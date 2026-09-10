import fs from "node:fs";

const configPath = new URL("../wrangler.jsonc", import.meta.url);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const problems = [];
const warnings = [];

if (config.name !== "fuxian-novel-workbench") {
  warnings.push(`Worker 名称现在是 ${JSON.stringify(config.name)}；Cloudflare 面板中的 Worker 名称必须与它一致。`);
}
if (config.main !== "vinext/server/app-router-entry") {
  problems.push("wrangler.jsonc 的 main 应为 vinext/server/app-router-entry。 ");
}
if (!Array.isArray(config.compatibility_flags) || !config.compatibility_flags.includes("nodejs_compat")) {
  problems.push("缺少 nodejs_compat compatibility flag。 ");
}
const db = config.d1_databases?.find((x) => x.binding === "DB");
if (!db) problems.push("缺少名为 DB 的 D1 binding。 ");
else if (!db.database_id || db.database_id === "00000000-0000-0000-0000-000000000000") {
  warnings.push("D1 database_id 仍是占位值。正式部署前要换成 Cloudflare 创建出的真实 Database ID。 ");
}
if (db && db.migrations_dir !== "drizzle") warnings.push("D1 migrations_dir 不是 drizzle；确认迁移文件位置。 ");

if (problems.length) {
  console.error("\n❌ Cloudflare preflight 未通过：");
  for (const x of problems) console.error(`  - ${x}`);
  process.exit(1);
}
console.log("\n✅ Cloudflare 项目结构检查通过。 ");
for (const x of warnings) console.warn(`⚠️  ${x}`);
console.log("\n运行时还需要在 Cloudflare Worker 中设置 CF_ACCESS_TEAM_DOMAIN 与 CF_ACCESS_AUD。\n");
