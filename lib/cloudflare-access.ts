export type AccessJwtPayload = {
  sub?: string;
  email?: string;
  name?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  [key: string]: unknown;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type JwkKey = JsonWebKey & { kid?: string; alg?: string; use?: string };
type Jwks = { keys?: JwkKey[] };

const keyCache = new Map<string, CryptoKey>();

function normalizeTeamDomain(value: string): string {
  const raw = value.trim().replace(/\/+$/, "");
  if (!raw) throw new Error("Cloudflare Access team domain is missing");
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJsonPart<T>(value: string): T {
  const decoded = new TextDecoder().decode(decodeBase64Url(value));
  return JSON.parse(decoded) as T;
}

function audienceMatches(actual: string | string[] | undefined, expected: string): boolean {
  return typeof actual === "string" ? actual === expected : Array.isArray(actual) && actual.includes(expected);
}

async function importSigningKey(
  teamDomain: string,
  kid: string,
  fetcher: typeof fetch,
): Promise<CryptoKey> {
  const cacheKey = `${teamDomain}|${kid}`;
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetcher(`${teamDomain}/cdn-cgi/access/certs`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Unable to fetch Cloudflare Access signing keys (${response.status})`);

  const jwks = (await response.json()) as Jwks;
  const jwk = jwks.keys?.find((candidate) => candidate.kid === kid);
  if (!jwk) throw new Error("Cloudflare Access signing key was not found");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  keyCache.set(cacheKey, key);
  return key;
}

/**
 * Verify the signed JWT added by Cloudflare Access.
 *
 * The application intentionally validates the signature, issuer, audience and
 * token lifetime instead of trusting a user-controlled identity header.
 */
export async function verifyCloudflareAccessJwt(
  token: string,
  teamDomainValue: string,
  expectedAudience: string,
  fetcher: typeof fetch = fetch,
): Promise<AccessJwtPayload> {
  const teamDomain = normalizeTeamDomain(teamDomainValue);
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed Cloudflare Access JWT");

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonPart<JwtHeader>(encodedHeader);
  const payload = decodeJsonPart<AccessJwtPayload>(encodedPayload);

  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported Cloudflare Access JWT header");

  const key = await importSigningKey(teamDomain, header.kid, fetcher);
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!verified) throw new Error("Invalid Cloudflare Access JWT signature");

  const now = Math.floor(Date.now() / 1000);
  const issuer = teamDomain;
  if (payload.iss !== issuer) throw new Error("Cloudflare Access JWT issuer mismatch");
  if (!audienceMatches(payload.aud, expectedAudience)) throw new Error("Cloudflare Access JWT audience mismatch");
  if (typeof payload.exp !== "number" || payload.exp <= now) throw new Error("Cloudflare Access JWT has expired");
  if (typeof payload.nbf === "number" && payload.nbf > now + 30) throw new Error("Cloudflare Access JWT is not active yet");
  if (!payload.sub || !payload.email) throw new Error("Cloudflare Access identity is incomplete");

  return payload;
}
