# DNS同步工具

这是一个基于Cloudflare Worker的DNS同步工具，可以自动将一个DNS提供商的记录同步到其他提供商。

## 功能特点

- 支持多种DNS提供商：Cloudflare、阿里云、DNSPod、GoDaddy、Namecheap、华为云等
- 提供Web界面进行配置
- 安全存储API密钥
- 定时自动同步DNS记录
- 支持手动触发同步
- 查看同步历史记录

## 部署说明

### 前提条件

- Cloudflare账户
- Node.js和npm环境（用于本地开发）

### 部署步骤

1. 克隆此仓库
   ```
   git clone https://github.com/yourusername/dns-sync-worker.git
   cd dns-sync-worker
   ```

2. 安装依赖
   ```
   npm install
   ```

3. 部署Worker

   #### 一键部署到Cloudflare Workers
   
   [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yourusername/dns-sync-worker)

   #### 或者使用Wrangler手动部署
   ```
   npm run deploy
   ```

4. 在Cloudflare Workers控制面板中配置：
   
   #### 存储选项（二选一）
   
   **选项1: 创建KV命名空间**
   - 进入Workers & Pages > KV
   - 点击"创建命名空间"
   - 命名为"dns-sync-kv"(或任何你喜欢的名称)
   - 记下命名空间ID
   
   **选项2: 创建D1数据库**
   - 进入Workers & Pages > D1
   - 点击"创建数据库"
   - 命名为"dns_sync_db"
   - 记下数据库ID
   
   > 注意：KV和D1是二选一的存储选项，优先使用D1数据库。如果同时配置了KV和D1，系统将自动选择D1作为存储。
   
   #### 配置环境变量
   - 进入你的Worker详情页 > 设置 > 变量
   - 添加以下环境变量：
     - `PASSWORD`: 管理界面登录密码
     - `KV`: KV命名空间ID（如果使用KV存储）
     - `DB`: D1数据库ID（如果使用D1存储）
     - `CRON`: 定时触发表达式 (默认: "0 */6 * * *"，即每6小时执行一次)

## 本地开发

1. 创建开发环境使用的KV命名空间或D1数据库
   ```
   # 创建KV命名空间
   npx wrangler kv:namespace create dns-sync-kv --preview
   
   # 或创建D1数据库
   npx wrangler d1 create dns_sync_db
   ```

2. 创建或修改`.dev.vars`文件，设置本地开发环境变量：
   ```
   PASSWORD=your_password_here
   ```

3. 修改`wrangler.toml`文件，添加存储配置：
   ```toml
   # 如果使用KV
   kv_namespaces = [
     { binding = "KV", id = "您的KV命名空间ID" }
   ]
   
   # 或者如果使用D1
   [[d1_databases]]
   binding = "DB"
   database_name = "dns_sync_db"
   database_id = "您的D1数据库ID"
   ```

4. 运行以下命令启动本地开发服务器：
   ```
   npm run dev
   ```

## 使用说明

1. 访问Worker的URL（例如：https://dns-sync-worker.yourdomain.workers.dev）
2. 使用设置的密码登录
3. 添加DNS提供商配置
4. 设置同步配置，选择源提供商和目标提供商
5. 点击"立即同步"按钮触发同步，或等待自动定时同步

## 支持的DNS提供商

- Cloudflare
- 阿里云
- DNSPod
- GoDaddy
- Namecheap
- 华为云
- 自定义API

## 同步规则说明

- 可以将源提供商与目标提供商设置为相同类型（例如，从一个Cloudflare账号同步到另一个Cloudflare账号）
- 只有当源提供商和目标提供商的API密钥完全相同时，才会跳过同步
- 根据CRON环境变量设置的时间表自动执行同步任务，也可以手动触发

## 存储选项比较

| 功能 | KV存储 | D1数据库 |
|------|-------|---------|
| 性能 | 读取快，适合小数据 | 适合结构化数据和复杂查询 |
| 查询能力 | 基本键值操作 | 支持SQL查询 |
| 事务支持 | 不支持 | 支持 |
| 数据大小限制 | 单值25MB | 更高 |
| 价格 | 免费计划包含更多操作 | 免费计划包含基本使用量 |

## 安全说明

- 所有API密钥都存储在Cloudflare KV存储或D1数据库中
- 登录密码通过环境变量设置
- 使用基本身份验证保护Web界面

## 许可证

ISC 