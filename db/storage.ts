import { env } from 'cloudflare:workers';
export function storage() { if (!env.DB) throw new Error('DB unavailable'); return env.DB; }
