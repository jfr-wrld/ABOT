import type { Exercise } from "@/types/workout";
import { normalizeExercise } from "./normalize";

type SeedRow = Pick<Exercise, "id" | "name" | "primaryMuscles" | "secondaryMuscles" | "equipment" | "isBodyweight">;

/**
 * Built-in exercise library. Ids are stable slugs — never rename them,
 * because workout history references them.
 */
const SEED_ROWS: SeedRow[] = [
  // ---- Chest ----
  { id: "bench-press-barbell", name: "Bench Press (Barbell)", primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "shoulders"], equipment: "barbell" },
  { id: "bench-press-dumbbell", name: "Bench Press (Dumbbell)", primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "shoulders"], equipment: "dumbbell" },
  { id: "incline-bench-press-barbell", name: "Incline Bench Press (Barbell)", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders", "triceps"], equipment: "barbell" },
  { id: "incline-bench-press-dumbbell", name: "Incline Bench Press (Dumbbell)", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders", "triceps"], equipment: "dumbbell" },
  { id: "chest-press-machine", name: "Chest Press (Machine)", primaryMuscles: ["chest"], secondaryMuscles: ["triceps"], equipment: "machine" },
  { id: "cable-fly", name: "Cable Fly", primaryMuscles: ["chest"], secondaryMuscles: [], equipment: "cable" },
  { id: "push-up", name: "Push Up", primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "shoulders"], equipment: "bodyweight", isBodyweight: true },
  { id: "chest-dip", name: "Chest Dip", primaryMuscles: ["chest"], secondaryMuscles: ["triceps"], equipment: "bodyweight", isBodyweight: true },

  // ---- Back ----
  { id: "deadlift-barbell", name: "Deadlift (Barbell)", primaryMuscles: ["back"], secondaryMuscles: ["hamstrings", "glutes", "lower_back"], equipment: "barbell" },
  { id: "pull-up", name: "Pull Up", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: "bodyweight", isBodyweight: true },
  { id: "lat-pulldown-cable", name: "Lat Pulldown (Cable)", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: "cable" },
  { id: "bent-over-row-barbell", name: "Bent Over Row (Barbell)", primaryMuscles: ["back"], secondaryMuscles: ["biceps", "lower_back"], equipment: "barbell" },
  { id: "seated-row-cable", name: "Seated Row (Cable)", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: "cable" },
  { id: "one-arm-row-dumbbell", name: "One Arm Row (Dumbbell)", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: "dumbbell" },
  { id: "t-bar-row", name: "T-Bar Row", primaryMuscles: ["back"], secondaryMuscles: ["biceps"], equipment: "machine" },

  // ---- Shoulders ----
  { id: "overhead-press-barbell", name: "Overhead Press (Barbell)", primaryMuscles: ["shoulders"], secondaryMuscles: ["triceps"], equipment: "barbell" },
  { id: "shoulder-press-dumbbell", name: "Shoulder Press (Dumbbell)", primaryMuscles: ["shoulders"], secondaryMuscles: ["triceps"], equipment: "dumbbell" },
  { id: "lateral-raise-dumbbell", name: "Lateral Raise (Dumbbell)", primaryMuscles: ["shoulders"], secondaryMuscles: [], equipment: "dumbbell" },
  { id: "face-pull-cable", name: "Face Pull (Cable)", primaryMuscles: ["shoulders"], secondaryMuscles: ["traps"], equipment: "cable" },
  { id: "rear-delt-fly-machine", name: "Rear Delt Fly (Machine)", primaryMuscles: ["shoulders"], secondaryMuscles: ["traps"], equipment: "machine" },

  // ---- Arms ----
  { id: "bicep-curl-barbell", name: "Bicep Curl (Barbell)", primaryMuscles: ["biceps"], secondaryMuscles: ["forearms"], equipment: "barbell" },
  { id: "bicep-curl-dumbbell", name: "Bicep Curl (Dumbbell)", primaryMuscles: ["biceps"], secondaryMuscles: ["forearms"], equipment: "dumbbell" },
  { id: "hammer-curl-dumbbell", name: "Hammer Curl (Dumbbell)", primaryMuscles: ["biceps"], secondaryMuscles: ["forearms"], equipment: "dumbbell" },
  { id: "preacher-curl-machine", name: "Preacher Curl (Machine)", primaryMuscles: ["biceps"], secondaryMuscles: [], equipment: "machine" },
  { id: "triceps-pushdown-cable", name: "Triceps Pushdown (Cable)", primaryMuscles: ["triceps"], secondaryMuscles: [], equipment: "cable" },
  { id: "skullcrusher-barbell", name: "Skullcrusher (Barbell)", primaryMuscles: ["triceps"], secondaryMuscles: [], equipment: "barbell" },
  { id: "overhead-triceps-extension-dumbbell", name: "Overhead Triceps Extension (Dumbbell)", primaryMuscles: ["triceps"], secondaryMuscles: [], equipment: "dumbbell" },
  { id: "triceps-dip", name: "Triceps Dip", primaryMuscles: ["triceps"], secondaryMuscles: ["chest", "shoulders"], equipment: "bodyweight", isBodyweight: true },

  // ---- Legs ----
  { id: "squat-barbell", name: "Squat (Barbell)", primaryMuscles: ["quads"], secondaryMuscles: ["glutes", "hamstrings", "lower_back"], equipment: "barbell" },
  { id: "front-squat-barbell", name: "Front Squat (Barbell)", primaryMuscles: ["quads"], secondaryMuscles: ["glutes", "abs"], equipment: "barbell" },
  { id: "leg-press-machine", name: "Leg Press (Machine)", primaryMuscles: ["quads"], secondaryMuscles: ["glutes"], equipment: "machine" },
  { id: "leg-extension-machine", name: "Leg Extension (Machine)", primaryMuscles: ["quads"], secondaryMuscles: [], equipment: "machine" },
  { id: "bulgarian-split-squat", name: "Bulgarian Split Squat", primaryMuscles: ["quads"], secondaryMuscles: ["glutes"], equipment: "dumbbell" },
  { id: "romanian-deadlift-barbell", name: "Romanian Deadlift (Barbell)", primaryMuscles: ["hamstrings"], secondaryMuscles: ["glutes", "lower_back"], equipment: "barbell" },
  { id: "leg-curl-machine", name: "Leg Curl (Machine)", primaryMuscles: ["hamstrings"], secondaryMuscles: [], equipment: "machine" },
  { id: "hip-thrust-barbell", name: "Hip Thrust (Barbell)", primaryMuscles: ["glutes"], secondaryMuscles: ["hamstrings"], equipment: "barbell" },
  { id: "walking-lunge-dumbbell", name: "Walking Lunge (Dumbbell)", primaryMuscles: ["glutes"], secondaryMuscles: ["quads", "hamstrings"], equipment: "dumbbell" },
  { id: "standing-calf-raise-machine", name: "Standing Calf Raise (Machine)", primaryMuscles: ["calves"], secondaryMuscles: [], equipment: "machine" },
  { id: "seated-calf-raise-machine", name: "Seated Calf Raise (Machine)", primaryMuscles: ["calves"], secondaryMuscles: [], equipment: "machine" },

  // ---- Core / Traps / Other ----
  { id: "plank", name: "Plank", primaryMuscles: ["abs"], secondaryMuscles: ["lower_back"], equipment: "bodyweight", isBodyweight: true },
  { id: "hanging-leg-raise", name: "Hanging Leg Raise", primaryMuscles: ["abs"], secondaryMuscles: [], equipment: "bodyweight", isBodyweight: true },
  { id: "cable-crunch", name: "Cable Crunch", primaryMuscles: ["abs"], secondaryMuscles: [], equipment: "cable" },
  { id: "shrug-barbell", name: "Shrug (Barbell)", primaryMuscles: ["traps"], secondaryMuscles: [], equipment: "barbell" },
  { id: "kettlebell-swing", name: "Kettlebell Swing", primaryMuscles: ["glutes"], secondaryMuscles: ["hamstrings", "lower_back", "shoulders"], equipment: "kettlebell" },
];

export const SEED_EXERCISES: Exercise[] = SEED_ROWS.map(normalizeExercise);

export const SEED_EXERCISES_BY_ID: Record<string, Exercise> = Object.fromEntries(
  SEED_EXERCISES.map((e) => [e.id, e]),
);
