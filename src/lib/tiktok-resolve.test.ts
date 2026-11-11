import { afterEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
let native = false;
vi.mock("@capacitor/core", () => ({ CapacitorHttp: { get: (...a: unknown[]) => get(...a) } }));
vi.mock("@/lib/native/files", () => ({ isNativeApp: () => native }));

const { resolveTikTokShortLink } = await import("./tiktok-resolve");
const LINK = "https://vt.tiktok.com/ZSpaKUad5/";
const json = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as Response);

afterEach(() => {
  vi.unstubAllGlobals();
  get.mockReset();
  native = false;
});

describe("resolveTikTokShortLink", () => {
  it("Android: the redirect's final URL gives the full link", async () => {
    native = true;
    get.mockResolvedValue({ url: "https://www.tiktok.com/@coach.ari/video/7301234567890123456?_r=1", data: "" });
    expect(await resolveTikTokShortLink(LINK)).toBe("https://www.tiktok.com/@coach.ari/video/7301234567890123456");
  });

  it("falls back to oEmbed, which names the video", async () => {
    native = true;
    get.mockRejectedValue(new Error("offline"));
    const fetch = json({ embed_product_id: "7301234567890123456", author_unique_id: "coach.ari" });
    vi.stubGlobal("fetch", fetch);
    expect(await resolveTikTokShortLink(LINK)).toBe("https://www.tiktok.com/@coach.ari/video/7301234567890123456");
    expect(String((fetch.mock.calls as unknown as [string][])[0]![0])).toBe(`https://www.tiktok.com/oembed?url=${encodeURIComponent(LINK)}`);
  });

  it("reads the id from the embed html when the field is missing", async () => {
    vi.stubGlobal("fetch", json({ html: '<blockquote data-video-id="7301234567890123456">' }));
    expect(await resolveTikTokShortLink(LINK)).toBe("https://www.tiktok.com/@tiktok/video/7301234567890123456");
  });

  it("gives null for an answer without a usable id", async () => {
    vi.stubGlobal("fetch", json({ embed_product_id: "123" }));
    expect(await resolveTikTokShortLink(LINK)).toBeNull();
    vi.stubGlobal("fetch", json({}, false));
    expect(await resolveTikTokShortLink(LINK)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("network"))));
    expect(await resolveTikTokShortLink(LINK)).toBeNull();
  });
});
