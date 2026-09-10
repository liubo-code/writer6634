import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { verifyCloudflareAccessJwt } from "@/lib/cloudflare-access";

export type CloudflareUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

/**
 * Local vinext development has no Cloudflare Access layer in front of it.
 * The fallback is deliberately limited to NODE_ENV=development so it cannot
 * become an accidental production authentication bypass.
 */
function localDevelopmentUser(): CloudflareUser | null {
  if (process.env.NODE_ENV !== "development") return null;
  return {
    userId: "local-development-user",
    displayName: "本地开发",
    email: "local@fuxian.invalid",
    fullName: "本地开发",
  };
}

export async function getCloudflareUser(): Promise<CloudflareUser | null> {
  const requestHeaders = await headers();
  const token = requestHeaders.get("cf-access-jwt-assertion");
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.CF_ACCESS_AUD?.trim();

  if (!token || !teamDomain || !audience) return localDevelopmentUser();

  try {
    const payload = await verifyCloudflareAccessJwt(token, teamDomain, audience);
    const email = String(payload.email);
    const fullName = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : null;
    return {
      userId: String(payload.sub),
      displayName: fullName ?? email,
      email,
      fullName,
    };
  } catch (error) {
    console.error("Cloudflare Access authentication failed", error);
    return null;
  }
}

export function cloudflareAccessConfigured(): boolean {
  return Boolean(env.CF_ACCESS_TEAM_DOMAIN?.trim() && env.CF_ACCESS_AUD?.trim());
}
