import { normalizeExercise, normalizeSession } from "@/data/normalize";
import { lbsToKg } from "@/lib/calc";
import type {
  Equipment,
  Exercise,
  LogType,
  MuscleGroup,
  SessionExercise,
  SetType,
  WeightUnit,
  WorkoutSession,
  WorkoutSet,
} from "@/types/workout";

/**
 * Workout history from other apps' CSV exports (Hevy, Strong, or any file with the same
 * columns), turned into ABOT sessions. Everything runs on the device; nothing is uploaded.
 *
 * - Columns are found by name, not position, so reordered or extra columns are fine. Units
 *   written in a header ("Weight (kg)", "weight_lbs") win over the unit the lifter picks.
 * - Exercise names are matched to the library ignoring case, punctuation, word order and
 *   plurals; a name with no match becomes a custom exercise.
 * - Ids are derived from the file's own data, so importing the same file twice changes
 *   nothing, and a workout already on the device at the same minute is skipped.
 * - Records are not stored: they are worked out from the whole history whenever they are
 *   shown, so imported workouts count toward them as soon as they are saved.
 */

export type CsvSource = "hevy" | "strong" | "generic";

export interface ParsedSet {
  type: SetType;
  /** In the file's unit; null when the column is empty. */
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  durationSec: number | null;
  /** In metres. */
  distanceM: number | null;
}

export interface ParsedExercise {
  name: string;
  notes?: string;
  /** Hevy's superset number inside the workout. */
  superset?: string;
  sets: ParsedSet[];
}

export interface ParsedWorkout {
  /** Stable for the same workout in the same file. */
  key: string;
  name: string;
  startedAt: number;
  finishedAt: number;
  notes?: string;
  exercises: ParsedExercise[];
}

export type CsvParseResult =
  | {
      ok: true;
      source: CsvSource;
      /** The weight unit the file states, or null when the lifter has to say. */
      unitInFile: WeightUnit | null;
      workouts: ParsedWorkout[];
      /** Data rows that could not be read (no date, no exercise, a rest-timer row). */
      skippedRows: number;
    }
  | { ok: false; error: string };

// ---------------------------------------------------------------- CSV text

/** RFC 4180 rows: quoted fields, "" escapes, commas or newlines inside quotes, CRLF. */
export function parseCsvRows(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** Strong writes ";" in some regions; whichever separator the header line uses most wins. */
function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const count = (d: string) => firstLine.split(d).length - 1;
  return [",", ";", "\t"].reduce((best, d) => (count(d) > count(best) ? d : best), ",");
}

// ---------------------------------------------------------------- columns

type Col =
  | "date"
  | "end"
  | "workout"
  | "workoutNo"
  | "duration"
  | "exercise"
  | "setOrder"
  | "setType"
  | "weight"
  | "reps"
  | "rpe"
  | "distance"
  | "seconds"
  | "notes"
  | "workoutNotes"
  | "superset";

/** Header text -> column, after lowercasing and turning anything else into "_". */
const ALIASES: Record<string, Col> = {
  date: "date",
  start_time: "date",
  end_time: "end",
  workout_name: "workout",
  title: "workout",
  workout: "workoutNo",
  workout_no: "workoutNo",
  duration: "duration",
  exercise_name: "exercise",
  exercise_title: "exercise",
  exercise: "exercise",
  set_order: "setOrder",
  set_index: "setOrder",
  set_type: "setType",
  weight: "weight",
  reps: "reps",
  rpe: "rpe",
  distance: "distance",
  seconds: "seconds",
  duration_seconds: "seconds",
  notes: "notes",
  exercise_notes: "notes",
  workout_notes: "workoutNotes",
  description: "workoutNotes",
  superset_id: "superset",
};

interface Header {
  cols: Partial<Record<Col, number>>;
  weightUnit: WeightUnit | null;
  /** Metres per unit of the distance column, or null when the file does not say. */
  distanceScale: number | null;
  /** The Duration column counts seconds ("Duration (sec)") instead of "1h 5m". */
  durationInSeconds: boolean;
}

