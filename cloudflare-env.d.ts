declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    /** Passphrase gating write/read access to /api/practice. Set with `wrangler secret put`. */
    PRACTICE_PASSPHRASE?: string;
    /** HMAC key signing the session cookie. Set with `wrangler secret put`. */
    AUTH_SECRET?: string;
  }
}
