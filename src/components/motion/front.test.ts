import { describe, expect, it } from "vitest";
import { FRONT_PATTERNS, frontPoseAt } from "./front";
import { patternFor } from "./patterns";
import { SEED_EXERCISES_BY_ID } from "@/data/exercises";
import type { Exercise } from "@/types/workout";

const width = (l: number[], r: number[]) => r[0]! - l[0]!;

describe("front-view patterns", () => {
  it("every pose gives finite joints, left of centre on the left and right on the right", () => {
    for (const p of Object.values(FRONT_PATTERNS)) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const j = frontPoseAt(p, t);
        for (const v of Object.values(j).flat()) expect(Number.isFinite(v), `${p.id} t=${t}`).toBe(true);
        expect(j.hipL[0], p.id).toBeLessThan(j.hipR[0]);
        expect(j.shL[0], p.id).toBeLessThan(j.shR[0]);
      }
    }
  });

  it("abduction opens the knees, adduction closes them", () => {
    const ab = FRONT_PATTERNS.hip_abduction;
    expect(width(ab.b.knL, ab.b.knR)).toBeGreaterThan(width(ab.a.knL, ab.a.knR) + 30);
    expect(ab.concentric).toBe("AtoB");
    const ad = FRONT_PATTERNS.hip_adduction;
    expect(width(ad.b.knL, ad.b.knR)).toBeLessThan(width(ad.a.knL, ad.a.knR) - 30);
  });

  it("the Russian twist moves the hands from one side to the other and alternates", () => {
    const rt = FRONT_PATTERNS.russian_twist;
    expect(rt.a.haL[0]).toBeLessThan(100);
    expect(rt.b.haR[0]).toBeGreaterThan(140);
    expect(rt.concentric).toBe("alternate");
  });

  it("the three seed exercises a side view cannot show now get a front view", () => {
    for (const [id, pid] of [
      ["hip-abduction-machine", "hip_abduction"],
      ["hip-adduction-machine", "hip_adduction"],
      ["russian-twist", "russian_twist"],
    ] as const) {
      const p = patternFor(SEED_EXERCISES_BY_ID[id]!);
      expect(p?.id, id).toBe(pid);
      expect(p && "view" in p && p.view, id).toBe("front");
    }
  });

  it("catalog names find them too", () => {
    const cat = (name: string) => ({ ...SEED_EXERCISES_BY_ID["squat-barbell"]!, id: `fedb-${name}`, name, isCatalog: true }) as Exercise;
    expect(patternFor(cat("Thigh Abductor"))?.id).toBe("hip_abduction");
    expect(patternFor(cat("Thigh Adductor"))?.id).toBe("hip_adduction");
    expect(patternFor(cat("Russian Twist"))?.id).toBe("russian_twist");
  });
});
