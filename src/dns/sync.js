/**
 * DNS同步模块
 * 处理不同DNS提供商之间的记录同步
 */

import { getDNSProviders, getDNSProviderWithCredentials } from './providers.js';
import { fetchDNSRecords, updateDNSRecords } from './adapters.js';

// 主同步函数
export async function syncDNSRecords(storage) {
  if (!storage) {
    throw new Error('未配置存储，需要提供KV或D1数据库');
  }
  
  const providers = await getDNSProviders(storage);
  
  // 检查是否有足够的提供商进行同步
  if (providers.length < 1) {
    throw new Error('需要至少一个DNS提供商才能进行同步');
  }
  
  // 获取同步配置
  const syncConfig = await getSyncConfig(storage);
  if (!syncConfig || !syncConfig.sourceProviderId || !syncConfig.targetProviderIds || syncConfig.targetProviderIds.length === 0) {
    throw new Error('未配置同步设置');
  }
  
  // 获取源提供商
  const sourceProvider = await getDNSProviderWithCredentials(storage, syncConfig.sourceProviderId);
  if (!sourceProvider) {
    throw new Error('源DNS提供商不存在');
  }
  
  // 获取源DNS记录
  const sourceRecords = await fetchDNSRecords(sourceProvider);
  
  // 同步结果
  const results = {
    success: [],
    failed: []
  };
  
  // 对每个目标提供商进行同步
  for (const targetProviderId of syncConfig.targetProviderIds) {
    try {
      const targetProvider = await getDNSProviderWithCredentials(storage, targetProviderId);
      if (!targetProvider) {
        results.failed.push({
          providerId: targetProviderId,
          error: '目标DNS提供商不存在'
        });
        continue;
      }
      
      // 检查是否是相同的提供商实例（相同ID且API密钥完全相同）
      if (targetProviderId === syncConfig.sourceProviderId && 
          targetProvider.apiKey === sourceProvider.apiKey && 
          targetProvider.secretKey === sourceProvider.secretKey) {
        results.failed.push({
          providerId: targetProviderId,
          error: '源提供商和目标提供商完全相同，跳过同步'
        });
        continue;
      }
      
      // 更新目标提供商的DNS记录
      await updateDNSRecords(targetProvider, sourceRecords, syncConfig.syncOptions);
      
      results.success.push({
        providerId: targetProviderId,
        name: targetProvider.name
      });
    } catch (error) {
      results.failed.push({
        providerId: targetProviderId,
        error: error.message
      });
    }
  }
  
  // 保存同步历史记录
  const historyEntry = {
    timestamp: Date.now(),
    sourceProviderId: syncConfig.sourceProviderId,
    sourceName: sourceProvider.name,
    recordCount: sourceRecords.length,
    results
  };
  
  // 根据存储类型保存历史记录
  if ('exec' in storage) {
    // D1数据库
    await saveHistoryToDb(storage, historyEntry);
  } else {
    // KV存储
    await saveSyncHistory(storage, historyEntry);
  }
  
  return results;
}

// 获取同步配置
export async function getSyncConfig(storage) {
  if ('get' in storage) {
    // KV存储
    return await storage.get('sync_config', { type: 'json' }) || null;
  } else {
    // D1数据库
    try {
      await ensureSyncConfigTable(storage);
      const result = await storage.prepare('SELECT config FROM sync_config WHERE id = 1').first();
      return result ? JSON.parse(result.config) : null;
    } catch (error) {
      console.error('获取同步配置失败:', error);
      return null;
    }
  }
}

// 保存同步配置
export async function saveSyncConfig(storage, config) {
  if ('put' in storage) {
    // KV存储
    await storage.put('sync_config', JSON.stringify(config));
  } else {
    // D1数据库
    try {
      await ensureSyncConfigTable(storage);
      await storage.prepare(`
        INSERT OR REPLACE INTO sync_config (id, config) 
        VALUES (1, ?)
      `).bind(JSON.stringify(config)).run();
    } catch (error) {
      console.error('保存同步配置失败:', error);
    }
  }
  return config;
}

// 确保同步配置表存在
async function ensureSyncConfigTable(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sync_config (
      id INTEGER PRIMARY KEY,
      config TEXT NOT NULL
    )
  `);
}

// 保存同步历史记录到KV
async function saveSyncHistory(kv, historyEntry) {
  // 获取现有历史记录
  const history = await kv.get('sync_history', { type: 'json' }) || [];
  
  // 添加新记录并限制历史记录数量
  history.unshift(historyEntry);
  if (history.length > 50) {
    history.length = 50;
  }
  
  await kv.put('sync_history', JSON.stringify(history));
}

// 保存同步历史记录到D1数据库
async function saveHistoryToDb(db, historyEntry) {
  // 确保数据表存在
  await ensureSyncHistoryTable(db);
  
  // 插入记录
  await db.prepare(`
    INSERT INTO sync_history (
      timestamp, 
      source_provider_id, 
      source_name, 
      record_count, 
      success_count, 
      failed_count, 
      details
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    historyEntry.timestamp,
    historyEntry.sourceProviderId,
    historyEntry.sourceName,
    historyEntry.recordCount,
    historyEntry.results.success.length,
    historyEntry.results.failed.length,
    JSON.stringify(historyEntry.results)
  ).run();
}

// 确保同步历史表存在
async function ensureSyncHistoryTable(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sync_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      source_provider_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      success_count INTEGER NOT NULL,
      failed_count INTEGER NOT NULL,
      details TEXT NOT NULL
    )
  `);
}

// 获取同步历史记录
export async function getSyncHistory(storage) {
  if ('get' in storage) {
    // KV存储
    return await storage.get('sync_history', { type: 'json' }) || [];
  } else {
    // D1数据库
    try {
      await ensureSyncHistoryTable(storage);
      const results = await storage.prepare(`
        SELECT * FROM sync_history ORDER BY timestamp DESC LIMIT 50
      `).all();
      
      return results.results.map(row => ({
        timestamp: row.timestamp,
        sourceProviderId: row.source_provider_id,
        sourceName: row.source_name,
        recordCount: row.record_count,
        results: JSON.parse(row.details)
      }));
    } catch (error) {
      console.error('获取同步历史失败:', error);
      return [];
    }
  }
} 