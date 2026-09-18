import { NextRequest, NextResponse } from 'next/server';

/*
 * Per-request CSP with a fresh nonce, following Next.js's documented nonce recipe.
 * vinext's inline hydration/RSC-bootstrap scripts pick up the nonce automatically
 * from this header (see node_modules/vinext/dist/server/csp.js) — a static CSP in
 * next.config.ts headers() can't do this since the nonce must change per request.
 */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  // next.config.ts headers() only reach route handlers under vinext, not the page itself.
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'same-origin');
  return response;
}
