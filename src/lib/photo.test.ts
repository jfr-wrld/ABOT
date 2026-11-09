import { describe, expect, it } from "vitest";
import { fitSize } from "./photo";

describe("fitSize", () => {
  it("brings the longer edge down to the limit and keeps the shape", () => {
    expect(fitSize(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitSize(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("never scales a small photo up", () => {
    expect(fitSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});
