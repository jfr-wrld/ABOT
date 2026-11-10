import { describe, expect, it } from "vitest";
import { SEED_EXERCISES } from "@/data/exercises";
import {
  exerciseFromCsvName,
  matchExercise,
  parseCsvDate,
  parseCsvDuration,
  parseCsvRows,
  parseWorkoutCsv,
  planCsvImport,
} from "./data-portability";
import type { WorkoutSession } from "@/types/workout";

/** The header and row layout of Hevy's "Export workout data" file. */
const HEVY = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Push Day","15 Jan 2024, 08:30","15 Jan 2024, 09:35","Felt strong","Bench Press (Barbell)",,"Pause at chest",0,"warmup",40,10,,,
"Push Day","15 Jan 2024, 08:30","15 Jan 2024, 09:35","Felt strong","Bench Press (Barbell)",,"",1,"normal",80,8,,,8.5
"Push Day","15 Jan 2024, 08:30","15 Jan 2024, 09:35","Felt strong","Triceps Pushdown (Cable)",0,"",0,"normal",30,12,,,
"Push Day","15 Jan 2024, 08:30","15 Jan 2024, 09:35","Felt strong","Lateral Raise (Dumbbell)",0,"",0,"dropset",10,15,,,
"Push Day","15 Jan 2024, 08:30","15 Jan 2024, 09:35","Felt strong","Plank",,"",0,"normal",,,,60,
"Legs","17 Jan 2024, 18:00","17 Jan 2024, 19:00","","Squat (Barbell)",,"",0,"failure",100,5,,,`;

/** Strong's classic export: ";" separated, units not named, durations like "1h 5m". */
const STRONG = `Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE
2023-03-02 07:15:00;"Upper A";1h 5m;"Barbell Bench Press";W;95;10;0;0;"";"";
2023-03-02 07:15:00;"Upper A";1h 5m;"Barbell Bench Press";1;185;5;0;0;"";"";9
2023-03-02 07:15:00;"Upper A";1h 5m;"Barbell Bench Press";Rest Timer;0;0;0;120;"";"";
2023-03-02 07:15:00;"Upper A";1h 5m;"Cable Zottman Curl";1;40,5;12;0;0;"slow negatives";"";`;

/** Strong's newer export: units in the headers, Duration in seconds. */
const STRONG_NEW = `Workout #,Date,Workout Name,Duration (sec),Exercise Name,Set Order,Weight (kg),Reps,RPE,Distance (meters),Seconds,Notes,Workout Notes
12,2024-05-01 06:00:00,Cardio,1800,Running (Treadmill),1,0,0,,5000,1500,,
12,2024-05-01 06:00:00,Cardio,1800,Pull Up,1,0,10,,0,0,,`;

describe("CSV text", () => {
  it("reads quoted fields with commas, escaped quotes and line breaks", () => {
    expect(parseCsvRows('a,b\r\n"x, y","he said ""go""\nnow"\n')).toEqual([
      ["a", "b"],
      ["x, y", 'he said "go"\nnow'],
    ]);
  });
  it("detects semicolons and drops a byte-order mark and blank lines", () => {
    expect(parseCsvRows("﻿Date;Reps\n\n2024-01-01;5\n")).toEqual([
      ["Date", "Reps"],
      ["2024-01-01", "5"],
    ]);
  });
});

describe("dates and durations", () => {
  it("reads Strong, Hevy and ISO dates as local time", () => {
    const local = new Date(2024, 0, 15, 8, 30).getTime();
    expect(parseCsvDate("2024-01-15 08:30:00")).toBe(local);
    expect(parseCsvDate("15 Jan 2024, 08:30")).toBe(local);
    expect(parseCsvDate("2024-01-15T08:30")).toBe(local);
    expect(parseCsvDate("2024-01-15T08:30:00Z")).toBe(Date.UTC(2024, 0, 15, 8, 30));
    expect(parseCsvDate("not a date")).toBeNull();
  });
  it("reads 1h 5m, 45m, 1:05:00 and plain seconds", () => {
    expect(parseCsvDuration("1h 5m", false)).toBe(3900);
    expect(parseCsvDuration("45m", false)).toBe(2700);
    expect(parseCsvDuration("1:05:00", false)).toBe(3900);
    expect(parseCsvDuration("1800", true)).toBe(1800);
  });
});

describe("parseWorkoutCsv", () => {
  it("Hevy: two workouts, set types, kg from the header, superset and timed sets", () => {
    const r = parseWorkoutCsv(HEVY);
    if (!r.ok) throw new Error(r.error);
    expect(r.source).toBe("hevy");
    expect(r.unitInFile).toBe("kg");
    expect(r.workouts.map((w) => w.name)).toEqual(["Push Day", "Legs"]);
    const push = r.workouts[0]!;
    expect(push.finishedAt - push.startedAt).toBe(65 * 60_000);
    expect(push.notes).toBe("Felt strong");
    expect(push.exercises.map((e) => e.name)).toEqual([
      "Bench Press (Barbell)",
      "Triceps Pushdown (Cable)",
      "Lateral Raise (Dumbbell)",
      "Plank",
    ]);
    expect(push.exercises[0]!.sets.map((s) => [s.type, s.weight, s.reps, s.rpe])).toEqual([
      ["warmup", 40, 10, null],
      ["normal", 80, 8, 8.5],
    ]);
    expect(push.exercises[0]!.notes).toBe("Pause at chest");
    expect(push.exercises[1]!.superset).toBe("0");
    expect(push.exercises[2]!.sets[0]!.type).toBe("dropset");
    expect(push.exercises[3]!.sets[0]!.durationSec).toBe(60);
    expect(r.workouts[1]!.exercises[0]!.sets[0]!.type).toBe("failure");
  });

  it("Strong: W is a warm-up, Rest Timer rows are skipped, decimal commas read", () => {
    const r = parseWorkoutCsv(STRONG);
    if (!r.ok) throw new Error(r.error);
    expect(r.source).toBe("strong");
    expect(r.unitInFile).toBeNull();
    expect(r.skippedRows).toBe(1);
    const w = r.workouts[0]!;
    expect(w.finishedAt - w.startedAt).toBe(3900 * 1000);
    expect(w.exercises[0]!.sets.map((s) => [s.type, s.weight, s.rpe])).toEqual([
      ["warmup", 95, null],
      ["normal", 185, 9],
    ]);
    expect(w.exercises[1]!.sets[0]!.weight).toBe(40.5);
    expect(w.exercises[1]!.notes).toBe("slow negatives");
  });

  it("Strong's newer export: units in brackets, seconds and metres", () => {
    const r = parseWorkoutCsv(STRONG_NEW);
    if (!r.ok) throw new Error(r.error);
    expect(r.unitInFile).toBe("kg");
    const run = r.workouts[0]!.exercises[0]!.sets[0]!;
    expect([run.distanceM, run.durationSec]).toEqual([5000, 1500]);
    expect(r.workouts[0]!.finishedAt - r.workouts[0]!.startedAt).toBe(1800 * 1000);
  });

  it("refuses a file that is not a workout export", () => {
    const r = parseWorkoutCsv("name,email\nAna,ana@example.com");
    expect(r.ok).toBe(false);
    expect(parseWorkoutCsv("").ok).toBe(false);
  });
});

describe("matching exercise names to the library", () => {
  const find = (n: string) => matchExercise(n, SEED_EXERCISES)?.id ?? null;
  it("matches regardless of case, word order, punctuation and plurals", () => {
    expect(find("Bench Press (Barbell)")).toBe("bench-press-barbell");
    expect(find("barbell bench press")).toBe("bench-press-barbell");
    expect(find("Bench Press - Barbell")).toBe("bench-press-barbell");
    expect(find("Biceps Curl (Dumbbells)")).toBe("bicep-curl-dumbbell");
    expect(find("Pull-Ups")).toBe("pull-up");
  });
  it("tolerates one typo but not a different word", () => {
    expect(find("Bench Press (Dumbell)")).toBe("bench-press-dumbbell");
    expect(find("Incline Bench Press (Barbell)")).toBe("incline-bench-press-barbell");
    expect(find("Decline Bench Press (Smith Machine)")).toBeNull();
  });
  it("a new name becomes a custom exercise with its equipment and muscle guessed", () => {
    const e = exerciseFromCsvName("Cable Zottman Curl", [{ type: "normal", weight: 20, reps: 10, rpe: null, durationSec: null, distanceM: null }]);
    expect(e).toMatchObject({ equipment: "cable", primaryMuscles: ["biceps"], isCustom: true, logType: "weight_reps" });
    const run = exerciseFromCsvName("Running (Treadmill)", [{ type: "normal", weight: 0, reps: 0, rpe: null, durationSec: 1500, distanceM: 5000 }]);
    expect(run).toMatchObject({ primaryMuscles: ["cardio"], logType: "distance_duration", category: "cardio" });
  });
});

describe("planCsvImport", () => {
  const parse = (text: string) => {
    const r = parseWorkoutCsv(text);
    if (!r.ok) throw new Error(r.error);
    return r;
  };

  it("builds finished sessions on library exercises, with supersets and custom exercises", () => {
    const plan = planCsvImport(parse(HEVY), { unit: "kg", library: SEED_EXERCISES, existing: [] });
    expect(plan.sessions).toHaveLength(2);
    expect(plan.sets).toBe(6);
    const push = plan.sessions[0]!;
    expect(push.status).toBe("completed");
    expect(push.exercises.map((e) => e.exerciseId)).toEqual([
      "bench-press-barbell",
      "triceps-pushdown-cable",
      "lateral-raise-dumbbell",
      "plank",
    ]);
    expect(push.exercises[1]!.supersetId).toBeTruthy();
    expect(push.exercises[1]!.supersetId).toBe(push.exercises[2]!.supersetId);
    expect(push.exercises[0]!.sets.every((s) => s.completed)).toBe(true);
    // Plank is timed: the 0 the file writes for weight and reps is left empty.
    expect(push.exercises[3]!.sets[0]).toMatchObject({ weightKg: null, reps: null, durationSec: 60 });
    expect(plan.newExercises).toEqual([]);
  });

  it("converts pounds, and maps or creates every exercise", () => {
    const plan = planCsvImport(parse(STRONG), { unit: "lbs", library: SEED_EXERCISES, existing: [] });
    const [bench, zottman] = plan.sessions[0]!.exercises;
    expect(bench!.exerciseId).toBe("bench-press-barbell");
    expect(bench!.sets[1]!.weightKg).toBe(83.91);
    expect(plan.matched).toEqual([{ from: "Barbell Bench Press", to: "Bench Press (Barbell)" }]);
    expect(plan.newExercises.map((e) => e.name)).toEqual(["Cable Zottman Curl"]);
    expect(zottman!.exerciseId).toBe(plan.newExercises[0]!.id);
  });

  it("the same file gives the same ids; a workout already logged at that minute is skipped", () => {
    const a = planCsvImport(parse(HEVY), { unit: "kg", library: SEED_EXERCISES, existing: [] });
    const fresh = planCsvImport(parse(HEVY), { unit: "kg", library: SEED_EXERCISES, existing: [] });
    expect(fresh.sessions.map((s) => s.id)).toEqual(a.sessions.map((s) => s.id));
    const again = planCsvImport(parse(HEVY), { unit: "kg", library: SEED_EXERCISES, existing: a.sessions });
    expect(again.sessions).toEqual([]);
    expect(again.duplicates).toBe(2);

    const logged: WorkoutSession = { ...a.sessions[1]!, id: "mine", startedAt: a.sessions[1]!.startedAt + 20_000 };
    const withMine = planCsvImport(parse(HEVY), { unit: "kg", library: SEED_EXERCISES, existing: [logged] });
    expect(withMine.duplicates).toBe(1);
    expect(withMine.sessions.map((s) => s.name)).toEqual(["Push Day"]);
  });

  it("a custom exercise made by an earlier import is reused, not made twice", () => {
    const first = planCsvImport(parse(STRONG), { unit: "kg", library: SEED_EXERCISES, existing: [] });
    const second = planCsvImport(parse(STRONG), {
      unit: "kg",
      library: [...SEED_EXERCISES, ...first.newExercises],
      existing: [],
    });
    expect(second.newExercises).toEqual([]);
    expect(second.sessions[0]!.exercises[1]!.exerciseId).toBe(first.newExercises[0]!.id);
  });
});
