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
