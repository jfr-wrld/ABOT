/**
 * The in-app path a `?from=`, `?next=` or saved sign-in return may lead to, or null.
 *
 * Checking for a leading "/" is not enough: browsers read "/\evil.com" (and "/\t/evil.com") as
 * "//evil.com", another site (security audit 2026-11-11). The path is resolved against this
 * origin instead, and only a result on the same origin counts.
 */
export function safeReturnPath(raw: string | null | undefined, origin = "https://abot.invalid"): string | null {
  if (!raw || !raw.startsWith("/") || /[\\\u0000-\u001f]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return null;
  }
  if (url.origin !== new URL(origin).origin) return null;
  return url.pathname + url.search + url.hash;
}
