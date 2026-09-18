/** Stand-in for the `cloudflare:workers` module. Tests assign `env.DB`. */
export const env: { DB?: D1Database; PRACTICE_PASSPHRASE?: string; AUTH_SECRET?: string } = {};
