import { describe, expect, it } from "vitest";
import { fromDisplay, toDisplay } from "./units";

describe("unit round trip", () => {
  it("62.5 kg survives a trip through lbs within 0.001", () => {
    const shown = toDisplay(62.5, "lbs");
    expect(Math.abs(fromDisplay(shown, "lbs") - 62.5)).toBeLessThan(0.001);
  });
  it("137.5 lbs is 62.369 kg", () => {
    expect(Math.abs(fromDisplay(137.5, "lbs") - 62.369)).toBeLessThan(0.001);
  });
  it("kg is the identity", () => {
    expect(toDisplay(62.5, "kg")).toBe(62.5);
    expect(fromDisplay(62.5, "kg")).toBe(62.5);
  });
});
