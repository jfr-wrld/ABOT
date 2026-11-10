import { describe, expect, it } from "vitest";
import { onBack, runBack } from "./back-stack";

describe("back stack", () => {
  it("closes the newest moment first, and says when nothing is open", () => {
    const closed: string[] = [];
    const offA = onBack(() => closed.push("streak"));
    const offB = onBack(() => closed.push("studio"));
    expect(runBack()).toBe(true);
    offB();
    expect(runBack()).toBe(true);
    offA();
    expect(runBack()).toBe(false);
    expect(closed).toEqual(["studio", "streak"]);
  });
});
