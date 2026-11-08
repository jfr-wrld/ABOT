import { describe, expect, it } from "vitest";
import { supersetLabels } from "./superset";

describe("supersetLabels", () => {
  it("letters supersets in order of first appearance and cycles four colours", () => {
    const labels = supersetLabels([
      { id: "1", supersetId: "x" },
      { id: "2" },
      { id: "3", supersetId: "x" },
      { id: "4", supersetId: "y" },
      { id: "5", supersetId: "y" },
    ]);
    expect(labels["1"]).toEqual({ letter: "A", color: 0 });
    expect(labels["3"]).toEqual({ letter: "A", color: 0 });
    expect(labels["4"]).toEqual({ letter: "B", color: 1 });
    expect(labels["2"]).toBeUndefined();
  });
  it("a superset id used by only one exercise is not shown", () => {
    expect(supersetLabels([{ id: "1", supersetId: "x" }, { id: "2" }])).toEqual({});
  });
});
