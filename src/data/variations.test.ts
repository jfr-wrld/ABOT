import { describe, expect, it } from "vitest";
import { variationLabel, variationsFor, VARIATION_LABEL } from "./variations";
import { SEED_EXERCISES, SEED_EXERCISES_BY_ID } from "./exercises";

const of = (id: string) => variationsFor(SEED_EXERCISES_BY_ID[id]);

describe("variations", () => {
  it("cable exercises offer attachments", () => {
    expect(of("seated-row-cable")).toEqual(["v-handle", "wide-bar", "straight-bar", "mag-grip", "rope", "single-handle"]);
    expect(of("lat-pulldown-cable")).toContain("wide-bar");
    expect(of("triceps-pushdown-cable")).toContain("rope");
  });

  it("free weights offer grips and stances; fixed movements offer nothing", () => {
    expect(of("pull-up")).toEqual(["wide", "close", "neutral", "mixed"]);
    expect(of("bench-press-barbell")).toEqual(["wide", "close", "paused"]);
    expect(of("leg-press-machine")).not.toContain("high-bar");
    expect(of("triceps-rope-pushdown-cable")).toEqual([]);
    expect(of("cable-fly")).toEqual([]);
  });

  it("every offered key has a label", () => {
    for (const e of SEED_EXERCISES) for (const k of variationsFor(e)) expect(VARIATION_LABEL[k], `${e.id}: ${k}`).toBeDefined();
    expect(variationLabel("gone")).toBe("gone");
  });
});
