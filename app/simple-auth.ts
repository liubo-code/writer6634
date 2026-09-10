import { env } from "cloudflare:workers";
import { headers } from "next/headers";

const COOKIE_NAME = "fuxian_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const OWNER_ID = "fuxian-primary-owner";
const encoder = new TextEncoder();

export type SimpleUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

function localDevelopmentUser(): SimpleUser | null {
  if (process.env.NODE_ENV !== "development") return null;
  return {
    userId: OWNER_ID,
    displayName: "本地开发",
    email: "local@fuxian.invalid",
    fullName: "本地开发",
  };
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function sessionKey() {
  const secret = env.APP_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("APP_SESSION_SECRET is not configured");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(value: string) {
  const signature = await crypto.subtle.sign("HMAC", await sessionKey(), encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createSessionToken() {
  const payload = bytesToBase64Url(
    encoder.encode(
      JSON.stringify({
        sub: OWNER_ID,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      }),
    ),
  );
  return `${payload}.${await sign(payload)}`;
}

async function verifySessionToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await sessionKey(),
      base64UrlToBytes(signature),
      encoder.encode(payload),
    );
    if (!ok) return false;
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as { sub?: string; exp?: number };
    return decoded.sub === OWNER_ID && typeof decoded.exp === "number" && decoded.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function readCookie(cookieHeader: string, name: string) {
  for (const item of cookieHeader.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

export async function verifyGatePassword(input: string) {
  const expected = env.APP_GATE_PASSWORD ?? "";
  if (!expected) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(input)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let diff = av.length ^ bv.length;
  for (let i = 0; i < Math.min(av.length, bv.length); i++) diff |= av[i] ^ bv[i];
  return diff === 0;
}

export function simpleGateConfigured() {
  return Boolean(env.APP_GATE_PASSWORD && env.APP_SESSION_SECRET && env.APP_SESSION_SECRET.trim().length >= 32);
}

export async function getSimpleUser(): Promise<SimpleUser | null> {
  if (!simpleGateConfigured()) return localDevelopmentUser();
  const requestHeaders = await headers();
  const token = readCookie(requestHeaders.get("cookie") ?? "", COOKIE_NAME);
  if (!token || !(await verifySessionToken(token))) return null;
  return {
    userId: OWNER_ID,
    displayName: "伏线用户",
    email: "private@fuxian.invalid",
    fullName: null,
  };
}

export function sessionCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
