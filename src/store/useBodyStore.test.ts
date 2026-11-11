import { beforeEach, describe, expect, it } from "vitest";
import { useBodyStore } from "./useBodyStore";
import { dayKey } from "@/lib/bodyweight";

const DAY = 86_400_000;
const now = new Date(2026, 10, 11, 8).getTime();

describe("useBodyStore", () => {
  beforeEach(() => useBodyStore.setState({ entries: [] }));

  it("a weight-only update the same day keeps that day's body fat and waist", () => {
    const { logWeight } = useBodyStore.getState();
    logWeight(80, now, { bodyFatPercent: 18, waistCm: 82 });
    logWeight(79.6, now + 60_000);
    expect(useBodyStore.getState().entries).toEqual([{ id: dayKey(now), date: now + 60_000, weightKg: 79.6, bodyFatPercent: 18, waistCm: 82 }]);
  });

  it("restore puts a deleted weigh-in back in date order", () => {
    const { logWeight, remove, restore } = useBodyStore.getState();
    logWeight(81, now - DAY);
    logWeight(80, now);
    const gone = useBodyStore.getState().entries[0]!;
    remove(gone.id);
    restore(gone);
    expect(useBodyStore.getState().entries.map((e) => e.weightKg)).toEqual([81, 80]);
  });

  it("restore does not overwrite a newer weigh-in logged that day meanwhile", () => {
    const { logWeight, remove, restore } = useBodyStore.getState();
    logWeight(80, now);
    const gone = useBodyStore.getState().entries[0]!;
    remove(gone.id);
    logWeight(79, now);
    restore(gone);
    expect(useBodyStore.getState().entries.map((e) => e.weightKg)).toEqual([79]);
  });
});
