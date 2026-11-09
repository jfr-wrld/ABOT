import { FAQ, LANGUAGE_LABEL, SECTION_TITLE, THEME_LABEL } from "@/components/settings/labels";
import { SPLITS } from "@/lib/seed-routines";
import { PLATE_COLORS, PLATE_SETS } from "@/lib/plate-calculator";

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
  // Exercise detail tabs, SmartExerciseMedia tabs, motion phases (PhaseLabel), Story Studio tabs
  "Summary", "History", "How to",
  "Motion", "Video", "Anatomy",
  "Concentric", "Eccentric", "Hold", "Carry", "Alternate",
  "Layout", "Photo",
  // SPLITS labels (template filter chips)
  ...SPLITS.map((s) => s.label),
  // WorkoutCalendar weekday heads
  "Mo", "Tu", "We", "Th", "Fr", "Sa", "Su",
  // STORY_PRESETS blurbs (layout tooltips in the Story Studio; copied, story-exporter needs a DOM)
  "Black plate, steel hairlines, one Volt point",
  "Muscle map lit by sets worked",
  "Every set itemised like a till slip",
  "Cockpit readout, massive figures",
  "Black and white editorial",
  "Records first, with top tonnage",
  "Your photo behind a glass card",
  "Stats above, progress line below",
  "Each lift a plate on the bar, sized by its volume",
  "A honeycomb of plates, one per lift",
  "Swiss poster in black on Volt",
  // Errors thrown by data/backup, lib/photo, story-exporter and data/catalog, shown with t()
  "This file is not valid JSON",
  "This is not an ABOT backup",
  "This backup was made by a newer version of ABOT",
  // Errors from lib/data-portability (CSV import)
  "This file is empty",
  "This CSV does not look like a workout export. It needs date, exercise name and weight or reps columns.",
  "No workouts were found in this file",
  "Pick a photo (JPEG, PNG or WebP).",
  "This photo could not be read. Try a JPEG or PNG.",
  "This browser cannot resize photos.",
  "This photo is too detailed to store. Try another one.",
  "This browser cannot draw photos.",
  "Could not download the catalog. Check your connection and try again.",
  "The catalog file was not in the expected format.",
  // Plate calculator: bar presets and plate colour names
  ...PLATE_SETS.kg.bars.map((b) => b.label),
  "Gym bar",
  ...PLATE_COLORS.map((c) => c.name),
];
