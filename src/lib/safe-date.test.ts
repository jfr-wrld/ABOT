import { describe, expect, it } from "vitest";
import { isoTime } from "./safe-date";

describe("isoTime", () => {
  it("formats a real moment and gives undefined for one Date cannot hold", () => {
    expect(isoTime(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(isoTime(1e300)).toBeUndefined();
    expect(isoTime(Number.NaN)).toBeUndefined();
  });
});
