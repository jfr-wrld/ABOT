import { describe, expect, it } from "vitest";
import { linkSupersetIn, removeFromList, supersetLabels, supersetNext, unlinkSupersetIn } from "./superset";

describe("supersetLabels", () => {
  it("letters supersets in order of first appearance and cycles four colours", () => {
    const labels = supersetLabels([
      { id: "1", supersetId: "x" },
      { id: "2" },
      { id: "3", supersetId: "x" },
      { id: "4", supersetId: "y" },
      { id: "5", supersetId: "y" },
    ]);
    expect(labels["1"]).toEqual({ letter: "A", color: 0, order: 1, size: 2 });
    expect(labels["3"]).toEqual({ letter: "A", color: 0, order: 2, size: 2 });
    expect(labels["4"]).toEqual({ letter: "B", color: 1, order: 1, size: 2 });
    expect(labels["2"]).toBeUndefined();
  });
  it("a superset id used by only one exercise is not shown", () => {
    expect(supersetLabels([{ id: "1", supersetId: "x" }, { id: "2" }])).toEqual({});
  });
});

describe("A1/A2 places and giant sets", () => {
  it("numbers a group of three top to bottom and reports its size", () => {
    const labels = supersetLabels([
      { id: "1", supersetId: "x" },
      { id: "2", supersetId: "x" },
      { id: "3" },
      { id: "4", supersetId: "x" },
    ]);
    expect(["1", "2", "4"].map((id) => `${labels[id]!.letter}${labels[id]!.order}`)).toEqual(["A1", "A2", "A3"]);
    expect(labels["4"]!.size).toBe(3);
  });
});

describe("supersetNext: who goes after a ticked set", () => {
  const sets = (...done: boolean[]) => done.map((completed) => ({ completed }));
  const giant = () => [
    { id: "a", supersetId: "x", sets: sets(true, false) },
    { id: "b", supersetId: "x", sets: sets(false, false) },
    { id: "c", supersetId: "x", sets: sets(false, false) },
  ];

  it("A1 hands off to A2 at its first open set, A2 to A3", () => {
    expect(supersetNext(giant(), "a")).toEqual({ sessionExerciseId: "b", setIndex: 0 });
    expect(supersetNext(giant(), "b")).toEqual({ sessionExerciseId: "c", setIndex: 0 });
  });

  it("the last exercise of the group hands off to nobody: rest starts", () => {
    expect(supersetNext(giant(), "c")).toBeNull();
  });

  it("skips a later exercise that has no sets left", () => {
    const list = giant();
    list[1]!.sets = sets(true, true);
    expect(supersetNext(list, "a")).toEqual({ sessionExerciseId: "c", setIndex: 0 });
    list[2]!.sets = sets(true);
    expect(supersetNext(list, "a")).toBeNull();
  });

  it("ignores exercises outside the group and lone ids", () => {
    expect(supersetNext([{ id: "a", sets: sets(false) }, { id: "b", sets: sets(false) }], "a")).toBeNull();
    expect(supersetNext([{ id: "a", supersetId: "x", sets: sets(false) }, { id: "b", sets: sets(false) }], "a")).toBeNull();
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
