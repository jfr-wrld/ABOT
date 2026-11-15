"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics, web build only (owner-approved 2026-11-15; next.config.ts leaves it out of
 * the Android export). Cookieless page views, sent to this site's own /_vercel/insights path.
 * Only the path is reported: the query and hash can carry a sign-in code or an order id, and
 * /admin visits are the founder's own.
 */
export function stripForAnalytics(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return null;
  return { ...event, url: url.origin + url.pathname };
}

export function WebAnalytics() {
  // Development would load Vercel's debug script from another host, which the CSP blocks.
  if (process.env.ABOT_WEB_ANALYTICS !== "1" || process.env.NODE_ENV !== "production") return null;
  return <Analytics beforeSend={stripForAnalytics} />;
}
