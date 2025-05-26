/**
 * DNS提供商表单UI组件
 */
import { html } from 'hono/html';
import { getSupportedProviderTypes } from '../dns/providers.js';

export function renderProviderForm(provider = null) {
  const isEdit = !!provider;
  const providerTypes = getSupportedProviderTypes();
  
  return html`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DNS同步工具 - ${isEdit ? '编辑' : '添加'}提供商</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <script src="https://cdn.jsdelivr.net/npm/alpinejs@3.10.3/dist/cdn.min.js" defer></script>
    </head>
    <body class="bg-gray-100 min-h-screen" x-data="providerFormData()">
      <nav class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex">
              <div class="flex-shrink-0 flex items-center">
                <h1 class="text-xl font-bold text-gray-800">DNS同步工具</h1>
              </div>
            </div>
            <div class="flex items-center">
              <a href="/admin" class="ml-4 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">
                返回仪表盘
              </a>
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
        
        <!-- 表单 -->
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:px-6">
            <h2 class="text-lg font-medium text-gray-900">${isEdit ? '编辑' : '添加'}DNS提供商</h2>
          </div>
          <div class="border-t border-gray-200 px-4 py-5 sm:p-6">
            <form @submit.prevent="saveProvider">
              <div class="space-y-6">
                <input type="hidden" x-model="provider.id">
                
                <div>
                  <label for="name" class="block text-sm font-medium text-gray-700">名称</label>
                  <input type="text" id="name" x-model="provider.name" required
                         class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                </div>
                
                <div>
                  <label for="type" class="block text-sm font-medium text-gray-700">类型</label>
                  <select id="type" x-model="provider.type" required @change="updateFieldsVisibility"
                          class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                    <option value="">请选择DNS提供商类型</option>
                    <template x-for="type in providerTypes" :key="type.id">
                      <option :value="type.id" x-text="type.name"></option>
                    </template>
                  </select>
                </div>
                
                <div>
                  <label for="domain" class="block text-sm font-medium text-gray-700">域名</label>
                  <input type="text" id="domain" x-model="provider.domain" required
                         class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <p class="mt-1 text-sm text-gray-500">例如: example.com</p>
                </div>
                
                <!-- Cloudflare 特定字段 -->
                <div x-show="provider.type === 'cloudflare'">
                  <label for="apiKey" class="block text-sm font-medium text-gray-700">API令牌</label>
                  <input type="password" id="apiKey" x-model="provider.apiKey" :required="provider.type === 'cloudflare'"
                         class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <p class="mt-1 text-sm text-gray-500">Cloudflare API令牌，可在Cloudflare控制面板中创建</p>
                </div>
                
                <!-- 阿里云特定字段 -->
                <div x-show="provider.type === 'aliyun'">
                  <div>
                    <label for="aliyunAccessKeyId" class="block text-sm font-medium text-gray-700">AccessKey ID</label>
                    <input type="text" id="aliyunAccessKeyId" x-model="provider.apiKey" :required="provider.type === 'aliyun'"
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  </div>
                  <div class="mt-4">
                    <label for="aliyunAccessKeySecret" class="block text-sm font-medium text-gray-700">AccessKey Secret</label>
                    <input type="password" id="aliyunAccessKeySecret" x-model="provider.secretKey" :required="provider.type === 'aliyun'"
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  </div>
                </div>
                
                <!-- DNSPod特定字段 -->
                <div x-show="provider.type === 'dnspod'">
                  <label for="dnspodToken" class="block text-sm font-medium text-gray-700">API Token</label>
                  <input type="password" id="dnspodToken" x-model="provider.apiKey" :required="provider.type === 'dnspod'"
                         class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <p class="mt-1 text-sm text-gray-500">格式: ID,Token</p>
                </div>
                
                <!-- GoDaddy特定字段 -->
                <div x-show="provider.type === 'godaddy'">
                  <div>
                    <label for="godaddyKey" class="block text-sm font-medium text-gray-700">API Key</label>
                    <input type="text" id="godaddyKey" x-model="provider.apiKey" :required="provider.type === 'godaddy'"
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  </div>
                  <div class="mt-4">
                    <label for="godaddySecret" class="block text-sm font-medium text-gray-700">API Secret</label>
                    <input type="password" id="godaddySecret" x-model="provider.secretKey" :required="provider.type === 'godaddy'"
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  </div>
                </div>
                
                <!-- Namecheap特定字段 -->
                <div x-show="provider.type === 'namecheap'">
                  <div>
                    <label for="namecheapKey" class="block text-sm font-medium text-gray-700">API Key</label>
                    <input type="text" id="namecheapKey" x-model="provider.apiKey" :required="provider.type === 'namecheap'"
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  </div>
                  <div class="mt-4">
                    <label for="namecheapUsername" class="block text-sm font-medium text-gray-700">API Username</label>
                    <input type="text" id="namecheapUsername" x-model="provider.secretKey" :required="provider.type === 'namecheap'"
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  </div>
                </div>
                
                <!-- 华为云特定字段 -->
                <div x-show="provider.type === 'huaweicloud'">
                  <div>
                    <label for="huaweiToken" class="block text-sm font-medium text-gray-700">Token</label>
                    <input type="password" id="huaweiToken" x-model="provider.apiKey" :required="provider.type === 'huaweicloud'"
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                    <p class="mt-1 text-sm text-gray-500">华为云IAM Token</p>
                  </div>
                  <div class="mt-4">
                    <label for="huaweiProjectId" class="block text-sm font-medium text-gray-700">Project ID</label>
                    <input type="text" id="huaweiProjectId" x-model="provider.secretKey" :required="provider.type === 'huaweicloud'"
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                    <p class="mt-1 text-sm text-gray-500">华为云项目ID</p>
                  </div>
                </div>
                
                <!-- 自定义API特定字段 -->
                <div x-show="provider.type === 'custom'">
                  <div>
                    <label for="customEndpoint" class="block text-sm font-medium text-gray-700">API端点</label>
                    <input type="url" id="customEndpoint" x-model="provider.apiEndpoint" :required="provider.type === 'custom'"
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                    <p class="mt-1 text-sm text-gray-500">例如: https://api.example.com/dns</p>
                  </div>
                  <div class="mt-4">
                    <label for="customApiKey" class="block text-sm font-medium text-gray-700">API密钥</label>
                    <input type="password" id="customApiKey" x-model="provider.apiKey" :required="provider.type === 'custom'"
                           class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  </div>
                </div>
                
                <div class="flex justify-between">
                  <button type="button" @click="goBack" 
                          class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    取消
                  </button>
                  <button type="submit" 
                          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    保存
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      <script>
        function providerFormData() {
          return {
            provider: ${JSON.stringify(provider || {
              id: '',
              name: '',
              type: '',
              domain: '',
              apiKey: '',
              secretKey: '',
              apiEndpoint: ''
            })},
            message: '',
            messageType: 'success',
            providerTypes: ${JSON.stringify(providerTypes)},
            
            updateFieldsVisibility() {
              // 根据提供商类型显示不同的字段
              // 这里不需要做任何事情，因为我们使用了x-show指令
            },
            
            async saveProvider() {
              try {
                const response = await fetch('/admin/api/providers', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(this.provider)
                });
                
                if (response.ok) {
                  this.message = 'DNS提供商已保存';
                  this.messageType = 'success';
                  
                  // 3秒后重定向到仪表盘
                  setTimeout(() => {
                    window.location.href = '/admin';
                  }, 3000);
                } else {
                  const error = await response.json();
                  throw new Error(error.message || '保存失败');
                }
              } catch (error) {
                this.message = error.message;
                this.messageType = 'error';
              }
            },
            
            goBack() {
              window.location.href = '/admin';
            }
          };
        }
      </script>
    </body>
    </html>
  `;
} 