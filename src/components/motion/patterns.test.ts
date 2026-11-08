import { describe, expect, it } from "vitest";
import { LEN, PATTERNS, patternFor, phaseAt, poseAt, rig } from "./patterns";
import { SEED_EXERCISES } from "@/data/exercises";
import type { Exercise } from "@/types/workout";

const dist = (p: number[], q: number[]) => Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!);

describe("patterns", () => {
  it("every pose of every pattern gives finite joints with fixed bone lengths", () => {
    for (const p of Object.values(PATTERNS)) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const j = rig(poseAt(p, t));
        for (const v of Object.values(j).flat()) expect(Number.isFinite(v), `${p.id} t=${t}`).toBe(true);
        expect(dist(j.shoulder, j.elbow), p.id).toBeCloseTo(LEN.upperArm, 4);
        expect(dist(j.elbow, j.hand), p.id).toBeCloseTo(LEN.foreArm, 4);
        expect(dist(j.hip, j.knee), p.id).toBeCloseTo(LEN.thigh, 4);
        expect(dist(j.knee, j.ankle), p.id).toBeCloseTo(LEN.shin, 4);
        expect(dist(j.hip, j.farKnee), p.id).toBeCloseTo(LEN.thigh, 4);
        expect(dist(j.shoulder, j.farElbow), p.id).toBeCloseTo(LEN.upperArm, 4);
      }
    }
  });

  it("covers every seed exercise except movements a side view cannot show", () => {
    const missing = SEED_EXERCISES.filter((e) => !patternFor(e)).map((e) => e.id).sort();
    expect(missing).toEqual(["hip-abduction-machine", "hip-adduction-machine", "russian-twist"]);
  });

  it("maps catalog exercises by name and skips mobility and cardio", () => {
    const cat = (name: string, extra: Partial<Exercise> = {}) =>
      ({ ...SEED_EXERCISES[0]!, id: `fedb-${name}`, name, isCatalog: true, category: "compound", ...extra }) as Exercise;
    expect(patternFor(cat("Zercher Squats"))?.id).toBe("squat_back");
    expect(patternFor(cat("Alternate Incline Dumbbell Curl"))?.id).toBe("curl");
    expect(patternFor(cat("Incline Barbell Bench Press"))?.id).toBe("bench_incline");
    expect(patternFor(cat("Seated Cable Rows"))?.id).toBe("row_seated");
    expect(patternFor(cat("Upright Cable Row"))?.id).toBe("upright_row");
    expect(patternFor(cat("Stiff-Legged Dumbbell Deadlift"))?.id).toBe("rdl");
    expect(patternFor(cat("Hamstring Stretch", { category: "mobility" }))).toBeNull();
    expect(patternFor(cat("Mystery Movement"))).toBeNull();
  });

  it("knows which half of the rep is concentric", () => {
    const squat = PATTERNS.squat_back;
    expect(phaseAt(squat, 0.1).label).toBe("Eccentric");
    expect(phaseAt(PATTERNS.curl, 0.1).label).toBe("Concentric");
    expect(phaseAt(PATTERNS.plank, 0.5).label).toBe("Hold");
    for (const p of Object.values(PATTERNS)) {
      for (const t of [0, 0.3, 0.6, 0.99]) {
        const ph = phaseAt(p, t);
        expect(ph.progress).toBeGreaterThanOrEqual(0);
        expect(ph.progress).toBeLessThanOrEqual(1);
      }
    }
  });
});
