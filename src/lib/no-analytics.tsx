/**
 * Stands in for `@vercel/analytics/next` in the Android build (next.config.ts aliases it), so the
 * app ships none of its code: the zero-network rule allows Vercel Web Analytics on the web only.
 */
export function Analytics(): null {
  return null;
}
