import {
  EQUIPMENT_LABELS,
  type Exercise,
  type GymLocation,
  type MuscleGroup,
  type PRKind,
  type SetType,
  type WeightUnit,
  type WorkoutSession,
} from "@/types/workout";
import { countSets, detectSessionPRs, exerciseHistory, muscleSplit, sessionDurationSec, sessionVolume, setVolume } from "@/lib/calc";

/** Everything a story card shows, taken from one finished workout. Weights stay in kg. */
export interface StorySet {
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  /** Tonnage of this set, both sides counted for per-hand and one-side loads. */
  volumeKg: number;
  isPR: boolean;
}

export interface StoryExercise {
  name: string;
  equipment: string;
  sets: StorySet[];
  volumeKg: number;
  /** Heaviest set, ties broken by reps; null when no set carried load. */
  best: StorySet | null;
}

export interface StoryPR {
  exerciseName: string;
  kind: PRKind;
  weightKg: number;
  reps: number;
  /** Estimated 1RM for best_1rm, set tonnage for best_set_volume, the load otherwise. */
  valueKg: number;
}

export interface StoryTrendPoint {
  date: number;
  e1rmKg: number;
}

export interface StoryData {
  sessionId: string;
  title: string;
  startedAt: number;
  durationSec: number;
  volumeKg: number;
  setsDone: number;
  unit: WeightUnit;
  locationName: string | null;
  barWeightKg: number | null;
  exercises: StoryExercise[];
  prs: StoryPR[];
  /** Working sets per muscle (secondary muscles count half), most worked first. */
  muscles: { muscle: MuscleGroup; sets: number }[];
  equipment: { label: string; count: number }[];
  /** Estimated 1RM of this workout's highest-volume lift, oldest first, up to this workout. */
  trend: { exerciseName: string; points: StoryTrendPoint[] } | null;
}

export const PR_KIND_LABEL: Record<PRKind, string> = {
  heaviest_weight: "Heaviest weight",
  best_1rm: "Best est. 1RM",
  best_set_volume: "Best set volume",
};

const TREND_POINTS = 12;

export function buildStoryData(
  session: WorkoutSession,
  sessions: WorkoutSession[],
  byId: Record<string, Exercise>,
  unit: WeightUnit,
  locations: GymLocation[] = [],
): StoryData {
  const prs = detectSessionPRs(session, sessions, byId);
  const prSetIds = new Set(prs.map((p) => p.setId));
  const nameOf = (exerciseId: string) => byId[exerciseId]?.name ?? "Removed exercise";

  const exercises: StoryExercise[] = session.exercises
    .map((ex) => {
      const def = byId[ex.exerciseId];
      const mode = def?.loadMode ?? "total";
      const sets: StorySet[] = ex.sets
        .filter((s) => s.completed)
        .map((s) => ({
          type: s.type,
          weightKg: s.weightKg,
          reps: s.reps,
          durationSec: s.durationSec ?? null,
          volumeKg: setVolume(s, mode),
          isPR: prSetIds.has(s.id),
        }));
      let best: StorySet | null = null;
      for (const s of sets) {
        if (s.weightKg === null || s.weightKg <= 0 || s.reps === null || s.reps <= 0) continue;
        if (!best || s.weightKg > (best.weightKg ?? 0) || (s.weightKg === best.weightKg && s.reps > (best.reps ?? 0)))
          best = s;
      }
      return {
        name: nameOf(ex.exerciseId),
        equipment: def ? EQUIPMENT_LABELS[def.equipment] : "Other",
        sets,
        volumeKg: sets.reduce((n, s) => n + s.volumeKg, 0),
        best,
      };
    })
    .filter((ex) => ex.sets.length > 0);

  const split = muscleSplit([{ ...session, status: "completed" }], byId);
  const muscles = (Object.entries(split) as [MuscleGroup, number][])
    .filter(([m, n]) => n > 0 && m !== "cardio")
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets);

  const equipmentCount = new Map<string, number>();
  for (const ex of exercises) equipmentCount.set(ex.equipment, (equipmentCount.get(ex.equipment) ?? 0) + 1);
  const equipment = [...equipmentCount.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // The trend follows the lift with the longest history, so the line has points to draw;
  // ties go to the lift that moved the most weight today.
  const upToHere = sessions.filter((s) => s.id !== session.id && s.startedAt < session.startedAt);
  const withThis = [...upToHere, { ...session, status: "completed" as const }];
  let trend: StoryData["trend"] = null;
  let bestScore: [number, number] = [0, 0];
  for (const ex of session.exercises) {
    const mode = byId[ex.exerciseId]?.loadMode ?? "total";
    const volume = ex.sets.reduce((n, s) => n + setVolume(s, mode), 0);
    if (volume <= 0) continue;
    const history = exerciseHistory(ex.exerciseId, withThis, { byId, allGyms: true });
    const score: [number, number] = [history.length, volume];
    if (score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1])) {
      bestScore = score;
      trend = {
        exerciseName: nameOf(ex.exerciseId),
        points: history.slice(-TREND_POINTS).map((p) => ({ date: p.date, e1rmKg: p.estimated1RM })),
      };
    }
  }

  const location = session.locationId ? locations.find((l) => l.id === session.locationId) : undefined;

  return {
    sessionId: session.id,
    title: session.name.trim() || "Workout",
    startedAt: session.startedAt,
    durationSec: sessionDurationSec(session),
    volumeKg: sessionVolume(session, byId),
    setsDone: countSets(session).completed,
    unit,
    locationName: location?.name ?? null,
    barWeightKg: location?.barWeightKg ?? null,
    exercises,
    prs: prs.map((p) => ({
      exerciseName: nameOf(p.exerciseId),
      kind: p.kind,
      weightKg: p.weightKg,
      reps: p.reps,
      valueKg: p.value,
    })),
    muscles,
    equipment,
    trend,
  };
}
