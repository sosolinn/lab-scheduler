# LabScheduler

实验室超净台预约与值日管理系统，基于 Next.js App Router。预约记录已接入 Supabase PostgreSQL，值日记录暂时继续保存在浏览器 localStorage 中。

## 项目结构

- `app/layout.js`：Next.js 根布局与全局样式入口
- `app/page.js`：读取并渲染原页面结构
- `app/LegacyScriptRunner.js`：启动页面逻辑并在启动前加载数据库预约
- `app/api/bookings/route.js`：预约记录的读取、新增和删除 API
- `lib/database.js`：服务器端 PostgreSQL 连接
- `database-bridge.js`：在不改变现有 UI 的前提下同步预约数据
- `supabase/migrations/001_create_lab_bookings.sql`：预约表 SQL 结构
- `index.html`、`style.css`、`script.js`：保留的页面结构、样式和原有交互逻辑

## 配置 Supabase

复制环境变量示例：

```bash
cp .env.example .env.local
```

在 `.env.local` 中填写 Supabase 提供的连接地址：

```env
DATABASE_URL="你的 Supabase Transaction pooler URL"
DIRECT_URL="你的 Supabase Direct connection URL"
```

网站运行时只使用 `DATABASE_URL`。真实数据库地址只能放在本地 `.env.local` 或 Vercel 等部署平台的环境变量中，不要提交到 GitHub。

预约 API 第一次运行时会自动创建 `lab_bookings` 表。也可以在 Supabase SQL Editor 中手动执行：

```text
supabase/migrations/001_create_lab_bookings.sql
```

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`。首次加载时，网站会尝试把当前浏览器中原有的预约记录迁移到数据库；遇到与数据库现有预约冲突的本地记录时，以数据库记录为准。

## 构建与运行

```bash
npm run build
npm run start
```

由于预约功能使用服务端 API 和数据库连接，本项目不能再作为纯静态站点部署到 GitHub Pages。推荐部署到 Vercel、支持 Node.js 的服务器或其他能够运行 Next.js 服务端功能的平台，并在部署平台配置 `DATABASE_URL`。

每次推送或提交 Pull Request 时，GitHub Actions 会自动安装依赖并执行 Next.js 构建检查。
