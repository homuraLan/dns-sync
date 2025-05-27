/**
 * DNS适配器模块
 * 处理不同DNS提供商API的适配
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
        name: record.name.replace(/\.$/, ''), // 移除末尾的点
        content: Array.isArray(record.records) ? record.records[0] : record.records,
        ttl: record.ttl,
        proxied: false
      };
    default:
      return record;
  }
};

// 获取DNS记录
export async function fetchDNSRecords(provider) {
  try {
    // 根据提供商类型选择适配器
    let records;
    switch (provider.type) {
      case 'cloudflare':
        records = await fetchCloudflareRecords(provider);
        break;
      case 'aliyun':
        records = await fetchAliyunRecords(provider);
        break;
      case 'dnspod':
        records = await fetchDNSPodRecords(provider);
        break;
      case 'godaddy':
        records = await fetchGoDaddyRecords(provider);
        break;
      case 'namecheap':
        records = await fetchNamecheapRecords(provider);
        break;
      case 'huaweicloud':
        records = await fetchHuaweiCloudRecords(provider);
        break;
      case 'custom':
        records = await fetchCustomRecords(provider);
        break;
      default:
        throw new Error(`不支持的DNS提供商类型: ${provider.type}`);
    }
    
    // 根据域名配置过滤记录类型
    return filterRecordsByDomainsAndTypes(records, provider.domains);
  } catch (error) {
    console.error(`获取${provider.name}的DNS记录失败:`, error);
    throw new Error(`获取${provider.name}的DNS记录失败: ${error.message}`);
  }
}

// 更新DNS记录
export async function updateDNSRecords(provider, records, options = {}) {
  try {
    // 过滤记录，只保留匹配域名的记录
    const filteredRecords = filterRecordsByDomains(records, provider.domains);
    
    // 根据提供商类型选择适配器
    switch (provider.type) {
      case 'cloudflare':
        return await updateCloudflareRecords(provider, filteredRecords, options);
      case 'aliyun':
        return await updateAliyunRecords(provider, filteredRecords, options);
      case 'dnspod':
        return await updateDNSPodRecords(provider, filteredRecords, options);
      case 'godaddy':
        return await updateGoDaddyRecords(provider, filteredRecords, options);
      case 'namecheap':
        return await updateNamecheapRecords(provider, filteredRecords, options);
      case 'huaweicloud':
        return await updateHuaweiCloudRecords(provider, filteredRecords, options);
      case 'custom':
        return await updateCustomRecords(provider, filteredRecords, options);
      default:
        throw new Error(`不支持的DNS提供商类型: ${provider.type}`);
    }
  } catch (error) {
    console.error(`更新${provider.name}的DNS记录失败:`, error);
    throw new Error(`更新${provider.name}的DNS记录失败: ${error.message}`);
  }
}

// 根据域名列表过滤记录
function filterRecordsByDomains(records, domains) {
  // 如果没有指定域名，返回所有记录
  if (!domains || domains.length === 0) {
    return records;
  }
  
  // 将通配符模式转换为正则表达式
  const patterns = domains.map(domain => {
    if (domain.startsWith('*.')) {
      // 将 *.example.com 转换为正则表达式 /^.*\.example\.com$/i
      const escaped = domain.substring(2).replace(/\./g, '\\.');
      return new RegExp(`^.*\\.${escaped}$`, 'i');
    } else {
      // 将 example.com 转换为正则表达式 /^example\.com$/i
      const escaped = domain.replace(/\./g, '\\.');
      return new RegExp(`^${escaped}$`, 'i');
    }
  });
  
  // 过滤记录
  return records.filter(record => {
    return patterns.some(pattern => pattern.test(record.zone_name) || pattern.test(record.name));
  });
}

// 根据域名和记录类型过滤记录
function filterRecordsByDomainsAndTypes(records, domains) {
  // 如果没有指定域名，返回所有记录
  if (!domains || domains.length === 0) {
    return records;
  }
  
  return records.filter(record => {
    return domains.some(domainConfig => {
      const domain = typeof domainConfig === 'string' ? domainConfig : domainConfig.domain;
      const recordTypes = typeof domainConfig === 'string' ? null : domainConfig.recordTypes;
      
      // 检查域名匹配
      let domainMatches = false;
      if (domain === '*') {
        // 通配符匹配所有域名
        domainMatches = true;
      } else if (domain.startsWith('*.')) {
        // 子域名通配符
        const escaped = domain.substring(2).replace(/\./g, '\\.');
        const pattern = new RegExp(`^.*\\.${escaped}$`, 'i');
        domainMatches = pattern.test(record.zone_name) || pattern.test(record.name);
      } else {
        // 精确域名匹配
        const escaped = domain.replace(/\./g, '\\.');
        const pattern = new RegExp(`^${escaped}$`, 'i');
        domainMatches = pattern.test(record.zone_name) || pattern.test(record.name);
      }
      
      // 检查记录类型匹配
      let typeMatches = true;
      if (recordTypes && recordTypes.length > 0) {
        typeMatches = recordTypes.includes(record.type);
      }
      
      return domainMatches && typeMatches;
    });
  });
}

// Cloudflare适配器
async function fetchCloudflareRecords(provider) {
  console.log(`获取Cloudflare记录: ${provider.name}`);
  
  // 获取所有域名的记录
  let allRecords = [];
  
  // 如果没有指定域名，尝试获取账户下所有域名
  const domains = provider.domains && provider.domains.length > 0 
    ? provider.domains
        .filter(d => {
          const domain = typeof d === 'string' ? d : d.domain;
          return domain && !domain.startsWith('*.') && domain !== '*';
        })
        .map(d => typeof d === 'string' ? d : d.domain)
    : [];
  
  try {
    // 如果没有指定域名，先获取账户下所有域名
    if (domains.length === 0) {
      const zonesResponse = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', {
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!zonesResponse.ok) {
        throw new Error(`Cloudflare API错误: ${zonesResponse.status} ${zonesResponse.statusText}`);
      }
      
      const zonesData = await zonesResponse.json();
      if (!zonesData.success) {
        throw new Error(`Cloudflare API错误: ${zonesData.errors[0].message}`);
      }
      
      // 获取每个域名的记录
      for (const zone of zonesData.result) {
        const zoneRecords = await getCloudflareZoneRecords(zone.id, provider.apiKey);
        allRecords = [...allRecords, ...zoneRecords.map(record => ({
          ...normalizeRecord(record, 'cloudflare'),
          zone_name: zone.name
        }))];
      }
    } else {
      // 获取指定域名的记录
      for (const domain of domains) {
        // 获取域名的zone ID
        const zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
          headers: {
            'Authorization': `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!zoneResponse.ok) {
          console.error(`获取域名${domain}的zone ID失败: ${zoneResponse.status} ${zoneResponse.statusText}`);
          continue;
        }
        
        const zoneData = await zoneResponse.json();
        if (!zoneData.success || zoneData.result.length === 0) {
          console.error(`域名${domain}在Cloudflare中不存在`);
          continue;
        }
        
        const zoneId = zoneData.result[0].id;
        const zoneName = zoneData.result[0].name;
        
        // 获取域名的DNS记录
        const zoneRecords = await getCloudflareZoneRecords(zoneId, provider.apiKey);
        allRecords = [...allRecords, ...zoneRecords.map(record => ({
          ...normalizeRecord(record, 'cloudflare'),
          zone_name: zoneName
        }))];
      }
    }
    
    return allRecords;
  } catch (error) {
    console.error('获取Cloudflare记录失败:', error);
    throw error;
  }
}

// 获取Cloudflare域名的DNS记录
async function getCloudflareZoneRecords(zoneId, apiKey) {
  const records = [];
  let page = 1;
  let hasMorePages = true;
  
  while (hasMorePages) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=100&page=${page}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Cloudflare API错误: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(`Cloudflare API错误: ${data.errors[0].message}`);
    }
    
    records.push(...data.result);
    
    // 检查是否有更多页
    if (data.result.length < 100) {
      hasMorePages = false;
    } else {
      page++;
    }
  }
  
  return records;
}

async function updateCloudflareRecords(provider, records, options) {
  console.log(`更新Cloudflare记录: ${provider.name}, 记录数: ${records.length}`);
  
  // 按域名分组记录
  const recordsByDomain = {};
  for (const record of records) {
    if (!recordsByDomain[record.zone_name]) {
      recordsByDomain[record.zone_name] = [];
    }
    recordsByDomain[record.zone_name].push(record);
  }
  
  let updated = 0;
  let added = 0;
  let deleted = 0;
  
  // 处理每个域名的记录
  for (const [domain, domainRecords] of Object.entries(recordsByDomain)) {
    try {
      // 获取域名的zone ID
      const zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!zoneResponse.ok) {
        console.error(`获取域名${domain}的zone ID失败: ${zoneResponse.status} ${zoneResponse.statusText}`);
        continue;
      }
      
      const zoneData = await zoneResponse.json();
      if (!zoneData.success || zoneData.result.length === 0) {
        console.error(`域名${domain}在Cloudflare中不存在`);
        continue;
      }
      
      const zoneId = zoneData.result[0].id;
      
      // 获取当前记录
      const currentRecords = await getCloudflareZoneRecords(zoneId, provider.apiKey);
      
      // 更新或创建记录
      for (const record of domainRecords) {
        // 查找匹配的现有记录
        const existingRecord = currentRecords.find(r => 
          r.type === record.type && r.name === record.name
        );
        
        if (existingRecord) {
          // 检查记录是否需要更新
          if (existingRecord.content !== record.content || 
              existingRecord.ttl !== record.ttl ||
              existingRecord.proxied !== record.proxied) {
            
            // 更新记录
            const updateResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existingRecord.id}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                type: record.type,
                name: record.name,
                content: record.content,
                ttl: record.ttl,
                proxied: record.proxied || false
              })
            });
            
            if (updateResponse.ok) {
              updated++;
            } else {
              console.error(`更新记录失败: ${record.name} ${record.type}`);
            }
          }
        } else if (options.overwriteAll !== false) {
          // 创建新记录
          const createResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${provider.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              type: record.type,
              name: record.name,
              content: record.content,
              ttl: record.ttl || 1,
              proxied: record.proxied || false
            })
          });
          
          if (createResponse.ok) {
            added++;
          } else {
            console.error(`创建记录失败: ${record.name} ${record.type}`);
          }
        }
      }
      
      // 删除多余记录
      if (options.deleteExtra) {
        for (const existingRecord of currentRecords) {
          const shouldKeep = domainRecords.some(r => 
            r.type === existingRecord.type && r.name === existingRecord.name
          );
          
          if (!shouldKeep) {
            const deleteResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existingRecord.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${provider.apiKey}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (deleteResponse.ok) {
              deleted++;
            } else {
              console.error(`删除记录失败: ${existingRecord.name} ${existingRecord.type}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`处理域名${domain}时出错:`, error);
    }
  }
  
  return { updated, added, deleted };
}

// 阿里云适配器
async function fetchAliyunRecords(provider) {
  console.log(`获取阿里云记录: ${provider.name}`);
  
  // 阿里云API需要签名，这里使用一个简化的实现
  // 实际生产环境应使用阿里云SDK或更完整的签名实现
  
  // 获取所有域名的记录
  let allRecords = [];
  
  // 如果没有指定域名，尝试获取账户下所有域名
  const domains = provider.domains && provider.domains.length > 0 
    ? provider.domains
        .filter(d => {
          const domain = typeof d === 'string' ? d : d.domain;
          return domain && !domain.startsWith('*.') && domain !== '*';
        })
        .map(d => typeof d === 'string' ? d : d.domain)
    : [];
    
  try {
    if (domains.length === 0) {
      // 获取账户下所有域名
      const timestamp = new Date().toISOString();
      const domainListUrl = `https://alidns.aliyuncs.com/?Action=DescribeDomains&AccessKeyId=${encodeURIComponent(provider.apiKey)}&Timestamp=${encodeURIComponent(timestamp)}&SignatureVersion=1.0&SignatureMethod=HMAC-SHA1&Format=JSON`;
      
      // 注意：实际使用时需要正确签名请求
      // 这里仅作为示例，实际应使用阿里云SDK
      const domainsResponse = await fetch(domainListUrl, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!domainsResponse.ok) {
        throw new Error(`阿里云API错误: ${domainsResponse.status} ${domainsResponse.statusText}`);
      }
      
      const domainsData = await domainsResponse.json();
      
      // 获取每个域名的记录
      for (const domain of domainsData.Domains.Domain) {
        const domainRecords = await getAliyunDomainRecords(domain.DomainName, provider.apiKey, provider.secretKey);
        allRecords = [...allRecords, ...domainRecords];
      }
    } else {
      // 获取指定域名的记录
      for (const domain of domains) {
        try {
          const domainRecords = await getAliyunDomainRecords(domain, provider.apiKey, provider.secretKey);
          allRecords = [...allRecords, ...domainRecords];
        } catch (error) {
          console.error(`获取域名${domain}的记录失败:`, error);
        }
      }
    }
    
    return allRecords;
  } catch (error) {
    console.error('获取阿里云记录失败:', error);
    throw error;
  }
}

// 获取阿里云域名的DNS记录
async function getAliyunDomainRecords(domain, accessKeyId, accessKeySecret) {
  // 注意：实际使用时应使用阿里云SDK或正确实现签名
  // 这里仅作为示例框架
  
  const timestamp = new Date().toISOString();
  const recordsUrl = `https://alidns.aliyuncs.com/?Action=DescribeDomainRecords&DomainName=${encodeURIComponent(domain)}&AccessKeyId=${encodeURIComponent(accessKeyId)}&Timestamp=${encodeURIComponent(timestamp)}&SignatureVersion=1.0&SignatureMethod=HMAC-SHA1&Format=JSON`;
  
  try {
    // 实际使用时需要正确签名请求
    const response = await fetch(recordsUrl, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`阿里云API错误: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // 标准化记录格式
    return data.DomainRecords.Record.map(record => ({
      ...normalizeRecord(record, 'aliyun'),
      zone_name: domain
    }));
  } catch (error) {
    console.error(`获取阿里云域名${domain}记录失败:`, error);
    throw error;
  }
}

async function updateAliyunRecords(provider, records, options) {
  console.log(`更新阿里云记录: ${provider.name}, 记录数: ${records.length}`);
  
  // 按域名分组记录
  const recordsByDomain = {};
  for (const record of records) {
    if (!recordsByDomain[record.zone_name]) {
      recordsByDomain[record.zone_name] = [];
    }
    recordsByDomain[record.zone_name].push(record);
  }
  
  let updated = 0;
  let added = 0;
  let deleted = 0;
  
  // 处理每个域名的记录
  for (const [domain, domainRecords] of Object.entries(recordsByDomain)) {
    try {
      // 获取当前记录
      const currentRecords = await getAliyunDomainRecords(domain, provider.apiKey, provider.secretKey);
      
      // 更新或创建记录
      for (const record of domainRecords) {
        // 查找匹配的现有记录
        const existingRecord = currentRecords.find(r => 
          r.type === record.type && r.name === record.name
        );
        
        if (existingRecord) {
          // 检查记录是否需要更新
          if (existingRecord.content !== record.content || existingRecord.ttl !== record.ttl) {
            // 更新记录
            const timestamp = new Date().toISOString();
            const updateUrl = `https://alidns.aliyuncs.com/?Action=UpdateDomainRecord&RecordId=${existingRecord.id}&RR=${encodeURIComponent(record.name.replace(`.${domain}`, '') || '@')}&Type=${record.type}&Value=${encodeURIComponent(record.content)}&TTL=${record.ttl || 600}&AccessKeyId=${encodeURIComponent(provider.apiKey)}&Timestamp=${encodeURIComponent(timestamp)}&SignatureVersion=1.0&SignatureMethod=HMAC-SHA1&Format=JSON`;
            
            // 实际使用时需要正确签名请求
            const updateResponse = await fetch(updateUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            if (updateResponse.ok) {
              updated++;
            } else {
              console.error(`更新记录失败: ${record.name} ${record.type}`);
            }
          }
        } else if (options.overwriteAll !== false) {
          // 创建新记录
          const timestamp = new Date().toISOString();
          const createUrl = `https://alidns.aliyuncs.com/?Action=AddDomainRecord&DomainName=${encodeURIComponent(domain)}&RR=${encodeURIComponent(record.name.replace(`.${domain}`, '') || '@')}&Type=${record.type}&Value=${encodeURIComponent(record.content)}&TTL=${record.ttl || 600}&AccessKeyId=${encodeURIComponent(provider.apiKey)}&Timestamp=${encodeURIComponent(timestamp)}&SignatureVersion=1.0&SignatureMethod=HMAC-SHA1&Format=JSON`;
          
          // 实际使用时需要正确签名请求
          const createResponse = await fetch(createUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (createResponse.ok) {
            added++;
          } else {
            console.error(`创建记录失败: ${record.name} ${record.type}`);
          }
        }
      }
      
      // 删除多余记录
      if (options.deleteExtra) {
        for (const existingRecord of currentRecords) {
          const shouldKeep = domainRecords.some(r => 
            r.type === existingRecord.type && r.name === existingRecord.name
          );
          
          if (!shouldKeep) {
            const timestamp = new Date().toISOString();
            const deleteUrl = `https://alidns.aliyuncs.com/?Action=DeleteDomainRecord&RecordId=${existingRecord.id}&AccessKeyId=${encodeURIComponent(provider.apiKey)}&Timestamp=${encodeURIComponent(timestamp)}&SignatureVersion=1.0&SignatureMethod=HMAC-SHA1&Format=JSON`;
            
            // 实际使用时需要正确签名请求
            const deleteResponse = await fetch(deleteUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            if (deleteResponse.ok) {
              deleted++;
            } else {
              console.error(`删除记录失败: ${existingRecord.name} ${existingRecord.type}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`处理域名${domain}时出错:`, error);
    }
  }
  
  return { updated, added, deleted };
}

// DNSPod适配器
async function fetchDNSPodRecords(provider) {
  console.log(`获取DNSPod记录: ${provider.name}`);
  
  // 获取所有域名的记录
  let allRecords = [];
  
  // 如果没有指定域名，尝试获取账户下所有域名
  const domains = provider.domains && provider.domains.length > 0 
    ? provider.domains
        .filter(d => {
          const domain = typeof d === 'string' ? d : d.domain;
          return domain && !domain.startsWith('*.') && domain !== '*';
        })
        .map(d => typeof d === 'string' ? d : d.domain)
    : [];
  
  try {
    if (domains.length === 0) {
      // 获取账户下所有域名
      const domainsResponse = await fetch('https://dnsapi.cn/Domain.List', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'login_token': `${provider.apiKey},${provider.secretKey}`,
          'format': 'json'
        })
      });
      
      if (!domainsResponse.ok) {
        throw new Error(`DNSPod API错误: ${domainsResponse.status} ${domainsResponse.statusText}`);
      }
      
      const domainsData = await domainsResponse.json();
      if (domainsData.status.code !== '1') {
        throw new Error(`DNSPod API错误: ${domainsData.status.message}`);
      }
      
      // 获取每个域名的记录
      for (const domain of domainsData.domains) {
        const domainRecords = await getDNSPodDomainRecords(domain.name, provider.apiKey, provider.secretKey);
        allRecords = [...allRecords, ...domainRecords];
      }
    } else {
      // 获取指定域名的记录
      for (const domain of domains) {
        try {
          const domainRecords = await getDNSPodDomainRecords(domain, provider.apiKey, provider.secretKey);
          allRecords = [...allRecords, ...domainRecords];
        } catch (error) {
          console.error(`获取域名${domain}的记录失败:`, error);
        }
      }
    }
    
    return allRecords;
  } catch (error) {
    console.error('获取DNSPod记录失败:', error);
    throw error;
  }
}

// 获取DNSPod域名的DNS记录
async function getDNSPodDomainRecords(domain, apiKey, secretKey) {
  const response = await fetch('https://dnsapi.cn/Record.List', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      'login_token': `${apiKey},${secretKey}`,
      'format': 'json',
      'domain': domain
    })
  });
  
  if (!response.ok) {
    throw new Error(`DNSPod API错误: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  if (data.status.code !== '1') {
    throw new Error(`DNSPod API错误: ${data.status.message}`);
  }
  
  // 标准化记录格式
  return data.records.map(record => ({
    id: record.id,
    type: record.type,
    name: record.name === '@' ? domain : `${record.name}.${domain}`,
    content: record.value,
    ttl: parseInt(record.ttl),
    zone_name: domain
  }));
}

async function updateDNSPodRecords(provider, records, options) {
  console.log(`更新DNSPod记录: ${provider.name}, 记录数: ${records.length}`);
  
  // 按域名分组记录
  const recordsByDomain = {};
  for (const record of records) {
    if (!recordsByDomain[record.zone_name]) {
      recordsByDomain[record.zone_name] = [];
    }
    recordsByDomain[record.zone_name].push(record);
  }
  
  let updated = 0;
  let added = 0;
  let deleted = 0;
  
  // 处理每个域名的记录
  for (const [domain, domainRecords] of Object.entries(recordsByDomain)) {
    try {
      // 获取当前记录
      const currentRecords = await getDNSPodDomainRecords(domain, provider.apiKey, provider.secretKey);
      
      // 更新或创建记录
      for (const record of domainRecords) {
        // 提取子域名部分
        const subDomain = record.name === domain ? '@' : record.name.replace(`.${domain}`, '');
        
        // 查找匹配的现有记录
        const existingRecord = currentRecords.find(r => 
          r.type === record.type && 
          (r.name === record.name || (r.name === domain && record.name === domain))
        );
        
        if (existingRecord) {
          // 检查记录是否需要更新
          if (existingRecord.content !== record.content || existingRecord.ttl !== record.ttl) {
            // 更新记录
            const updateResponse = await fetch('https://dnsapi.cn/Record.Modify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: new URLSearchParams({
                'login_token': `${provider.apiKey},${provider.secretKey}`,
                'format': 'json',
                'domain': domain,
                'record_id': existingRecord.id,
                'sub_domain': subDomain,
                'record_type': record.type,
                'value': record.content,
                'ttl': record.ttl || 600
              })
            });
            
            if (updateResponse.ok) {
              const updateData = await updateResponse.json();
              if (updateData.status.code === '1') {
                updated++;
              } else {
                console.error(`更新记录失败: ${record.name} ${record.type} - ${updateData.status.message}`);
              }
            } else {
              console.error(`更新记录失败: ${record.name} ${record.type}`);
            }
          }
        } else if (options.overwriteAll !== false) {
          // 创建新记录
          const createResponse = await fetch('https://dnsapi.cn/Record.Create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              'login_token': `${provider.apiKey},${provider.secretKey}`,
              'format': 'json',
              'domain': domain,
              'sub_domain': subDomain,
              'record_type': record.type,
              'value': record.content,
              'ttl': record.ttl || 600
            })
          });
          
          if (createResponse.ok) {
            const createData = await createResponse.json();
            if (createData.status.code === '1') {
              added++;
            } else {
              console.error(`创建记录失败: ${record.name} ${record.type} - ${createData.status.message}`);
            }
          } else {
            console.error(`创建记录失败: ${record.name} ${record.type}`);
          }
        }
      }
      
      // 删除多余记录
      if (options.deleteExtra) {
        for (const existingRecord of currentRecords) {
          const shouldKeep = domainRecords.some(r => 
            r.type === existingRecord.type && 
            (r.name === existingRecord.name || (r.name === domain && existingRecord.name === domain))
          );
          
          if (!shouldKeep) {
            const deleteResponse = await fetch('https://dnsapi.cn/Record.Remove', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: new URLSearchParams({
                'login_token': `${provider.apiKey},${provider.secretKey}`,
                'format': 'json',
                'domain': domain,
                'record_id': existingRecord.id
              })
            });
            
            if (deleteResponse.ok) {
              const deleteData = await deleteResponse.json();
              if (deleteData.status.code === '1') {
                deleted++;
              } else {
                console.error(`删除记录失败: ${existingRecord.name} ${existingRecord.type} - ${deleteData.status.message}`);
              }
            } else {
              console.error(`删除记录失败: ${existingRecord.name} ${existingRecord.type}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`处理域名${domain}时出错:`, error);
    }
  }
  
  return { updated, added, deleted };
}

// GoDaddy适配器
async function fetchGoDaddyRecords(provider) {
  console.log(`获取GoDaddy记录: ${provider.name}`);
  throw new Error('GoDaddy适配器尚未实现，请使用华为云官方SDK或实现完整的API调用');
}

async function updateGoDaddyRecords(provider, records, options) {
  console.log(`更新GoDaddy记录: ${provider.name}, 记录数: ${records.length}`);
  throw new Error('GoDaddy适配器尚未实现，请使用华为云官方SDK或实现完整的API调用');
}

// Namecheap适配器
async function fetchNamecheapRecords(provider) {
  console.log(`获取Namecheap记录: ${provider.name}`);
  throw new Error('Namecheap适配器尚未实现，请使用官方SDK或实现完整的API调用');
}

async function updateNamecheapRecords(provider, records, options) {
  console.log(`更新Namecheap记录: ${provider.name}, 记录数: ${records.length}`);
  throw new Error('Namecheap适配器尚未实现，请使用官方SDK或实现完整的API调用');
}

// 华为云适配器
async function fetchHuaweiCloudRecords(provider) {
  console.log(`获取华为云记录: ${provider.name}`);
  
  // 获取所有域名的记录
  let allRecords = [];
  
  // 如果没有指定域名，尝试获取账户下所有域名
  const domains = provider.domains && provider.domains.length > 0 
    ? provider.domains
        .filter(d => {
          const domain = typeof d === 'string' ? d : d.domain;
          return domain && !domain.startsWith('*.') && domain !== '*';
        })
        .map(d => typeof d === 'string' ? d : d.domain)
    : [];
  
  try {
    // 获取华为云Token
    const token = await getHuaweiCloudToken(provider.apiKey, provider.secretKey);
    
    if (domains.length === 0) {
      // 获取账户下所有公网域名
      const zonesResponse = await fetch('https://dns.myhuaweicloud.com/v2/zones?zone_type=public', {
        headers: {
          'X-Auth-Token': token,
          'Content-Type': 'application/json'
        }
      });
      
      if (!zonesResponse.ok) {
        throw new Error(`华为云API错误: ${zonesResponse.status} ${zonesResponse.statusText}`);
      }
      
      const zonesData = await zonesResponse.json();
      
      // 获取每个域名的记录
      for (const zone of zonesData.zones) {
        const zoneRecords = await getHuaweiCloudZoneRecords(zone.id, token);
        allRecords = [...allRecords, ...zoneRecords.map(record => ({
          ...normalizeRecord(record, 'huaweicloud'),
          zone_name: zone.name.replace(/\.$/, '') // 移除末尾的点
        }))];
      }
    } else {
      // 获取指定域名的记录
      for (const domain of domains) {
        try {
          // 查找域名的zone ID
          const zoneResponse = await fetch(`https://dns.myhuaweicloud.com/v2/zones?name=${domain}&zone_type=public`, {
            headers: {
              'X-Auth-Token': token,
              'Content-Type': 'application/json'
            }
          });
          
          if (!zoneResponse.ok) {
            console.error(`获取域名${domain}的zone ID失败: ${zoneResponse.status} ${zoneResponse.statusText}`);
            continue;
          }
          
          const zoneData = await zoneResponse.json();
          if (!zoneData.zones || zoneData.zones.length === 0) {
            console.error(`域名${domain}在华为云中不存在`);
            continue;
          }
          
          const zoneId = zoneData.zones[0].id;
          const zoneName = zoneData.zones[0].name.replace(/\.$/, '');
          
          // 获取域名的DNS记录
          const zoneRecords = await getHuaweiCloudZoneRecords(zoneId, token);
          allRecords = [...allRecords, ...zoneRecords.map(record => ({
            ...normalizeRecord(record, 'huaweicloud'),
            zone_name: zoneName
          }))];
        } catch (error) {
          console.error(`获取域名${domain}的记录失败:`, error);
        }
      }
    }
    
    return allRecords;
  } catch (error) {
    console.error('获取华为云记录失败:', error);
    throw error;
  }
}

// 获取华为云Token
async function getHuaweiCloudToken(accessKey, secretKey) {
  // 华为云DNS API需要使用AK/SK签名认证
  // 这里实现一个简化的签名认证过程
  // 实际生产环境建议使用华为云官方SDK
  
  try {
    // 华为云AK/SK签名认证需要复杂的签名算法
    // 这里先尝试使用临时访问密钥的方式
    
    // 方法1: 使用AK/SK获取临时Token
    // 注意：这需要正确的签名算法，这里简化实现
    
    // 构造认证请求体
    const authBody = {
      auth: {
        identity: {
          methods: ['hw_ak_sk'],
          hw_ak_sk: {
            access: {
              key: accessKey  // AK (访问密钥ID)
            },
            secret: {
              key: secretKey  // SK (秘钥)
            }
          }
        },
        scope: {
          project: {
            name: 'cn-north-4'  // 使用华为云DNS服务的区域
          }
        }
      }
    };
    
    const response = await fetch('https://iam.myhuaweicloud.com/v3/auth/tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(authBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('华为云认证失败:', errorText);
      throw new Error(`华为云认证失败: ${response.status} ${response.statusText}`);
    }
    
    const token = response.headers.get('X-Subject-Token');
    if (!token) {
      throw new Error('华为云认证失败: 未获取到Token');
    }
    
    console.log('华为云认证成功，获取到Token');
    return token;
  } catch (error) {
    console.error('华为云认证错误:', error);
    throw error; // 不再使用模拟模式，直接抛出错误
  }
}

// 获取华为云域名的DNS记录
async function getHuaweiCloudZoneRecords(zoneId, token) {
  const records = [];
  let offset = 0;
  const limit = 500;
  let hasMore = true;
  
  while (hasMore) {
    const response = await fetch(`https://dns.myhuaweicloud.com/v2/zones/${zoneId}/recordsets?limit=${limit}&offset=${offset}`, {
      headers: {
        'X-Auth-Token': token,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`华为云API错误: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    records.push(...data.recordsets);
    
    // 检查是否有更多记录
    if (data.recordsets.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }
  
  return records;
}

async function updateHuaweiCloudRecords(provider, records, options) {
  console.log(`更新华为云记录: ${provider.name}, 记录数: ${records.length}`);
  
  // 按域名分组记录
  const recordsByDomain = {};
  for (const record of records) {
    if (!recordsByDomain[record.zone_name]) {
      recordsByDomain[record.zone_name] = [];
    }
    recordsByDomain[record.zone_name].push(record);
  }
  
  let updated = 0;
  let added = 0;
  let deleted = 0;
  
  try {
    // 获取华为云Token
    const token = await getHuaweiCloudToken(provider.apiKey, provider.secretKey);
    
    // 处理每个域名的记录
    for (const [domain, domainRecords] of Object.entries(recordsByDomain)) {
      try {
        // 查找域名的zone ID
        const zoneResponse = await fetch(`https://dns.myhuaweicloud.com/v2/zones?name=${domain}&zone_type=public`, {
          headers: {
            'X-Auth-Token': token,
            'Content-Type': 'application/json'
          }
        });
        
        if (!zoneResponse.ok) {
          console.error(`获取域名${domain}的zone ID失败: ${zoneResponse.status} ${zoneResponse.statusText}`);
          continue;
        }
        
        const zoneData = await zoneResponse.json();
        if (!zoneData.zones || zoneData.zones.length === 0) {
          console.error(`域名${domain}在华为云中不存在`);
          continue;
        }
        
        const zoneId = zoneData.zones[0].id;
        
        // 获取当前记录
        const currentRecords = await getHuaweiCloudZoneRecords(zoneId, token);
        
        // 更新或创建记录
        for (const record of domainRecords) {
          // 构造记录名称（华为云需要FQDN格式）
          const recordName = record.name.endsWith('.') ? record.name : `${record.name}.`;
          
          // 查找匹配的现有记录
          const existingRecord = currentRecords.find(r => 
            r.type === record.type && r.name === recordName
          );
          
          if (existingRecord) {
            // 检查记录是否需要更新
            const existingValues = Array.isArray(existingRecord.records) ? existingRecord.records : [existingRecord.records];
            const newValues = [record.content];
            
            if (JSON.stringify(existingValues.sort()) !== JSON.stringify(newValues.sort()) || 
                existingRecord.ttl !== record.ttl) {
              
              // 更新记录
              const updateResponse = await fetch(`https://dns.myhuaweicloud.com/v2.1/zones/${zoneId}/recordsets/${existingRecord.id}`, {
                method: 'PUT',
                headers: {
                  'X-Auth-Token': token,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  name: recordName,
                  type: record.type,
                  records: [record.content],
                  ttl: record.ttl || 300
                })
              });
              
              if (updateResponse.ok) {
                updated++;
              } else {
                const errorText = await updateResponse.text();
                console.error(`更新记录失败: ${record.name} ${record.type} - ${errorText}`);
              }
            }
          } else if (options.overwriteAll !== false) {
            // 创建新记录
            const createResponse = await fetch(`https://dns.myhuaweicloud.com/v2.1/zones/${zoneId}/recordsets`, {
              method: 'POST',
              headers: {
                'X-Auth-Token': token,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                name: recordName,
                type: record.type,
                records: [record.content],
                ttl: record.ttl || 300
              })
            });
            
            if (createResponse.ok) {
              added++;
            } else {
              const errorText = await createResponse.text();
              console.error(`创建记录失败: ${record.name} ${record.type} - ${errorText}`);
            }
          }
        }
        
        // 删除多余记录
        if (options.deleteExtra) {
          for (const existingRecord of currentRecords) {
            // 跳过系统默认记录（NS和SOA）
            if (existingRecord.type === 'NS' || existingRecord.type === 'SOA') {
              continue;
            }
            
            const shouldKeep = domainRecords.some(r => {
              const recordName = r.name.endsWith('.') ? r.name : `${r.name}.`;
              return r.type === existingRecord.type && recordName === existingRecord.name;
            });
            
            if (!shouldKeep) {
              const deleteResponse = await fetch(`https://dns.myhuaweicloud.com/v2.1/zones/${zoneId}/recordsets/${existingRecord.id}`, {
                method: 'DELETE',
                headers: {
                  'X-Auth-Token': token,
                  'Content-Type': 'application/json'
                }
              });
              
              if (deleteResponse.ok) {
                deleted++;
              } else {
                const errorText = await deleteResponse.text();
                console.error(`删除记录失败: ${existingRecord.name} ${existingRecord.type} - ${errorText}`);
              }
            }
          }
        }
      } catch (error) {
        console.error(`处理域名${domain}时出错:`, error);
      }
    }
  } catch (error) {
    console.error('华为云认证失败:', error);
    throw error;
  }
  
  return { updated, added, deleted };
}

// 自定义API适配器
async function fetchCustomRecords(provider) {
  console.log(`获取自定义API记录: ${provider.name}`);
  throw new Error('自定义API适配器尚未实现，请根据具体API文档实现');
}

async function updateCustomRecords(provider, records, options) {
  console.log(`更新自定义API记录: ${provider.name}, 记录数: ${records.length}`);
  throw new Error('自定义API适配器尚未实现，请根据具体API文档实现');
} 