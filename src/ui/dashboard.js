/**
 * 仪表盘页面UI组件
 */
import { html } from 'hono/html';
import { getSyncConfig, getSyncHistory } from '../dns/sync.js';
import { getSupportedProviderTypes } from '../dns/providers.js';

export function renderDashboard(providers = [], syncConfig = null, syncHistory = [], providerTypes = []) {
  // 如果没有传入 providerTypes，则获取默认值
  if (!providerTypes || providerTypes.length === 0) {
    providerTypes = getSupportedProviderTypes();
  }
  

  
  // 分离源供应商和目标供应商
  const sourceProviders = providers.filter(p => p.role === 'source');
  const targetProviders = providers.filter(p => p.role === 'target');
  
  // 安全地序列化数据
  const safeStringify = (obj) => {
    try {
      console.log('开始序列化对象:', obj);
      
      // 直接序列化，不进行HTML实体编码
      const result = JSON.stringify(obj || {});
      
      console.log('序列化结果:', result);
      
      // 验证生成的JSON是否有效
      JSON.parse(result);
      return result;
    } catch (error) {
      console.error('JSON序列化错误:', error, 'Object:', obj);
      // 返回一个包含基本数据的JSON
      return JSON.stringify({
        providers: [],
        sourceProviders: [],
        targetProviders: [],
        syncConfig: { syncOptions: { overwriteAll: true, deleteExtra: false } },
        syncHistory: [],
        providerTypes: [
          { id: 'cloudflare', name: 'Cloudflare' },
          { id: 'aliyun', name: '阿里云' },
          { id: 'dnspod', name: 'DNSPod' },
          { id: 'godaddy', name: 'GoDaddy' },
          { id: 'namecheap', name: 'Namecheap' },
          { id: 'huaweicloud', name: '华为云' }
        ]
      });
    }
  };
  
  return html`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DNS同步工具 - 仪表盘</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <script id="dashboard-data" type="application/json">${safeStringify({
        providers: providers || [],
        sourceProviders: sourceProviders || [],
        targetProviders: targetProviders || [],
        syncConfig: syncConfig || {
          syncOptions: {
            overwriteAll: true,
            deleteExtra: false
          }
        },
        syncHistory: syncHistory || [],
        providerTypes: providerTypes || [
          { id: 'cloudflare', name: 'Cloudflare' },
          { id: 'aliyun', name: '阿里云' },
          { id: 'dnspod', name: 'DNSPod' },
          { id: 'godaddy', name: 'GoDaddy' },
          { id: 'namecheap', name: 'Namecheap' },
          { id: 'huaweicloud', name: '华为云' }
        ]
      })}</script>
      <script>
        window.dashboardData = function() {
          try {
            const dataScript = document.getElementById('dashboard-data');
            if (!dataScript) {
              console.error('找不到数据脚本元素');
              return { providers: [], sourceProviders: [], targetProviders: [], syncConfig: { syncOptions: { overwriteAll: true, deleteExtra: false } }, syncHistory: [], providerTypes: [], newProvider: { type: '', name: '', domains: '', excludeDomains: '', apiKey: '', secretKey: '', role: '', sourceProviderIds: [], overwriteAll: true, deleteExtra: false }, message: '', messageType: 'success' };
            }
            
            let textContent = dataScript.textContent.trim();
            
            // 解码HTML实体
            textContent = textContent
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&#x27;/g, "'");
            
            if (!textContent) {
              console.error('数据脚本内容为空');
              return { providers: [], sourceProviders: [], targetProviders: [], syncConfig: { syncOptions: { overwriteAll: true, deleteExtra: false } }, syncHistory: [], providerTypes: [], newProvider: { type: '', name: '', domains: '', excludeDomains: '', apiKey: '', secretKey: '', role: '', sourceProviderIds: [], overwriteAll: true, deleteExtra: false }, message: '', messageType: 'success' };
            }
            
            const data = JSON.parse(textContent);
            
            return {
            providers: data.providers || [],
            sourceProviders: data.sourceProviders || [],
            targetProviders: data.targetProviders || [],
            syncConfig: data.syncConfig || { syncOptions: { overwriteAll: true, deleteExtra: false } },
            newProvider: {
              type: '',
              name: '',
              domains: '',
              excludeDomains: '',
              apiKey: '',
              secretKey: '',
              role: '',
              sourceProviderIds: [],
              overwriteAll: true,
              deleteExtra: false
            },
            editingProvider: null, // 正在编辑的提供商
            syncHistory: data.syncHistory || [],
            message: '',
            messageType: 'success',
            providerTypes: data.providerTypes || [
              { id: 'cloudflare', name: 'Cloudflare' },
              { id: 'aliyun', name: '阿里云' },
              { id: 'dnspod', name: 'DNSPod' },
              { id: 'godaddy', name: 'GoDaddy' },
              { id: 'namecheap', name: 'Namecheap' },
              { id: 'huaweicloud', name: '华为云' }
            ],
            
            getProviderTypeName(type) {
              const providerType = this.providerTypes.find(p => p.id === type);
              return providerType ? providerType.name : type;
            },
            
            getSourceProviderNames(sourceProviderIds) {
              if (!sourceProviderIds || sourceProviderIds.length === 0) {
                return '无';
              }
              const names = sourceProviderIds.map(id => {
                const provider = this.sourceProviders.find(p => p.id === id);
                return provider ? provider.name : '未知';
              });
              return names.join(', ');
            },
            
            formatDate(timestamp) {
              return new Date(timestamp).toLocaleString('zh-CN');
            },
            
            formatApiKey(apiKey) {
              if (!apiKey || apiKey.length <= 3) {
                return apiKey || '';
              }
              return apiKey.substring(0, 3) + '*'.repeat(Math.min(apiKey.length - 3, 20));
            },
            
            async saveProvider() {
              try {
                // 验证表单
                if (!this.newProvider.type) {
                  throw new Error('请选择DNS提供商类型');
                }
                if (!this.newProvider.name) {
                  throw new Error('请输入提供商名称');
                }
                if (!this.newProvider.apiKey) {
                  throw new Error('请输入API密钥');
                }
                if (!this.newProvider.role) {
                  throw new Error('请选择供应商角色');
                }
                if (this.newProvider.role === 'target' && this.newProvider.sourceProviderIds.length === 0) {
                  throw new Error('目标供应商必须选择至少一个源供应商');
                }
                
                // 重名检查
                const existingProvider = this.providers.find(p => 
                  p.name === this.newProvider.name && 
                  (!this.editingProvider || p.id !== this.editingProvider.id)
                );
                if (existingProvider) {
                  throw new Error('供应商名称"' + this.newProvider.name + '"已存在，请使用其他名称');
                }
                
                // 创建提供商对象
                const providerData = {
                  type: this.newProvider.type,
                  name: this.newProvider.name,
                  domains: this.newProvider.domains,
                  excludeDomains: this.newProvider.excludeDomains,
                  apiKey: this.newProvider.apiKey,
                  secretKey: this.newProvider.secretKey,
                  role: this.newProvider.role,
                  sourceProviderIds: this.newProvider.role === 'target' ? this.newProvider.sourceProviderIds : []
                };
                
                // 如果是编辑模式，添加ID并使用PUT方法
                if (this.editingProvider) {
                  providerData.id = this.editingProvider.id;
                }
                
                // 保存提供商
                const response = await fetch('/admin/api/providers', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '')
                  },
                  body: JSON.stringify(providerData)
                });
                
                if (!response.ok) {
                  const error = await response.json();
                  throw new Error(error.message || '保存配置失败');
                }
                
                const result = await response.json();
                const updatedProvider = result.provider || { ...providerData, id: this.editingProvider ? this.editingProvider.id : Date.now().toString() };
                
                // 更新提供商列表
                if (this.editingProvider) {
                  // 编辑模式：更新现有提供商
                  const index = this.providers.findIndex(p => p.id === this.editingProvider.id);
                  if (index !== -1) {
                    // 保持原有ID，更新其他属性
                    this.providers[index] = { ...updatedProvider, id: this.editingProvider.id };
                  }
                  
                  // 更新分类列表
                  const sourceIndex = this.sourceProviders.findIndex(p => p.id === this.editingProvider.id);
                  const targetIndex = this.targetProviders.findIndex(p => p.id === this.editingProvider.id);
                  
                  if (sourceIndex !== -1) {
                    if (updatedProvider.role === 'source') {
                      // 仍然是源供应商，直接更新
                      this.sourceProviders[sourceIndex] = { ...updatedProvider, id: this.editingProvider.id };
                    } else {
                      // 角色改变为目标供应商，从源列表移除
                      this.sourceProviders.splice(sourceIndex, 1);
                    }
                  }
                  
                  if (targetIndex !== -1) {
                    if (updatedProvider.role === 'target') {
                      // 仍然是目标供应商，直接更新
                      this.targetProviders[targetIndex] = { ...updatedProvider, id: this.editingProvider.id };
                    } else {
                      // 角色改变为源供应商，从目标列表移除
                      this.targetProviders.splice(targetIndex, 1);
                    }
                  }
                  
                  // 如果角色发生改变，添加到新的列表
                  if (sourceIndex === -1 && updatedProvider.role === 'source') {
                    this.sourceProviders.push({ ...updatedProvider, id: this.editingProvider.id });
                  }
                  if (targetIndex === -1 && updatedProvider.role === 'target') {
                    this.targetProviders.push({ ...updatedProvider, id: this.editingProvider.id });
                  }
                } else {
                  // 添加模式：添加新提供商
                  this.providers.push(updatedProvider);
                  if (updatedProvider.role === 'source') {
                    this.sourceProviders.push(updatedProvider);
                  } else {
                    this.targetProviders.push(updatedProvider);
                  }
                }
                
                // 保存同步配置
                await fetch('/admin/api/sync-config', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '')
                  },
                  body: JSON.stringify({
                    ...this.syncConfig,
                    syncOptions: {
                      overwriteAll: this.newProvider.overwriteAll,
                      deleteExtra: this.newProvider.deleteExtra
                    }
                  })
                });
                
                const wasEditing = this.editingProvider !== null;
                this.resetForm();
                this.message = wasEditing ? '供应商已更新' : '供应商已添加';
                this.messageType = 'success';
              } catch (error) {
                this.message = error.message;
                this.messageType = 'error';
              }
            },
            
            resetForm() {
              this.newProvider = {
                type: '',
                name: '',
                domains: '',
                excludeDomains: '',
                apiKey: '',
                secretKey: '',
                role: '',
                sourceProviderIds: [],
                overwriteAll: true,
                deleteExtra: false
              };
              this.editingProvider = null;
            },
            
            editProvider(provider) {
              this.editingProvider = provider;
              this.newProvider = {
                id: provider.id,
                type: provider.type,
                name: provider.name,
                domains: Array.isArray(provider.domains) ? 
                  provider.domains.map(d => {
                    if (typeof d === 'string') return d;
                    if (d.recordTypes && d.recordTypes.length > 0) {
                      return d.domain + ':' + d.recordTypes.join(',');
                    }
                    return d.domain;
                  }).join('\\n') : 
                  (provider.domains || ''),
                excludeDomains: Array.isArray(provider.excludeDomains) ? 
                  provider.excludeDomains.map(d => {
                    if (typeof d === 'string') return d;
                    if (d.recordTypes && d.recordTypes.length > 0) {
                      return d.domain + ':' + d.recordTypes.join(',');
                    }
                    return d.domain;
                  }).join('\\n') : 
                  (provider.excludeDomains || ''),
                apiKey: this.formatApiKey(provider.apiKey || ''),
                secretKey: this.formatApiKey(provider.secretKey || ''),
                role: provider.role,
                sourceProviderIds: provider.sourceProviderIds || [],
                overwriteAll: true,
                deleteExtra: false
              };
              
              // 滚动到表单
              document.querySelector('#provider-form').scrollIntoView({ behavior: 'smooth' });
            },
            
            cancelEdit() {
              this.resetForm();
            },
            
            async runSync() {
              try {
                console.log('开始手动同步...');
                this.message = '正在执行同步...';
                this.messageType = 'success';
                
                const response = await fetch('/admin/api/sync', {
                  method: 'POST',
                  headers: {
                    'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '')
                  }
                });
                
                console.log('同步API响应状态:', response.status);
                
                if (!response.ok) {
                  const errorText = await response.text();
                  console.error('同步API错误响应:', errorText);
                  throw new Error('同步请求失败: ' + response.status + ' - ' + errorText);
                }
                
                const result = await response.json();
                console.log('同步API响应结果:', result);
                
                if (result.success) {
                  const successCount = result.result?.success?.length || 0;
                  const failedCount = result.result?.failed?.length || 0;
                  this.message = '同步完成！成功: ' + successCount + ', 失败: ' + failedCount;
                  this.messageType = 'success';
                  console.log('手动同步完成，成功:', successCount, '失败:', failedCount);
                  
                  // 刷新同步历史
                  await this.loadSyncHistory();
                } else {
                  throw new Error(result.error || '同步失败');
                }
              } catch (error) {
                console.error('手动同步失败:', error);
                this.message = '同步失败: ' + error.message;
                this.messageType = 'error';
              }
            },
            
            async deleteProvider(id) {
              if (!confirm('确定要删除此DNS提供商吗？')) {
                return;
              }
              
              try {
                // 检查要删除的提供商
                const providerToDelete = this.providers.find(p => p.id === id);
                if (!providerToDelete) {
                  throw new Error('找不到要删除的提供商');
                }
                
                // 如果删除的是源供应商，检查是否有目标供应商依赖它
                let targetProvidersToDelete = [];
                if (providerToDelete.role === 'source') {
                  targetProvidersToDelete = this.targetProviders.filter(target => {
                    // 检查目标供应商的源供应商列表
                    if (!target.sourceProviderIds || target.sourceProviderIds.length === 0) {
                      return false;
                    }
                    
                    // 移除要删除的源供应商ID后，检查是否还有其他源供应商
                    const remainingSourceIds = target.sourceProviderIds.filter(sourceId => sourceId !== id);
                    return remainingSourceIds.length === 0;
                  });
                  
                  if (targetProvidersToDelete.length > 0) {
                    const targetNames = targetProvidersToDelete.map(t => t.name).join('、');
                    const confirmMessage = '删除源供应商"' + providerToDelete.name + '"后，目标供应商"' + targetNames + '"将没有源供应商，这些目标供应商也会被删除。确定继续吗？';
                    if (!confirm(confirmMessage)) {
                      return;
                    }
                  }
                }
                
                // 删除主要提供商
                const response = await fetch('/admin/api/providers/' + id, {
                  method: 'DELETE',
                  headers: {
                    'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '')
                  }
                });
                
                if (!response.ok) {
                  const error = await response.json();
                  throw new Error(error.message || '删除失败');
                }
                
                // 删除依赖的目标供应商
                for (const targetProvider of targetProvidersToDelete) {
                  try {
                    await fetch('/admin/api/providers/' + targetProvider.id, {
                      method: 'DELETE',
                      headers: {
                        'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '')
                      }
                    });
                  } catch (error) {
                    console.error('删除目标供应商失败:', error);
                  }
                }
                
                // 更新本地数据
                const deletedIds = [id, ...targetProvidersToDelete.map(t => t.id)];
                this.providers = this.providers.filter(p => !deletedIds.includes(p.id));
                this.sourceProviders = this.sourceProviders.filter(p => !deletedIds.includes(p.id));
                this.targetProviders = this.targetProviders.filter(p => !deletedIds.includes(p.id));
                
                // 更新其他目标供应商的源供应商列表（移除已删除的源供应商ID）
                if (providerToDelete.role === 'source') {
                  this.targetProviders.forEach(target => {
                    if (target.sourceProviderIds && target.sourceProviderIds.includes(id)) {
                      target.sourceProviderIds = target.sourceProviderIds.filter(sourceId => sourceId !== id);
                    }
                  });
                  
                  // 同步更新到服务器
                  for (const target of this.targetProviders) {
                    if (target.sourceProviderIds && target.sourceProviderIds.length > 0) {
                      try {
                        await fetch('/admin/api/providers', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '')
                          },
                          body: JSON.stringify(target)
                        });
                      } catch (error) {
                        console.error('更新目标供应商失败:', error);
                      }
                    }
                  }
                }
                
                let message = 'DNS提供商"' + providerToDelete.name + '"已删除';
                if (targetProvidersToDelete.length > 0) {
                  const targetNames = targetProvidersToDelete.map(t => t.name).join('、');
                  message += '，同时删除了目标供应商"' + targetNames + '"';
                }
                
                this.message = message;
                this.messageType = 'success';
              } catch (error) {
                this.message = error.message;
                this.messageType = 'error';
              }
            },
            
            async loadSyncHistory() {
              try {
                const response = await fetch('/admin/api/sync-history', {
                  headers: {
                    'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '')
                  }
                });
                if (response.ok) {
                  this.syncHistory = await response.json();
                }
              } catch (error) {
                console.error('加载同步历史失败:', error);
              }
            },
            
            async clearSyncHistory() {
              if (!confirm('确定要清理所有同步历史记录吗？此操作不可恢复。')) {
                return;
              }
              
              try {
                const response = await fetch('/admin/api/sync-history', {
                  method: 'DELETE',
                  headers: {
                    'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '')
                  }
                });
                
                if (response.ok) {
                  this.syncHistory = [];
                  this.message = '同步历史已清理';
                  this.messageType = 'success';
                } else {
                  const error = await response.json();
                  throw new Error(error.message || '清理失败');
                }
              } catch (error) {
                this.message = error.message;
                this.messageType = 'error';
              }
            },
            
            logout() {
              localStorage.removeItem('auth_token');
              document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
              window.location.href = '/';
            }
          };
        } catch (error) {
            console.error('JSON解析错误:', error);
            return {
              providers: [],
              sourceProviders: [],
              targetProviders: [],
              syncConfig: { syncOptions: { overwriteAll: true, deleteExtra: false } },
              syncHistory: [],
              providerTypes: [
                { id: 'cloudflare', name: 'Cloudflare' },
                { id: 'aliyun', name: '阿里云' },
                { id: 'dnspod', name: 'DNSPod' },
                { id: 'godaddy', name: 'GoDaddy' },
                { id: 'namecheap', name: 'Namecheap' },
                { id: 'huaweicloud', name: '华为云' }
              ],
              newProvider: {
                type: '',
                name: '',
                domains: '',
                excludeDomains: '',
                apiKey: '',
                secretKey: '',
                role: '',
                sourceProviderIds: [],
                overwriteAll: true,
                deleteExtra: false
              },
              editingProvider: null,
              message: '',
              messageType: 'success',
              getProviderTypeName: () => '',
              getSourceProviderNames: () => '无',
              formatDate: (timestamp) => new Date(timestamp).toLocaleString('zh-CN'),
              saveProvider: () => {},
              resetForm: () => {},
              editProvider: () => {},
              cancelEdit: () => {},
              runSync: () => {},
              deleteProvider: () => {},
              loadSyncHistory: () => {},
              clearSyncHistory: () => {},
              logout: () => {
                localStorage.removeItem('auth_token');
                document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                window.location.href = '/';
              }
            };
          }
        }
      </script>
      <script src="https://cdn.jsdelivr.net/npm/alpinejs@3.10.3/dist/cdn.min.js" defer></script>
    </head>
    <body class="bg-gray-100 min-h-screen">
      <script>console.log('Body loaded, testing Alpine.js');</script>
      <div x-data="window.dashboardData()">
      <nav class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex">
              <div class="flex-shrink-0 flex items-center">
                <h1 class="text-xl font-bold text-gray-800">DNS同步工具</h1>
              </div>
            </div>
              <div class="flex items-center space-x-4">
                <button @click="runSync" class="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                立即同步
              </button>
                <a href="/admin/ban-management" class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">
                  IP封禁管理
                </a>
              <button @click="logout" class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">
                退出登录
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <!-- 警告消息 -->
        <div x-show="message" class="mb-4 p-4 rounded-md" :class="messageType === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg x-show="messageType === 'error'" class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
              <svg x-show="messageType === 'success'" class="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm" x-text="message"></p>
            </div>
            <div class="ml-auto pl-3">
              <div class="-mx-1.5 -my-1.5">
                <button @click="message = ''" class="inline-flex rounded-md p-1.5" :class="messageType === 'error' ? 'text-red-500 hover:bg-red-100' : 'text-green-500 hover:bg-green-100'">
                  <span class="sr-only">关闭</span>
                  <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 主要内容 -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <!-- 源供应商列表 -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="px-4 py-5 sm:px-6">
                <h2 class="text-lg font-medium text-gray-900">源供应商</h2>
                <p class="mt-1 text-sm text-gray-500">DNS记录的来源提供商</p>
            </div>
            <div class="border-t border-gray-200 px-4 py-5 sm:p-6">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">域名</th>
                      <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                      <template x-if="sourceProviders.length === 0">
                      <tr>
                        <td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">
                            暂无源供应商，请在下方添加配置
                        </td>
                      </tr>
                    </template>
                      <template x-for="provider in sourceProviders" :key="provider.id">
                      <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" x-text="provider.name"></td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="getProviderTypeName(provider.type)"></td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="provider.domain || '所有域名'"></td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button @click="editProvider(provider)" class="text-indigo-600 hover:text-indigo-900 mr-3">编辑</button>
                          <button @click="deleteProvider(provider.id)" class="text-red-600 hover:text-red-900">删除</button>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
            <!-- 目标供应商列表 -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="px-4 py-5 sm:px-6">
                <h2 class="text-lg font-medium text-gray-900">目标供应商</h2>
                <p class="mt-1 text-sm text-gray-500">DNS记录的同步目标提供商</p>
              </div>
              <div class="border-t border-gray-200 px-4 py-5 sm:p-6">
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                      <tr>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">源供应商</th>
                        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      <template x-if="targetProviders.length === 0">
                        <tr>
                          <td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">
                            暂无目标供应商，请在下方添加配置
                          </td>
                        </tr>
                      </template>
                      <template x-for="provider in targetProviders" :key="provider.id">
                        <tr>
                          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" x-text="provider.name"></td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="getProviderTypeName(provider.type)"></td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="getSourceProviderNames(provider.sourceProviderIds)"></td>
                          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button @click="editProvider(provider)" class="text-indigo-600 hover:text-indigo-900 mr-3">编辑</button>
                            <button @click="deleteProvider(provider.id)" class="text-red-600 hover:text-red-900">删除</button>
                          </td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <!-- 添加供应商配置 -->
            <div id="provider-form" class="bg-white overflow-hidden shadow rounded-lg lg:col-span-2">
              <div class="px-4 py-5 sm:px-6">
                <h2 class="text-lg font-medium text-gray-900" x-text="editingProvider ? '编辑DNS供应商' : '添加DNS供应商'"></h2>
            </div>
            <div class="border-t border-gray-200 px-4 py-5 sm:p-6">
                <form @submit.prevent="saveProvider">
                  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <!-- 基本信息 -->
                <div class="space-y-6">
                  <div>
                    <label for="providerType" class="block text-sm font-medium text-gray-700">DNS提供商类型</label>
                    <select id="providerType" x-model="newProvider.type" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                      <option value="">请选择提供商类型</option>
                      <template x-for="type in providerTypes" :key="type.id">
                        <option :value="type.id" x-text="type.name"></option>
                      </template>
                    </select>
                  </div>
                      
                      <!-- API密钥获取链接 -->
                      <div x-show="newProvider.type === 'huaweicloud'" class="mb-4">
                        <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
                          <div class="flex">
                            <div class="flex-shrink-0">
                              <svg class="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                              </svg>
                            </div>
                            <div class="ml-3">
                              <p class="text-sm text-blue-700">
                                需要华为云访问密钥？
                                <a href="https://console.huaweicloud.com/iam/?locale=zh-cn#/mine/accessKey" 
                                   target="_blank" 
                                   class="font-medium text-blue-600 hover:text-blue-500 underline">
                                  新增访问秘钥
                                  <svg class="inline h-3 w-3 ml-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div x-show="newProvider.type === 'cloudflare'" class="mb-4">
                        <div class="bg-orange-50 border border-orange-200 rounded-md p-3">
                          <div class="flex">
                            <div class="flex-shrink-0">
                              <svg class="h-5 w-5 text-orange-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                              </svg>
                            </div>
                            <div class="ml-3">
                              <p class="text-sm text-orange-700">
                                需要Cloudflare API令牌？
                                <a href="https://dash.cloudflare.com/profile/api-tokens" 
                                   target="_blank" 
                                   class="font-medium text-orange-600 hover:text-orange-500 underline">
                                  创建令牌->编辑区域 DNS (使用模板)
                                  <svg class="inline h-3 w-3 ml-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                  
                  <div>
                    <label for="providerName" class="block text-sm font-medium text-gray-700">名称</label>
                    <input type="text" id="providerName" x-model="newProvider.name" 
                               :readonly="editingProvider !== null"
                               :class="editingProvider ? 'mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-500 sm:text-sm' : 'mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'"
                               placeholder="输入供应商名称">
                  </div>
                  
                  <div>
                        <label for="domains" class="block text-sm font-medium text-gray-700">包含域名列表</label>
                        <textarea id="domains" x-model="newProvider.domains" rows="4"
                              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                  placeholder="每行一个域名或记录类型，例如：
example.com
*.example.org:A,AAAA
test.com:CNAME,TXT
A,MX"></textarea>
                        <p class="mt-1 text-xs text-gray-500">支持格式：域名、域名:记录类型、纯记录类型（如A,MX表示所有域名的A和MX记录），留空则同步所有域名</p>
                      </div>
                      
                      <div>
                        <label for="excludeDomains" class="block text-sm font-medium text-gray-700">排除域名列表</label>
                        <textarea id="excludeDomains" x-model="newProvider.excludeDomains" rows="4"
                                  class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                  placeholder="每行一个要排除的域名或记录类型，例如：
internal.example.com
*.private.org:A
test.example.com:MX,TXT
AAAA"></textarea>
                        <p class="mt-1 text-xs text-gray-500">支持格式：域名、域名:记录类型、纯记录类型（如AAAA表示排除所有域名的AAAA记录）</p>
                  </div>
                  
                  <div>
                    <label for="apiKey" class="block text-sm font-medium text-gray-700">API密钥</label>
                    <input type="text" id="apiKey" x-model="newProvider.apiKey" 
                           class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                           placeholder="API Key / Token">
                  </div>
                  
                  <div>
                    <label for="secretKey" class="block text-sm font-medium text-gray-700">API密钥(Secret)</label>
                    <input type="password" id="secretKey" x-model="newProvider.secretKey" 
                           class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                           placeholder="API Secret (如有)">
                      </div>
                  </div>
                  
                    <!-- 角色配置 -->
                    <div class="space-y-6">
                  <div>
                        <label class="block text-sm font-medium text-gray-700">供应商角色</label>
                    <div class="mt-2 space-y-2">
                      <div class="flex items-center">
                            <input id="roleSource" type="radio" x-model="newProvider.role" value="source"
                                   class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300">
                            <label for="roleSource" class="ml-2 block text-sm text-gray-900">源供应商（提供DNS记录）</label>
                          </div>
                          <div class="flex items-center">
                            <input id="roleTarget" type="radio" x-model="newProvider.role" value="target"
                                   class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300">
                            <label for="roleTarget" class="ml-2 block text-sm text-gray-900">目标供应商（接收DNS记录）</label>
                          </div>
                        </div>
                      </div>
                      
                      <!-- 目标供应商的源选择 -->
                      <div x-show="newProvider.role === 'target'">
                        <label for="sourceProviders" class="block text-sm font-medium text-gray-700">选择源供应商</label>
                        <div class="relative">
                          <div class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus-within:ring-indigo-500 focus-within:border-indigo-500 sm:text-sm bg-white">
                            <div class="p-2 space-y-1 max-h-32 overflow-y-auto">
                              <template x-for="sourceProvider in sourceProviders" :key="sourceProvider.id">
                                <label class="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                  <input type="checkbox" 
                                         :value="sourceProvider.id" 
                                         x-model="newProvider.sourceProviderIds"
                               class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
                                  <span class="text-sm text-gray-900" x-text="sourceProvider.name"></span>
                                </label>
                              </template>
                            </div>
                          </div>
                        </div>
                        <p class="mt-1 text-xs text-gray-500">可选择多个源供应商</p>
                        <div x-show="sourceProviders.length === 0" class="mt-2 text-sm text-gray-500">
                          请先添加源供应商
                        </div>
                      </div>
                      
                      <!-- 同步选项 -->
                      <div>
                        <label class="block text-sm font-medium text-gray-700">同步选项</label>
                        <div class="mt-2 space-y-2">
                      <div class="flex items-center">
                            <input id="overwriteAll" type="checkbox" x-model="newProvider.overwriteAll"
                               class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
                        <label for="overwriteAll" class="ml-2 block text-sm text-gray-900">覆盖所有记录</label>
                      </div>
                      <div class="flex items-center">
                            <input id="deleteExtra" type="checkbox" x-model="newProvider.deleteExtra"
                               class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
                        <label for="deleteExtra" class="ml-2 block text-sm text-gray-900">删除多余记录</label>
                      </div>
                    </div>
                  </div>
                  
                      <div class="flex justify-end space-x-3">
                        <button type="button" @click="editingProvider ? cancelEdit() : resetForm()" 
                                class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                x-text="editingProvider ? '取消' : '重置'">
                    </button>
                        <button type="submit" class="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                x-text="editingProvider ? '保存配置' : '添加供应商'">
                    </button>
                      </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
          
          <!-- 同步历史 -->
          <div class="bg-white overflow-hidden shadow rounded-lg lg:col-span-2">
              <div class="px-4 py-5 sm:px-6 flex justify-between items-center">
              <h2 class="text-lg font-medium text-gray-900">同步历史</h2>
                <button @click="clearSyncHistory" class="px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                  清理历史
                </button>
            </div>
            <div class="border-t border-gray-200 px-4 py-5 sm:p-6">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">源提供商</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">目标提供商</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">记录数</th>
                        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <template x-if="syncHistory.length === 0">
                      <tr>
                        <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
                          暂无同步历史
                        </td>
                      </tr>
                    </template>
                    <template x-for="(history, index) in syncHistory" :key="index">
                      <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="formatDate(history.timestamp)"></td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" x-text="history.sourceNames || history.sourceName || '未知'"></td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" x-text="history.targetName || '未知'"></td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="history.recordCount"></td>
                          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full" 
                                  :class="(history.success !== undefined ? history.success : (history.results && history.results.success && history.results.success.length > 0)) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                                  x-text="(history.success !== undefined ? history.success : (history.results && history.results.success && history.results.success.length > 0)) ? '成功' : '失败'"></span>
                          </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </body>
    </html>
  `;
} 