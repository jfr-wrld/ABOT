import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./safe-path";

describe("safeReturnPath", () => {
  it("keeps in-app paths with their query and hash", () => {
    expect(safeReturnPath("/settings")).toBe("/settings");
    expect(safeReturnPath("/profile?tab=about")).toBe("/profile?tab=about");
    expect(safeReturnPath("/profile/edit#name")).toBe("/profile/edit#name");
  });

  it("refuses anything that leaves the site", () => {
    for (const raw of ["//evil.com", "/\\evil.com", "/\\/evil.com", "/\t/evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "", null, undefined]) {
      expect(safeReturnPath(raw)).toBeNull();
    }
  });
});
