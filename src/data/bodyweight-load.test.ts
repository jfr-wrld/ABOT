import { describe, expect, it } from "vitest";
import { bodyLoadFor, bodyweightFactor } from "./bodyweight-load";
import { SEED_EXERCISES_BY_ID } from "./exercises";

describe("bodyweight load", () => {
  it("knows the seed exercises", () => {
    expect(bodyweightFactor(SEED_EXERCISES_BY_ID["pull-up"])).toBe(1);
    expect(bodyweightFactor(SEED_EXERCISES_BY_ID["push-up"])).toBe(0.64);
    expect(bodyweightFactor(SEED_EXERCISES_BY_ID["crunch"])).toBe(0);
    expect(bodyweightFactor(SEED_EXERCISES_BY_ID["bench-press-barbell"])).toBe(0);
  });

  it("matches catalog and custom exercises by name", () => {
    const bw = (name: string) => bodyweightFactor({ id: `x-${name}`, name, isBodyweight: true });
    expect(bw("Weighted Muscle-Up")).toBe(1);
    expect(bw("Decline Push-Up")).toBe(0.64);
    expect(bw("Inverted Row")).toBe(0.6);
    expect(bw("Hollow Body Hold")).toBe(0);
    expect(bw("Something New")).toBe(1);
  });

  it("gives the body's share in kg, or nothing without a body weight", () => {
    expect(bodyLoadFor(SEED_EXERCISES_BY_ID["push-up"], 70)).toBe(44.8);
    expect(bodyLoadFor(SEED_EXERCISES_BY_ID["pull-up"], null)).toBeUndefined();
    expect(bodyLoadFor(SEED_EXERCISES_BY_ID["plank"], 70)).toBeUndefined();
  });
});
