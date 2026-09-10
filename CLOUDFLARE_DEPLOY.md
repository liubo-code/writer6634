# 伏线 v2.1 · Cloudflare Workers 部署说明

这份工程已经从 OpenAI Sites 托管环境整理为原生 **Cloudflare Workers + vinext + D1 + Cloudflare Access** 结构。

## 架构

- **vinext / Next.js App Router**：网页、大纲和正文界面
- **Cloudflare Workers**：SSR 与 `/api/*` 后端
- **Cloudflare D1**：工作区、大纲快照、逐章正文
- **Cloudflare Access**：登录门禁与用户身份
- **GitHub**：源码仓库，可接 Cloudflare Workers Builds 自动发布

## 第一次上线前，必须完成 3 个账号级配置

### 1. 创建 D1 数据库

在 Cloudflare 控制台创建一个 D1 数据库，建议名字：

`fuxian-db`

创建后复制它的 **Database ID**，把 `wrangler.jsonc` 里的：

`00000000-0000-0000-0000-000000000000`

替换成真实 ID。Binding 名必须保留为：

`DB`

也可以在本机登录 Wrangler 后运行：

```bash
npx wrangler login
npx wrangler d1 create fuxian-db --binding DB --update-config
```

### 2. 应用数据库迁移

D1 建好并写入真实 ID 后执行：

```bash
npx wrangler d1 migrations apply fuxian-db --remote
```

会依次创建：

- `story_workspaces`
- `story_snapshots`
- `story_manuscript_chapters`

本地开发数据库可运行：

```bash
npx wrangler d1 migrations apply fuxian-db --local
```

### 3. 配置 Cloudflare Access

给这个 Worker 开启 Cloudflare Access，只允许你自己的邮箱访问。随后在 Worker 的 **Settings → Variables & Secrets** 添加两个普通变量：

- `CF_ACCESS_TEAM_DOMAIN`：例如 `https://你的团队名.cloudflareaccess.com`
- `CF_ACCESS_AUD`：这个 Access Application 的 **Application Audience (AUD) Tag**

应用会验证 `Cf-Access-Jwt-Assertion` 的 RSA 签名、issuer、audience 与有效期，然后使用 JWT 的 `sub` 作为数据库中的 owner。它不会只相信可以伪造的邮箱请求头。

`wrangler.jsonc` 已设置 `keep_vars: true`，通过 Wrangler / Git 自动部署时会保留你在 Cloudflare 面板中设置的运行时 Variables。

## GitHub → Cloudflare 自动部署

推荐把整个工程放到一个 GitHub 仓库根目录，然后在 Cloudflare：

1. **Workers & Pages** → **Create application**
2. 选择 **Import a repository**
3. 选择 GitHub 仓库
4. Worker 名称填写 `fuxian-novel-workbench`
5. Production branch 选择 `main`

建议构建设置：

- Install command：让 Cloudflare 按 `pnpm-lock.yaml` 自动安装，或 `pnpm install --frozen-lockfile`
- Build command：`pnpm build`
- Deploy command：`npx @vinext/cloudflare@1.0.0-beta.5 deploy --skip-build`

Cloudflare Workers 的 Git 集成会在以后每次 push 后自动重新构建部署。

## 本地检查

安装依赖后：

```bash
pnpm install --frozen-lockfile
pnpm cf:preflight
pnpm check:vinext
pnpm build
```

开发：

```bash
pnpm dev
```

`NODE_ENV=development` 时使用固定的本地开发身份，因此本机开发不需要先搭 Cloudflare Access。这个旁路不会在 production build 中生效。

## 上线后的最低烟雾测试

登录 Access 后依次检查：

1. `/api/health` 返回 `ok: true`、`database: true`、`accessConfigured: true`
2. 新建一本书，刷新页面后仍存在
3. 新建章节，填写大纲，刷新后仍存在
4. 切换到正文，输入文字，等待顶部显示已保存，再刷新确认正文存在
5. 回大纲修改该章标签，再进正文确认右侧大纲参考同步
6. 新建第二本书并切换，确认两本书互不串数据
7. 建立一个大纲快照，再恢复一次
8. 导出正文 TXT / 大纲备份

## 安全说明

- 所有数据 API 都从已验证的 Cloudflare Access JWT 获取 `owner`，客户端不能自己指定 owner。
- 写接口保留了跨站请求拦截。
- D1 查询全部使用参数绑定。
- 大纲与正文都有 revision 冲突保护；正文还有浏览器本地未同步草稿。
- 没有正确配置 Access 时，首页保持锁定，API 返回 401，不会自动退化成公开单用户模式。

## 当前版本说明

Cloudflare 官方目前推荐 Next.js 16 应用使用 vinext 部署到 Workers。本工程沿用原源码的 vinext `1.0.0-beta.5`，避免在这次部署改造里同时升级框架版本。等首次稳定上线后，再单独评估升级 vinext，能少制造几种完全不必要的变量。
