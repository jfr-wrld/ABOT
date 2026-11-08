"use client";

import type { Exercise, PersonalRecord, WeightUnit, WorkoutSession } from "@/types/workout";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { countSets, formatDuration, sessionDurationSec, sessionVolume } from "@/lib/calc";
import { formatVolume, formatWeight } from "@/lib/units";

const PR_LABEL = {
  heaviest_weight: "Heaviest weight",
  best_1rm: "Best estimated 1RM",
  best_set_volume: "Best set volume",
} as const;

export function FinishDialog({
  open,
  session,
  prs,
  exercisesById,
  unit,
  onConfirm,
  onClose,
  onMarkRemaining,
}: {
  open: boolean;
  session: WorkoutSession;
  prs: PersonalRecord[];
  exercisesById: Record<string, Exercise>;
  unit: WeightUnit;
  onConfirm: () => void;
  onClose: () => void;
  onMarkRemaining: () => void;
}) {
  const { total, completed } = countSets(session);
  const markable = session.exercises.reduce(
    (n, ex) => n + ex.sets.filter((s) => !s.completed && s.reps !== null && s.reps > 0).length,
    0,
  );
  const skipped = total - completed;
  const duration = sessionDurationSec(session);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Finish workout?"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onClose}>Keep going</Button>
          <Button variant="primary" onClick={onConfirm} disabled={completed === 0}>
            Finish workout
          </Button>
        </div>
      }
    >
      <dl className="grid grid-cols-3 gap-2">
        <Stat label="Duration" value={formatDuration(duration)} />
        <Stat label="Volume" value={formatVolume(sessionVolume(session, exercisesById), unit)} />
        <Stat label="Sets done" value={String(completed)} />
      </dl>

      {completed === 0 ? (
        <p className="mt-4 text-sm text-text-muted">
          No set has been marked done yet, so there is nothing to save. Tick at least one set, or discard the
          workout from the bottom of the page.
        </p>
      ) : skipped > 0 ? (
        <p className="mt-4 text-sm text-text-muted">
          {skipped} {skipped === 1 ? "set was" : "sets were"} not marked done and will not be saved.
        </p>
      ) : null}

      {markable > 0 && (
        <Button onClick={onMarkRemaining} className="mt-3 w-full">
          Mark {markable} remaining {markable === 1 ? "set" : "sets"} done
        </Button>
      )}

      {prs.length > 0 && (
        <section className="mt-4">
          <h3 className="text-sm font-semibold">
            {prs.length} personal {prs.length === 1 ? "record" : "records"}
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {prs.map((pr) => (
              <li key={`${pr.exerciseId}-${pr.kind}`} className="rounded-ctl bg-bg px-3 py-2 text-sm">
                <span className="font-semibold">{exercisesById[pr.exerciseId]?.name ?? pr.exerciseId}</span>
                <span className="block text-xs text-text-muted">
                  {PR_LABEL[pr.kind]}: {formatWeight(pr.weightKg, unit)} × {pr.reps}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-ctl bg-bg px-3 py-2">
      <dt className="label-caps">{label}</dt>
      <dd className="text-lg font-bold num">{value}</dd>
    </div>
  );
}
