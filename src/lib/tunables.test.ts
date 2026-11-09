import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_TUNABLES, normalizeTunables, setTunablesSource, tunables, type Tunables } from "./tunables";
import { metFor } from "./calorie-estimator";
import { fatigueStage, recoveryHours } from "./muscle-recovery";
import { normalizeRemoteConfig } from "./remote-config";

const withOverride = (patch: (t: Tunables) => void) => {
  const t = structuredClone(DEFAULT_TUNABLES);
  patch(t);
  setTunablesSource(() => t);
};
afterEach(() => setTunablesSource(() => DEFAULT_TUNABLES));

describe("tunables", () => {
  it("bounds every field and keeps defaults for missing or broken ones", () => {
    const t = normalizeTunables({ recovery: { bigHours: 9999, primaryPct: "20" }, calories: { metMin: "x" }, coach: { repCeiling: 6, repFloor: 9 } });
    expect(t.recovery.bigHours).toBe(168);
    expect(t.recovery.primaryPct).toBe(20);
    expect(t.calories.metMin).toBe(3.5);
    expect(t.coach.repFloor).toBe(5);
    expect(normalizeTunables(null)).toEqual(DEFAULT_TUNABLES);
  });

  it("comes in with the remote config", () => {
    expect(normalizeRemoteConfig({ tunables: { story: { freePresets: 4 } } }).tunables.story.freePresets).toBe(4);
  });

  it("an edit in Mission Control changes the algorithms that read it", () => {
    expect(recoveryHours("chest")).toBe(72);
    expect(metFor(0, null)).toBe(3.5);
    expect(fatigueStage(25)).toBe("recovering");
    withOverride((t) => {
      t.recovery.bigHours = 96;
      t.recovery.readyAtPct = 30;
      t.calories.metMin = 4;
    });
    expect(tunables().recovery.bigHours).toBe(96);
    expect(recoveryHours("chest")).toBe(96);
    expect(metFor(0, null)).toBe(4);
    expect(fatigueStage(25)).toBe("fresh");
  });
});
