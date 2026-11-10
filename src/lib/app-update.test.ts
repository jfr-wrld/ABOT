import { describe, expect, it } from "vitest";
import { AUTO_CHECK_MS, changelogLines, checkDue, checkForUpdate, compareBuild, parseRelease, putOff } from "./app-update";

const release = {
  tag_name: "apk-130",
  name: "ABOT 1.0.130",
  body: "Dock in liquid glass",
  published_at: "2026-11-10T08:00:00Z",
  assets: [{ name: "abot-1.0.130.apk", browser_download_url: "https://github.com/jfr-wrld/ABOT/releases/download/apk-130/abot-1.0.130.apk" }],
};

describe("app updates", () => {
  it("reads an APK release: build, version, download link", () => {
    expect(parseRelease(release)).toMatchObject({ build: 130, version: "1.0.130", apkUrl: release.assets[0]!.browser_download_url });
    expect(parseRelease({ ...release, tag_name: "v2" })).toBeNull();
    expect(parseRelease({ ...release, assets: [] })).toBeNull();
    expect(parseRelease(null)).toBeNull();
  });

  it("offers only a bigger build", () => {
    const r = parseRelease(release);
    expect(compareBuild(r, 129).kind).toBe("available");
    expect(compareBuild(r, 130).kind).toBe("current");
    expect(compareBuild(null, 1).kind).toBe("none");
  });

  it("no release yet, a failed request and a good answer", async () => {
    const res = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    expect(await checkForUpdate(1, res(404, {}))).toEqual({ kind: "none" });
    expect(await checkForUpdate(1, res(500, {}))).toEqual({ kind: "error" });
    expect((await checkForUpdate(120, res(200, [release]))).kind).toBe("available");
    expect(await checkForUpdate(1, (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toEqual({ kind: "error" });
  });

  it("gathers every newer build into the changelog, newest first", () => {
    const at = (n: number) => parseRelease({ ...release, tag_name: `apk-${n}`, body: `Build ${n}` })!;
    const r = compareBuild([at(128), at(130), at(129), at(127)], 128);
    expect(r.kind).toBe("available");
    if (r.kind !== "available") return;
    expect(r.release.build).toBe(130);
    expect(r.changes.map((c) => c.build)).toEqual([130, 129]);
  });

  it("turns release notes into changelog lines", () => {
    expect(changelogLines("## What's new\n- Streak flame\n* Workout bar shortcuts\n\n1. Faster updates\n")).toEqual([
      "What's new",
      "Streak flame",
      "Workout bar shortcuts",
      "Faster updates",
    ]);
  });

  it("asks GitHub again on return at most every 30 minutes, and Later waits a day for that build", () => {
    expect(checkDue(null, 0)).toBe(true);
    expect(checkDue(0, AUTO_CHECK_MS - 1)).toBe(false);
    expect(checkDue(0, AUTO_CHECK_MS)).toBe(true);
    expect(putOff({ build: 130, until: 1000 }, 130, 500)).toBe(true);
    expect(putOff({ build: 130, until: 1000 }, 131, 500)).toBe(false);
    expect(putOff({ build: 130, until: 1000 }, 130, 1000)).toBe(false);
  });
});
