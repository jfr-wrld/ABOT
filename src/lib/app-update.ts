/**
 * Android app updates from GitHub Releases. Builds of main are published as release
 * "apk-<run number>" with the APK attached (.github/workflows/android.yml); the installed app's
 * build number is the same run number (versionCode), so newer means a bigger number. Checked only
 * when the lifter taps "Check for updates" (CLAUDE.md network exceptions).
 */

export const UPDATE_REPO = process.env.NEXT_PUBLIC_ABOT_UPDATE_REPO || "jfr-wrld/ABOT";

export interface LatestRelease {
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
  const m = typeof r.tag_name === "string" ? /^apk-(\d+)$/.exec(r.tag_name) : null;
  if (!m) return null;
  const assets = Array.isArray(r.assets) ? (r.assets as { name?: unknown; browser_download_url?: unknown }[]) : [];
  const apk = assets.find((a) => typeof a.name === "string" && a.name.endsWith(".apk") && typeof a.browser_download_url === "string");
  if (!apk) return null;
  const build = Number(m[1]);
  return {
    build,
    version: `1.0.${build}`,
    apkUrl: String(apk.browser_download_url),
    publishedAt: typeof r.published_at === "string" ? r.published_at : null,
    notes: typeof r.body === "string" ? r.body.slice(0, 280) : "",
  };
}

export type UpdateCheck =
  | { kind: "available"; release: LatestRelease }
  | { kind: "current"; build: number }
  | { kind: "none" }
  | { kind: "error" };

/** Compares the newest release with the installed build. */
export function compareBuild(release: LatestRelease | null, installedBuild: number): UpdateCheck {
  if (!release) return { kind: "none" };
  return release.build > installedBuild ? { kind: "available", release } : { kind: "current", build: installedBuild };
}

export async function checkForUpdate(installedBuild: number, fetcher: typeof fetch = fetch): Promise<UpdateCheck> {
  try {
    const res = await fetcher(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
    if (res.status === 404) return { kind: "none" };
    if (!res.ok) return { kind: "error" };
    return compareBuild(parseRelease(await res.json()), installedBuild);
  } catch {
    return { kind: "error" };
  }
}
