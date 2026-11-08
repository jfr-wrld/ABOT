"use client";

import type { WeightUnit, WorkoutSession } from "@/types/workout";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useNow } from "@/lib/useNow";
import { countSets, formatDuration, sessionDurationSec, sessionVolume } from "@/lib/calc";
import { formatVolume } from "@/lib/units";
import { Button } from "@/components/ui/Button";

export function ActiveWorkoutHeader({
  session,
  unit,
  onFinish,
}: {
  session: WorkoutSession;
  unit: WeightUnit;
  onFinish: () => void;
}) {
  const rename = useWorkoutStore((s) => s.renameActive);
  const now = useNow(1000);
  const duration = sessionDurationSec(session, now);
  const volume = sessionVolume(session);
  const { total, completed } = countSets(session);

  return (
    <header className="px-4 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="workout-name" className="sr-only">
            Workout name
          </label>
          <input
            id="workout-name"
            value={session.name}
            onChange={(e) => rename(e.target.value)}
            className="h-11 w-full rounded-ctl bg-transparent px-1 text-xl font-bold text-text hover:bg-surface focus:bg-surface"
          />
        </div>
        <Button variant="primary" onClick={onFinish} className="shrink-0">
          Finish
        </Button>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Duration" value={formatDuration(duration)} />
        <Stat label="Volume" value={formatVolume(volume, unit)} />
        <Stat label="Sets" value={`${completed} / ${total}`} />
      </dl>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-ctl bg-surface px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase text-text-muted">{label}</dt>
      <dd className="text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}
