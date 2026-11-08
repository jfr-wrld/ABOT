import { describe, expect, it } from "vitest";
import { REGIONS, regionLevels, regionsFor } from "./regions";
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from "@/types/workout";

describe("muscle regions", () => {
  it("has the 16 regions the owner listed", () => {
    expect([...REGIONS].sort()).toEqual(
      [
        "abs", "biceps", "calves", "chest", "forearms", "front_delts", "glutes", "hamstrings",
        "lats", "lower_back", "obliques", "quads", "rear_delts", "side_delts", "traps", "triceps",
      ].sort(),
    );
  });
  it("maps every muscle group except cardio to at least one region", () => {
    for (const m of Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[]) {
      if (m === "cardio") expect(regionsFor(m)).toEqual([]);
      else expect(regionsFor(m).length, m).toBeGreaterThan(0);
    }
    expect(regionsFor("shoulders")).toEqual(["front_delts", "side_delts", "rear_delts"]);
    expect(regionsFor("full_body")).toHaveLength(16);
  });
  it("primary wins over secondary on a shared region", () => {
    const levels = regionLevels(["shoulders"], ["triceps", "traps"]);
    expect(levels.front_delts).toBe("primary");
    expect(levels.triceps).toBe("secondary");
    const overlap = regionLevels(["back"], ["traps"]);
    expect(overlap.traps).toBe("primary");
  });
});
