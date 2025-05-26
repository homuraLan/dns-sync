/**
 * 登录页面UI组件
 */
import { html } from 'hono/html';

export function renderLoginPage() {
  return html`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DNS同步工具 - 登录</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100 h-screen flex items-center justify-center">
      <div class="bg-white p-8 rounded-lg shadow-md w-96">
        <div class="text-center mb-6">
          <h1 class="text-2xl font-bold text-gray-800">DNS同步工具</h1>
          <p class="text-gray-600">请输入密码登录</p>
        </div>
        
        <form id="login-form" class="space-y-4">
          <input type="hidden" id="username" name="username" value="admin">
          
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">密码</label>
            <input type="password" id="password" name="password" required 
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
          </div>
          
          <div class="pt-2">
            <button type="submit" 
                    class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              登录
            </button>
          </div>
          
          <div id="error-message" class="text-red-500 text-center hidden"></div>
        </form>
      </div>
      
      <script>
        document.getElementById('login-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          
          try {
            const response = await fetch('/admin', {
              headers: {
                'Authorization': 'Basic ' + btoa(username + ':' + password)
              }
            });
            
            if (response.ok) {
              window.location.href = '/admin';
            } else {
              document.getElementById('error-message').textContent = '密码错误';
              document.getElementById('error-message').classList.remove('hidden');
            }
          } catch (error) {
            document.getElementById('error-message').textContent = '登录请求失败';
            document.getElementById('error-message').classList.remove('hidden');
          }
        });
      </script>
    </body>
    </html>
  `;
} 