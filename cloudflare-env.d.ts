declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    /** Cloudflare Access team domain, e.g. https://your-team.cloudflareaccess.com */
    CF_ACCESS_TEAM_DOMAIN?: string;
    /** Application Audience (AUD) tag for the Access application. */
    CF_ACCESS_AUD?: string;
  }
}
