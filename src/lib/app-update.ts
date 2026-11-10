/**
 * Android app updates from GitHub Releases. Builds of main are published as release
 * "apk-<run number>" with the APK attached (.github/workflows/android.yml); the installed app's
 * build number is the same run number (versionCode), so newer means a bigger number. Checked every
 * time the app starts, on return from the background at most every 30 minutes, and when the
 * lifter taps "Check for updates" (CLAUDE.md network exceptions).
 */

export const UPDATE_REPO = process.env.NEXT_PUBLIC_ABOT_UPDATE_REPO || "jfr-wrld/ABOT";

/**
 * Which key signed this build. "legacy": the old debug key that was public in the repository,
 * releases tagged apk-<n>. "release": the private release key, releases tagged abot-<n>. A phone
 * cannot move between the two in place (Android refuses an update signed by another key), so a
 * legacy build that sees an abot-<n> release guides a reinstall instead of downloading it.
 */
export const SIGNING: "legacy" | "release" = process.env.NEXT_PUBLIC_ABOT_SIGNING === "release" ? "release" : "legacy";
export type Channel = "apk" | "abot";
const OWN_CHANNEL: Channel = SIGNING === "release" ? "abot" : "apk";

export interface LatestRelease {
  channel: Channel;
  build: number;
  version: string;
  apkUrl: string;
  publishedAt: string | null;
  notes: string;
}

/** The release JSON from the GitHub API, read safely; null when it is not an APK release. */
export function parseRelease(raw: unknown): LatestRelease | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as { tag_name?: unknown; name?: unknown; body?: unknown; published_at?: unknown; assets?: unknown };
  const m = typeof r.tag_name === "string" ? /^(apk|abot)-(\d+)$/.exec(r.tag_name) : null;
  if (!m) return null;
  const channel = m[1] as Channel;
  const assets = Array.isArray(r.assets) ? (r.assets as { name?: unknown; browser_download_url?: unknown }[]) : [];
  // The APK must come from this repository's own release for this tag, nowhere else.
  const own = `https://github.com/${UPDATE_REPO}/releases/download/${r.tag_name}/`;
  const apk = assets.find(
    (a) =>
      typeof a.name === "string" &&
      a.name.endsWith(".apk") &&
      typeof a.browser_download_url === "string" &&
      a.browser_download_url.startsWith(own) &&
      /^[\w.-]+\.apk$/.test(a.browser_download_url.slice(own.length)),
  );
  if (!apk) return null;
  const build = Number(m[2]);
  return {
    channel,
    build,
    version: `1.0.${build}`,
    apkUrl: String(apk.browser_download_url),
    publishedAt: typeof r.published_at === "string" ? r.published_at : null,
    notes: typeof r.body === "string" ? r.body.slice(0, 2000) : "",
  };
}

export type UpdateCheck =
  | { kind: "available"; release: LatestRelease; changes: LatestRelease[] }
  /** A legacy build, and the app now ships signed with the release key: reinstall once. */
  | { kind: "moved"; release: LatestRelease }
  | { kind: "current"; build: number }
  | { kind: "none" }
  | { kind: "error" };

/**
 * Compares the newest releases with the installed build. `changes` is every newer release,
 * newest first, so the changelog covers all the builds this phone skipped.
 */
export function compareBuild(releases: LatestRelease | LatestRelease[] | null, installedBuild: number, own: Channel = OWN_CHANNEL): UpdateCheck {
  const all = (Array.isArray(releases) ? releases : releases ? [releases] : []).slice().sort((a, b) => b.build - a.build);
  // Only releases signed like this build can install over it.
  const list = all.filter((r) => r.channel === own);
  const moved = own === "apk" ? all.find((r) => r.channel === "abot") : undefined;
  if (moved) return { kind: "moved", release: moved };
  if (list.length === 0) return { kind: "none" };
  const newer = list.filter((r) => r.build > installedBuild);
  return newer.length > 0 ? { kind: "available", release: newer[0]!, changes: newer } : { kind: "current", build: installedBuild };
}

export async function checkForUpdate(installedBuild: number, fetcher: typeof fetch = fetch): Promise<UpdateCheck> {
  try {
    const res = await fetcher(`https://api.github.com/repos/${UPDATE_REPO}/releases?per_page=30`, { headers: { Accept: "application/vnd.github+json" } });
    if (res.status === 404) return { kind: "none" };
    if (!res.ok) return { kind: "error" };
    const body: unknown = await res.json();
    const list = (Array.isArray(body) ? body : [body]).map(parseRelease).filter((r): r is LatestRelease => r !== null);
    return compareBuild(list, installedBuild);
  } catch {
    return { kind: "error" };
  }
}

/** A release's notes as changelog lines: list and heading markers and blank lines dropped, at most `max`. */
export function changelogLines(notes: string, max = 8): string[] {
  return notes
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+\.|#+)\s+/, "").trim())
    .filter((l) => l.length > 0 && !/^#+$/.test(l))
    .slice(0, max);
}

/**
 * How often a return from the background asks GitHub again. A cold start always asks: builds land
 * several times a day, and a long wait meant a phone opened right after one build never heard of
 * the next.
 */
export const AUTO_CHECK_MS = 30 * 60_000;
/** "Later" keeps a version's pop-up away this long. */
export const LATER_MS = 24 * 3_600_000;

export function checkDue(lastCheckedAt: number | null, now: number): boolean {
  return lastCheckedAt === null || now - lastCheckedAt >= AUTO_CHECK_MS;
}

/** The pop-up for `build` was put off and the wait is not over (a newer build shows at once). */
export function putOff(later: { build: number; until: number } | null, build: number, now: number): boolean {
  return later !== null && later.build >= build && now < later.until;
}
