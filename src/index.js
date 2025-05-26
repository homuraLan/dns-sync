import { Hono } from 'hono';
import { html } from 'hono/html';
import { basicAuth } from 'hono/basic-auth';

// 导入DNS同步模块
import { syncDNSRecords, getSyncConfig, saveSyncConfig, getSyncHistory } from './dns/sync.js';
import { getDNSProviders, saveDNSProvider, deleteDNSProvider } from './dns/providers.js';

// 导入UI组件
import { renderLoginPage } from './ui/login.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderProviderForm } from './ui/provider-form.js';

const app = new Hono();

// 基础认证中间件
const auth = async (c, next) => {
  // 只验证密码，用户名固定为admin
  const password = c.env.PASSWORD || 'changeme';
  
  return basicAuth({
    username: 'admin', // 固定用户名
    password,
  })(c, next);
};

// 获取存储对象（KV或D1）
const getStorage = (env) => {
  // 优先使用D1数据库，如果不存在则使用KV
  return env.DB || env.KV;
};

// 静态资源 - 移除serveStatic，使用简单的响应处理
app.get('/static/*', (c) => {
  const path = c.req.path.replace('/static/', '');
  // 简单处理，返回404
  return new Response('Not Found', { status: 404 });
  // 注意：如果需要真正提供静态文件，应该使用其他方式或将静态资源存储在KV中
});

// 登录页面
app.get('/', (c) => {
  return c.html(renderLoginPage());
});

// 受保护的路由
app.use('/admin/*', auth);

// 管理仪表盘
app.get('/admin', async (c) => {
  const storage = getStorage(c.env);
  const providers = await getDNSProviders(storage);
  const syncConfig = await getSyncConfig(storage);
  const syncHistory = await getSyncHistory(storage);
  return c.html(renderDashboard(providers, syncConfig, syncHistory));
});

// API路由
app.post('/admin/api/providers', async (c) => {
  const data = await c.req.json();
  const storage = getStorage(c.env);
  await saveDNSProvider(storage, data);
  return c.json({ success: true });
});

app.delete('/admin/api/providers/:id', async (c) => {
  const id = c.req.param('id');
  const storage = getStorage(c.env);
  await deleteDNSProvider(storage, id);
  return c.json({ success: true });
});

app.post('/admin/api/sync-config', async (c) => {
  const data = await c.req.json();
  const storage = getStorage(c.env);
  await saveSyncConfig(storage, data);
  return c.json({ success: true });
});

app.get('/admin/api/sync-history', async (c) => {
  const storage = getStorage(c.env);
  const history = await getSyncHistory(storage);
  return c.json(history);
});

app.post('/admin/api/sync', async (c) => {
  try {
    const storage = getStorage(c.env);
    // 对于syncDNSRecords，传递单个存储实例
    const result = await syncDNSRecords(storage);
    return c.json({ success: true, result });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 添加/编辑DNS提供商表单
app.get('/admin/providers/new', (c) => {
  return c.html(renderProviderForm());
});

app.get('/admin/providers/:id', async (c) => {
  const id = c.req.param('id');
  const storage = getStorage(c.env);
  const providers = await getDNSProviders(storage);
  const provider = providers.find(p => p.id === id);
  return c.html(renderProviderForm(provider));
});

// 定时任务处理函数
export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
  
  // 定时触发的CRON表达式从环境变量获取，默认每6小时一次
  scheduled: {
    cron: (env) => env.CRON || "0 */6 * * *",
    async handler(event, env, ctx) {
      try {
        console.log('Running scheduled DNS sync task');
        const storage = getStorage(env);
        await syncDNSRecords(storage);
        console.log('DNS sync completed successfully');
      } catch (error) {
        console.error('DNS sync failed:', error);
      }
    }
  }
}; 