import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ID } from "./id";
import { DYNAMIC_KEYS } from "./dynamic-keys";
import { translate } from "./index";

const ROOT = join(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    // The i18n module itself only has examples in its comments.
    if (statSync(p).isDirectory()) return f === "i18n" ? [] : files(p);
    return /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });
}

const unescape = (s: string) => JSON.parse(`"${s}"`) as string;
const STR = String.raw`"((?:[^"\\]|\\.)*)"`;

/** Every literal handed to t(...) or t.n(n, ..., ...) in the source. */
function literals(): { key: string; where: string }[] {
  const out: { key: string; where: string }[] = [];
  for (const f of files(ROOT)) {
    const src = readFileSync(f, "utf8");
    const where = f.slice(ROOT.length + 1);
    for (const m of src.matchAll(new RegExp(String.raw`\bt\(\s*${STR}`, "g"))) out.push({ key: unescape(m[1]), where });
    for (const m of src.matchAll(new RegExp(String.raw`\bt\.n\([^,]+,\s*${STR},\s*${STR}`, "g"))) {
      out.push({ key: unescape(m[1]), where }, { key: unescape(m[2]), where });
    }
  }
  return out;
}

describe("Indonesian translation", () => {
  it("has an entry for every text passed to t()", () => {
    const missing = [...literals(), ...DYNAMIC_KEYS.map((key) => ({ key, where: "dynamic-keys.ts" }))].filter(({ key }) => !(key in ID));
    expect(missing.map(({ key, where }) => `${where}: ${key}`)).toEqual([]);
  });

  it("never passes a template string to t(), which the check above could not see", () => {
    const offenders = files(ROOT).filter((f) => /\bt(\.n)?\(\s*`/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });

  it("keeps the same {placeholders} in both languages", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const bad = Object.entries(ID).filter(([en, id]) => names(en).join() !== names(id).join());
    expect(bad).toEqual([]);
  });

  it("falls back to English and fills placeholders", () => {
    expect(translate("id", "Not in the dictionary")).toBe("Not in the dictionary");
    expect(translate("en", "{n} sets", { n: 3 })).toBe("3 sets");
    expect(translate("id", "Home")).toBe("Beranda");
  });
});
