import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Create/bind the D1 database in wrangler.jsonc before using database features."
    );
  }

  return drizzle(env.DB, { schema });
}
