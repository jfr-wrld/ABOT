// Adds the exercises free-exercise-db does not have (modern machines, cable variations, assisted
// and plate-loaded machines, sled work) from Open Exercise Atlas
// (https://github.com/yagizerentunay/open-exercise-atlas, data CC0 1.0).
//
//   node scripts/build-atlas-catalog.mjs            fetch, map, write
//   node scripts/build-atlas-catalog.mjs --report   also print what was left out and why
//
// Run after scripts/build-fedb-library.mjs. An Atlas exercise is left out when the seed library or
// free-exercise-db already has it (same tool and name words, or every word of its name in one of
// theirs), so the photo library stays the one people see. Atlas illustrations are not used: their
// still, drawn style does not sit with the photo pairs, so these rows show the tool icon and the
// muscle map instead. Writes src/data/atlas-catalog.generated.ts.
import fs from "node:fs";
import path from "node:path";
import { cleanSteps } from "../src/data/cleanSteps.mjs";
import { exerciseKey, nameWords } from "../src/data/exerciseKey.mjs";

/** The Atlas commit the library is built from; bump it to take in new exercises. */
const COMMIT = "d46835681c450c1fb76d77e5e0cd74e799076e5e";
const RAW = `https://raw.githubusercontent.com/yagizerentunay/open-exercise-atlas/${COMMIT}/`;

const root = path.resolve(import.meta.dirname, "..");
const report = process.argv.includes("--report");

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

// free-exercise-db as the app has it (scripts/build-fedb-library.mjs), by the same tool mapping.
const fedbText = fs.readFileSync(path.join(root, "src/data/fedb-library.generated.ts"), "utf8");
const fedb = JSON.parse(fedbText.slice(fedbText.indexOf("= [") + 2, fedbText.lastIndexOf("]") + 1));
const FEDB_EQUIPMENT = { barbell: "barbell", "e-z curl bar": "barbell", dumbbell: "dumbbell", cable: "cable", machine: "machine", kettlebells: "kettlebell", bands: "band", "body only": "bodyweight" };
const fedbEq = (f) => (f.equipment === null ? "bodyweight" : (FEDB_EQUIPMENT[f.equipment] ?? "other"));
const fedbKeys = new Set(fedb.map((f) => exerciseKey(f.name, fedbEq(f))));
const fedbWords = fedb.map((f) => ({ eq: fedbEq(f), words: new Set(nameWords(f.name)) }));
const inFedb = (name, equipment) => {
  if (fedbKeys.has(exerciseKey(name, equipment))) return true;
  const w = nameWords(name);
  return fedbWords.some((f) => f.eq === equipment && w.every((x) => f.words.has(x)));
};

const atlas = await (await get(`${RAW}dist/exercises.en.json`)).json();
const rows = [];
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
  if (inFedb(name, equipment)) {
    skipped.push(`${e.name} = free-exercise-db`);
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
    media: {},
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
// (data CC0 1.0). Do not edit by hand: change the script and run it again.
import type { ExerciseInput } from "./normalize";

export const ATLAS_COMMIT = "${COMMIT}";

export const ATLAS_INPUTS: ExerciseInput[] = ${JSON.stringify(unique)};
`;
fs.writeFileSync(path.join(root, "src/data/atlas-catalog.generated.ts"), ts);
console.log(`${unique.length} exercises (${skipped.length} already in the seed library or free-exercise-db)`);
if (report) console.log(skipped.join("\n"));
