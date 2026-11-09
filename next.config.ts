import type { NextConfig } from "next";

// `npm run build:android` sets this: the app ships inside the APK as plain static files.
const nativeApp = process.env.ABOT_TARGET === "android";

const nextConfig: NextConfig = {
  ...(nativeApp ? { output: "export" as const, trailingSlash: true } : {}),
  // Partial prerendering needs a server; the static export goes without it.
  cacheComponents: !nativeApp,
  // The dev badge sits over the Home tab of the bottom bar; errors still surface without it.
  devIndicators: false,
  partialPrefetching: !nativeApp,
  // Web build only (a static export has no server to send headers). No page is meant to be shown
  // inside another site's frame; that includes /admin, which would otherwise be open to clickjacking.
  ...(nativeApp
    ? {}
    : {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
                { key: "X-Frame-Options", value: "DENY" },
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
              ],
            },
          ];
        },
      }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