function readHeader(cells: string[]): Header {
  const h: Header = { cols: {}, weightUnit: null, distanceScale: null, durationInSeconds: false };
  cells.forEach((raw, i) => {
    const text = raw.trim().toLowerCase();
    // "Weight (kg)", "Distance (meters)", "Duration (sec)": the unit sits in brackets.
    const bracket = /\(([^)]*)\)/.exec(text)?.[1]?.trim() ?? "";
    let key = text
      .replace(/\([^)]*\)/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    let unit = bracket;
    // Hevy puts the unit at the end: weight_kg, weight_lbs, distance_km, distance_miles.
    const suffix = /^(weight|distance)_(kg|lbs?|km|miles?|mi|m|meters?)$/.exec(key);
    if (suffix) {
      key = suffix[1]!;
      unit = suffix[2]!;
    }
    const col = ALIASES[key];
    if (!col || h.cols[col] !== undefined) return;
    h.cols[col] = i;
    if (col === "weight") {
      if (/^kgs?$/.test(unit)) h.weightUnit = "kg";
      else if (/^lbs?$|^pounds?$/.test(unit)) h.weightUnit = "lbs";
    }
    if (col === "distance") {
      if (/^km|kilomet/.test(unit)) h.distanceScale = 1000;
      else if (/^mi/.test(unit)) h.distanceScale = 1609.344;
      else if (/^m$|^met/.test(unit)) h.distanceScale = 1;
    }
    if (col === "duration" && /^s(ec|econds?)?$/.test(unit)) h.durationInSeconds = true;
  });
  return h;
}

function detectSource(cells: string[]): CsvSource {
  const lower = cells.map((c) => c.trim().toLowerCase());
  if (lower.includes("exercise_title") || lower.includes("start_time")) return "hevy";
  if (lower.includes("exercise name") && lower.some((c) => c.startsWith("set order"))) return "strong";
  return "generic";
}

// ---------------------------------------------------------------- values

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Local time from "2024-01-15 08:30:00", "2024-01-15T08:30", "15 Jan 2024, 08:30" or "2024-01-15". */
export function parseCsvDate(raw: string): number | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(+m[1]!, +m[2]! - 1, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)).getTime();
  }
  m = /^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m) {
    const month = MONTHS.indexOf(m[2]!.toLowerCase());
    if (month >= 0) return new Date(+m[3]!, month, +m[1]!, +m[4]!, +m[5]!, +(m[6] ?? 0)).getTime();
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/** "1h 5m", "45m", "50s", "1:05:00", or plain seconds when the header says so. */
export function parseCsvDuration(raw: string, inSeconds: boolean): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return inSeconds ? Math.round(+s) : Math.round(+s * 60);
  const clock = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(s);
  if (clock) return +(clock[1] ?? 0) * 3600 + +clock[2]! * 60 + +clock[3]!;
  let total = 0;
  let found = false;
  for (const [, n, u] of s.matchAll(/(\d+(?:\.\d+)?)\s*(h|m|s)/g)) {
    found = true;
    total += +n! * (u === "h" ? 3600 : u === "m" ? 60 : 1);
  }
  return found ? Math.round(total) : null;
}

/** Numbers as written by either app, including a decimal comma ("82,5"). */
function num(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  const n = Number(s.includes(",") && !s.includes(".") ? s.replace(",", ".") : s);
  return Number.isFinite(n) ? n : null;
}

/** ABOT keeps RPE 6 to 10 in half steps; anything else is dropped rather than guessed. */
function rpe(raw: string | undefined): number | null {
  const n = num(raw);
  if (n === null || n < 6 || n > 10) return null;
  return Math.round(n * 2) / 2;
}

/** Set type from Hevy's set_type or Strong's Set Order ("W", "D", "F" or a number). */
function setType(typeCell: string | undefined, orderCell: string | undefined): SetType | null {
  const t = (typeCell ?? "").trim().toLowerCase();
  if (t) {
    if (t.startsWith("warm")) return "warmup";
    if (t.startsWith("drop")) return "dropset";
    if (t.startsWith("fail")) return "failure";
    return "normal";
  }
  const o = (orderCell ?? "").trim().toUpperCase();
  if (o === "" || /^\d+$/.test(o)) return "normal";
  if (o === "W") return "warmup";
  if (o === "D") return "dropset";
  if (o === "F") return "failure";
  // "Rest Timer" and other notes Strong writes as rows are not sets.
  return null;
}

// ---------------------------------------------------------------- whole file

