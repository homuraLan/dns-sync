/**
 * DNS同步模块
 * 处理不同DNS提供商之间的记录同步
 */

import { getDNSProviders, getDNSProviderWithCredentials } from './providers.js';
import { fetchDNSRecords, updateDNSRecords } from './adapters.js';

// 主同步函数
export async function syncDNSRecords(storage) {
  console.log('开始DNS同步...');
  
  if (!storage) {
    throw new Error('未配置存储，需要提供KV或D1数据库');
  }
  
  const providers = await getDNSProviders(storage);
  console.log('获取到DNS提供商数量:', providers?.length || 0);
  
  // 检查是否有足够的提供商进行同步
  if (providers.length < 1) {
    throw new Error('需要至少一个DNS提供商才能进行同步');
  }
  
  // 分离源供应商和目标供应商
  const sourceProviders = providers.filter(p => p.role === 'source');
  const targetProviders = providers.filter(p => p.role === 'target');
  
  console.log('源供应商数量:', sourceProviders.length);
  console.log('目标供应商数量:', targetProviders.length);
  
  // 检查是否有源供应商和目标供应商
  if (sourceProviders.length === 0) {
    throw new Error('未配置源供应商');
  }
  
  if (targetProviders.length === 0) {
    throw new Error('未配置目标供应商');
  }
  
  // 检查目标供应商是否都配置了源供应商
  const validTargetProviders = targetProviders.filter(target => 
    target.sourceProviderIds && target.sourceProviderIds.length > 0
  );
  
  console.log('有效目标供应商数量:', validTargetProviders.length);
  
  if (validTargetProviders.length === 0) {
    throw new Error('目标供应商未配置源供应商');
  }
  
  // 同步结果
  const results = {
    success: [],
    failed: []
  };
  
  // 对每个目标提供商进行同步
  for (const targetProvider of validTargetProviders) {
    console.log(`开始同步目标供应商: ${targetProvider.name} (${targetProvider.id})`);
    
    try {
      const targetProviderWithCredentials = await getDNSProviderWithCredentials(storage, targetProvider.id);
      if (!targetProviderWithCredentials) {
        console.error(`目标供应商 ${targetProvider.name} 不存在`);
        results.failed.push({
          providerId: targetProvider.id,
          targetName: targetProvider.name,
          error: '目标DNS提供商不存在'
        });
        continue;
      }
      
      // 合并所有源供应商的DNS记录
      let allSourceRecords = [];
      const sourceNames = [];
      
      for (const sourceProviderId of targetProvider.sourceProviderIds) {
        try {
          const sourceProvider = await getDNSProviderWithCredentials(storage, sourceProviderId);
          if (!sourceProvider) {
            console.warn(`源供应商 ${sourceProviderId} 不存在，跳过`);
            continue;
          }
          
          // 检查是否是相同的提供商实例
          if (sourceProviderId === targetProvider.id && 
              sourceProvider.apiKey === targetProviderWithCredentials.apiKey && 
              sourceProvider.secretKey === targetProviderWithCredentials.secretKey) {
            console.warn(`源提供商和目标提供商完全相同 (${sourceProvider.name})，跳过`);
            continue;
          }
          
          // 获取源DNS记录
          const sourceRecords = await fetchDNSRecords(sourceProvider);
          allSourceRecords = allSourceRecords.concat(sourceRecords);
          sourceNames.push(sourceProvider.name);
        } catch (error) {
          console.error(`获取源供应商 ${sourceProviderId} 的DNS记录失败:`, error);
        }
      }
      
      if (allSourceRecords.length === 0) {
        results.failed.push({
          providerId: targetProvider.id,
          targetName: targetProvider.name,
          error: '没有可用的源DNS记录'
        });
        continue;
      }
      
      // 去重DNS记录（基于域名、类型和值）
      const uniqueRecords = [];
      const recordKeys = new Set();
      
      for (const record of allSourceRecords) {
        const key = `${record.name}:${record.type}:${record.content}`;
        if (!recordKeys.has(key)) {
          recordKeys.add(key);
          uniqueRecords.push(record);
        }
      }
      
      // 获取同步选项（从目标供应商或全局配置）
      const syncConfig = await getSyncConfig(storage);
      const syncOptions = syncConfig?.syncOptions || {
        overwriteAll: true,
        deleteExtra: false
      };
      
      // 更新目标提供商的DNS记录
      console.log(`更新目标供应商 ${targetProvider.name} 的DNS记录，记录数: ${uniqueRecords.length}`);
      await updateDNSRecords(targetProviderWithCredentials, uniqueRecords, syncOptions);
      
      results.success.push({
        providerId: targetProvider.id,
        targetName: targetProvider.name,
        sourceNames: sourceNames.join(', '),
        recordCount: uniqueRecords.length
      });
      
      // 保存单个同步历史记录
      const historyEntry = {
        timestamp: Date.now(),
        sourceProviderIds: targetProvider.sourceProviderIds,
        sourceNames: sourceNames.join(', '),
        targetProviderId: targetProvider.id,
        targetName: targetProvider.name,
        recordCount: uniqueRecords.length,
        success: true
      };
      
      console.log(`保存同步历史记录: ${targetProvider.name} <- ${sourceNames.join(', ')}`);
      await saveSingleSyncHistory(storage, historyEntry);
      
    } catch (error) {
      console.error(`同步目标供应商 ${targetProvider.name} 失败:`, error);
      
      results.failed.push({
        providerId: targetProvider.id,
        targetName: targetProvider.name,
        error: error.message
      });
  
      // 保存失败的同步历史记录
  const historyEntry = {
    timestamp: Date.now(),
        sourceProviderIds: targetProvider.sourceProviderIds || [],
        sourceNames: '未知',
        targetProviderId: targetProvider.id,
        targetName: targetProvider.name,
        recordCount: 0,
        success: false,
        error: error.message
      };
      
      await saveSingleSyncHistory(storage, historyEntry);
    }
  }
  
  console.log(`DNS同步完成，成功: ${results.success.length}, 失败: ${results.failed.length}`);
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

// 保存单个同步历史记录
async function saveSingleSyncHistory(storage, historyEntry) {
  if ('put' in storage) {
    // KV存储
    const history = await storage.get('sync_history', { type: 'json' }) || [];
    history.unshift(historyEntry);
    if (history.length > 50) {
      history.length = 50;
    }
    await storage.put('sync_history', JSON.stringify(history));
  } else {
    // D1数据库
    await ensureSyncHistoryTable(storage);
    await storage.prepare(`
      INSERT INTO sync_history (
        timestamp, 
        source_provider_ids, 
        source_names, 
        target_provider_id,
        target_name,
        record_count, 
        success,
        error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      historyEntry.timestamp,
      JSON.stringify(historyEntry.sourceProviderIds),
      historyEntry.sourceNames,
      historyEntry.targetProviderId,
      historyEntry.targetName,
      historyEntry.recordCount,
      historyEntry.success ? 1 : 0,
      historyEntry.error || null
    ).run();
  }
}

// 保存同步历史记录到KV（保留兼容性）
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
      source_provider_ids TEXT,
      source_names TEXT,
      target_provider_id TEXT,
      target_name TEXT,
      record_count INTEGER NOT NULL,
      success INTEGER NOT NULL DEFAULT 1,
      error_message TEXT,
      -- 保留旧字段以兼容性
      source_provider_id TEXT,
      source_name TEXT,
      success_count INTEGER,
      failed_count INTEGER,
      details TEXT
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
      
      return results.results.map(row => {
        // 新格式
        if (row.source_provider_ids || row.target_provider_id) {
          return {
            timestamp: row.timestamp,
            sourceProviderIds: row.source_provider_ids ? JSON.parse(row.source_provider_ids) : [],
            sourceNames: row.source_names || '未知',
            targetProviderId: row.target_provider_id,
            targetName: row.target_name,
            recordCount: row.record_count,
            success: row.success === 1,
            error: row.error_message
          };
        }
        // 旧格式兼容
        else {
          return {
        timestamp: row.timestamp,
        sourceProviderId: row.source_provider_id,
        sourceName: row.source_name,
        recordCount: row.record_count,
            results: row.details ? JSON.parse(row.details) : { success: [], failed: [] }
          };
        }
      });
    } catch (error) {
      console.error('获取同步历史失败:', error);
      return [];
    }
  }
} 