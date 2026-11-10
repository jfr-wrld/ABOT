import { describe, expect, it } from "vitest";
import { comeback, returnAfter } from "./comeback";
import type { WorkoutSession } from "@/types/workout";

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 10, 12);
const s = (id: string, daysAgo: number): WorkoutSession => ({
  id,
  name: id,
  startedAt: now - daysAgo * DAY,
  finishedAt: now - daysAgo * DAY + 3_600_000,
  status: "completed",
  exercises: [],
});

describe("coming back after a break", () => {
  it("welcomes back after ten days, not before", () => {
    expect(comeback([s("a", 3)], now)).toBeNull();
    expect(comeback([s("a", 30), s("b", 12)], now)).toMatchObject({ last: { id: "b" }, days: 11 });
    expect(comeback([], now)).toBeNull();
    // Old history (often imported) is not a break to come back from.
    expect(comeback([s("a", 400)], now)).toBeNull();
  });

  it("names the first workout after a gap", () => {
    const back = s("back", 0);
    expect(returnAfter([s("old", 20), back], back)).toBe(19);
    expect(returnAfter([s("old", 3), back], back)).toBeNull();
    expect(returnAfter([back], back)).toBeNull();
  });
});
