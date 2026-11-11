import { FAQ, LANGUAGE_LABEL, SECTION_TITLE, THEME_LABEL } from "@/components/settings/labels";
import { SPLITS } from "@/lib/seed-routines";
import { PLATE_COLORS, PLATE_SETS } from "@/lib/plate-calculator";
import { KIND_LABEL, PHASE_PILL_LABEL, WHY } from "@/lib/progressive-overload";
import { ACTIVITY_LEVELS, PHASE_BLURB, PHASE_CALIBRATION, PHASE_LABEL, RISK_LABEL } from "@/lib/phase-engine";
import { CATEGORY_LABEL, DIGEST_LABEL, FOODS, LEVEL_LABEL, SOURCE_LABEL } from "@/lib/nutrition-guide";
import { COVER_PRESETS } from "@/lib/cover-presets";
import { AISLE_LABEL, DAY_TEMPLATES, RAW_LABELS, SLOT_LABEL } from "@/lib/meal-templates";
import { FILTER_LABEL } from "@/lib/exercise-swapper";
import { REDEEM_REASONS } from "@/lib/redeem-service";
import { PLANS, PRO_FEATURE_LABEL, PRO_MATRIX, SIMULATOR } from "@/lib/entitlements";
import { CHECKOUT_MESSAGE, PAYMENT_STATUS_MESSAGE } from "@/lib/checkout";
import { AXIS_LABEL, DIAGNOSTIC_KEYS } from "@/lib/symmetry-analyzer";
import { VARIATION_LABEL } from "@/data/variations";

/**
 * English texts that reach t() through a variable (labels kept in constants and maps), so the
 * coverage test can see them too. Add each such constant's values here.
 */
export const DYNAMIC_KEYS: string[] = [
  // HealthSyncCard STATUS_LINE and HealthSyncService reasons
  "Health Connect // Active", "Health Connect // Partial access", "Disconnected", "Health Connect not installed",
  "Health Connect needs an update", "Android app only",
  "Health Connect is only in the Android app", "Only finished workouts are synced",
  // RecoveryMap REGION_NAMES and STAGE_LABELS
  "Pectoralis major", "Deltoids", "Biceps brachii", "Triceps brachii", "Forearms", "Rectus abdominis", "Obliques",
  "Trapezius", "Lats and upper back", "Erector spinae", "Gluteus maximus", "Quadriceps", "Hamstrings", "Adductors",
  "Calves", "Tibialis anterior", "Neck",
  "Fresh", "Recovering", "High load", "Exhausted",
  // BottomNav TABS labels
  "Home",
  "Workout",
  "Exercises",
  "Profile",
  // MUSCLE_GROUP_LABELS ("Back" goes through "Back (muscle)", see muscleText in lib/home)
  "Chest", "Shoulders", "Biceps", "Triceps", "Forearms", "Abs", "Quads", "Hamstrings", "Glutes", "Calves",
  "Traps", "Lats", "Adductors", "Abductors", "Neck", "Lower Back", "Full Body", "Cardio",
  // training-focus BUCKET_LABEL / FocusLabel
  "Push", "Pull", "Legs", "Core", "Upper", "Lower", "Full body",
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
  // Nearby gyms (lib/nearby-gyms), shown with t()
  "The map service is busy. Try again in a minute.",
  "Could not reach the map service. Check your connection and try again.",
  // Workout photos (components/workout/WorkoutPhotos), shown with t()
  "This workout already has 6 photos. Delete one to add another.",
  "This phone has no room left for photos. Free up space and try again.",
  "This photo could not be used.",
  "The photo could not be deleted. Try again.",
  "Could not download the catalog. Check your connection and try again.",
  "The catalog file was not in the expected format.",
  // Plate calculator: bar presets and plate colour names
  ...PLATE_SETS.kg.bars.map((b) => b.label),
  "Gym bar",
  ...PLATE_COLORS.map((c) => c.name),
  // Phase 3 coaching: pill titles and reasons, swap filters, radar axes, grades, diagnostics
  ...Object.values(KIND_LABEL),
  ...Object.values(WHY),
  ...Object.values(FILTER_LABEL),
  ...Object.values(AXIS_LABEL),
  "OPTIMAL", "BALANCED", "IMBALANCED", "CRITICAL",
  DIAGNOSTIC_KEYS.pushPull, DIAGNOSTIC_KEYS.noPull, DIAGNOSTIC_KEYS.pullPush, DIAGNOSTIC_KEYS.quadHam, DIAGNOSTIC_KEYS.hamQuad, DIAGNOSTIC_KEYS.skipLegs,
  ...Object.values(DIAGNOSTIC_KEYS.low),
  // ABOT // BLACK PRO: feature names, plans, comparison rows, simulator, checkout answer, Pro tab
  ...Object.values(PRO_FEATURE_LABEL),
  ...PLANS.flatMap((p) => [p.name, p.note]),
  ...PRO_MATRIX.flatMap((r) => [r.feature, ...[r.core, r.pro].filter((v): v is string => typeof v === "string")]),
  ...SIMULATOR.map((s) => s.label),
  ...Object.values(CHECKOUT_MESSAGE),
  ...Object.values(PAYMENT_STATUS_MESSAGE),
  // ProCelebration PERKS
  "Auto-overload coach", "72h recovery inspector", "Hands-free voice logger", "Story presets, no watermark",
  // Body phases: names, blurbs, activity levels, calibration lines, coach labels, retention risk
  ...Object.values(PHASE_LABEL),
  ...Object.values(PHASE_BLURB),
  ...ACTIVITY_LEVELS.map((a) => a.label),
  ...Object.values(PHASE_CALIBRATION).flat(),
  ...Object.values(PHASE_PILL_LABEL),
  ...Object.values(RISK_LABEL),
  // Food guide: categories, levels, and every food's name, portion and note
  ...Object.values(CATEGORY_LABEL),
  ...Object.values(LEVEL_LABEL),
  ...Object.values(DIGEST_LABEL),
  ...FOODS.flatMap((f) => [f.name, f.servingVisual, f.tacticalNote, ...f.units.map((u) => u.label)]),
  ...Object.values(SOURCE_LABEL),
  // Profile cover designs (lib/cover-presets)
  ...COVER_PRESETS.map((p) => p.name),
  // Fuel: meal slots, day plans, shopping aisles and dry staples (lib/meal-templates), calculator nutrients
  ...Object.values(SLOT_LABEL),
  ...DAY_TEMPLATES.map((d) => d.name),
  ...Object.values(AISLE_LABEL),
  ...RAW_LABELS,
  "protein",
  "carbs",
  "fat",
  "calories",
  ...Object.values(REDEEM_REASONS),
  // Exercise variations (data/variations.ts)
  ...Object.values(VARIATION_LABEL),
  "Pro",
];
