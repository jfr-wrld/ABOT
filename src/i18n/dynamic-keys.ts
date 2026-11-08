import { FAQ, LANGUAGE_LABEL, SECTION_TITLE, THEME_LABEL } from "@/components/settings/labels";

/**
 * English texts that reach t() through a variable (labels kept in constants and maps), so the
 * coverage test can see them too. Add each such constant's values here.
 */
export const DYNAMIC_KEYS: string[] = [
  // BottomNav TABS labels
  "Home",
  "Workout",
  "Exercises",
  "Profile",
  // MUSCLE_GROUP_LABELS ("Back" goes through "Back (muscle)", see muscleText in lib/home)
  "Chest", "Shoulders", "Biceps", "Triceps", "Forearms", "Abs", "Quads", "Hamstrings", "Glutes", "Calves",
  "Traps", "Lats", "Adductors", "Abductors", "Neck", "Lower Back", "Full Body", "Cardio",
  // EQUIPMENT_LABELS
  "Barbell", "Dumbbell", "Machine", "Smith Machine", "Cable", "Bodyweight", "Kettlebell", "Band", "Other",
  // SET_TYPE_META labels and SetTypeMenu hints
  "Warm-up", "Normal", "Drop set", "Failure",
  "Not counted in volume or records",
  "Counts toward volume and records",
  "Weight lowered right after the previous set",
  "Taken to the point you could not finish a rep",
  // PR kind labels: PR_KIND_LABEL (story-data), FinishDialog, SetRow, summary chips
  "Heaviest weight", "Best est. 1RM", "Best set volume", "Best estimated 1RM",
  "heaviest weight", "best estimated 1RM", "best set volume",
  "Weight", "e1RM", "Volume",
  // useWorkoutStore setStartedAt reasons, shown in the workout timer sheet
  "No workout in progress",
  "The start time cannot be in the future",
  "The start time must be before your first completed set",
  // Settings: SECTION_TITLE, THEME_LABEL, the "Phone" language option, FAQ, login back labels
  ...Object.values(SECTION_TITLE),
  ...Object.values(THEME_LABEL),
  LANGUAGE_LABEL.auto,
  ...FAQ.flatMap((f) => [f.q, f.a]),
  "Settings", "Back",
];
