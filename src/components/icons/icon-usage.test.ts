import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { iconUsage } from "../../../scripts/icon-usage.mjs";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const generated = readFileSync(here("./solar.generated.tsx"), "utf8");
const shipped = Object.fromEntries(
  [...generated.matchAll(/export const (\w+) = .*?solarIcon\("\w+", "(bold|linear)", (null|\{)[^;]*?, (null|\{)/g)].map((m) => [
    m[1],
    { fallback: m[2] as "bold" | "linear", bold: m[3] !== "null", linear: m[4] !== "null" },
  ]),
);

describe("icon styles", () => {
  it("ships every style the source draws (else run node scripts/make-icons.mjs)", () => {
    const usage: Map<string, Set<string>> = iconUsage(here("../.."), Object.fromEntries(Object.entries(shipped).map(([n, s]) => [n, s.fallback])));
    const missing: string[] = [];
    for (const [name, want] of usage) {
      const s = shipped[name];
      const needBold = want.has("both") || want.has("bold");
      const needLinear = want.has("both") || want.has("linear");
      if ((needBold && !s.bold) || (needLinear && !s.linear)) missing.push(`${name}: ${[...want].join("+")}`);
    }
    expect(missing).toEqual([]);
  });

  it("reads the generated file", () => {
    expect(Object.keys(shipped).length).toBeGreaterThan(100);
  });
});
