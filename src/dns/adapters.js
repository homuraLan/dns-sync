/**
 * DNS适配器模块
 * 处理不同DNS提供商的API调用
 */

// 标准化DNS记录格式
const normalizeRecord = (record, providerType) => {
  // 根据不同提供商格式进行标准化
  switch (providerType) {
    case 'cloudflare':
      return {
        id: record.id,
        type: record.type,
        name: record.name,
        content: record.content,
        ttl: record.ttl,
        proxied: record.proxied || false
      };
    case 'aliyun':
      return {
        id: record.RecordId,
        type: record.Type,
        name: record.RR,
        content: record.Value,
        ttl: record.TTL,
        proxied: false
      };
    case 'dnspod':
      return {
        id: record.id,
        type: record.type,
        name: record.name,
        content: record.value,
        ttl: record.ttl,
        proxied: false
      };
    case 'godaddy':
      return {
        id: `${record.type}-${record.name}`,
        type: record.type,
        name: record.name,
        content: record.data,
        ttl: record.ttl,
        proxied: false
      };
    case 'namecheap':
      return {
        id: `${record.Type}-${record.Host}`,
        type: record.Type,
        name: record.Host,
        content: record.Value,
        ttl: record.TTL || 1800,
        proxied: false
      };
    case 'huaweicloud':
      return {
        id: record.id,
        type: record.type,
        name: record.name,
        content: record.records[0],
        ttl: record.ttl,
        proxied: false
      };
    default:
      return record;
  }
};

// 获取DNS记录
export async function fetchDNSRecords(provider) {
  const { type, domain, apiKey, secretKey } = provider;
  
  try {
    switch (type) {
      case 'cloudflare':
        return await fetchCloudflareRecords(domain, apiKey);
      case 'aliyun':
        return await fetchAliyunRecords(domain, apiKey, secretKey);
      case 'dnspod':
        return await fetchDNSPodRecords(domain, apiKey);
      case 'godaddy':
        return await fetchGoDaddyRecords(domain, apiKey, secretKey);
      case 'namecheap':
        return await fetchNamecheapRecords(domain, apiKey, secretKey);
      case 'huaweicloud':
        return await fetchHuaweiCloudRecords(domain, apiKey, secretKey);
      case 'custom':
        return await fetchCustomRecords(provider);
      default:
        throw new Error(`不支持的DNS提供商类型: ${type}`);
    }
  } catch (error) {
    console.error(`获取${type}的DNS记录失败:`, error);
    throw new Error(`获取DNS记录失败: ${error.message}`);
  }
}

// 更新DNS记录
export async function updateDNSRecords(provider, records, options = {}) {
  const { type, domain, apiKey, secretKey } = provider;
  
  try {
    switch (type) {
      case 'cloudflare':
        return await updateCloudflareRecords(domain, apiKey, records, options);
      case 'aliyun':
        return await updateAliyunRecords(domain, apiKey, secretKey, records, options);
      case 'dnspod':
        return await updateDNSPodRecords(domain, apiKey, records, options);
      case 'godaddy':
        return await updateGoDaddyRecords(domain, apiKey, secretKey, records, options);
      case 'namecheap':
        return await updateNamecheapRecords(domain, apiKey, secretKey, records, options);
      case 'huaweicloud':
        return await updateHuaweiCloudRecords(domain, apiKey, secretKey, records, options);
      case 'custom':
        return await updateCustomRecords(provider, records, options);
      default:
        throw new Error(`不支持的DNS提供商类型: ${type}`);
    }
  } catch (error) {
    console.error(`更新${type}的DNS记录失败:`, error);
    throw new Error(`更新DNS记录失败: ${error.message}`);
  }
}

// Cloudflare API
async function fetchCloudflareRecords(domain, apiKey) {
  const zoneId = await getCloudflareZoneId(domain, apiKey);
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Cloudflare API错误: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.result.map(record => normalizeRecord(record, 'cloudflare'));
}

async function getCloudflareZoneId(domain, apiKey) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Cloudflare API错误: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  if (data.result.length === 0) {
    throw new Error(`在Cloudflare中找不到域名: ${domain}`);
  }
  
  return data.result[0].id;
}

async function updateCloudflareRecords(domain, apiKey, records, options) {
  const zoneId = await getCloudflareZoneId(domain, apiKey);
  
  // 获取现有记录
  const existingRecords = await fetchCloudflareRecords(domain, apiKey);
  
  // 处理每条记录
  for (const record of records) {
    // 查找匹配的现有记录
    const existingRecord = existingRecords.find(r => 
      r.type === record.type && r.name === record.name
    );
    
    if (existingRecord) {
      // 更新记录
      await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existingRecord.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl,
          proxied: record.proxied
        })
      });
    } else {
      // 创建新记录
      await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl,
          proxied: record.proxied
        })
      });
    }
  }
  
  return { updated: records.length };
}

