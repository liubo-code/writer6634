# 伏线 · 小说工作台 v2.1 Cloudflare-ready

一个把 **软木板大纲 + 人物/伏笔关系 + 分章正文写作 + 云端自动保存** 放在同一个项目里的私人小说工作台。

## 当前能力

- 多本小说切换
- 每本书独立的大纲 / 正文工作区
- 软木板自由拖拽、阶段、人物、伏笔、脑洞、连线
- 章节与人物稳定 ID 关联
- 正文逐章编辑、字数、修文备注、专注模式、上一章/下一章
- 正文侧栏同步显示对应章节的大纲与人物标签
- D1 云端保存
- 大纲与正文 revision 冲突保护
- 浏览器本地未同步草稿恢复
- 大纲快照
- TXT / 大纲导出
- Cloudflare Access JWT 身份验证

## 技术栈

- Next.js 16 / React 19
- vinext + Vite
- Cloudflare Workers
- Cloudflare D1
- Cloudflare Access
- Drizzle ORM / Zod

## 部署

直接看：[`CLOUDFLARE_DEPLOY.md`](./CLOUDFLARE_DEPLOY.md)

正式部署前唯一不能替你凭空生成的是你自己 Cloudflare 账号里的 D1 Database ID 和 Access AUD。源码已把这些账号专属值留成明确的配置步骤。

## 数据库迁移

- `drizzle/0000_flat_lorna_dane.sql`：大纲工作区与快照
- `drizzle/0001_story_manuscript_chapters.sql`：独立逐章正文

## 重要文件

- `app/cloudflare-auth.ts`：读取并验证 Access 身份
- `lib/cloudflare-access.ts`：Access JWT RS256 验证
- `app/api/workspace/route.ts`：大纲工作区 API
- `app/api/manuscript/route.ts`：正文 API
- `app/api/snapshots/route.ts`：大纲快照 API
- `app/api/health/route.ts`：上线后健康检查
- `wrangler.jsonc`：Workers / D1 配置
- `vite.config.ts`：vinext + Cloudflare Vite plugin

## 本地命令

```bash
pnpm install --frozen-lockfile
pnpm cf:preflight
pnpm dev
pnpm build
```

本地开发使用仅限 development 的本地身份；生产环境没有有效 Cloudflare Access JWT 就不会进入工作台。
