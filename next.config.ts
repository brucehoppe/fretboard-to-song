import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Content-Security-Policy is set per-request in proxy.ts (it needs a fresh nonce
  // for vinext's inline hydration scripts); everything static lives here.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
