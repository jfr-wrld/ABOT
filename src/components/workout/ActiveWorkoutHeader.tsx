"use client";

import { useState } from "react";
import type { WeightUnit, WorkoutSession } from "@/types/workout";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useNow } from "@/lib/useNow";
import { countSets, formatDuration, sessionDurationSec, sessionVolume } from "@/lib/calc";
import { formatVolume } from "@/lib/units";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

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
  const [startOpen, setStartOpen] = useState(false);

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
        <div className="rounded-ctl bg-surface px-3 py-2">
          <dt className="text-[11px] font-semibold uppercase text-text-muted">Duration</dt>
          <dd>
            <button
              type="button"
              onClick={() => setStartOpen(true)}
              aria-haspopup="dialog"
              aria-label={`Duration ${formatDuration(duration)}. Adjust start time`}
              className="-mx-1 rounded-ctl px-1 text-lg font-bold tabular-nums underline decoration-line-strong decoration-dotted underline-offset-4 hover:bg-surface-2"
            >
              {formatDuration(duration)}
            </button>
          </dd>
        </div>
        <Stat label="Volume" value={formatVolume(volume, unit)} />
        <Stat label="Sets" value={`${completed} / ${total}`} />
      </dl>
      {startOpen && <StartTimeSheet startedAt={session.startedAt} onClose={() => setStartOpen(false)} />}
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

function StartTimeSheet({ startedAt, onClose }: { startedAt: number; onClose: () => void }) {
  const setStartedAt = useWorkoutStore((s) => s.setStartedAt);
  const d = new Date(startedAt);
  const [value, setValue] = useState(
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  );
  const [error, setError] = useState<string | null>(null);

  function save() {
    const [h, m] = value.split(":").map(Number);
    if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) {
      setError("Enter a time like 07:30");
      return;
    }
    // Same calendar day as the original start; a workout rarely spans midnight.
    const next = new Date(startedAt);
    next.setHours(h, m, 0, 0);
    const r = setStartedAt(next.getTime());
    if (r.ok) onClose();
    else setError(r.reason);
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Adjust start time"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save start time
          </Button>
        </div>
      }
    >
      <label htmlFor="start-time" className="mb-1 block text-sm font-semibold">
        Started at
      </label>
      <input
        id="start-time"
        type="time"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "start-time-error" : "start-time-hint"}
        className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base [color-scheme:dark]"
      />
      {error ? (
        <p id="start-time-error" role="alert" className="mt-1 text-xs text-failure">
          {error}
        </p>
      ) : (
        <p id="start-time-hint" className="mt-1 text-xs text-text-muted">
          Use this if you started the timer late. Duration is counted from this time.
        </p>
      )}
    </Sheet>
  );
}
