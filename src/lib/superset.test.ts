import { describe, expect, it } from "vitest";
import { linkSupersetIn, removeFromList, supersetLabels, unlinkSupersetIn } from "./superset";

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

describe("linking and unlinking (shared by workouts and routines)", () => {
  const list = () => [{ id: "a" }, { id: "b" }, { id: "c" }] as { id: string; supersetId?: string }[];
  let n = 0;
  const id = () => `g${++n}`;

  it("links two, and a third joins the same superset", () => {
    let l = linkSupersetIn(list(), "a", "b", id);
    expect(l[0]!.supersetId).toBeTruthy();
    expect(l[1]!.supersetId).toBe(l[0]!.supersetId);
    l = linkSupersetIn(l, "c", "a", id);
    expect(l[2]!.supersetId).toBe(l[0]!.supersetId);
  });

  it("linking members of two supersets merges them", () => {
    let l = linkSupersetIn([...list(), { id: "d" }], "a", "b", id);
    l = linkSupersetIn(l, "c", "d", id);
    l = linkSupersetIn(l, "a", "c", id);
    expect(new Set(l.map((e) => e.supersetId)).size).toBe(1);
  });

  it("unlinking one of two dissolves the superset; removing keeps no lonely id", () => {
    const l = linkSupersetIn(list(), "a", "b", id);
    expect(unlinkSupersetIn(l, "a").every((e) => !e.supersetId)).toBe(true);
    expect(removeFromList(l, "b").every((e) => !e.supersetId)).toBe(true);
  });
});
