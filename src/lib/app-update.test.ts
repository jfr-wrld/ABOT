import { describe, expect, it } from "vitest";
import { checkForUpdate, compareBuild, parseRelease } from "./app-update";

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
    expect((await checkForUpdate(120, res(200, release))).kind).toBe("available");
    expect(await checkForUpdate(1, (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toEqual({ kind: "error" });
  });
});
