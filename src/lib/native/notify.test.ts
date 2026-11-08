import { describe, expect, it } from "vitest";
import { shiftWeekly } from "./notify";

describe("shiftWeekly", () => {
  it("moves the prep call back within the same day", () => {
    expect(shiftWeekly(1, 17, 30, 30)).toEqual({ weekday: 1, hour: 17, minute: 0 });
  });

  it("wraps into the previous day, and from Sunday into Saturday", () => {
    expect(shiftWeekly(3, 0, 10, 30)).toEqual({ weekday: 2, hour: 23, minute: 40 });
    expect(shiftWeekly(0, 0, 0, 15)).toEqual({ weekday: 6, hour: 23, minute: 45 });
  });
});
