/**
 * IP封禁管理页面UI组件
 */
import { html } from 'hono/html';

export function renderBanManagement(bannedIPs = {}) {
  // 安全地序列化数据
  const safeStringify = (obj) => {
    return JSON.stringify(obj || {}).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  };

  return html`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DNS同步工具 - IP封禁管理</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <script src="https://cdn.jsdelivr.net/npm/alpinejs@3.10.3/dist/cdn.min.js" defer></script>
    </head>
    <body class="bg-gray-100 min-h-screen" x-data="banManagementData()">
      <nav class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex">
              <div class="flex-shrink-0 flex items-center">
                <h1 class="text-xl font-bold text-gray-800">DNS同步工具 - IP封禁管理</h1>
              </div>
            </div>
            <div class="flex items-center space-x-4">
              <a href="/admin" class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">
                返回仪表盘
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

        <!-- 封禁IP列表 -->
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:px-6">
            <h2 class="text-lg font-medium text-gray-900">被封禁的IP地址</h2>
            <p class="mt-1 text-sm text-gray-500">管理因登录失败次数过多而被封禁的IP地址</p>
          </div>
          <div class="border-t border-gray-200">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP地址</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">封禁时间</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">到期时间</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">剩余时间</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">封禁原因</th>
                    <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <template x-if="Object.keys(bannedIPs).length === 0">
                    <tr>
                      <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">
                        暂无被封禁的IP地址
                      </td>
                    </tr>
                  </template>
                  <template x-for="(ban, ip) in bannedIPs" :key="ip">
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" x-text="ip"></td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="formatDate(ban.bannedAt)"></td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="formatDate(ban.expiresAt)"></td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="getRemainingTime(ban.expiresAt)"></td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" x-text="ban.reason"></td>
                      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button @click="unbanIP(ip)" class="text-indigo-600 hover:text-indigo-900">解除封禁</button>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 手动封禁IP -->
        <div class="mt-6 bg-white overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:px-6">
            <h2 class="text-lg font-medium text-gray-900">手动封禁IP</h2>
            <p class="mt-1 text-sm text-gray-500">手动添加需要封禁的IP地址</p>
          </div>
          <div class="border-t border-gray-200 px-4 py-5 sm:p-6">
            <form @submit.prevent="manualBanIP" class="space-y-4">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label for="banIP" class="block text-sm font-medium text-gray-700">IP地址</label>
                  <input type="text" id="banIP" x-model="newBan.ip" required
                         class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                         placeholder="例如: 192.168.1.100">
                </div>
                <div>
                  <label for="banReason" class="block text-sm font-medium text-gray-700">封禁原因</label>
                  <input type="text" id="banReason" x-model="newBan.reason"
                         class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                         placeholder="手动封禁">
                </div>
                <div class="flex items-end">
                  <button type="submit"
                          class="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                    封禁IP
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      <script>
        window.banManagementData = function() {
          return {
            bannedIPs: ${safeStringify(bannedIPs)},
            message: '',
            messageType: 'success',
            newBan: {
              ip: '',
              reason: '手动封禁'
            },

            formatDate(timestamp) {
              return new Date(timestamp).toLocaleString('zh-CN');
            },

            getRemainingTime(expiresAt) {
              const now = Date.now();
              const remaining = expiresAt - now;
              
              if (remaining <= 0) {
                return '已过期';
              }
              
              const hours = Math.floor(remaining / (60 * 60 * 1000));
              const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
              
              if (hours > 0) {
                return hours + '小时' + minutes + '分钟';
              } else {
                return minutes + '分钟';
              }
            },

            async unbanIP(ip) {
              if (!confirm('确定要解除对IP "' + ip + '" 的封禁吗？')) {
                return;
              }

              try {
                const response = await fetch('/admin/api/unban-ip', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '')
                  },
                  body: JSON.stringify({ ip })
                });

                if (response.ok) {
                  delete this.bannedIPs[ip];
                  this.message = 'IP "' + ip + '" 已解除封禁';
                  this.messageType = 'success';
                } else {
                  const error = await response.json();
                  throw new Error(error.error || '解除封禁失败');
                }
              } catch (error) {
                this.message = error.message;
                this.messageType = 'error';
              }
            },

            async manualBanIP() {
              if (!this.newBan.ip.trim()) {
                this.message = '请输入IP地址';
                this.messageType = 'error';
                return;
              }

              try {
                const response = await fetch('/admin/api/ban-ip', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || '')
                  },
                  body: JSON.stringify({
                    ip: this.newBan.ip,
                    reason: this.newBan.reason || '手动封禁'
                  })
                });

                if (response.ok) {
                  const result = await response.json();
                  this.bannedIPs[this.newBan.ip] = result.ban;
                  this.message = 'IP "' + this.newBan.ip + '" 已被封禁';
                  this.messageType = 'success';
                  this.newBan.ip = '';
                  this.newBan.reason = '手动封禁';
                } else {
                  const error = await response.json();
                  throw new Error(error.error || '封禁失败');
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
        };
      </script>
    </body>
    </html>
  `;
} 