import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET() {
  let database = false;
  let databaseError: string | null = null;
  try {
    const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    database = row?.ok === 1;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "Unknown database error";
  }

  const accessConfigured = Boolean(env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD);
  const simpleGateConfigured = Boolean(
    env.APP_GATE_PASSWORD && env.APP_SESSION_SECRET && env.APP_SESSION_SECRET.trim().length >= 32,
  );

  return Response.json(
    {
      ok: database,
      runtime: "cloudflare-workers",
      database,
      authMode: accessConfigured ? "cloudflare-access" : simpleGateConfigured ? "password-gate" : "locked",
      accessConfigured,
      simpleGateConfigured,
      databaseError,
    },
    {
      status: database ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
