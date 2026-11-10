"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ListPlus, RefreshCw } from "lucide-react";
import type { WorkoutSession } from "@/types/workout";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { routineExercisesFrom } from "@/lib/session-routine";
import { hasChanges, routineChanges, updatedRoutineExercises } from "@/lib/routine-update";
import { routineEditPath } from "@/lib/routes";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/**
 * A workout started from a routine that went differently (heavier, more reps, a swapped or added
 * lift) offers to carry that into the routine, so the routine keeps up with the lifter. Planned
 * rep ranges stay. Hidden when the routine is gone or nothing changed.
 */
export function UpdateRoutineCard({ session, className = "" }: { session: WorkoutSession; className?: string }) {
  const t = useT();
  const routine = useRoutineStore((s) => s.routines.find((r) => r.id === session.routineId));
  const [updated, setUpdated] = useState(false);
  const changes = useMemo(() => (routine ? routineChanges(routine, session) : null), [routine, session]);
  if (!routine) return null;
  if (updated) {
    return (
      <Link
        href={routineEditPath(routine.id)}
        className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent-tint px-3 text-sm font-semibold text-text ${className}`}
      >
        <Check aria-hidden="true" size={16} className="text-accent" />
        {t("{name} updated · Open", { name: routine.name })}
      </Link>
    );
  }
  if (!changes || !hasChanges(changes)) return null;
  const parts = [
    changes.retargeted.length > 0 && t.n(changes.retargeted.length, "new targets for {n} lift", "new targets for {n} lifts"),
    changes.added.length > 0 && t.n(changes.added.length, "{n} lift added", "{n} lifts added"),
    changes.removed.length > 0 && t.n(changes.removed.length, "{n} lift dropped", "{n} lifts dropped"),
  ].filter(Boolean);
  return (
    <section aria-labelledby="update-routine" className={`panel flex flex-col gap-2 p-3 ${className}`}>
      <div>
        <h2 id="update-routine" className="text-sm font-semibold">
          {t("Update {name}?", { name: routine.name })}
        </h2>
        <p className="text-xs text-text-muted">{parts.join(" · ")}</p>
      </div>
      <Button
        onClick={() => {
          useRoutineStore.getState().setExercises(routine.id, updatedRoutineExercises(routine, session));
          feedback.tick();
          setUpdated(true);
        }}
        className="min-h-11"
      >
        <RefreshCw aria-hidden="true" size={16} />
        {t("Update routine")}
      </Button>
    </section>
  );
}

/**
 * Saves a finished workout to My Routines: same lifts, order and rest, with what was lifted as
 * the targets. Once saved, the button becomes a link to the new routine.
 */
export function SaveAsRoutineButton({ session, className = "" }: { session: WorkoutSession; className?: string }) {
  const t = useT();
  const [savedId, setSavedId] = useState<string | null>(null);
  const exists = useRoutineStore((s) => (savedId ? s.routines.some((r) => r.id === savedId) : false));

  if (savedId && exists) {
    return (
      <Link
        href={routineEditPath(savedId)}
        className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent-tint px-3 text-sm font-semibold text-text ${className}`}
      >
        <Check aria-hidden="true" size={16} className="text-accent" />
        {t("Saved to My Routines · Open")}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        const routines = useRoutineStore.getState();
        const r = routines.create(session.name);
        routines.setExercises(r.id, routineExercisesFrom(session));
        feedback.tick();
        setSavedId(r.id);
      }}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-ink/[0.12] bg-surface-2 px-3 text-sm font-semibold text-text hover:border-ink/25 ${className}`}
    >
      <ListPlus aria-hidden="true" size={16} />
      {t("Save as routine")}
    </button>
  );
}

/** A sheet to rename a finished workout. */
export function RenameWorkoutSheet({ session, open, onClose }: { session: WorkoutSession; open: boolean; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState(session.name);
  // Each opening starts from the current name.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setName(session.name), 0);
    return () => clearTimeout(id);
  }, [open, session.name]);
  const save = () => {
    useWorkoutStore.getState().renameSession(session.id, name);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t("Rename workout")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label htmlFor={`rename-${session.id}`} className="mb-1 block text-sm font-semibold">
          {t("Workout name")}
        </label>
        <input
          id={`rename-${session.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoComplete="off"
          className="h-12 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base"
        />
        <Button type="submit" variant="primary" disabled={!name.trim()} className="mt-3 w-full">
          {t("Save name")}
        </Button>
      </form>
    </Sheet>
  );
}
