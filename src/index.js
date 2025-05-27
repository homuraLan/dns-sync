import { Hono } from 'hono';
import { html } from 'hono/html';

// 导入DNS同步模块
import { syncDNSRecords, getSyncConfig, saveSyncConfig, getSyncHistory } from './dns/sync.js';
import { getDNSProviders, saveDNSProvider, deleteDNSProvider, getSupportedProviderTypes } from './dns/providers.js';

// 导入认证模块
import { createAuthMiddleware } from './auth/jwt.js';

// 导入UI组件
import { renderLoginPage } from './ui/login.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderProviderForm } from './ui/provider-form.js';
import { renderBanManagement } from './ui/ban-management.js';

const app = new Hono();

// 获取存储对象（KV或D1）
const getStorage = (env) => {
  // 优先使用D1数据库，如果不存在则使用KV
  return env.DB || env.KV;
};

// 初始化认证中间件
let authMiddleware = null;
const getAuthMiddleware = (env) => {
  if (!authMiddleware) {
    const storage = getStorage(env);
    const jwtSecret = env.JWT_SECRET || 'your-secret-key-change-in-production';
    authMiddleware = createAuthMiddleware(storage, jwtSecret);
  }
  return authMiddleware;
};

// 静态资源 - 移除serveStatic，使用简单的响应处理
app.get('/static/*', (c) => {
  const path = c.req.path.replace('/static/', '');
  // 简单处理，返回404
  return new Response('Not Found', { status: 404 });
  // 注意：如果需要真正提供静态文件，应该使用其他方式或将静态资源存储在KV中
});

// 登录页面
app.get('/', (c) => {
  const defaultUsername = c.env.USERNAME || 'admin';
  return c.html(renderLoginPage('', null, defaultUsername));
});

// 登录API
app.post('/api/login', async (c) => {
  const auth = getAuthMiddleware(c.env);
  return auth.checkIPBan(c, async () => {
    return auth.handleLogin(c);
  });
});

// 管理仪表盘 - 需要JWT认证
app.get('/admin', async (c) => {
  const auth = getAuthMiddleware(c.env);
  try {
    return await auth.jwtAuth(c, async () => {
  const storage = getStorage(c.env);
  const providers = await getDNSProviders(storage);
  const syncConfig = await getSyncConfig(storage);
  const syncHistory = await getSyncHistory(storage);
      const providerTypes = getSupportedProviderTypes();
      return c.html(renderDashboard(providers, syncConfig, syncHistory, providerTypes));
});
  } catch (error) {
    // 认证失败，重定向到登录页面
    return c.redirect('/');
  }
});

// IP封禁管理页面
app.get('/admin/ban-management', async (c) => {
  const auth = getAuthMiddleware(c.env);
  try {
    return await auth.jwtAuth(c, async () => {
      const bannedIPs = await auth.banManager.getBannedIPs();
      return c.html(renderBanManagement(bannedIPs));
    });
  } catch (error) {
    // 认证失败，重定向到登录页面
    return c.redirect('/');
  }
});

// API路由 - 需要JWT认证
app.post('/admin/api/providers', async (c) => {
  const auth = getAuthMiddleware(c.env);
  return auth.jwtAuth(c, async () => {
  const data = await c.req.json();
  const storage = getStorage(c.env);
    const result = await saveDNSProvider(storage, data);
    return c.json({ success: true, provider: result.provider });
  });
});

app.delete('/admin/api/providers/:id', async (c) => {
  const auth = getAuthMiddleware(c.env);
  return auth.jwtAuth(c, async () => {
  const id = c.req.param('id');
  const storage = getStorage(c.env);
  await deleteDNSProvider(storage, id);
  return c.json({ success: true });
  });
});

app.post('/admin/api/sync-config', async (c) => {
  const auth = getAuthMiddleware(c.env);
  return auth.jwtAuth(c, async () => {
  const data = await c.req.json();
  const storage = getStorage(c.env);
  await saveSyncConfig(storage, data);
  return c.json({ success: true });
  });
});

app.get('/admin/api/sync-history', async (c) => {
  const auth = getAuthMiddleware(c.env);
  return auth.jwtAuth(c, async () => {
  const storage = getStorage(c.env);
  const history = await getSyncHistory(storage);
  return c.json(history);
  });
});

app.delete('/admin/api/sync-history', async (c) => {
  const auth = getAuthMiddleware(c.env);
  return auth.jwtAuth(c, async () => {
    const storage = getStorage(c.env);
    
    // 清理同步历史
    if ('put' in storage) {
      // KV存储
      await storage.put('sync_history', JSON.stringify([]));
    } else {
      // D1数据库
      try {
        await storage.prepare('DELETE FROM sync_history').run();
      } catch (error) {
        console.error('清理同步历史失败:', error);
      }
    }
    
    return c.json({ success: true });
  });
});

app.post('/admin/api/sync', async (c) => {
  const auth = getAuthMiddleware(c.env);
  return auth.jwtAuth(c, async () => {
  try {
    const storage = getStorage(c.env);
    const result = await syncDNSRecords(storage);
    return c.json({ success: true, result });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
  });
});

// IP封禁管理API
app.post('/admin/api/ban-ip', async (c) => {
  const auth = getAuthMiddleware(c.env);
  return auth.jwtAuth(c, async () => {
    const { ip, reason } = await c.req.json();
    await auth.banManager.banIP(ip);
    const ban = await auth.banManager.isIPBanned(ip);
    return c.json({ success: true, ban });
  });
});

app.post('/admin/api/unban-ip', async (c) => {
  const auth = getAuthMiddleware(c.env);
  return auth.jwtAuth(c, async () => {
    const { ip } = await c.req.json();
    await auth.banManager.unbanIP(ip);
    return c.json({ success: true });
  });
});

// 添加/编辑DNS提供商表单
app.get('/admin/providers/new', (c) => {
  return c.html(renderProviderForm());
});

app.get('/admin/providers/:id', async (c) => {
  const id = c.req.param('id');
  const storage = getStorage(c.env);
  const providers = await getDNSProviders(storage);
  const provider = providers.find(p => p.id === id);
  return c.html(renderProviderForm(provider));
});

// 定时任务处理函数
export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
  
  // 定时触发的CRON表达式从环境变量获取，默认每6小时一次
  scheduled: {
    cron: (env) => env.CRON || "0 */6 * * *",
    async handler(event, env, ctx) {
      try {
        console.log('Running scheduled DNS sync task');
        const storage = getStorage(env);
        await syncDNSRecords(storage);
        console.log('DNS sync completed successfully');
      } catch (error) {
        console.error('DNS sync failed:', error);
      }
    }
  }
}; 