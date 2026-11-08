import type { Exercise } from "@/types/workout";

/**
 * Built-in exercise library. Ids are stable slugs — never rename them,
 * because workout history references them.
 */
export const SEED_EXERCISES: Exercise[] = [
  // ---- Chest ----
  { id: "bench-press-barbell", name: "Bench Press (Barbell)", primaryMuscle: "chest", secondaryMuscles: ["triceps", "shoulders"], equipment: "barbell" },
  { id: "bench-press-dumbbell", name: "Bench Press (Dumbbell)", primaryMuscle: "chest", secondaryMuscles: ["triceps", "shoulders"], equipment: "dumbbell" },
  { id: "incline-bench-press-barbell", name: "Incline Bench Press (Barbell)", primaryMuscle: "chest", secondaryMuscles: ["shoulders", "triceps"], equipment: "barbell" },
  { id: "incline-bench-press-dumbbell", name: "Incline Bench Press (Dumbbell)", primaryMuscle: "chest", secondaryMuscles: ["shoulders", "triceps"], equipment: "dumbbell" },
  { id: "chest-press-machine", name: "Chest Press (Machine)", primaryMuscle: "chest", secondaryMuscles: ["triceps"], equipment: "machine" },
  { id: "cable-fly", name: "Cable Fly", primaryMuscle: "chest", secondaryMuscles: [], equipment: "cable" },
  { id: "push-up", name: "Push Up", primaryMuscle: "chest", secondaryMuscles: ["triceps", "shoulders"], equipment: "bodyweight", isBodyweight: true },
  { id: "chest-dip", name: "Chest Dip", primaryMuscle: "chest", secondaryMuscles: ["triceps"], equipment: "bodyweight", isBodyweight: true },

  // ---- Back ----
  { id: "deadlift-barbell", name: "Deadlift (Barbell)", primaryMuscle: "back", secondaryMuscles: ["hamstrings", "glutes", "lower_back"], equipment: "barbell" },
  { id: "pull-up", name: "Pull Up", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "bodyweight", isBodyweight: true },
  { id: "lat-pulldown-cable", name: "Lat Pulldown (Cable)", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "cable" },
  { id: "bent-over-row-barbell", name: "Bent Over Row (Barbell)", primaryMuscle: "back", secondaryMuscles: ["biceps", "lower_back"], equipment: "barbell" },
  { id: "seated-row-cable", name: "Seated Row (Cable)", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "cable" },
  { id: "one-arm-row-dumbbell", name: "One Arm Row (Dumbbell)", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "dumbbell" },
  { id: "t-bar-row", name: "T-Bar Row", primaryMuscle: "back", secondaryMuscles: ["biceps"], equipment: "machine" },

  // ---- Shoulders ----
  { id: "overhead-press-barbell", name: "Overhead Press (Barbell)", primaryMuscle: "shoulders", secondaryMuscles: ["triceps"], equipment: "barbell" },
  { id: "shoulder-press-dumbbell", name: "Shoulder Press (Dumbbell)", primaryMuscle: "shoulders", secondaryMuscles: ["triceps"], equipment: "dumbbell" },
  { id: "lateral-raise-dumbbell", name: "Lateral Raise (Dumbbell)", primaryMuscle: "shoulders", secondaryMuscles: [], equipment: "dumbbell" },
  { id: "face-pull-cable", name: "Face Pull (Cable)", primaryMuscle: "shoulders", secondaryMuscles: ["traps"], equipment: "cable" },
  { id: "rear-delt-fly-machine", name: "Rear Delt Fly (Machine)", primaryMuscle: "shoulders", secondaryMuscles: ["traps"], equipment: "machine" },

  // ---- Arms ----
  { id: "bicep-curl-barbell", name: "Bicep Curl (Barbell)", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], equipment: "barbell" },
  { id: "bicep-curl-dumbbell", name: "Bicep Curl (Dumbbell)", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], equipment: "dumbbell" },
  { id: "hammer-curl-dumbbell", name: "Hammer Curl (Dumbbell)", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], equipment: "dumbbell" },
  { id: "preacher-curl-machine", name: "Preacher Curl (Machine)", primaryMuscle: "biceps", secondaryMuscles: [], equipment: "machine" },
  { id: "triceps-pushdown-cable", name: "Triceps Pushdown (Cable)", primaryMuscle: "triceps", secondaryMuscles: [], equipment: "cable" },
  { id: "skullcrusher-barbell", name: "Skullcrusher (Barbell)", primaryMuscle: "triceps", secondaryMuscles: [], equipment: "barbell" },
  { id: "overhead-triceps-extension-dumbbell", name: "Overhead Triceps Extension (Dumbbell)", primaryMuscle: "triceps", secondaryMuscles: [], equipment: "dumbbell" },
  { id: "triceps-dip", name: "Triceps Dip", primaryMuscle: "triceps", secondaryMuscles: ["chest", "shoulders"], equipment: "bodyweight", isBodyweight: true },

  // ---- Legs ----
  { id: "squat-barbell", name: "Squat (Barbell)", primaryMuscle: "quads", secondaryMuscles: ["glutes", "hamstrings", "lower_back"], equipment: "barbell" },
  { id: "front-squat-barbell", name: "Front Squat (Barbell)", primaryMuscle: "quads", secondaryMuscles: ["glutes", "abs"], equipment: "barbell" },
  { id: "leg-press-machine", name: "Leg Press (Machine)", primaryMuscle: "quads", secondaryMuscles: ["glutes"], equipment: "machine" },
  { id: "leg-extension-machine", name: "Leg Extension (Machine)", primaryMuscle: "quads", secondaryMuscles: [], equipment: "machine" },
  { id: "bulgarian-split-squat", name: "Bulgarian Split Squat", primaryMuscle: "quads", secondaryMuscles: ["glutes"], equipment: "dumbbell" },
  { id: "romanian-deadlift-barbell", name: "Romanian Deadlift (Barbell)", primaryMuscle: "hamstrings", secondaryMuscles: ["glutes", "lower_back"], equipment: "barbell" },
  { id: "leg-curl-machine", name: "Leg Curl (Machine)", primaryMuscle: "hamstrings", secondaryMuscles: [], equipment: "machine" },
  { id: "hip-thrust-barbell", name: "Hip Thrust (Barbell)", primaryMuscle: "glutes", secondaryMuscles: ["hamstrings"], equipment: "barbell" },
  { id: "walking-lunge-dumbbell", name: "Walking Lunge (Dumbbell)", primaryMuscle: "glutes", secondaryMuscles: ["quads", "hamstrings"], equipment: "dumbbell" },
  { id: "standing-calf-raise-machine", name: "Standing Calf Raise (Machine)", primaryMuscle: "calves", secondaryMuscles: [], equipment: "machine" },
  { id: "seated-calf-raise-machine", name: "Seated Calf Raise (Machine)", primaryMuscle: "calves", secondaryMuscles: [], equipment: "machine" },

  // ---- Core / Traps / Other ----
  { id: "plank", name: "Plank", primaryMuscle: "abs", secondaryMuscles: ["lower_back"], equipment: "bodyweight", isBodyweight: true },
  { id: "hanging-leg-raise", name: "Hanging Leg Raise", primaryMuscle: "abs", secondaryMuscles: [], equipment: "bodyweight", isBodyweight: true },
  { id: "cable-crunch", name: "Cable Crunch", primaryMuscle: "abs", secondaryMuscles: [], equipment: "cable" },
  { id: "shrug-barbell", name: "Shrug (Barbell)", primaryMuscle: "traps", secondaryMuscles: [], equipment: "barbell" },
  { id: "kettlebell-swing", name: "Kettlebell Swing", primaryMuscle: "glutes", secondaryMuscles: ["hamstrings", "lower_back", "shoulders"], equipment: "kettlebell" },
];

export const SEED_EXERCISES_BY_ID: Record<string, Exercise> = Object.fromEntries(
  SEED_EXERCISES.map((e) => [e.id, e]),
);
