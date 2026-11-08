"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import type { WeightUnit, WorkoutSession } from "@/types/workout";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useNow } from "@/lib/useNow";
import { countSets, formatDuration, sessionDurationSec, sessionVolume } from "@/lib/calc";
import { formatVolume } from "@/lib/units";
import { motion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { Button, press } from "@/components/ui/Button";
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
  const { byId } = useAllExercises();
  const volume = sessionVolume(session, byId);
  const { total, completed } = countSets(session);
  const [startOpen, setStartOpen] = useState(false);
  const paused = session.pausedAt !== undefined;
  const locations = useLocationStore((s) => s.locations);
  const setLocation = useWorkoutStore((s) => s.setLocation);

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
            className="h-11 w-full rounded-ctl bg-transparent px-1 text-xl font-bold tracking-tight text-text hover:bg-surface focus:bg-surface"
          />
        </div>
        {/* The screen's single glow: Finish is the one action that ends the session. */}
        <motion.button
          type="button"
          onClick={onFinish}
          {...press}
          className="min-h-11 shrink-0 rounded-xl bg-accent px-5 text-sm font-extrabold text-on-accent shadow-volt transition-[filter] duration-150 hover:brightness-110"
        >
          Finish
        </motion.button>
      </div>

      {locations.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <label htmlFor="workout-gym" className="text-sm text-text-muted">
            Gym
          </label>
          <Select
            id="workout-gym"
            value={session.locationId ?? ""}
            onChange={(v) => setLocation(v || undefined)}
            options={[{ value: "", label: "No gym" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
            className="flex-1"
          />
        </div>
      )}

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/10 bg-surface px-3 py-2.5">
          <dt className="label-caps flex items-center gap-1.5">
            Duration
            {paused && <span className="rounded bg-accent px-1 text-[9px] font-bold text-on-accent">Paused</span>}
          </dt>
          <dd>
            <button
              type="button"
              onClick={() => setStartOpen(true)}
              aria-haspopup="dialog"
              aria-label={`Duration ${formatDuration(duration)}${paused ? ", paused" : ""}. Pause or adjust the timer`}
              className="num -mx-1 flex min-h-11 w-[calc(100%+8px)] items-center rounded-ctl px-1 text-xl font-bold tracking-tight text-text underline decoration-line-strong decoration-dotted underline-offset-4 hover:bg-surface-2"
            >
              {formatDuration(duration)}
            </button>
          </dd>
        </div>
        <Stat label="Volume" value={formatVolume(volume, unit)} />
        <Stat label="Sets" value={`${completed} / ${total}`} />
      </dl>
      {startOpen && <StartTimeSheet startedAt={session.startedAt} paused={paused} onClose={() => setStartOpen(false)} />}
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-surface px-3 py-2.5">
      <dt className="label-caps">{label}</dt>
      <dd className="num flex min-h-11 items-center truncate text-xl font-bold tracking-tight text-text">{value}</dd>
    </div>
  );
}

/** Tapping the duration: pause or resume the clock, or move the start time. */
function StartTimeSheet({ startedAt, paused, onClose }: { startedAt: number; paused: boolean; onClose: () => void }) {
  const setStartedAt = useWorkoutStore((s) => s.setStartedAt);
  const pause = useWorkoutStore((s) => s.pauseActive);
  const resume = useWorkoutStore((s) => s.resumeActive);
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
      title="Workout timer"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save start time
          </Button>
        </div>
      }
    >
      <Button
        variant={paused ? "primary" : "secondary"}
        onClick={() => {
          if (paused) resume();
          else pause();
          onClose();
        }}
        className="mb-1 w-full"
      >
        {paused ? <Play aria-hidden="true" size={16} /> : <Pause aria-hidden="true" size={16} />}
        {paused ? "Resume workout timer" : "Pause workout timer"}
      </Button>
      <p className="mb-4 text-xs text-text-muted">
        {paused
          ? "The clock is stopped. Ticking a set also resumes it."
          : "Stops the clock for a break. The rest timer is cleared; ticking a set resumes."}
      </p>
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
