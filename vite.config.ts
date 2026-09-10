import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import vinext from "vinext";

/**
 * Cloudflare Workers + vinext (Next.js App Router) configuration.
 *
 * Keep this intentionally small. Cloudflare recommends using the native
 * vinext integration and reading platform bindings with `cloudflare:workers`.
 */
export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
  ],
});
