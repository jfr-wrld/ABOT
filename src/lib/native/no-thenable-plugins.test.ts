import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !f.endsWith(".test.ts") ? [p] : [];
  });

describe("Capacitor plugins", () => {
  // A Capacitor plugin is a Proxy that answers `then`, so a Promise that resolves to one never
  // settles: `await` calls a native "then" that does not exist. Resolve to the module or a
  // wrapper object instead, e.g. `.then((m) => ({ ln: m.LocalNotifications }))`.
  it("are never what a dynamic import's promise resolves to", () => {
    const bad = files(ROOT).filter((f) => /import\("@capacitor\/[^"]+"\)\.then\(\(?\w+\)? => \w+\.[A-Z]\w*\)/.test(readFileSync(f, "utf8")));
    expect(bad.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });
});
