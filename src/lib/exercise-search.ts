import type { Equipment, Exercise, MuscleGroup } from "@/types/workout";
import { worksArea } from "@/components/anatomy/regions";
import { hasPhoto } from "@/lib/exercise-photo";

/**
 * Exercise search for the library and the picker, one behaviour for both. A query matches when
 * every typed word starts a word of the exercise's name, its equipment or its muscles, in
 * English or Indonesian, or a common gym short form ("db bench", "ohp", "dada"). One wrong,
 * missing or swapped letter is forgiven in words of five letters or more ("benhc").
 */

const EQUIPMENT_WORDS: Record<Equipment, string[]> = {
  barbell: ["barbell", "barbel", "bb"],
  dumbbell: ["dumbbell", "dumbell", "dumbel", "db"],
  machine: ["machine", "mesin", "alat"],
  smith_machine: ["smith", "machine", "mesin"],
  cable: ["cable", "kabel"],
  bodyweight: ["bodyweight", "bw", "beban", "badan", "tubuh"],
  kettlebell: ["kettlebell", "kb"],
  band: ["band", "resistance", "karet"],
  other: [],
};

const MUSCLE_WORDS: Record<MuscleGroup, string[]> = {
  chest: ["chest", "pec", "pecs", "dada"],
  back: ["back", "punggung"],
  lats: ["lats", "lat", "punggung", "sayap"],
  shoulders: ["shoulders", "shoulder", "delts", "delt", "bahu", "pundak"],
  biceps: ["biceps", "bicep", "lengan"],
  triceps: ["triceps", "tricep", "lengan"],
  forearms: ["forearms", "forearm", "lengan", "bawah"],
  abs: ["abs", "core", "perut"],
  quads: ["quads", "quad", "paha", "depan"],
  hamstrings: ["hamstrings", "hamstring", "paha", "belakang"],
  glutes: ["glutes", "glute", "bokong", "pantat"],
  calves: ["calves", "calf", "betis"],
  traps: ["traps", "trap", "trapezius"],
  lower_back: ["lower", "back", "punggung", "bawah"],
  adductors: ["adductors", "adductor", "paha", "dalam"],
  abductors: ["abductors", "abductor", "paha", "luar"],
  neck: ["neck", "leher"],
  full_body: ["full", "body"],
  cardio: ["cardio", "kardio"],
};

/** Words in a name that people also search in Indonesian. */
const NAME_ALIASES: Record<string, string[]> = {
  run: ["lari"],
  running: ["lari"],
  treadmill: ["lari"],
  walking: ["jalan"],
  bike: ["sepeda"],
  cycling: ["sepeda"],
  bicycling: ["sepeda"],
  rowing: ["dayung"],
  squat: ["jongkok"],
  plank: ["papan"],
  rope: ["tali"],
};

/** Short forms typed as one word, read as the words they stand for. */
const QUERY_ALIASES: Record<string, string> = {
  ohp: "overhead press",
  rdl: "romanian deadlift",
  sldl: "stiff leg deadlift",
  dl: "deadlift",
  bp: "bench press",
  ghr: "glute ham raise",
  pushup: "push up",
  pullup: "pull up",
  chinup: "chin up",
  situp: "sit up",
  skullcrusher: "skull crusher",
};

export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function words(s: string): string[] {
  return fold(s)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

/** Every word an exercise can be found by, built once per exercise object. */
const cache = new WeakMap<Exercise, string[]>();
function searchWords(e: Exercise): string[] {
  let w = cache.get(e);
  if (!w) {
    const own = words(e.name);
    w = [
      ...own,
      ...own.flatMap((x) => NAME_ALIASES[x] ?? []),
      ...EQUIPMENT_WORDS[e.equipment],
      ...[...e.primaryMuscles, ...e.secondaryMuscles].flatMap((m) => MUSCLE_WORDS[m] ?? []),
    ];
    cache.set(e, w);
  }
  return w;
}

/** Optimal string alignment distance, stopping early once it passes 1. */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return true;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > 1) return false;
  }
  return d[a.length]![b.length]! <= 1;
}

/** 0: starts a word. 1: a one-letter slip of a word or of its start. -1: no match. */
function tokenMatch(q: string, pool: string[]): number {
  if (pool.some((w) => w.startsWith(q))) return 0;
  if (q.length >= 5 && pool.some((w) => withinOneEdit(q, w) || (w.length > q.length && withinOneEdit(q, w.slice(0, q.length))))) return 1;
  return -1;
}

function queryTokens(query: string): string[] {
  return words(query).flatMap((w) => words(QUERY_ALIASES[w] ?? w));
}

/** How well an exercise matches: 0 its name starts with the query, 1 every word starts a word, 2 with a typo; null no match. */
export function matchScore(e: Exercise, query: string): number | null {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return 0;
  const pool = searchWords(e);
  let typo = false;
  for (const q of tokens) {
    const m = tokenMatch(q, pool);
    if (m < 0) return null;
    if (m === 1) typo = true;
  }
  if (typo) return 2;
  return fold(e.name).startsWith(tokens.join(" ")) ? 0 : 1;
}

export interface ExerciseFilter {
  query: string;
  muscle?: MuscleGroup | "" | null;
  equipment?: Equipment | "" | null;
  /**
   * Browsing (no query) lists only exercises with a real photo, plus the lifter's own custom
   * exercises and these ids (favourites, recent). A search finds every exercise, photo first.
   */
  photos?: { keep?: ReadonlySet<string> };
}

export interface Ranking {
  favorites?: ReadonlySet<string>;
  /** Finished workouts each exercise was in. */
  uses?: Readonly<Record<string, number>>;
}

/**
 * The exercises that match. With a query they are ordered by how well they match, then
 * favourites, then how often they were done, then name; without one the list keeps its order.
 */
export function filterExercises(list: Exercise[], f: ExerciseFilter, rank: Ranking = {}): Exercise[] {
  const searching = f.query.trim() !== "";
  const out: { e: Exercise; score: number }[] = [];
  for (const e of list) {
    if (f.muscle && !worksArea([...e.primaryMuscles, ...e.secondaryMuscles], f.muscle)) continue;
    if (f.equipment && e.equipment !== f.equipment) continue;
    if (f.photos && !searching && !shownWithoutSearch(e, f.photos.keep)) continue;
    const score = searching ? matchScore(e, f.query) : 0;
    if (score === null) continue;
    out.push({ e, score });
  }
  if (!searching) return out.map((x) => x.e);
  const fav = (e: Exercise) => (rank.favorites?.has(e.id) ? 0 : 1);
  const uses = (e: Exercise) => rank.uses?.[e.id] ?? 0;
  const photo = (e: Exercise) => (f.photos && !hasPhoto(e) ? 1 : 0);
  return out
    .sort((a, b) => a.score - b.score || photo(a.e) - photo(b.e) || fav(a.e) - fav(b.e) || uses(b.e) - uses(a.e) || a.e.name.localeCompare(b.e.name))
    .map((x) => x.e);
}

/** Listed while browsing: a real photo, the lifter's own exercise, or one they keep coming back to. */
export function shownWithoutSearch(e: Exercise, keep?: ReadonlySet<string>): boolean {
  return hasPhoto(e) || e.isCustom === true || (keep?.has(e.id) ?? false);
}
