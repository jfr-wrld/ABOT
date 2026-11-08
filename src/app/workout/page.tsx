"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRoutineStore } from "@/store/useRoutineStore";
import { Plus } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { HydrationGate } from "@/components/ui/Loading";
import { Button } from "@/components/ui/Button";
import { ActiveWorkoutHeader } from "@/components/workout/ActiveWorkoutHeader";
import { ExerciseCard } from "@/components/workout/ExerciseCard";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { FinishDialog } from "@/components/workout/FinishDialog";
import { Sheet } from "@/components/ui/Sheet";
import { RoutineLibrary } from "@/components/routines/RoutineLibrary";
import { detectSessionPRs, previousSets } from "@/lib/calc";
import { supersetLabels } from "@/lib/superset";
import type { PRKind } from "@/types/workout";

export default function WorkoutPage() {
  return (
    <HydrationGate>
      <WorkoutScreen />
    </HydrationGate>
  );
}

/**
 * /workout?start=<routine id | "empty">, the target of a reminder's Start button: starts that
 * routine (or an empty workout) unless one is already running, then cleans the address.
 */
function useStartFromLink() {
  const router = useRouter();
  const start = useSearchParams().get("start");
  useEffect(() => {
    if (!start) return;
    const w = useWorkoutStore.getState();
    if (!w.active) {
      const routine = useRoutineStore.getState().routines.find((r) => r.id === start);
      if (routine && routine.exercises.length > 0) w.startFromRoutine(routine);
      else w.startEmpty(useSettingsStore.getState().defaultRestSeconds);
    }
    router.replace("/workout");
  }, [start, router]);
}

function WorkoutScreen() {
  useStartFromLink();
  const router = useRouter();
  const active = useWorkoutStore((s) => s.active);
  const sessions = useWorkoutStore((s) => s.sessions);
  const { addExercise, finishActive, discardActive, completeAllRemaining } = useWorkoutStore();
  const { weightUnit, showRpe, defaultRestSeconds } = useSettingsStore();
  const { byId } = useAllExercises();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  // The summary route is fetched while the workout runs, so Finish still lands there with no signal.
  const activeId = active?.id;
  useEffect(() => {
    if (activeId) router.prefetch(`/workout/summary/${activeId}`);
  }, [activeId, router]);

  const prs = useMemo(() => (active ? detectSessionPRs(active, sessions, byId) : []), [active, sessions, byId]);
  const prBySet = useMemo(() => {
    const m: Record<string, PRKind[]> = {};
    for (const pr of prs) (m[pr.setId] ??= []).push(pr.kind);
    return m;
  }, [prs]);

  if (!active) return <RoutineLibrary />;

  const inWorkout = new Set(active.exercises.map((e) => e.exerciseId));
  const supersets = supersetLabels(active.exercises);

  return (
    <main className="flex flex-1 flex-col">
      <ActiveWorkoutHeader session={active} unit={weightUnit} onFinish={() => setFinishOpen(true)} />

      <h1 className="sr-only">Active workout: {active.name}</h1>

      <div className="flex flex-col gap-3 px-3 pt-4">
        {active.exercises.length === 0 && (
          <p className="panel px-4 py-6 text-center text-sm text-text-muted">
            This workout has no exercises yet. Add one below to start logging sets.
          </p>
        )}
        {active.exercises.map((item, i) => (
          <ExerciseCard
            key={item.id}
            item={item}
            exercise={byId[item.exerciseId]}
            previous={previousSets(item.exerciseId, sessions, active.id, { byId, locationId: active.locationId })}
            unit={weightUnit}
            showRpe={showRpe}
            prBySet={prBySet}
            canMoveUp={i > 0}
            canMoveDown={i < active.exercises.length - 1}
            superset={supersets[item.id]}
          />
        ))}

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-card border border-white/[0.12] bg-surface text-sm font-semibold text-text transition-colors duration-200 hover:border-white/25 hover:bg-surface-2 active:bg-white/[0.08]"
        >
          <Plus aria-hidden="true" size={18} className="text-accent" />
          Add exercise
        </button>

        {/* Kept quiet on purpose: Finish is the one action this screen should pull the eye to. */}
        <button
          type="button"
          onClick={() => setDiscardOpen(true)}
          className="mx-auto mt-6 min-h-11 rounded-ctl px-4 text-xs font-medium text-failure/80 transition-colors hover:bg-failure/10 hover:text-failure"
        >
          Discard workout
        </button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        inWorkout={inWorkout}
        onPick={(ex) => {
          addExercise(ex.id, defaultRestSeconds);
          setPickerOpen(false);
        }}
      />

      <FinishDialog
        open={finishOpen}
        session={active}
        prs={prs}
        exercisesById={byId}
        unit={weightUnit}
        onClose={() => setFinishOpen(false)}
        onMarkRemaining={() => completeAllRemaining()}
        onConfirm={() => {
          const done = finishActive();
          setFinishOpen(false);
          router.push(done ? `/workout/summary/${done.id}` : "/");
        }}
      />

      <Sheet
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard this workout?"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setDiscardOpen(false)}>Keep it</Button>
            <Button
              variant="danger"
              onClick={() => {
                discardActive();
                setDiscardOpen(false);
                router.push("/");
              }}
            >
              Discard
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          Everything logged in this workout will be deleted. This cannot be undone.
        </p>
      </Sheet>
    </main>
  );
}
