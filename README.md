# LabScheduler

实验室超净台预约与值日管理系统，现已迁移为 Next.js App Router 项目。

## 当前迁移策略

为确保现有 UI、交互逻辑以及浏览器中的历史数据完全兼容，Next.js 会在构建时读取原有 `index.html`、`style.css` 和 `script.js`：

- `app/layout.js`：Next.js 根布局与全局样式入口
- `app/page.js`：读取并渲染原页面结构
- `app/LegacyScriptRunner.js`：在客户端加载原有业务逻辑
- `index.html`：保留的原页面结构源文件
- `style.css`：保留的原样式文件
- `script.js`：保留的预约、值日和 localStorage 逻辑

原有 localStorage 键名未修改，因此升级前保存的预约和值日记录仍可继续使用。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`。

## 构建与预览

```bash
npm run build
npm run start
```

构建结果输出到 `out` 目录，可部署到 GitHub Pages、Vercel 或其他静态托管平台。
