// Which style (Bold, Linear) each icon is actually drawn in, read from the source, so
// make-icons.mjs ships only those shapes. An icon component picks Linear at 18 px and under,
// otherwise its default, unless `variant` says. Where a call site cannot be read (a size or variant
// that is not a literal, or the icon handed on as a value, e.g. a tab's Icon), both styles ship.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function files(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files(p, out);
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith(".test.ts") && !e.name.endsWith(".test.tsx") && !p.includes("components/icons/")) out.push(p);
  }
  return out;
}

/** name -> Set of "bold" | "linear" | "both"; `defaults` maps name -> its default style. */
export function iconUsage(srcDir, defaults) {
  const need = new Map(Object.keys(defaults).map((n) => [n, new Set()]));
  for (const f of files(srcDir)) {
    const text = readFileSync(f, "utf8");
    const imp = [...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']@\/components\/icons["']/g)];
    if (!imp.length) continue;
    // The rest of the file without its import lines, so naming an icon there is not a use.
    const s = text.replace(/import\s[^;]*?from\s*["'][^"']+["'];?/g, "");
    const names = new Map();
    for (const m of imp)
      for (const part of m[1].split(",")) {
        const [orig, local] = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/);
        if (orig && need.has(orig)) names.set(local ?? orig, orig);
      }
    for (const [local, orig] of names) {
      const want = need.get(orig);
      const re = new RegExp(`\\b${local}\\b`, "g");
      for (const m of s.matchAll(re)) {
        const before = s.slice(Math.max(0, m.index - 1), m.index);
        if (before !== "<") {
          want.add("both"); // handed on as a value: drawn at a size we cannot see
          continue;
        }
        // The JSX tag's attributes, up to its end (attributes here hold no ">" of their own).
        const end = s.indexOf(">", m.index);
        const attrs = s.slice(m.index, end);
        const size = attrs.match(/\bsize=\{([^}]*)\}/)?.[1]?.trim() ?? (attrs.match(/\bsize="(\d+)"/)?.[1] ?? null);
        const variant = attrs.match(/\bvariant="(bold|linear)"/)?.[1] ?? (/\bvariant=\{/.test(attrs) ? "?" : null);
        if (variant === "?") want.add("both");
        else if (variant) want.add(variant);
        else if (size === null) want.add(defaults[orig]);
        else if (/^\d+(\.\d+)?$/.test(size)) want.add(Number(size) <= 18 ? "linear" : defaults[orig]);
        else want.add("both");
      }
    }
  }
  return need;
}
