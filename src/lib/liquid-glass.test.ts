import { describe, expect, it } from "vitest";
import { displacementAt, displacementPixels, liquidGlassSupported } from "./liquid-glass";

describe("displacementAt", () => {
  const W = 200, H = 60, R = 20, BEZEL = 16;
  it("leaves the flat middle alone", () => {
    expect(displacementAt(100, 30, W, H, R, BEZEL)).toEqual([0, 0]);
  });
  it("pulls the rim inward, most at the very edge", () => {
    const [lx, ly] = displacementAt(1, 30, W, H, R, BEZEL);
    expect(lx).toBeGreaterThan(0.5);
    expect(Math.abs(ly)).toBeLessThan(1e-9);
    const [rx] = displacementAt(199, 30, W, H, R, BEZEL);
    expect(rx).toBeLessThan(-0.5);
    const [, ty] = displacementAt(100, 1, W, H, R, BEZEL);
    expect(ty).toBeGreaterThan(0.5);
    expect(displacementAt(100, 2, W, H, R, BEZEL)[1]).toBeGreaterThan(displacementAt(100, 10, W, H, R, BEZEL)[1]);
  });
  it("bends corners along the diagonal", () => {
    const [dx, dy] = displacementAt(8, 8, W, H, R, BEZEL);
    expect(dx).toBeGreaterThan(0);
    expect(dy).toBeGreaterThan(0);
  });
});

describe("displacementPixels", () => {
  it("is neutral grey in the middle", () => {
    const px = displacementPixels(40, 20, 10, 6);
    const i = (10 * 40 + 20) * 4;
    expect([...px.slice(i, i + 4)]).toEqual([128, 128, 128, 255]);
  });
});

describe("liquidGlassSupported", () => {
  it("is on for Chromium and the Android WebView, off for Safari, Firefox and iOS Chrome", () => {
    expect(liquidGlassSupported("Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36")).toBe(true);
    expect(liquidGlassSupported("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15")).toBe(false);
    expect(liquidGlassSupported("Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0")).toBe(false);
    expect(liquidGlassSupported("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/131.0 Mobile/15E148 Safari/604.1")).toBe(false);
  });
});
