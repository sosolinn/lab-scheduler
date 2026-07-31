# LabScheduler

楷模实验室超净台预约与值日管理系统，基于 Next.js App Router、Supabase PostgreSQL 与 Supabase Auth。

## 主要功能

- 超净台一周预约与时间冲突校验
- Supabase 共享预约、值日和人员名单
- 邮箱＋密码注册、登录和退出
- 新预约自动绑定创建者的 Supabase 用户 ID
- 普通用户只能修改、删除本人预约
- 管理员可以管理全部预约和升级前未绑定所有者的旧预约
- 值日记录仅允许北京时间当天提交，同日重新提交会覆盖

## 环境变量

复制示例文件：

```bash
cp .env.example .env.local
```

填写：

```env
DATABASE_URL="Supabase Transaction pooler URL"
DIRECT_URL="Supabase Direct connection URL"
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_xxxxxxxxx"
LAB_ADMIN_EMAILS="admin@example.com,second-admin@example.com"
```

说明：

- `DATABASE_URL`：网站 API 连接 PostgreSQL 使用。
- `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`：Supabase Auth 登录使用；publishable key 可以安全发送到浏览器。
- `LAB_ADMIN_EMAILS`：服务器端管理员邮箱白名单，多个邮箱用英文逗号分隔。不要把真实管理员邮箱写入公开仓库，应该放在 `.env.local` 或 Netlify 环境变量中。

## Supabase Auth 设置

在 Supabase Dashboard 中进入：

```text
Authentication → Providers → Email
```

启用 Email provider。若启用 Confirm email，新注册用户需要先点击确认邮件再登录。

部署到 Netlify 时，还应在：

```text
Authentication → URL Configuration
```

将 Site URL 设置为正式网站地址，并把本地和正式地址加入 Redirect URLs，例如：

```text
http://localhost:3000/**
https://camellab-scheduler.netlify.app/**
```

## 权限规则

- 所有人都可以查看预约情况。
- 未登录用户不能创建、修改或删除预约。
- 新预约的 `owner_id` 由服务端从已验证的 Access Token 获取，客户端提交的所有者信息不会被信任。
- 普通用户只能修改和删除 `owner_id` 等于本人用户 ID 的预约。
- `LAB_ADMIN_EMAILS` 中的管理员可以修改和删除全部预约。
- 升级前创建、没有 `owner_id` 的旧预约只能由管理员管理。

预约 API 首次运行时会自动为 `lab_bookings` 增加：

```text
owner_id
owner_email
updated_at
```

## 锁定 Supabase Data API

网站通过受保护的 Next.js API 和 `DATABASE_URL` 访问数据库，不允许浏览器绕过权限接口直接写表。部署登录功能后，在 Supabase SQL Editor 中执行：

```text
supabase/migrations/004_secure_data_api.sql
```

该迁移会为 `lab_bookings`、`lab_duties` 和 `lab_people` 启用 RLS，并撤销 `anon`、`authenticated` 对这些表的直接 Data API 权限。Next.js 服务端使用数据库连接字符串，不受这项撤销影响。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开：

```text
http://localhost:3000
```

## Netlify 部署

先在 Netlify 当前站点中配置全部环境变量，再执行：

```bash
netlify deploy --prod --context production
```

环境变量变更后必须重新部署。

## 构建检查

```bash
npm run build
```

GitHub Actions 会检查所有浏览器运行脚本的 JavaScript 语法，并执行 Next.js 生产构建。
