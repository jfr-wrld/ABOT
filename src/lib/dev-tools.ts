/**
 * Testing switches (the monetization simulator, Simulate on the paywall, device licence edits,
 * built-in offline codes, the local remote-config override) exist only in development builds:
 * `next dev`, tests, or a build made with NEXT_PUBLIC_ABOT_DEV=1. Release builds (CI, Vercel)
 * leave them out, so no one can turn PRO on from the app itself (security audit 2026-11-11).
 */
export const DEV_TOOLS = process.env.NEXT_PUBLIC_ABOT_DEV === "1" || process.env.NODE_ENV !== "production";
