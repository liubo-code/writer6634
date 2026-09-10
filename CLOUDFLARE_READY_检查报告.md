# 伏线 v2.1 Cloudflare-ready · 检查报告

检查日期：2026-09-10

## 已完成检查

### 1. TypeScript / TSX 语法

- 扫描 87 个 `.ts` / `.tsx` 文件。
- TypeScript parser 结果：**0 个语法错误**。

### 2. Cloudflare Access JWT 验证器

使用 Node Web Crypto 临时生成 RSA-2048 密钥，对 `lib/cloudflare-access.ts` 的实际编译结果做了三类测试：

- 合法 RS256 JWT：通过。
- 错误 audience：正确拒绝。
- 被篡改签名：正确拒绝。

验证器同时检查 issuer、audience、exp、nbf、sub、email。

### 3. D1 / SQLite migration

将以下迁移依次应用到全新 SQLite 数据库：

- `drizzle/0000_flat_lorna_dane.sql`
- `drizzle/0001_story_manuscript_chapters.sql`

结果：**全部成功**。

确认生成：

- `story_workspaces`
- `story_snapshots`
- `story_manuscript_chapters`
- 对应索引

另外实际测试了大纲与正文使用的 revision 乐观锁更新语句，均按预期递增。

### 4. package / lock 一致性

- `package.json` 可正常解析。
- `wrangler.jsonc` 可正常解析。
- `package.json` 与 `pnpm-lock.yaml` 的 dependencies / devDependencies specifier：**0 个不一致**。

### 5. Cloudflare 配置静态检查

`pnpm cf:preflight` 对应脚本已运行：

- Worker main：`vinext/server/app-router-entry`，通过。
- `nodejs_compat`：存在。
- D1 binding：`DB`，存在。
- migrations 目录：`drizzle`，正确。
- D1 Database ID：当前仍是明显的占位 UUID，需要创建你自己的 D1 后替换。
- Access Team Domain / AUD：属于账号运行时值，需要在 Cloudflare 面板填写。

### 6. 旧托管环境清理

已经移除：

- `.openai/hosting.json`
- OpenAI Sites Vite plugin
- Sites 专用 execution-profile / installer / runtime 包装脚本
- `oai-authenticated-*` 登录 header
- `/signin-with-chatgpt` / `/signout-with-chatgpt` 逻辑

API 与首页均已切换到 Cloudflare Access 身份验证。

## 目前无法在本环境完成的一项检查

**完整 `pnpm install → vinext check → production build` 未执行。**

原因是当前代码执行环境无法访问 `registry.npmjs.org`，并非项目安装时报出的依赖错误。已经确认本环境请求 npm registry 会因 DNS / 网络访问失败而中止。

因此当前结论是：源码结构、语法、JWT 验证逻辑、数据库 migration、锁文件一致性均已检查；真正的 production build 会在代码进入可联网的 Cloudflare Workers Builds 后成为最后一道验证。如果首次 Cloudflare build 暴露 vinext beta 的兼容问题，应以构建日志为准继续修正。

## 正式上线前仍需的账号专属配置

1. 创建 `fuxian-db` 并把真实 D1 Database ID 写入 `wrangler.jsonc`。
2. 应用两份 D1 migrations。
3. 开启 Cloudflare Access，并设置：
   - `CF_ACCESS_TEAM_DOMAIN`
   - `CF_ACCESS_AUD`
4. Cloudflare Worker 项目名保持与 `wrangler.jsonc` 一致：`fuxian-novel-workbench`。
