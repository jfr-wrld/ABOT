import { UPDATE_REPO } from "@/lib/app-update";

/**
 * Mission Control's Growth numbers. APK downloads come from the public GitHub Releases API (the
 * same call the update check makes). CI uploads each build twice: abot.apk, the fixed name the web
 * "Get the app" link points at, and abot-1.0.<n>.apk, the file the in-app updater downloads. So
 * abot.apk counts installs from the web link, and the versioned files count updates by people who
 * already have the app. GitHub counts downloads, not people: one phone downloading twice counts 2.
 */

export interface ReleaseDownloads {
  tag: string;
  build: number;
  publishedAt: string | null;
  fromLink: number;
  updates: number;
}

export interface DownloadSummary {
  fromLink: number;
  updates: number;
  releases: ReleaseDownloads[];
}

export function summarizeDownloads(raw: unknown): DownloadSummary {
  const releases: ReleaseDownloads[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const rel = r as { tag_name?: unknown; published_at?: unknown; assets?: unknown };
    const m = typeof rel.tag_name === "string" ? /^abot-(\d+)$/.exec(rel.tag_name) : null;
    if (!m) continue;
    let fromLink = 0;
    let updates = 0;
    for (const a of Array.isArray(rel.assets) ? (rel.assets as { name?: unknown; download_count?: unknown }[]) : []) {
      const n = typeof a.download_count === "number" && a.download_count > 0 ? a.download_count : 0;
      if (a.name === "abot.apk") fromLink += n;
      else if (typeof a.name === "string" && a.name.endsWith(".apk")) updates += n;
    }
    releases.push({ tag: rel.tag_name as string, build: Number(m[1]), publishedAt: typeof rel.published_at === "string" ? rel.published_at : null, fromLink, updates });
  }
  releases.sort((a, b) => b.build - a.build);
  return {
    fromLink: releases.reduce((s, r) => s + r.fromLink, 0),
    updates: releases.reduce((s, r) => s + r.updates, 0),
    releases,
  };
}

/** Up to 300 releases (3 pages); every build is one release, so this reaches back far enough. */
export async function fetchDownloads(fetcher: typeof fetch = fetch): Promise<DownloadSummary> {
  const all: unknown[] = [];
  for (let page = 1; page <= 3; page++) {
    const res = await fetcher(`https://api.github.com/repos/${UPDATE_REPO}/releases?per_page=100&page=${page}`, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(res.status === 403 ? "GitHub rate limit reached (60 calls an hour per IP). Try again later." : `GitHub answered ${res.status}.`);
    const batch: unknown = await res.json();
    if (!Array.isArray(batch)) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return summarizeDownloads(all);
}

export interface GrowthDay {
  day: string;
  signups: number;
  active: number;
}

export interface GrowthSummary {
  days: GrowthDay[];
  signupsToday: number;
  signups7: number;
  signupsTotal: number;
  activeToday: number;
  /** The busiest day in the range: accounts that synced. */
  activePeak: number;
}

export function summarizeGrowth(raw: unknown): GrowthSummary {
  const days: GrowthDay[] = (Array.isArray(raw) ? raw : [])
    .map((r) => {
      const row = r as Record<string, unknown>;
      return { day: String(row.day ?? ""), signups: Number(row.signups ?? 0) || 0, active: Number(row.active ?? 0) || 0 };
    })
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day));
  const sum = (xs: GrowthDay[], k: "signups" | "active") => xs.reduce((s, d) => s + d[k], 0);
  const last = days.at(-1);
  return {
    days,
    signupsToday: last?.signups ?? 0,
    signups7: sum(days.slice(-7), "signups"),
    signupsTotal: sum(days, "signups"),
    activeToday: last?.active ?? 0,
    activePeak: days.reduce((m, d) => Math.max(m, d.active), 0),
  };
}