export function parseWorkoutCsv(text: string): CsvParseResult {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { ok: false, error: "This file is empty" };
  const header = readHeader(rows[0]!);
  const c = header.cols;
  if (c.date === undefined || c.exercise === undefined || (c.weight === undefined && c.reps === undefined && c.seconds === undefined)) {
    return { ok: false, error: "This CSV does not look like a workout export. It needs date, exercise name and weight or reps columns." };
  }
  const source = detectSource(rows[0]!);
  const cell = (r: string[], col: Col) => (c[col] === undefined ? undefined : r[c[col]!]);
  // Strong's own distance column is in the app's unit, which the file does not name.
  const distanceScale = header.distanceScale ?? (header.weightUnit === "lbs" ? 1609.344 : 1000);

  const byKey = new Map<string, ParsedWorkout>();
  const exercisesOf = new Map<ParsedWorkout, Map<string, ParsedExercise>>();
  let skippedRows = 0;
  for (const r of rows.slice(1)) {
    const dateText = cell(r, "date")?.trim() ?? "";
    const startedAt = parseCsvDate(dateText);
    const exerciseName = cell(r, "exercise")?.trim() ?? "";
    const type = setType(cell(r, "setType"), cell(r, "setOrder"));
    if (startedAt === null || !exerciseName || type === null) {
      skippedRows++;
      continue;
    }
    const name = cell(r, "workout")?.trim() || "Imported workout";
    const key = `${dateText}|${name}|${cell(r, "workoutNo")?.trim() ?? ""}`;
    let w = byKey.get(key);
    if (!w) {
      const end = cell(r, "end") ? parseCsvDate(cell(r, "end")!) : null;
      const dur = cell(r, "duration") ? parseCsvDuration(cell(r, "duration")!, header.durationInSeconds) : null;
      const finishedAt = end !== null && end >= startedAt ? end : dur !== null ? startedAt + dur * 1000 : startedAt;
      const notes = cell(r, "workoutNotes")?.trim();
      w = { key, name, startedAt, finishedAt, ...(notes ? { notes } : {}), exercises: [] };
      byKey.set(key, w);
      exercisesOf.set(w, new Map());
    }
    // One card per exercise: sets of the same exercise later in the workout join it.
    const superset = cell(r, "superset")?.trim() || undefined;
    const byName = exercisesOf.get(w)!;
    let ex = byName.get(exerciseName.toLowerCase());
    if (!ex) {
      ex = { name: exerciseName, sets: [], ...(superset ? { superset } : {}) };
      byName.set(exerciseName.toLowerCase(), ex);
      w.exercises.push(ex);
    }
    const notes = cell(r, "notes")?.trim();
    if (notes && !ex.notes) ex.notes = notes;
    const distance = num(cell(r, "distance"));
    const seconds = num(cell(r, "seconds"));
    const reps = num(cell(r, "reps"));
    ex.sets.push({
      type,
      weight: num(cell(r, "weight")),
      reps: reps === null ? null : Math.round(reps),
      rpe: rpe(cell(r, "rpe")),
      durationSec: seconds && seconds > 0 ? Math.round(seconds) : null,
      distanceM: distance && distance > 0 ? Math.round(distance * distanceScale) : null,
    });
  }
  const workouts = [...byKey.values()].sort((a, b) => a.startedAt - b.startedAt);
  if (workouts.length === 0) return { ok: false, error: "No workouts were found in this file" };
  return { ok: true, source, unitInFile: header.weightUnit, workouts, skippedRows };
}

// ---------------------------------------------------------------- exercise names

const FILLER = new Set(["the", "a", "an", "with", "on", "of"]);
const WORDS: Record<string, string> = {
  db: "dumbbell",
  dumbbells: "dumbbell",
  bb: "barbell",
  kb: "kettlebell",
  bw: "bodyweight",
  pullup: "pull up",
  pullups: "pull up",
  chinup: "chin up",
  chinups: "chin up",
  pushup: "push up",
  pushups: "push up",
  situp: "sit up",
  situps: "sit up",
  "&": "and",
};

