/**
 * JWT认证和IP封禁模块
 */

// 简单的JWT实现（用于Cloudflare Workers环境）
class SimpleJWT {
  constructor(secret) {
    this.secret = secret;
  }

  // Base64 URL编码
  base64UrlEncode(str) {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Base64 URL解码
  base64UrlDecode(str) {
    str += '='.repeat((4 - str.length % 4) % 4);
    return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  }

  // 生成JWT token
  async sign(payload, expiresIn = '24h') {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.parseExpiration(expiresIn);

    const jwtPayload = {
      ...payload,
      iat: now,
      exp: exp
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(jwtPayload));

    const signature = await this.createSignature(`${encodedHeader}.${encodedPayload}`);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  // 验证JWT token
  async verify(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const [encodedHeader, encodedPayload, signature] = parts;
      
      // 验证签名
      const expectedSignature = await this.createSignature(`${encodedHeader}.${encodedPayload}`);
      if (signature !== expectedSignature) {
        throw new Error('Invalid signature');
      }

      // 解析payload
      const payload = JSON.parse(this.base64UrlDecode(encodedPayload));
      
      // 检查过期时间
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        throw new Error('Token expired');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid token: ' + error.message);
    }
  }

  // 创建签名
  async createSignature(data) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(data)
    );

    return this.base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  }

  // 解析过期时间
  parseExpiration(expiresIn) {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 24 * 60 * 60; // 默认24小时

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 24 * 60 * 60;
    }
  }
}

// IP封禁管理
export class IPBanManager {
  constructor(storage) {
    this.storage = storage;
    this.maxAttempts = 5;
    this.banDuration = 24 * 60 * 60 * 1000; // 24小时
  }

  // 获取IP尝试记录
  async getAttempts(ip) {
    const key = `login_attempts_${ip}`;
    if ('get' in this.storage) {
      const data = await this.storage.get(key, { type: 'json' });
      return data || { count: 0, lastAttempt: 0 };
    } else {
      try {
        const result = await this.storage.prepare('SELECT data FROM ip_attempts WHERE ip = ?').bind(ip).first();
        return result ? JSON.parse(result.data) : { count: 0, lastAttempt: 0 };
      } catch (error) {
        return { count: 0, lastAttempt: 0 };
      }
    }
  }

  // 记录失败尝试
  async recordFailedAttempt(ip) {
    const attempts = await this.getAttempts(ip);
    attempts.count += 1;
    attempts.lastAttempt = Date.now();

    const key = `login_attempts_${ip}`;
    if ('put' in this.storage) {
      await this.storage.put(key, JSON.stringify(attempts));
    } else {
      try {
        await this.ensureAttemptsTable();
        await this.storage.prepare(`
          INSERT OR REPLACE INTO ip_attempts (ip, data) VALUES (?, ?)
        `).bind(ip, JSON.stringify(attempts)).run();
      } catch (error) {
        console.error('记录失败尝试失败:', error);
      }
    }

    // 如果超过最大尝试次数，添加到封禁列表
    if (attempts.count >= this.maxAttempts) {
      await this.banIP(ip);
    }

    return attempts;
  }

  // 清除IP尝试记录
  async clearAttempts(ip) {
    const key = `login_attempts_${ip}`;
    if ('delete' in this.storage) {
      await this.storage.delete(key);
    } else {
      try {
        await this.storage.prepare('DELETE FROM ip_attempts WHERE ip = ?').bind(ip).run();
      } catch (error) {
        console.error('清除尝试记录失败:', error);
      }
    }
  }

  // 封禁IP
  async banIP(ip) {
    const banData = {
      ip,
      bannedAt: Date.now(),
      expiresAt: Date.now() + this.banDuration,
      reason: '登录失败次数过多'
    };

    if ('put' in this.storage) {
      const bans = await this.getBannedIPs();
      bans[ip] = banData;
      await this.storage.put('banned_ips', JSON.stringify(bans));
    } else {
      try {
        await this.ensureBansTable();
        await this.storage.prepare(`
          INSERT OR REPLACE INTO ip_bans (ip, data) VALUES (?, ?)
        `).bind(ip, JSON.stringify(banData)).run();
      } catch (error) {
        console.error('封禁IP失败:', error);
      }
    }
  }

