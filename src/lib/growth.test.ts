import { describe, expect, it } from "vitest";
import { fetchDownloads, summarizeDownloads, summarizeGrowth } from "./growth";

const release = (n: number, link: number, update: number) => ({
  tag_name: `abot-${n}`,
  published_at: "2026-11-13T10:00:00Z",
  assets: [
    { name: `abot-1.0.${n}.apk`, download_count: update },
    { name: "abot.apk", download_count: link },
  ],
});

describe("APK downloads", () => {
  it("splits the web link's abot.apk from the updater's versioned files, newest build first", () => {
    const s = summarizeDownloads([release(231, 2, 1), release(232, 92, 1), { tag_name: "apk-9", assets: [{ name: "abot.apk", download_count: 500 }] }]);
    expect(s.fromLink).toBe(94);
    expect(s.updates).toBe(2);
    expect(s.releases.map((r) => r.build)).toEqual([232, 231]);
  });

  it("ignores junk", () => {
    expect(summarizeDownloads(null)).toEqual({ fromLink: 0, updates: 0, releases: [] });
    expect(summarizeDownloads([{ tag_name: "abot-1", assets: [{ name: "abot.apk", download_count: -3 }, { name: "notes.txt", download_count: 9 }] }]).fromLink).toBe(0);
  });

  it("pages until a short page and explains a rate limit", async () => {
    const urls: string[] = [];
    const page = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body }) as Response;
    const full = Array.from({ length: 100 }, (_, i) => release(i + 1, 1, 0));
    const ok = await fetchDownloads((async (u: string) => {
      urls.push(u);
      return page(urls.length === 1 ? full : [release(500, 3, 0)]);
    }) as typeof fetch);
    expect(urls).toHaveLength(2);
    expect(ok.fromLink).toBe(103);
    await expect(fetchDownloads((async () => page({}, 403)) as typeof fetch)).rejects.toThrow(/rate limit/);
  });
});

describe("growth rows", () => {
  it("totals today, the last 7 days and the whole range", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ day: `2026-11-${String(i + 6).padStart(2, "0")}`, signups: i, active: i * 2 }));
    const g = summarizeGrowth(rows);
    expect(g.signupsToday).toBe(9);
    expect(g.signups7).toBe(3 + 4 + 5 + 6 + 7 + 8 + 9);
    expect(g.signupsTotal).toBe(45);
    expect(g.activeToday).toBe(18);
    expect(g.activePeak).toBe(18);
  });

  it("reads bigint strings and drops rows without a date", () => {
    const g = summarizeGrowth([{ day: "2026-11-15", signups: "12", active: "4" }, { day: null, signups: 9 }]);
    expect(g.days).toEqual([{ day: "2026-11-15", signups: 12, active: 4 }]);
    expect(summarizeGrowth(undefined).signupsTotal).toBe(0);
  });
});

describe("web visits", () => {
  it("totals today, 7 and 30 days, and keeps the top 5 pages", async () => {
    const { summarizeVisits } = await import("./growth");
    const days = Array.from({ length: 30 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, visitors: "1", views: 2 }));
    days[29] = { day: "2026-10-30", visitors: "5", views: 9 };
    const paths = ["/", "/workout", "/progress", "/history", "other", "/settings"].map((path, i) => ({ path, visitors: 6 - i, views: String(60 - i) }));
    const v = summarizeVisits(days, paths);
    expect(v.today).toBe(5);
    expect(v.last7).toBe(6 + 5);
    expect(v.last30).toBe(29 + 5);
    expect(v.days[29]).toEqual({ day: "2026-10-30", visitors: 5, views: 9 });
    expect(v.topPaths.map((p) => p.path)).toEqual(["/", "/workout", "/progress", "/history", "other"]);
    expect(v.topPaths[0]).toEqual({ path: "/", visitors: 6, views: 60 });
    expect(summarizeVisits(null, undefined)).toEqual({ days: [], today: 0, last7: 0, last30: 0, topPaths: [] });
  });
});
