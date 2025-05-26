/**
 * 仪表盘页面UI组件
 */
import { html } from 'hono/html';
import { getSyncConfig, getSyncHistory } from '../dns/sync.js';
import { getSupportedProviderTypes } from '../dns/providers.js';

export function renderDashboard(providers = [], syncConfig = null, syncHistory = []) {
  const providerTypes = getSupportedProviderTypes();
  
  return html`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DNS同步工具 - 仪表盘</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <script src="https://cdn.jsdelivr.net/npm/alpinejs@3.10.3/dist/cdn.min.js" defer></script>
    </head>
    <body class="bg-gray-100 min-h-screen" x-data="dashboardData()">
      <nav class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex">
              <div class="flex-shrink-0 flex items-center">
                <h1 class="text-xl font-bold text-gray-800">DNS同步工具</h1>
              </div>
            </div>
            <div class="flex items-center">
              <button @click="runSync" class="mr-4 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                立即同步
              </button>
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
          <!-- DNS提供商管理 -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="px-4 py-5 sm:px-6 flex justify-between items-center">
              <h2 class="text-lg font-medium text-gray-900">DNS提供商</h2>
              <a href="/admin/providers/new" class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                添加提供商
              </a>
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
                    <template x-if="providers.length === 0">
                      <tr>
                        <td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">
                          暂无DNS提供商，请添加
                        </td>
                      </tr>
                    </template>
                    <template x-for="provider in providers" :key="provider.id">
                      <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" x-text="provider.name"></td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="getProviderTypeName(provider.type)"></td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="provider.domain"></td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <a :href="'/admin/providers/' + provider.id" class="text-indigo-600 hover:text-indigo-900 mr-3">编辑</a>
                          <button @click="deleteProvider(provider.id)" class="text-red-600 hover:text-red-900">删除</button>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <!-- 同步配置 -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="px-4 py-5 sm:px-6">
              <h2 class="text-lg font-medium text-gray-900">同步配置</h2>
            </div>
            <div class="border-t border-gray-200 px-4 py-5 sm:p-6">
              <form @submit.prevent="saveSyncConfig">
                <div class="space-y-6">
                  <div>
                    <label for="sourceProvider" class="block text-sm font-medium text-gray-700">源DNS提供商</label>
                    <select id="sourceProvider" x-model="syncConfig.sourceProviderId" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                      <option value="">请选择源提供商</option>
                      <template x-for="provider in providers" :key="provider.id">
                        <option :value="provider.id" x-text="provider.name"></option>
                      </template>
                    </select>
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700">目标DNS提供商</label>
                    <div class="mt-2 space-y-2">
                      <template x-for="provider in providers" :key="provider.id">
                        <div class="flex items-center" x-show="provider.id !== syncConfig.sourceProviderId">
                          <input :id="'target-' + provider.id" type="checkbox" :value="provider.id" 
                                 x-model="syncConfig.targetProviderIds"
                                 class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
                          <label :for="'target-' + provider.id" class="ml-2 block text-sm text-gray-900" x-text="provider.name"></label>
                        </div>
                      </template>
                    </div>
                  </div>
                  
                  <div>
                    <label for="syncInterval" class="block text-sm font-medium text-gray-700">同步选项</label>
                    <div class="mt-2 space-y-2">
                      <div class="flex items-center">
                        <input id="overwriteAll" type="checkbox" x-model="syncConfig.syncOptions.overwriteAll"
                               class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
                        <label for="overwriteAll" class="ml-2 block text-sm text-gray-900">覆盖所有记录</label>
                      </div>
                      <div class="flex items-center">
                        <input id="deleteExtra" type="checkbox" x-model="syncConfig.syncOptions.deleteExtra"
                               class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
                        <label for="deleteExtra" class="ml-2 block text-sm text-gray-900">删除多余记录</label>
                      </div>
                    </div>
                  </div>
                  
                  <div class="flex justify-between">
                    <button type="submit" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                      保存配置
                    </button>
                    <button type="button" @click="runSync" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                      立即同步
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
          
          <!-- 同步历史 -->
          <div class="bg-white overflow-hidden shadow rounded-lg lg:col-span-2">
            <div class="px-4 py-5 sm:px-6">
              <h2 class="text-lg font-medium text-gray-900">同步历史</h2>
            </div>
            <div class="border-t border-gray-200 px-4 py-5 sm:p-6">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">源提供商</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">记录数</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">成功</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">失败</th>
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
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" x-text="history.sourceName"></td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="history.recordCount"></td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="history.results.success.length"></td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="history.results.failed.length"></td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <script>
        function dashboardData() {
          return {
            providers: ${JSON.stringify(providers)},
            syncConfig: ${JSON.stringify(syncConfig || {
              sourceProviderId: '',
              targetProviderIds: [],
              syncOptions: {
                overwriteAll: true,
                deleteExtra: false
              }
            })},
            syncHistory: ${JSON.stringify(syncHistory)},
            message: '',
            messageType: 'success',
            providerTypes: ${JSON.stringify(providerTypes)},
            
            getProviderTypeName(type) {
              const providerType = this.providerTypes.find(p => p.id === type);
              return providerType ? providerType.name : type;
            },
            
            formatDate(timestamp) {
              return new Date(timestamp).toLocaleString('zh-CN');
            },
            
            async saveSyncConfig() {
              try {
                const response = await fetch('/admin/api/sync-config', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(this.syncConfig)
                });
                
                if (response.ok) {
                  this.message = '同步配置已保存';
                  this.messageType = 'success';
                } else {
                  const error = await response.json();
                  throw new Error(error.message || '保存配置失败');
                }
              } catch (error) {
                this.message = error.message;
                this.messageType = 'error';
              }
            },
            
            async runSync() {
              try {
                this.message = '正在执行同步...';
                this.messageType = 'success';
                
                const response = await fetch('/admin/api/sync', {
                  method: 'POST'
                });
                
                const result = await response.json();
                
                if (response.ok) {
                  this.message = '同步完成！成功: ' + result.result.success.length + ', 失败: ' + result.result.failed.length;
                  this.messageType = 'success';
                  
                  // 刷新同步历史
                  this.loadSyncHistory();
                } else {
                  throw new Error(result.error || '同步失败');
                }
              } catch (error) {
                this.message = error.message;
                this.messageType = 'error';
              }
            },
            
            async deleteProvider(id) {
              if (!confirm('确定要删除此DNS提供商吗？')) {
                return;
              }
              
              try {
                const response = await fetch('/admin/api/providers/' + id, {
                  method: 'DELETE'
                });
                
                if (response.ok) {
                  this.providers = this.providers.filter(p => p.id !== id);
                  this.message = 'DNS提供商已删除';
                  this.messageType = 'success';
                } else {
                  const error = await response.json();
                  throw new Error(error.message || '删除失败');
                }
              } catch (error) {
                this.message = error.message;
                this.messageType = 'error';
              }
            },
            
            async loadSyncHistory() {
              try {
                const response = await fetch('/admin/api/sync-history');
                if (response.ok) {
                  this.syncHistory = await response.json();
                }
              } catch (error) {
                console.error('加载同步历史失败:', error);
              }
            },
            
            logout() {
              window.location.href = '/';
            }
          };
        }
      </script>
    </body>
    </html>
  `;
} 