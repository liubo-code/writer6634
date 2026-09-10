declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    /** Temporary private gate password. Configure as a Secret in production. */
    APP_GATE_PASSWORD?: string;
    /** HMAC secret used to sign the temporary session cookie. Use at least 32 random characters. */
    APP_SESSION_SECRET?: string;
    /** Cloudflare Access team domain, e.g. https://your-team.cloudflareaccess.com */
    CF_ACCESS_TEAM_DOMAIN?: string;
    /** Application Audience (AUD) tag for the Access application. */
    CF_ACCESS_AUD?: string;
  }
}
