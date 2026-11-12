// Builds ABOT's extended exercise library from Open Exercise Atlas
// (https://github.com/yagizerentunay/open-exercise-atlas): exercise data CC0 1.0, illustrations
// CC0 1.0 (Atlas originals) or MIT (Monk Mode, (c) 2026 Yagiz Eren Tunay), recorded per image.
//
//   node scripts/build-atlas-catalog.mjs            fetch, map, write (keeps images already made)
//   node scripts/build-atlas-catalog.mjs --report   also print near-duplicates of seed exercises
//   node scripts/build-atlas-catalog.mjs --force    fetch every image again
//
// Writes src/data/atlas-catalog.generated.ts and a 128 px thumbnail per exercise (the size of the seed thumbs) in
// public/atlas/<id>.webp, which ship with the app, so lists show pictures offline (about 1.5 MB).
// The full illustration loads from the pinned Atlas commit on the detail page, when online, as the
// free-exercise-db photos do. Needs the network proxy for Node when behind one (NODE_USE_ENV_PROXY=1).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { cleanSteps } from "../src/data/cleanSteps.mjs";
import { exerciseKey, nameWords } from "../src/data/exerciseKey.mjs";

/** The Atlas commit the library is built from; bump it to take in new exercises. */
const COMMIT = "d46835681c450c1fb76d77e5e0cd74e799076e5e";
const RAW = `https://raw.githubusercontent.com/yagizerentunay/open-exercise-atlas/${COMMIT}/`;

const root = path.resolve(import.meta.dirname, "..");
const imgDir = path.join(root, "public/atlas");
fs.mkdirSync(imgDir, { recursive: true });
const report = process.argv.includes("--report");
const force = process.argv.includes("--force");

/**
 * Atlas exercises that are the same movement as a seed exercise under another name. Found with
 * --report and checked by hand; the seed exercise keeps its id, so history is untouched.
 */
const SAME_AS_SEED = new Set([
  "barbell-back-squat",
  "conventional-deadlift",
  "barbell-curl",
  "bent-over-barbell-row",
  "dumbbell-biceps-curl",
  "cable-rope-triceps-pushdown",
  "cable-biceps-curl",
  "seated-barbell-shoulder-press",
  "standing-calf-raise-machine",
  "chin-up",
  "pull-up",
  "push-up",
  "chest-dip",
  "dumbbell-bench-press",
  "barbell-bench-press",
  "barbell-hip-thrust",
  "dumbbell-shoulder-press",
  "dumbbell-lateral-raise",
  "dumbbell-front-raise",
  "dumbbell-shrug",
  "barbell-shrug",
  "goblet-squat",
  "bodyweight-squat",
  "bulgarian-split-squat",
  "dumbbell-walking-lunge",
  "plank",
  "hanging-leg-raise",
  "cable-crunch",
  "russian-twist",
  "ab-wheel-rollout",
  "bodyweight-mountain-climber",
  "kettlebell-swing",
  "overhead-press",
]);

const EQUIPMENT_ORDER = [
  ["barbell", "barbell"],
  ["ez-bar", "barbell"],
  ["dumbbell", "dumbbell"],
  ["kettlebell", "kettlebell"],
  ["cable", "cable"],
  ["machine", "machine"],
  ["band", "band"],
  ["bodyweight", "bodyweight"],
  ["pull-up-bar", "bodyweight"],
];

function equipmentOf(e) {
  if (/\bsmith\b/i.test(e.name)) return "smith_machine";
  for (const [atlas, abot] of EQUIPMENT_ORDER) if (e.equipment.includes(atlas)) return abot;
  // A bench or a mat alone, or nothing at all: the lifter's own body is the load.
  if (e.equipment.every((x) => x === "bench" || x === "mat")) return "bodyweight";
  return "other";
}

const MUSCLE = {
  quadriceps: "quads",
  glutes: "glutes",
  chest: "chest",
  shoulders: "shoulders",
  lats: "lats",
  triceps: "triceps",
  "upper-back": "back",
  abdominals: "abs",
  obliques: "abs",
  hamstrings: "hamstrings",
  traps: "traps",
  forearms: "forearms",
  calves: "calves",
  "tibialis-anterior": "calves",
  biceps: "biceps",
  adductors: "adductors",
  abductors: "abductors",
  "lower-back": "lower_back",
  neck: "neck",
};
const muscles = (list) => [...new Set((list ?? []).map((m) => MUSCLE[m]).filter(Boolean))];

const LABEL = { barbell: "Barbell", dumbbell: "Dumbbell", cable: "Cable", machine: "Machine", kettlebell: "Kettlebell", smith_machine: "Smith Machine" };
const WORD = /\b(EZ-Bar|Smith Machine|Barbell|Dumbbells?|Cable|Machine|Kettlebells?)\b\s*/i;