  // 检查IP是否被封禁
  async isIPBanned(ip) {
    if ('get' in this.storage) {
      const bans = await this.getBannedIPs();
      const ban = bans[ip];
      if (ban && ban.expiresAt > Date.now()) {
        return ban;
      }
      // 清除过期的封禁
      if (ban && ban.expiresAt <= Date.now()) {
        delete bans[ip];
        await this.storage.put('banned_ips', JSON.stringify(bans));
      }
      return null;
    } else {
      try {
        const result = await this.storage.prepare('SELECT data FROM ip_bans WHERE ip = ?').bind(ip).first();
        if (result) {
          const ban = JSON.parse(result.data);
          if (ban.expiresAt > Date.now()) {
            return ban;
          }
          // 清除过期的封禁
          await this.storage.prepare('DELETE FROM ip_bans WHERE ip = ?').bind(ip).run();
        }
        return null;
      } catch (error) {
        return null;
      }
    }
  }

  // 获取所有被封禁的IP
  async getBannedIPs() {
    if ('get' in this.storage) {
      const data = await this.storage.get('banned_ips', { type: 'json' });
      return data || {};
    } else {
      try {
        await this.ensureBansTable();
        const result = await this.storage.prepare('SELECT ip, data FROM ip_bans').all();
        const bans = {};
        result.results.forEach(row => {
          const ban = JSON.parse(row.data);
          if (ban.expiresAt > Date.now()) {
            bans[row.ip] = ban;
          }
        });
        return bans;
      } catch (error) {
        return {};
      }
    }
  }

  // 解除IP封禁
  async unbanIP(ip) {
    if ('get' in this.storage) {
      const bans = await this.getBannedIPs();
      delete bans[ip];
      await this.storage.put('banned_ips', JSON.stringify(bans));
    } else {
      try {
        await this.storage.prepare('DELETE FROM ip_bans WHERE ip = ?').bind(ip).run();
      } catch (error) {
        console.error('解除封禁失败:', error);
      }
    }

    // 同时清除尝试记录
    await this.clearAttempts(ip);
  }

  // 确保数据库表存在
  async ensureAttemptsTable() {
    await this.storage.exec(`
      CREATE TABLE IF NOT EXISTS ip_attempts (
        ip TEXT PRIMARY KEY,
        data TEXT NOT NULL
      )
    `);
  }

  async ensureBansTable() {
    await this.storage.exec(`
      CREATE TABLE IF NOT EXISTS ip_bans (
        ip TEXT PRIMARY KEY,
        data TEXT NOT NULL
      )
    `);
  }
}

// 认证中间件
export function createAuthMiddleware(storage, jwtSecret) {
  const jwt = new SimpleJWT(jwtSecret);
  const banManager = new IPBanManager(storage);

  return {
    jwt,
    banManager,

    // JWT认证中间件
    async jwtAuth(c, next) {
      try {
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.replace('Bearer ', '') || 
                     c.req.query('token') || 
                     c.req.cookie('auth_token');

        if (!token) {
          // 检查是否是API请求
          if (c.req.path.startsWith('/admin/api/')) {
            return c.json({ error: '未提供认证token' }, 401);
          }
          throw new Error('未提供认证token');
        }

        const payload = await jwt.verify(token);
        c.set('user', payload);
        return await next();
      } catch (error) {
        // 检查是否是API请求
        if (c.req.path.startsWith('/admin/api/')) {
          return c.json({ error: '认证失败: ' + error.message }, 401);
        }
        throw error;
      }
    },

    // IP封禁检查中间件
    async checkIPBan(c, next) {
      const ip = c.req.header('CF-Connecting-IP') || 
                c.req.header('X-Forwarded-For') || 
                c.req.header('X-Real-IP') || 
                '127.0.0.1';

      const ban = await banManager.isIPBanned(ip);
      if (ban) {
        const remainingTime = Math.ceil((ban.expiresAt - Date.now()) / (60 * 1000));
        return c.json({ 
          error: `IP已被封禁，原因: ${ban.reason}，剩余时间: ${remainingTime}分钟` 
        }, 403);
      }

      c.set('clientIP', ip);
      return await next();
    },

    // 登录处理
    async handleLogin(c) {
      const ip = c.get('clientIP');
      const { username, password } = await c.req.json();

      // 验证用户名和密码
      const correctUsername = c.env.USERNAME || 'admin';
      const correctPassword = c.env.PASSWORD || 'changeme';
      if (username !== correctUsername || password !== correctPassword) {
        await banManager.recordFailedAttempt(ip);
        const attempts = await banManager.getAttempts(ip);
        const remaining = Math.max(0, banManager.maxAttempts - attempts.count);
        
        return c.json({ 
          error: '用户名或密码错误',
          remainingAttempts: remaining
        }, 401);
      }

      // 登录成功，清除失败记录
      await banManager.clearAttempts(ip);

      // 生成JWT token
      const token = await jwt.sign({
        username: correctUsername,
        ip: ip,
        loginTime: Date.now()
      }, '24h');

      return c.json({
        success: true,
        token,
        user: { username: correctUsername }
      });
    }
  };
}