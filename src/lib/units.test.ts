import { describe, expect, it } from "vitest";
import { cmToFtIn, formatWeight, fromDisplay, ftInToCm, toDisplay, toInput } from "./units";

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

describe("height in feet and inches", () => {
  it("170 cm is 5 ft 7 in", () => {
    expect(cmToFtIn(170)).toEqual({ ft: 5, inch: 7 });
  });
  it("rounding up to 12 inches carries into the feet", () => {
    expect(cmToFtIn(182.5)).toEqual({ ft: 6, inch: 0 });
  });
  it("5 ft 7 in is 170.2 cm", () => {
    expect(ftInToCm(5, 7)).toBe(170.2);
  });
});

describe("toInput and formatWeight", () => {
  it("shows a kg weight in lbs with one decimal, not two", () => {
    expect(toInput(100, "lbs")).toBe(220.5);
    expect(formatWeight(100, "lbs")).toBe("220.5 lbs");
  });
  it("keeps what was typed in lbs", () => {
    expect(toInput(fromDisplay(222.3, "lbs"), "lbs")).toBe(222.3);
    expect(toInput(fromDisplay(225, "lbs"), "lbs")).toBe(225);
  });
  it("keeps small kg plates", () => {
    expect(toInput(102.25, "kg")).toBe(102.25);
    expect(formatWeight(102.25, "kg")).toBe("102.25 kg");
    expect(formatWeight(60, "kg", false)).toBe("60");
  });
});
