import { describe, expect, it } from "vitest";
import { clampView, cropRect, initialView, zoomTo } from "./crop";

const img = { w: 4000, h: 3000 };
const square = { w: 300, h: 300 };
const wide = { w: 300, h: 100 };

describe("crop", () => {
  it("starts centred, just covering the frame", () => {
    const v = initialView(img, square);
    expect(v.zoom).toBe(1);
    // 3000 px tall fills 300: 0.1 scale, 400 wide, centred.
    expect(v.x).toBeCloseTo(-50);
    expect(v.y).toBeCloseTo(0);
    expect(cropRect(v, img, square)).toEqual({ x: 500, y: -0, w: 3000, h: 3000 });
  });

  it("never leaves a gap: moves and zoom stay in range", () => {
    expect(clampView({ zoom: 1, x: 40, y: -999 }, img, square)).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(clampView({ zoom: 9, x: 0, y: 0 }, img, square).zoom).toBe(4);
    expect(clampView({ zoom: 0.2, x: 0, y: 0 }, img, wide).zoom).toBe(1);
  });

  it("zooms around the centre, and the crop shrinks with it", () => {
    const v = zoomTo(initialView(img, square), 2, img, square);
    const r = cropRect(v, img, square);
    expect(r.w).toBeCloseTo(1500);
    // Still centred on the image's middle.
    expect(r.x + r.w / 2).toBeCloseTo(2000);
    expect(r.y + r.h / 2).toBeCloseTo(1500);
  });

  it("a wide frame crops a band of the image", () => {
    const r = cropRect(initialView(img, wide), img, wide);
    expect(r.w).toBeCloseTo(4000);
    expect(r.h).toBeCloseTo(4000 / 3);
  });
});
