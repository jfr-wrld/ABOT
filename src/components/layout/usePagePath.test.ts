import { describe, expect, it } from "vitest";
import { normalizePath } from "./usePagePath";
import { showsDock } from "./BottomNav";

describe("normalizePath", () => {
  it("drops the trailing slash the Android export adds", () => {
    expect(normalizePath("/workout/")).toBe("/workout");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath(null)).toBeNull();
  });

  it("keeps the dock on tab pages either way", () => {
    for (const p of ["/workout", "/workout/", "/exercises/", "/profile/"]) expect(showsDock(p)).toBe(true);
    expect(showsDock("/history/")).toBe(false);
  });
});
