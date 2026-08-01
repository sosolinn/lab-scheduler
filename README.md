# LabScheduler

楷模实验室超净台预约与值日管理系统，基于 Next.js App Router 与 Supabase PostgreSQL。

## 主要功能

- 超净台一周预约与时间冲突校验
- 共享预约、值日和人员名单
- 本地用户名＋密码登录，不依赖邮箱确认、国际邮件或第三方社交账号
- 管理员创建、停用和管理实验室成员账户
- 普通用户只能修改、删除本人预约
- 管理员可以管理全部预约
- 值日记录仅允许按北京时间当天提交，同日重新提交会覆盖
- 首次登录或管理员重置密码后，用户必须修改临时密码

## 环境变量

复制示例文件：

```bash
cp .env.example .env.local
```

填写：

```env
DATABASE_URL="Supabase Transaction pooler URL"
DIRECT_URL="Supabase Direct connection URL"
LAB_BOOTSTRAP_ADMIN_USERNAME="admin"
LAB_BOOTSTRAP_ADMIN_PASSWORD="至少8位的强密码"
LAB_BOOTSTRAP_ADMIN_DISPLAY_NAME="实验室管理员"
LAB_TIME_ZONE="Asia/Shanghai"
```

说明：

- `DATABASE_URL`：网站 API 连接 PostgreSQL 使用，推荐 Supabase Transaction pooler。
- `DIRECT_URL`：数据库迁移时可选。
- `LAB_BOOTSTRAP_ADMIN_USERNAME`：首个管理员用户名。
- `LAB_BOOTSTRAP_ADMIN_PASSWORD`：首个管理员初始密码，至少 8 位。
- `LAB_BOOTSTRAP_ADMIN_DISPLAY_NAME`：首个管理员显示姓名。
- `LAB_TIME_ZONE`：值日日期判定时区，默认 `Asia/Shanghai`。

系统只在 `lab_users` 中尚无管理员时使用启动变量创建首个管理员。创建完成后，其他账户均由管理员在网站“设置 → 成员账户管理”中创建。

不要把真实 `.env.local`、数据库密码或管理员密码提交到 GitHub。

## 登录与账户安全

- 密码使用 Node.js `scrypt` 加盐哈希保存，不保存明文。
- 登录状态使用随机会话令牌和 `HttpOnly` Cookie。
- 会话默认有效期为 7 天。
- 用户修改密码后，其他设备上的登录会话会失效。
- 管理员重置密码后，该用户所有旧会话都会失效，并在下次登录后被要求修改临时密码。
- 管理员可以停用账户，停用后用户会立即失去访问权限。
- 系统禁止停用当前登录管理员自己，也禁止移除最后一个启用管理员。

## 数据库表

首次运行时，服务端会自动创建：

```text
lab_users
lab_sessions
```

并为这两张表启用 RLS、撤销 `anon` 和 `authenticated` 的直接 Data API 权限。浏览器不能直接读取密码哈希或会话令牌。

也可以在 Supabase SQL Editor 中执行：

```text
supabase/migrations/005_local_username_auth.sql
```

## 首次启动

1. 在 `.env.local` 中填写 `DATABASE_URL` 和首个管理员变量。
2. 启动项目：

```bash
npm install
npm run dev
```

3. 打开：

```text
http://localhost:3000
```

4. 使用 `LAB_BOOTSTRAP_ADMIN_USERNAME` 和 `LAB_BOOTSTRAP_ADMIN_PASSWORD` 登录。
5. 进入“设置 → 成员账户管理”，为实验室成员创建用户名和临时密码。
6. 成员首次登录后，在设置页修改密码。

环境变量变更后必须完全重启开发服务器。

## Netlify 部署

在 Netlify 当前站点的环境变量中填写：

```text
DATABASE_URL
LAB_BOOTSTRAP_ADMIN_USERNAME
LAB_BOOTSTRAP_ADMIN_PASSWORD
LAB_BOOTSTRAP_ADMIN_DISPLAY_NAME
LAB_TIME_ZONE
```

随后重新部署。首个管理员创建成功后，仍应保留这些变量以便部署环境一致；系统不会覆盖已有管理员密码。

## 权限规则

- 所有人都可以查看预约情况和历史值日记录。
- 未登录用户不能创建、修改或删除预约，也不能提交值日记录。
- 新预约自动绑定当前本地账户 UUID。
- 普通用户只能修改和删除本人预约。
- 管理员可以管理全部预约、账户和旧预约。
- 值日记录不允许删除；当日可重新提交覆盖。

## 构建检查

```bash
npm run build
```