/** Lowercase words without punctuation, filler words or plural "s", in a fixed order. */
export function nameTokens(name: string): string[] {
  const words = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .flatMap((w) => (WORDS[w] ?? w).split(" "))
    .filter((w) => w && !FILLER.has(w))
    .map((w) => (w.length > 2 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
  return [...new Set(words)].sort();
}

/** At most one letter apart: a typo, not a different word (incline vs decline is two). */
function nearWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * The library exercise a CSV name means, or null. Same words in any order wins outright;
 * otherwise every word must pair with a word at most one typo away.
 */
export function matchExercise(name: string, library: Exercise[]): Exercise | null {
  const tokens = nameTokens(name);
  const key = tokens.join(" ");
  if (!key) return null;
  let near: Exercise | null = null;
  for (const e of library) {
    const other = nameTokens(e.name);
    if (other.join(" ") === key) return e;
    if (!near && other.length === tokens.length && tokens.every((t, i) => nearWord(t, other[i]!))) near = e;
  }
  return near;
}

const EQUIPMENT_WORDS: [RegExp, Equipment][] = [
  [/smith/i, "smith_machine"],
  [/barbell|\bbb\b|ez[ -]?bar|trap bar|hex bar/i, "barbell"],
  [/dumbbell|\bdb\b/i, "dumbbell"],
  [/kettlebell|\bkb\b/i, "kettlebell"],
  [/cable/i, "cable"],
  [/band/i, "band"],
  [/machine|lever|plate loaded|sled/i, "machine"],
  [/bodyweight|weighted|assisted|\bbw\b|pull[ -]?up|chin[ -]?up|push[ -]?up|\bdips?\b|plank|crunch|sit[ -]?up/i, "bodyweight"],
];

const MUSCLE_WORDS: [RegExp, MuscleGroup][] = [
  [/calf|calves/i, "calves"],
  [/shrug/i, "traps"],
  [/tricep|pushdown|skull|kickback|\bdips?\b|close grip bench/i, "triceps"],
  [/leg curl|hamstring|romanian|\brdl\b|good morning|stiff/i, "hamstrings"],
  [/curl|bicep|preacher|hammer/i, "biceps"],
  [/hip thrust|glute|bridge|kickback|abduct/i, "glutes"],
  [/squat|leg press|lunge|leg extension|step up|hack/i, "quads"],
  [/deadlift/i, "back"],
  [/pull[ -]?up|chin[ -]?up|pulldown|pullover/i, "lats"],
  [/\brows?\b/i, "back"],
  [/bench|chest|fly|flye|push[ -]?up|pec/i, "chest"],
  [/overhead|shoulder|military|lateral|raise|face pull|arnold|upright/i, "shoulders"],
  [/crunch|plank|sit[ -]?up|\bab\b|abs|leg raise|oblique|russian twist|wheel/i, "abs"],
  [/wrist|forearm|farmer/i, "forearms"],
  [/run|row(ing)? machine|bike|cycl|elliptical|stair|treadmill|jump rope|swim|walk/i, "cardio"],
];

/** A custom exercise for a name the library does not have, with a best guess at its details. */
export function exerciseFromCsvName(name: string, sets: ParsedSet[]): Exercise {
  const equipment = EQUIPMENT_WORDS.find(([re]) => re.test(name))?.[1] ?? "other";
  const muscle = MUSCLE_WORDS.find(([re]) => re.test(name))?.[1] ?? "full_body";
  const hasWeight = sets.some((s) => (s.weight ?? 0) > 0);
  const hasReps = sets.some((s) => (s.reps ?? 0) > 0);
  const hasTime = sets.some((s) => s.durationSec !== null);
  const hasDistance = sets.some((s) => s.distanceM !== null);
  const logType: LogType = hasDistance ? "distance_duration" : hasTime && !hasReps ? "duration" : !hasWeight && hasReps ? "reps_only" : "weight_reps";
  return normalizeExercise({
    id: `custom-import-${nameTokens(name).join("-") || "exercise"}`,
    name: name.trim(),
    equipment,
    primaryMuscles: [muscle],
    secondaryMuscles: [],
    isBodyweight: equipment === "bodyweight",
    logType,
    category: muscle === "cardio" ? "cardio" : undefined,
    isCustom: true,
  });
}

// ---------------------------------------------------------------- into ABOT

export interface CsvImportPlan {
  sessions: WorkoutSession[];
  /** Custom exercises to create for names the library did not have. */
  newExercises: Exercise[];
  /** CSV name -> library name, for names that were matched. */
  matched: { from: string; to: string }[];
  /** Workouts already on the device (imported before, or logged at the same minute), left out. */
  duplicates: number;
  /** Workouts dated before 1990 or in the future, left out: no app logged them, and a far-past
   * date made every Home render walk millions of weeks (security audit 2026-11-13). */
  outOfRange: number;
  sets: number;
}

/** Short stable hash, so a workout keeps its id when the same file is imported again. */
function hash(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)).slice(0, 14);
}

