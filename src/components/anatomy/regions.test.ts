import { describe, expect, it } from "vitest";
import { REGIONS, regionLevels, regionsFor } from "./regions";
import { BODY_BACK, BODY_FRONT } from "./bodyPaths.generated";
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from "@/types/workout";

describe("muscle regions (react-muscle-highlighter body)", () => {
  it("every region exists in the vendored body paths", () => {
    const drawn = new Set([...BODY_FRONT, ...BODY_BACK].map((p) => p.slug));
    for (const r of REGIONS) expect(drawn.has(r), r).toBe(true);
  });
  it("maps every muscle group except cardio to at least one region", () => {
    for (const m of Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[]) {
      if (m === "cardio") expect(regionsFor(m)).toEqual([]);
      else expect(regionsFor(m).length, m).toBeGreaterThan(0);
    }
    expect(regionsFor("shoulders")).toEqual(["deltoids"]);
    expect(regionsFor("lats")).toEqual(["upper-back"]);
    expect(regionsFor("full_body")).toEqual([...REGIONS]);
  });
  it("primary wins over secondary on a shared region", () => {
    const levels = regionLevels(["shoulders"], ["triceps", "traps"]);
    expect(levels.deltoids).toBe("primary");
    expect(levels.triceps).toBe("secondary");
    expect(regionLevels(["back"], ["lats"])["upper-back"]).toBe("primary");
  });
  it("vendored paths are present for both views", () => {
    expect(BODY_FRONT.length).toBeGreaterThan(10);
    expect(BODY_BACK.length).toBeGreaterThan(10);
    for (const p of [...BODY_FRONT, ...BODY_BACK]) for (const d of p.d) expect(d).toMatch(/^M/);
  });
});
