import { describe, expect, it } from "vitest";
import { resolveEffects } from "./effects";

describe("resolveEffects", () => {
  it("an explicit choice wins over the phone", () => {
    expect(resolveEffects("full", { cores: 2, memoryGb: 2 })).toBe("full");
    expect(resolveEffects("lite", { cores: 8, memoryGb: 8 })).toBe("lite");
  });

  it("auto is lite on a modest phone: few cores, little memory, Data Saver or reduced effects", () => {
    expect(resolveEffects("auto", { cores: 4, memoryGb: 8 })).toBe("lite");
    expect(resolveEffects("auto", { cores: 8, memoryGb: 4 })).toBe("lite");
    expect(resolveEffects("auto", { cores: 8, memoryGb: 8, saveData: true })).toBe("lite");
    expect(resolveEffects("auto", { cores: 8, memoryGb: 8, reduced: true })).toBe("lite");
  });

  it("auto is full on a capable phone, and when the browser tells nothing", () => {
    expect(resolveEffects("auto", { cores: 8, memoryGb: 8 })).toBe("full");
    expect(resolveEffects("auto", {})).toBe("full");
  });
});
