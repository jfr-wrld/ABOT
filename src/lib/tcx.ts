import type { Exercise, WeightUnit, WorkoutSession } from "@/types/workout";
import { isWorkingSet, sessionDurationSec } from "./calc";
import { formatWeight } from "./units";

/**
 * A finished workout as a Training Center XML (.tcx) file, the format Strava, Garmin Connect,
 * TrainingPeaks and others import. Lifting has no route, so the file holds one lap with the
 * time, the estimated calories and two time points, and the sets go in the activity notes.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** "Bench Press (Barbell): 80 kg x 8, 80 kg x 8" per exercise, working sets only. */
export function workoutNotes(session: WorkoutSession, byId: Record<string, Exercise>, unit: WeightUnit): string {
  const lines = [session.name];
  for (const ex of session.exercises) {
    const sets = ex.sets.filter(isWorkingSet);
    if (sets.length === 0) continue;
    const name = byId[ex.exerciseId]?.name ?? ex.exerciseId;
    const parts = sets.map((s) => (s.weightKg ? `${formatWeight(s.weightKg, unit)} x ${s.reps}` : `${s.reps} reps`));
    lines.push(`${name}: ${parts.join(", ")}`);
  }
  if (session.notes) lines.push(session.notes);
  return lines.join("\n");
}

export function workoutToTcx(
  session: WorkoutSession,
  opts: { kcal: number; byId: Record<string, Exercise>; unit: WeightUnit },
): string {
  const start = new Date(session.startedAt).toISOString();
  const seconds = sessionDurationSec(session);
  const end = new Date(session.finishedAt ?? session.startedAt + seconds * 1000).toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Other">
      <Id>${start}</Id>
      <Lap StartTime="${start}">
        <TotalTimeSeconds>${seconds}</TotalTimeSeconds>
        <DistanceMeters>0</DistanceMeters>
        <Calories>${Math.max(0, Math.round(opts.kcal))}</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
          <Trackpoint><Time>${start}</Time></Trackpoint>
          <Trackpoint><Time>${end}</Time></Trackpoint>
        </Track>
      </Lap>
      <Notes>${esc(workoutNotes(session, opts.byId, opts.unit))}</Notes>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
`;
}

/** abot-2024-01-15-push-day.tcx */
export function tcxFileName(session: WorkoutSession): string {
  const d = new Date(session.startedAt);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const slug = session.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "workout";
  return `abot-${day}-${slug}.tcx`;
}
