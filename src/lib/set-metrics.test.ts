import { describe, expect, it } from "vitest";
import { clockText, fromDistance, hasMeasure, parseClock, setText, toDistance } from "./set-metrics";

const reps = (n: number) => `${n} reps`;

describe("timed and distance sets", () => {
  it("reads times the way people type them", () => {
    expect(parseClock("1:30", "sec")).toBe(90);
    expect(parseClock("45", "sec")).toBe(45);
    expect(parseClock("30", "min")).toBe(1800);
    expect(parseClock("1:02:00", "min")).toBe(3720);
    expect(parseClock("2,5", "min")).toBe(150);
    expect(parseClock("1:75", "sec")).toBeNull();
    expect(parseClock("abc", "sec")).toBeNull();
    expect(parseClock("", "sec")).toBeNull();
  });

  it("writes times and distances back", () => {
    expect(clockText(90)).toBe("1:30");
    expect(clockText(3720)).toBe("1:02:00");
    expect(toDistance(5000, "kg")).toBe(5);
    expect(fromDistance(3.1, "lbs")).toBe(4989);
  });

  it("knows when a set has something to save", () => {
    expect(hasMeasure({ reps: null, durationSec: 60 }, "duration")).toBe(true);
    expect(hasMeasure({ reps: 10, durationSec: null }, "duration")).toBe(false);
    expect(hasMeasure({ reps: null, distanceM: 2000 }, "distance_duration")).toBe(true);
    expect(hasMeasure({ reps: 8 }, "weight_reps")).toBe(true);
  });

  it("shows each kind of set as text", () => {
    expect(setText({ weightKg: null, reps: null, durationSec: 90 }, "duration", "kg", { reps })).toBe("1:30");
    expect(setText({ weightKg: null, reps: null, durationSec: 1690, distanceM: 5000 }, "distance_duration", "kg", { reps })).toBe("5 km · 28:10");
    expect(setText({ weightKg: 80, reps: 8 }, "weight_reps", "kg", { reps })).toBe("80 kg × 8");
    expect(setText({ weightKg: null, reps: 12 }, "reps_only", "kg", { reps })).toBe("12 reps");
  });
});
