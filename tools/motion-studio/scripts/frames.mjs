/**
 * Renders a few frames of every composition to PNG, for reviewing the motion without Studio.
 *   npm run frames                      all compositions, frames 0, 1 s, 2 s, 3 s, 4.5 s, 6 s, 6.7 s
 *   npm run frames -- workout-arcade    one composition
 * Test renders only (--is-production=false). Set REMOTION_BROWSER to use an installed Chrome
 * instead of the one Remotion downloads (for a machine that cannot reach remotion.media).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["matchday", "thermal-matrix", "brutalist-receipt", "editorial", "arcade", "loaded-bar", "trophy-vault", "volt-poster"].map((p) => `workout-${p}`).concat("streak");
const frames = [0, 30, 60, 90, 135, 180, 201].join(",");
for (const id of ids) {
  const out = `out/frames/${id}`;
  mkdirSync(out, { recursive: true });
  const args = ["remotion", "render", "src/index.ts", id, out, `--frames=${frames}`, "--sequence", "--image-format=png", "--is-production=false"];
  if (process.env.REMOTION_BROWSER) args.push(`--browser-executable=${process.env.REMOTION_BROWSER}`);
  console.log(`Rendering ${id}…`);
  execFileSync("npx", args, { stdio: "inherit" });
}
