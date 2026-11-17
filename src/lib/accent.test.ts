import { describe, expect, it } from "vitest";
import { ACCENT_SWATCHES, accentTokens, contrast, onColor } from "./accent";

const DARK = "#09090b";

describe("accent tokens", () => {
  it("keeps Volt exactly as it was", () => {
    const v = accentTokens("#ccff00");
    expect(v["--brand"]).toBe("#ccff00");
    expect(v["--brand-edge"]).toBe("#b3e600");
    expect(v["--brand-light-edge"]).toBe("#8db300");
  });

  it("falls back to Volt for anything that is not #rrggbb", () => {
    expect(accentTokens("blue")["--brand"]).toBe("#ccff00");
    expect(accentTokens(undefined)["--brand"]).toBe("#ccff00");
  });

  it("keeps fills visible (3:1) and text readable (4.5:1) on the dark page, swatches and any colour", () => {
    const colours = [...ACCENT_SWATCHES.map((s) => s.hex), "#000000", "#1e3a8a", "#3f0d12", "#123456", "#7f7f7f", "#ffffff"];
    for (const hex of colours) {
      const t = accentTokens(hex);
      expect(contrast(t["--brand"]!, DARK)).toBeGreaterThanOrEqual(3);
      expect(contrast(t["--brand-text"]!, DARK)).toBeGreaterThanOrEqual(4.5);
      // Content on the fill picks black or white, whichever reads better.
      expect(contrast(t["--brand-on"]!, t["--brand"]!)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("puts black content on light colours and white on dark ones", () => {
    expect(onColor("#ccff00")).toBe("#000000");
    expect(onColor("#1d4ed8")).toBe("#ffffff");
  });

  it("does not fill with white on the light page: a pale colour becomes black there", () => {
    expect(accentTokens("#f4f4f5")["--brand-light"]).toBe("#18181b");
    expect(accentTokens("#3b82f6")["--brand-light"]).toBe("#3b82f6");
  });
});