// 阿里云API
async function fetchAliyunRecords(domain, accessKeyId, accessKeySecret) {
  // 这里实现阿里云DNS API调用
  // 实际实现需要使用阿里云SDK或自行构建签名
  throw new Error('阿里云DNS API尚未实现');
}

async function updateAliyunRecords(domain, accessKeyId, accessKeySecret, records, options) {
  throw new Error('阿里云DNS API尚未实现');
}

// DNSPod API
async function fetchDNSPodRecords(domain, apiKey) {
  // 这里实现DNSPod API调用
  throw new Error('DNSPod API尚未实现');
}

async function updateDNSPodRecords(domain, apiKey, records, options) {
  throw new Error('DNSPod API尚未实现');
}

// GoDaddy API
async function fetchGoDaddyRecords(domain, apiKey, apiSecret) {
  const response = await fetch(`https://api.godaddy.com/v1/domains/${domain}/records`, {
    headers: {
      'Authorization': `sso-key ${apiKey}:${apiSecret}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`GoDaddy API错误: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.map(record => normalizeRecord(record, 'godaddy'));
}

async function updateGoDaddyRecords(domain, apiKey, apiSecret, records, options) {
  // 按记录类型分组
  const recordsByType = {};
  
  for (const record of records) {
    if (!recordsByType[record.type]) {
      recordsByType[record.type] = [];
    }
    recordsByType[record.type].push({
      type: record.type,
      name: record.name,
      data: record.content,
      ttl: record.ttl
    });
  }
  
  // 更新每种类型的记录
  for (const [type, typeRecords] of Object.entries(recordsByType)) {
    await fetch(`https://api.godaddy.com/v1/domains/${domain}/records/${type}`, {
      method: 'PUT',
      headers: {
        'Authorization': `sso-key ${apiKey}:${apiSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(typeRecords)
    });
  }
  
  return { updated: records.length };
}

// Namecheap API
async function fetchNamecheapRecords(domain, apiKey, apiSecret) {
  // 这里实现Namecheap API调用
  throw new Error('Namecheap API尚未实现');
}

async function updateNamecheapRecords(domain, apiKey, apiSecret, records, options) {
  throw new Error('Namecheap API尚未实现');
}

// 华为云API
async function fetchHuaweiCloudRecords(domain, apiKey, secretKey) {
  // 获取zone_id
  const zoneId = await getHuaweiCloudZoneId(domain, apiKey, secretKey);
  
  // 获取记录列表
  const response = await fetch(`https://dns.myhuaweicloud.com/v2/zones/${zoneId}/recordsets`, {
    headers: {
      'X-Auth-Token': apiKey,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`华为云API错误: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.recordsets.map(record => normalizeRecord(record, 'huaweicloud'));
}

async function getHuaweiCloudZoneId(domain, apiKey, secretKey) {
  const response = await fetch(`https://dns.myhuaweicloud.com/v2/zones?name=${domain}`, {
    headers: {
      'X-Auth-Token': apiKey,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`华为云API错误: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  if (data.zones.length === 0) {
    throw new Error(`在华为云中找不到域名: ${domain}`);
  }
  
  return data.zones[0].id;
}

async function updateHuaweiCloudRecords(domain, apiKey, secretKey, records, options) {
  const zoneId = await getHuaweiCloudZoneId(domain, apiKey, secretKey);
  
  // 获取现有记录
  const existingRecords = await fetchHuaweiCloudRecords(domain, apiKey, secretKey);
  
  // 处理每条记录
  for (const record of records) {
    // 查找匹配的现有记录
    const existingRecord = existingRecords.find(r => 
      r.type === record.type && r.name === record.name
    );
    
    if (existingRecord) {
      // 更新记录
      await fetch(`https://dns.myhuaweicloud.com/v2/zones/${zoneId}/recordsets/${existingRecord.id}`, {
        method: 'PUT',
        headers: {
          'X-Auth-Token': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: record.name,
          type: record.type,
          ttl: record.ttl,
          records: [record.content]
        })
      });
    } else {
      // 创建新记录
      await fetch(`https://dns.myhuaweicloud.com/v2/zones/${zoneId}/recordsets`, {
        method: 'POST',
        headers: {
          'X-Auth-Token': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: record.name,
          type: record.type,
          ttl: record.ttl,
          records: [record.content]
        })
      });
    }
  }
  
  return { updated: records.length };
}

// 自定义API
async function fetchCustomRecords(provider) {
  const { apiEndpoint, apiKey, domain } = provider;
  
  const response = await fetch(`${apiEndpoint}/records?domain=${domain}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`自定义API错误: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.records || data;
}

async function updateCustomRecords(provider, records, options) {
  const { apiEndpoint, apiKey, domain } = provider;
  
  const response = await fetch(`${apiEndpoint}/sync`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      domain,
      records,
      options
    })
  });
  
  if (!response.ok) {
    throw new Error(`自定义API错误: ${response.status} ${response.statusText}`);
  }
  
  const result = await response.json();
  return result;
} 