const MINUTE = 60_000;
const DAY = 86_400_000;
/** The earliest workout date an import accepts; Hevy and Strong are far younger than this. */
const EARLIEST_MS = Date.UTC(1990, 0, 1);

export function planCsvImport(
  parsed: { source: CsvSource; workouts: ParsedWorkout[] },
  opts: { unit: WeightUnit; library: Exercise[]; existing: WorkoutSession[]; now?: number },
): CsvImportPlan {
  const latest = (opts.now ?? Date.now()) + DAY;
  const toKg = (w: number | null) => (w === null ? null : opts.unit === "kg" ? w : Math.round(lbsToKg(w) * 100) / 100);
  const existingMinutes = new Set(opts.existing.map((s) => Math.floor(s.startedAt / MINUTE)));
  const existingIds = new Set(opts.existing.map((s) => s.id));
  const library = [...opts.library];
  const created = new Map<string, Exercise>();
  const matchedNames = new Map<string, string>();
  const resolve = (name: string, sets: ParsedSet[]): Exercise => {
    const found = matchExercise(name, library);
    if (found) {
      if (!found.id.startsWith("custom-import-") && found.name !== name) matchedNames.set(name, found.name);
      return found;
    }
    const made = exerciseFromCsvName(name, sets);
    library.push(made);
    created.set(made.id, made);
    return made;
  };

  const sessions: WorkoutSession[] = [];
  let duplicates = 0;
  let outOfRange = 0;
  let setCount = 0;
  for (const w of parsed.workouts) {
    if (!(w.startedAt >= EARLIEST_MS && w.startedAt <= latest)) {
      outOfRange++;
      continue;
    }
    const id = `import-${parsed.source}-${hash(w.key)}`;
    // Already imported (same id), or logged in ABOT at the same minute: the same session.
    if (existingIds.has(id) || existingMinutes.has(Math.floor(w.startedAt / MINUTE))) {
      duplicates++;
      continue;
    }
    const exercises: SessionExercise[] = w.exercises.map((e, i) => {
      const ex = resolve(e.name, e.sets);
      // The other apps write 0 in columns that do not apply; ABOT leaves those empty.
      const usesWeight = ex.logType === "weight_reps";
      const sets: WorkoutSet[] = e.sets.map((s, j) => ({
        id: `${id}-e${i}-s${j}`,
        type: s.type,
        weightKg: usesWeight || (s.weight ?? 0) > 0 ? toKg(s.weight) : null,
        reps: s.reps === 0 && !usesWeight ? null : s.reps,
        rpe: s.rpe,
        completed: true,
        completedAt: w.startedAt,
        ...(s.durationSec !== null ? { durationSec: s.durationSec } : {}),
        ...(s.distanceM !== null ? { distanceM: s.distanceM } : {}),
      }));
      setCount += sets.length;
      return {
        id: `${id}-e${i}`,
        exerciseId: ex.id,
        sets,
        restSeconds: 90,
        ...(e.notes ? { notes: e.notes } : {}),
        ...(e.superset ? { supersetId: `${id}-ss${e.superset}` } : {}),
      };
    });
    // A superset needs two exercises; a lone id from the file is dropped.
    const ssCount = new Map<string, number>();
    for (const e of exercises) if (e.supersetId) ssCount.set(e.supersetId, (ssCount.get(e.supersetId) ?? 0) + 1);
    for (const e of exercises) if (e.supersetId && (ssCount.get(e.supersetId) ?? 0) < 2) delete e.supersetId;

    // The same checks as a backup file: whatever the CSV said, the stored session is one the
    // rest of the app can handle. A workout lasts at most a day.
    const session = normalizeSession({
      id,
      name: w.name,
      startedAt: w.startedAt,
      finishedAt: Number.isFinite(w.finishedAt) ? Math.min(Math.max(w.finishedAt, w.startedAt), w.startedAt + DAY) : w.startedAt,
      status: "completed",
      exercises,
      ...(w.notes ? { notes: w.notes } : {}),
    });
    if (!session) {
      outOfRange++;
      continue;
    }
    sessions.push(session);
  }
  return {
    sessions,
    newExercises: [...created.values()],
    matched: [...matchedNames].map(([from, to]) => ({ from, to })),
    duplicates,
    outOfRange,
    sets: setCount,
  };
}