/**
 * ABOT and Hevy name a lift first and its tool in brackets: "Barbell Bench Press" becomes
 * "Bench Press (Barbell)". The tool word moves out only when at least two words stay behind
 * ("Cable Crossover" stays) and it is not a count ("Double Kettlebell Front Squat" stays).
 */
function displayName(e, equipment) {
  const name = e.name.trim();
  if (name.includes("(")) return name;
  const m = WORD.exec(name);
  const label = LABEL[equipment];
  if (m && label && !/\b(Double|Single)\s+$/i.test(name.slice(0, m.index))) {
    const rest = (name.slice(0, m.index) + name.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim();
    if (rest.split(" ").length >= 2) {
      const tool = /ez-bar/i.test(m[1]) ? "EZ Bar" : label;
      return `${rest} (${tool})`;
    }
    return name;
  }
  // Machine and cable work named without its tool still says which, as the seed library does;
  // cardio machines are named by themselves ("Treadmill Running", not "... (Machine)").
  if (label && e.category !== "cardio" && (equipment === "machine" || equipment === "cable" || equipment === "smith_machine")) return `${name} (${label})`;
  return name;
}

function category(e) {
  if (e.category === "cardio") return "cardio";
  if (e.category === "mobility") return "mobility";
  return e.movementPattern === "isolation" ? "isolation" : "compound";
}

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": "ABOT-atlas-build/1.0" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

const seedText = fs.readFileSync(path.join(root, "src/data/seed-exercises.generated.ts"), "utf8");
const seed = JSON.parse(seedText.slice(seedText.indexOf("= [") + 2, seedText.lastIndexOf("]") + 1));
const seedKeys = new Map(seed.map((s) => [exerciseKey(s.name, s.equipment), s.name]));

const atlas = await (await get(`${RAW}dist/exercises.en.json`)).json();
const rows = [];
const credits = { cc0: 0, mit: 0 };
const skipped = [];
for (const e of atlas) {
  if (!/^[a-z0-9-]+$/.test(e.id)) continue;
  const equipment = equipmentOf(e);
  const primary = muscles(e.primaryMuscles);
  if (primary.length === 0) continue;
  const name = displayName(e, equipment);
  const key = exerciseKey(name, equipment);
  if (SAME_AS_SEED.has(e.id) || seedKeys.has(key)) {
    skipped.push(`${e.name} = ${seedKeys.get(key) ?? "(listed)"}`);
    continue;
  }
  if (report) {
    const words = new Set(nameWords(name));
    for (const s of seed) {
      if (s.equipment !== equipment) continue;
      const sw = new Set(nameWords(s.name));
      const shared = [...words].filter((w) => sw.has(w)).length;
      if (shared / Math.max(words.size, sw.size) >= 0.6) console.log(`near: ${e.id} "${name}" ~ "${s.name}"`);
    }
  }
  const media = (e.media ?? []).find((m) => m.role === "reference" || m.role === "start");
  let image = null;
  if (media && /^media\/exercises\/[a-z0-9-]+\.webp$/.test(media.path)) {
    const file = path.join(imgDir, `${e.id}.webp`);
    if (force || !fs.existsSync(file)) {
      const buf = Buffer.from(await (await get(RAW + media.path)).arrayBuffer());
      fs.writeFileSync(file, await sharp(buf).resize(128, 128, { fit: "cover", position: "attention" }).webp({ quality: 60, effort: 6 }).toBuffer());
      process.stdout.write(".");
    }
    image = RAW + media.path;
    if (media.license === "MIT") credits.mit++;
    else credits.cc0++;
  }
  const secondary = muscles(e.secondaryMuscles).filter((m) => !primary.includes(m));
  rows.push({
    id: `atlas-${e.id}`,
    name,
    equipment,
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    category: category(e),
    ...(equipment === "bodyweight" ? { isBodyweight: true } : {}),
    instructions: cleanSteps(e.instructions ?? []),
    formCues: [],
    media: image ? { motionUrls: [image] } : {},
  });
}

// Two Atlas rows can land on the same name: keep the first.
const seen = new Set();
const unique = rows.filter((r) => {
  const k = exerciseKey(r.name, r.equipment);
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

const ts = `// Generated by scripts/build-atlas-catalog.mjs from Open Exercise Atlas at ${COMMIT.slice(0, 7)}
// (data CC0 1.0; illustrations CC0 1.0 or MIT, Monk Mode (c) 2026 Yagiz Eren Tunay). Do not edit
// by hand: change the script and run it again.
import type { ExerciseInput } from "./normalize";

export const ATLAS_COMMIT = "${COMMIT}";

export const ATLAS_INPUTS: ExerciseInput[] = ${JSON.stringify(unique)};
`;
fs.writeFileSync(path.join(root, "src/data/atlas-catalog.generated.ts"), ts);
console.log(`\n${unique.length} exercises (${skipped.length} already in the seed library), images: ${credits.cc0} CC0, ${credits.mit} MIT`);
if (report) console.log(skipped.join("\n"));
