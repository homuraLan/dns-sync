/**
 * DNS提供商管理模块
 * 处理DNS提供商的添加、删除和获取
 */

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// 解析域名列表，支持指定记录类型
function parseDomainList(domainsString) {
  if (!domainsString) return [];
  
  return domainsString.split('\n')
    .map(line => line.trim())
    .filter(line => line)
    .map(line => {
      // 支持格式：
      // example.com - 指定域名
      // example.com:A,AAAA - 指定域名的特定记录类型
      // *.example.com:CNAME - 通配符域名的特定记录类型
      // A - 所有域名的A记录
      // MX,TXT - 所有域名的MX和TXT记录
      
      if (line.includes(':')) {
        // 包含冒号，格式为 域名:记录类型
        const parts = line.split(':');
        const domain = parts[0].trim();
        const recordTypes = parts[1] ? 
          parts[1].split(',').map(type => type.trim().toUpperCase()).filter(type => type) : 
          [];
        
        return {
          domain,
          recordTypes: recordTypes.length > 0 ? recordTypes : null
        };
      } else {
        // 不包含冒号，检查是否为纯记录类型
        const supportedTypes = getSupportedRecordTypes();
        const types = line.split(',').map(type => type.trim().toUpperCase()).filter(type => type);
        
        if (types.length > 0 && types.every(type => supportedTypes.includes(type))) {
          // 全部都是有效的记录类型，表示所有域名的这些记录类型
          return {
            domain: '*', // 使用通配符表示所有域名
            recordTypes: types
          };
        } else {
          // 当作域名处理
          return {
            domain: line,
            recordTypes: null // null表示所有类型
          };
        }
      }
    });
}

// 格式化域名显示
function formatDomainDisplay(domains) {
  if (!domains || domains.length === 0) return '所有域名';
  
  return domains.map(item => {
    if (typeof item === 'string') {
      return item;
    }
    if (item.recordTypes && item.recordTypes.length > 0) {
      return `${item.domain}:${item.recordTypes.join(',')}`;
    }
    return item.domain;
  }).join(', ');
}

// 获取支持的DNS记录类型
export function getSupportedRecordTypes() {
  return [
    'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'PTR', 'SRV', 'CAA', 'HTTPS', 'SVCB'
  ];
}

// 获取所有DNS提供商
export async function getDNSProviders(storage) {
  if ('get' in storage) {
    // KV存储
    const data = await storage.get('dns_providers', { type: 'json' });
    return data || [];
  } else {
    // D1数据库
    try {
      await ensureProvidersTable(storage);
      const result = await storage.prepare('SELECT * FROM dns_providers').all();
      return result.results.map(row => JSON.parse(row.data));
    } catch (error) {
      console.error('获取DNS提供商失败:', error);
      return [];
    }
  }
}

// 获取单个DNS提供商（不包含敏感信息）
export async function getDNSProviderPublic(storage, id) {
  const providers = await getDNSProviders(storage);
  const provider = providers.find(p => p.id === id);
  
  if (!provider) {
    return null;
  }
  
  // 返回不含敏感信息的提供商数据
  const { apiKey, secretKey, ...publicData } = provider;
  return publicData;
}

// 获取单个DNS提供商（包含敏感信息）
export async function getDNSProviderWithCredentials(storage, id) {
  const providers = await getDNSProviders(storage);
  return providers.find(p => p.id === id) || null;
}

// 保存DNS提供商
export async function saveDNSProvider(storage, providerData) {
  const providers = await getDNSProviders(storage);
  
  // 处理域名列表
  if (providerData.domains && Array.isArray(providerData.domains)) {
    // 已经是数组，保持不变
  } else if (typeof providerData.domains === 'string') {
    // 如果是字符串，按行分割并解析域名和记录类型
    providerData.domains = parseDomainList(providerData.domains);
  } else {
    // 默认为空数组
    providerData.domains = [];
  }
  
  // 处理排除域名列表
  if (providerData.excludeDomains && Array.isArray(providerData.excludeDomains)) {
    // 已经是数组，保持不变
  } else if (typeof providerData.excludeDomains === 'string') {
    // 如果是字符串，按行分割并解析域名和记录类型
    providerData.excludeDomains = parseDomainList(providerData.excludeDomains);
  } else {
    // 默认为空数组
    providerData.excludeDomains = [];
  }
  

  
  // 设置显示用的domain字段
  if (providerData.domains && providerData.domains.length > 0) {
    providerData.domain = formatDomainDisplay(providerData.domains);
  } else {
    providerData.domain = '所有域名';
  }
  
  // 设置默认角色
  if (!providerData.role) {
    providerData.role = 'source';
  }
  
  // 确保sourceProviderIds是数组
  if (!providerData.sourceProviderIds) {
    providerData.sourceProviderIds = [];
  }
  
  // 如果提供了ID，则更新现有提供商
  if (providerData.id) {
    const index = providers.findIndex(p => p.id === providerData.id);
    if (index !== -1) {
      // 如果API密钥字段为空，保留原有值
      if (!providerData.apiKey) {
        providerData.apiKey = providers[index].apiKey;
      }
      if (!providerData.secretKey) {
        providerData.secretKey = providers[index].secretKey;
      }
      
      providers[index] = { ...providers[index], ...providerData };
    }
  } else {
    // 创建新提供商
    providerData.id = generateId();
    providers.push(providerData);
  }
  
  // 保存到存储
  if ('put' in storage) {
    // KV存储
    await storage.put('dns_providers', JSON.stringify(providers));
  } else {
    // D1数据库
    try {
      await ensureProvidersTable(storage);
      
      // 清空表并重新插入所有记录
      await storage.prepare('DELETE FROM dns_providers').run();
      
      for (const provider of providers) {
        await storage.prepare(`
          INSERT INTO dns_providers (id, data) 
          VALUES (?, ?)
        `).bind(provider.id, JSON.stringify(provider)).run();
      }
    } catch (error) {
      console.error('保存DNS提供商失败:', error);
    }
  }
  
  return { success: true, provider: providerData };
}

// 删除DNS提供商
export async function deleteDNSProvider(storage, id) {
  const providers = await getDNSProviders(storage);
  const filteredProviders = providers.filter(p => p.id !== id);
  
  // 保存到存储
  if ('put' in storage) {
    // KV存储
    await storage.put('dns_providers', JSON.stringify(filteredProviders));
  } else {
    // D1数据库
    try {
      await ensureProvidersTable(storage);
      
      // 删除指定记录
      await storage.prepare('DELETE FROM dns_providers WHERE id = ?').bind(id).run();
    } catch (error) {
      console.error('删除DNS提供商失败:', error);
    }
  }
  
  return true;
}

// 确保DNS提供商表存在
async function ensureProvidersTable(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS dns_providers (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `);
}

// 获取支持的DNS提供商类型列表
export function getSupportedProviderTypes() {
  return [
    { id: 'cloudflare', name: 'Cloudflare' },
    { id: 'aliyun', name: '阿里云' },
    { id: 'dnspod', name: 'DNSPod' },
    { id: 'godaddy', name: 'GoDaddy' },
    { id: 'namecheap', name: 'Namecheap' },
    { id: 'huaweicloud', name: '华为云' }
  ];
} 