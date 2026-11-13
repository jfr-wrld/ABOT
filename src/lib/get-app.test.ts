import { describe, expect, it } from "vitest";
import { APK_URL, BANNER_LATER_MS, detectPlatform, emptyMemory, shouldNudge } from "./get-app";

describe("get the app", () => {
  it("points at the stable APK of the newest release", () => {
    expect(APK_URL).toBe("https://github.com/jfr-wrld/ABOT/releases/latest/download/abot.apk");
  });

  it("tells Android, iPhone, iPad and desktop browsers apart, and never pitches inside the app", () => {
    const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36";
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
    expect(detectPlatform(android, false)).toBe("android");
    expect(detectPlatform(android, true)).toBe("native");
    expect(detectPlatform(iphone, false)).toBe("ios");
    expect(detectPlatform(mac, false, 5)).toBe("ios");
    expect(detectPlatform(mac, false, 0)).toBe("desktop");
  });

  it("caps nudges: once per trigger, one per session, banner after its pause, none after never", () => {
    const m = emptyMemory();
    expect(shouldNudge(m, "first-workout", 0, false)).toBe(true);
    expect(shouldNudge(m, "first-workout", 0, true)).toBe(false);
    expect(shouldNudge({ ...m, shown: { "first-workout": true } }, "first-workout", 0, false)).toBe(false);
    expect(shouldNudge({ ...m, bannerUntil: BANNER_LATER_MS }, "banner", BANNER_LATER_MS - 1, false)).toBe(false);
    expect(shouldNudge({ ...m, bannerUntil: BANNER_LATER_MS }, "banner", BANNER_LATER_MS, false)).toBe(true);
    expect(shouldNudge({ ...m, never: true }, "banner", 0, false)).toBe(false);
  });
});
