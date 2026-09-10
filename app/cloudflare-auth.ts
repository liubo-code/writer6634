import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { verifyCloudflareAccessJwt } from "@/lib/cloudflare-access";
import { getSimpleUser, simpleGateConfigured, type SimpleUser } from "./simple-auth";

export type CloudflareUser = SimpleUser;

export async function getCloudflareUser(): Promise<CloudflareUser | null> {
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = env.CF_ACCESS_AUD?.trim();

  // Preferred mode: Cloudflare Access. Once configured, it takes priority.
  if (teamDomain && audience) {
    const requestHeaders = await headers();
    const token = requestHeaders.get("cf-access-jwt-assertion");
    if (!token) return null;

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

  // Temporary mode: private password gate with a signed HttpOnly cookie.
  if (simpleGateConfigured()) return getSimpleUser();

  // Local development fallback only. Production remains locked if no auth mode is configured.
  return getSimpleUser();
}

export function cloudflareAccessConfigured(): boolean {
  return Boolean(env.CF_ACCESS_TEAM_DOMAIN?.trim() && env.CF_ACCESS_AUD?.trim());
}
