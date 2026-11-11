import { describe, expect, it } from "vitest";
import { COVER_PRESETS, coverKind } from "./cover-presets";
import { coverCrop } from "./photo";
import { parseBackup } from "@/data/backup";

const withCover = (profileCover: unknown) =>
  JSON.stringify({ app: "ABOT", schemaVersion: 1, data: { sessions: [], routines: [], exercises: [], locations: [], settings: { profileCover } } });
const coverOf = (v: unknown) => {
  const r = parseBackup(withCover(v));
  return r.ok ? r.backup.data.settings?.profileCover : "failed";
};

describe("profile cover", () => {
  it("has ten designs with unique ids", () => {
    expect(COVER_PRESETS).toHaveLength(10);
    expect(new Set(COVER_PRESETS.map((p) => p.id)).size).toBe(10);
  });

  it("reads a stored value", () => {
    expect(coverKind(null)).toEqual({ kind: "skyline" });
    expect(coverKind("preset:neon-grid")).toEqual({ kind: "preset", id: "neon-grid" });
    expect(coverKind("preset:nope")).toEqual({ kind: "skyline" });
    expect(coverKind("data:image/jpeg;base64,AAAA").kind).toBe("image");
  });

  it("keeps only known designs and image data of cover size from a backup", () => {
    expect(coverOf("preset:inferno")).toBe("preset:inferno");
    expect(coverOf("preset:made-up")).toBeNull();
    expect(coverOf("data:image/jpeg;base64,AAAA")).toBe("data:image/jpeg;base64,AAAA");
    expect(coverOf(`data:image/jpeg;base64,${"A".repeat(250_000)}`)).toBeNull();
    expect(coverOf("https://example.com/cover.jpg")).toBeNull();
  });

  it("crops the centre at 3:1", () => {
    expect(coverCrop(4000, 3000, 3)).toEqual({ x: 0, y: 834, w: 4000, h: 1333 });
    expect(coverCrop(3000, 500, 3)).toEqual({ x: 750, y: 0, w: 1500, h: 500 });
  });
});
