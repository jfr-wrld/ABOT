import { describe, expect, it } from "vitest";
import { changeOver, dayKey, upsertEntry } from "./bodyweight";
import type { BodyweightEntry } from "@/types/workout";

const DAY = 86_400_000;
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9).getTime();
const entry = (t: number, weightKg: number): BodyweightEntry => ({ id: dayKey(t), date: t, weightKg });

describe("dayKey", () => {
  it("is the local calendar day", () => {
    expect(dayKey(new Date(2026, 10, 8, 23, 59).getTime())).toBe("2026-11-08");
    expect(dayKey(new Date(2026, 0, 3, 0, 1).getTime())).toBe("2026-01-03");
  });
});

describe("upsertEntry", () => {
  it("keeps one entry per day, the latest value winning", () => {
    const list = upsertEntry([entry(at(2026, 11, 1), 80)], entry(at(2026, 11, 1) + 3600_000, 79.5));
    expect(list).toHaveLength(1);
    expect(list[0]!.weightKg).toBe(79.5);
  });
  it("keeps the list in date order", () => {
    const list = upsertEntry([entry(at(2026, 11, 5), 80)], entry(at(2026, 11, 2), 81));
    expect(list.map((e) => e.id)).toEqual(["2026-11-02", "2026-11-05"]);
  });
});

describe("changeOver", () => {
  const now = at(2026, 11, 30);
  it("is latest minus earliest inside the window", () => {
    const list = [entry(now - 40 * DAY, 90), entry(now - 25 * DAY, 82), entry(now - 2 * DAY, 80.5)];
    expect(changeOver(list, 30, now)).toBeCloseTo(-1.5);
  });
  it("counts a weigh-in made after `now` (the page clock ticks once a minute)", () => {
    const list = [entry(now - 1 * DAY, 81), entry(now + 30_000, 80)];
    expect(changeOver(list, 30, now)).toBeCloseTo(-1);
  });
  it("needs two entries in the window to say anything", () => {
    expect(changeOver([entry(now - 40 * DAY, 90), entry(now - 1 * DAY, 80)], 30, now)).toBeNull();
    expect(changeOver([], 30, now)).toBeNull();
  });
});
