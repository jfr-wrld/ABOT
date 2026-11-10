import type { NextConfig } from "next";

// `npm run build:android` sets this: the app ships inside the APK as plain static files.
const nativeApp = process.env.ABOT_TARGET === "android";

/**
 * Content-Security-Policy for the web build (security audit 2026-11-11). Scripts come from this
 * site only; 'unsafe-inline' stays because Next.js writes its page data as inline scripts and a
 * static page has no per-request nonce. The policy still blocks scripts from other hosts, plugins,
 * <base> tricks, forms posting elsewhere, and data sent to hosts ABOT does not use.
 */
function contentSecurityPolicy(): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    // Exercise photos, Google profile pictures and lifters' own GIF links come from many hosts.
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    `connect-src 'self' ${supabase} ${supabase.replace(/^https:/, "wss:")} https://api.github.com https://raw.githubusercontent.com https://nominatim.openstreetmap.org https://overpass-api.de${dev ? " ws:" : ""}`.replace(/ +/g, " "),
    "frame-src https://www.youtube-nocookie.com https://www.tiktok.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

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
                { key: "Content-Security-Policy", value: contentSecurityPolicy() },
                { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()" },
                { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
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
