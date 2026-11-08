import { describe, expect, it } from "vitest";
import { embedUrl, parseVideoUrl, searchLinks } from "./videoUrl";

describe("parseVideoUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", { kind: "youtube", id: "dQw4w9WgXcQ" }],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=90", { kind: "youtube", id: "dQw4w9WgXcQ", start: 90 }],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s", { kind: "youtube", id: "dQw4w9WgXcQ", start: 90 }],
    ["https://youtu.be/dQw4w9WgXcQ?t=45s", { kind: "youtube", id: "dQw4w9WgXcQ", start: 45 }],
    ["https://www.youtube.com/shorts/abcDEF12345", { kind: "youtube", id: "abcDEF12345", vertical: true }],
    ["https://www.youtube.com/embed/abcDEF12345?start=12", { kind: "youtube", id: "abcDEF12345", start: 12 }],
    ["https://www.youtube-nocookie.com/embed/abcDEF12345", { kind: "youtube", id: "abcDEF12345" }],
    ["https://www.tiktok.com/@coach.ari/video/7301234567890123456?is_from_webapp=1", { kind: "tiktok", id: "7301234567890123456", vertical: true }],
    ["https://example.com/clips/squat.mp4", { kind: "file", url: "https://example.com/clips/squat.mp4", media: "video" }],
    ["https://example.com/clips/squat.webm?x=1", { kind: "file", url: "https://example.com/clips/squat.webm?x=1", media: "video" }],
    ["https://example.com/loop.GIF", { kind: "file", url: "https://example.com/loop.GIF", media: "image" }],
    ["  https://youtu.be/dQw4w9WgXcQ  ", { kind: "youtube", id: "dQw4w9WgXcQ" }],
  ])("%s", (url, expected) => {
    expect(parseVideoUrl(url)).toEqual(expected);
  });

  it.each([
    "",
    "not a url",
    "javascript:alert(1)",
    "data:video/mp4;base64,AAAA",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/channel/UC123",
    "https://vm.tiktok.com/ZMabc123/",
    "https://example.com/page.html",
    "ftp://example.com/a.mp4",
  ])("rejects %s", (url) => {
    expect(parseVideoUrl(url)).toBeNull();
  });
});

describe("embedUrl", () => {
  it("builds a muted, looping, privacy-enhanced YouTube embed", () => {
    expect(embedUrl({ kind: "youtube", id: "abcDEF12345" })).toBe(
      "https://www.youtube-nocookie.com/embed/abcDEF12345?autoplay=1&mute=1&loop=1&playlist=abcDEF12345&playsinline=1&rel=0&modestbranding=1",
    );
    expect(embedUrl({ kind: "youtube", id: "abcDEF12345", start: 30, end: 45 })).toContain("&start=30&end=45");
  });
  it("builds the TikTok player URL", () => {
    expect(embedUrl({ kind: "tiktok", id: "7301234567890123456", vertical: true })).toBe(
      "https://www.tiktok.com/player/v1/7301234567890123456?autoplay=1&loop=1&music_info=0&description=0",
    );
  });
});

describe("searchLinks", () => {
  it("builds YouTube and TikTok searches for the exercise", () => {
    expect(searchLinks("Bench Press (Barbell)")).toEqual({
      youtube: "https://www.youtube.com/results?search_query=Bench%20Press%20(Barbell)%20proper%20form%20shorts",
      tiktok: "https://www.tiktok.com/search?q=Bench%20Press%20(Barbell)%20proper%20form",
    });
  });
});
