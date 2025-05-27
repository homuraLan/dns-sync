/**
 * 登录页面UI组件
 */
import { html } from 'hono/html';

export function renderLoginPage(error = '', remainingAttempts = null, defaultUsername = 'admin') {
  // 安全地序列化数据
  const safeStringify = (value) => {
    if (value === null || value === undefined) return 'null';
    return JSON.stringify(value);
  };

  return html`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DNS同步工具 - 登录</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <script src="https://cdn.jsdelivr.net/npm/alpinejs@3.10.3/dist/cdn.min.js" defer></script>
    </head>
    <body class="bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8" x-data="{
        username: ${safeStringify(defaultUsername)},
        password: '',
        loading: false,
        errorMessage: ${safeStringify(error)},
        remainingAttempts: ${safeStringify(remainingAttempts)},

        async handleLogin() {
          this.loading = true;
          this.errorMessage = '';

          try {
            const response = await fetch('/api/login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                username: this.username,
                password: this.password
              })
            });

            const result = await response.json();

            if (response.ok) {
              // 保存token到localStorage和cookie
              localStorage.setItem('auth_token', result.token);
              document.cookie = 'auth_token=' + result.token + '; path=/; max-age=86400; SameSite=Strict';
              
              // 跳转到管理面板
              window.location.href = '/admin';
            } else {
              this.errorMessage = result.error;
              this.remainingAttempts = result.remainingAttempts;
            }
          } catch (error) {
            this.errorMessage = '登录请求失败: ' + error.message;
          } finally {
            this.loading = false;
          }
        }
      }">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
          DNS同步工具
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          请登录以访问管理面板
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <!-- 错误消息 -->
          <div x-show="errorMessage" class="mb-4 p-4 rounded-md bg-red-100 border border-red-200">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-red-700" x-text="errorMessage"></p>
                <p x-show="remainingAttempts !== null" class="text-xs text-red-600 mt-1">
                  剩余尝试次数: <span x-text="remainingAttempts"></span>
                </p>
              </div>
            </div>
          </div>

          <form class="space-y-6" @submit.prevent="handleLogin">
            <div>
              <label for="username" class="block text-sm font-medium text-gray-700">
                用户名
              </label>
              <div class="mt-1">
                <input id="username" x-model="username" type="text" required
                       class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                       placeholder="输入用户名">
              </div>
            </div>

            <div>
              <label for="password" class="block text-sm font-medium text-gray-700">
                密码
              </label>
              <div class="mt-1">
                <input id="password" x-model="password" type="password" required
                       class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                       placeholder="输入密码">
              </div>
            </div>

            <div>
              <button type="submit" :disabled="loading"
                      class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">
                <span x-show="!loading">登录</span>
                <span x-show="loading" class="flex items-center">
                  <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  登录中...
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
  `;
} 