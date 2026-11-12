import { describe, expect, it } from "vitest";
import { stepped, weightStep } from "./set-steps";

describe("weightStep", () => {
  it("is 5 lb, 1.25 kg on dumbbells and isolation, else 2.5 kg", () => {
    expect(weightStep({ equipment: "barbell", category: "compound" }, "lbs")).toBe(5);
    expect(weightStep({ equipment: "dumbbell", category: "compound" }, "kg")).toBe(1.25);
    expect(weightStep({ equipment: "cable", category: "isolation" }, "kg")).toBe(1.25);
    expect(weightStep({ equipment: "barbell", category: "compound" }, "kg")).toBe(2.5);
    expect(weightStep(undefined, "kg")).toBe(2.5);
  });
});

describe("stepped", () => {
  it("adds without float dust and stops at zero", () => {
    expect(stepped(2.5, 1.25 + 1.25)).toBe(5);
    expect(stepped(0.1 + 0.2, 0)).toBe(0.3);
    expect(stepped(1.25, -2.5)).toBe(0);
  });
});
