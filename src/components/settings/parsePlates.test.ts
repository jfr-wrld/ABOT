import { describe, expect, it } from "vitest";
import { parsePlates } from "./LocationsSection";

describe("parsePlates", () => {
  it("parses and sorts heaviest first", () => {
    expect(parsePlates("10, 25,2.5 , 20")).toEqual([25, 20, 10, 2.5]);
  });
  it("rejects empty, zero, negative and non-numeric entries", () => {
    expect(parsePlates("")).toBeNull();
    expect(parsePlates("25, 0")).toBeNull();
    expect(parsePlates("25, -5")).toBeNull();
    expect(parsePlates("25, abc")).toBeNull();
  });
});
