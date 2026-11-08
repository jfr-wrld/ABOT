"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { HydrationGate } from "@/components/ui/Loading";
import { Button } from "@/components/ui/Button";
import { ActiveWorkoutHeader } from "@/components/workout/ActiveWorkoutHeader";
import { RestTimerBar } from "@/components/workout/RestTimerBar";
import { ExerciseCard } from "@/components/workout/ExerciseCard";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { FinishDialog } from "@/components/workout/FinishDialog";
import { Sheet } from "@/components/ui/Sheet";
import { detectSessionPRs, previousSets } from "@/lib/calc";
import type { PRKind } from "@/types/workout";

export default function WorkoutPage() {
  return (
    <HydrationGate>
      <WorkoutScreen />
    </HydrationGate>
  );
}

function WorkoutScreen() {
  const router = useRouter();
  const active = useWorkoutStore((s) => s.active);
  const sessions = useWorkoutStore((s) => s.sessions);
  const { startEmpty, addExercise, finishActive, discardActive, completeAllRemaining } = useWorkoutStore();
  const { weightUnit, showRpe, defaultRestSeconds } = useSettingsStore();
  const { byId } = useAllExercises();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const prs = useMemo(() => (active ? detectSessionPRs(active, sessions, byId) : []), [active, sessions, byId]);
  const prBySet = useMemo(() => {
    const m: Record<string, PRKind[]> = {};
    for (const pr of prs) (m[pr.setId] ??= []).push(pr.kind);
    return m;
  }, [prs]);

  if (!active) {
    return (
      <main className="flex flex-1 flex-col px-4 pt-4">
        <h1 className="text-xl font-bold">Workout</h1>
        <div className="mt-10 flex flex-col items-center text-center">
          <p className="text-sm text-text-muted">
            No workout in progress. Start one and your sets, rest timer and PRs will be tracked here.
          </p>
          <Button variant="primary" onClick={() => startEmpty(defaultRestSeconds)} className="mt-5 w-full max-w-xs">
            Start an empty workout
          </Button>
        </div>
      </main>
    );
  }

  const inWorkout = new Set(active.exercises.map((e) => e.exerciseId));

  return (
    <main className="flex flex-1 flex-col">
      <ActiveWorkoutHeader session={active} unit={weightUnit} onFinish={() => setFinishOpen(true)} />
      <div className="mt-3">
        <RestTimerBar />
      </div>

      <h1 className="sr-only">Active workout: {active.name}</h1>

      <div className="flex flex-col gap-3 px-3 pt-3">
        {active.exercises.length === 0 && (
          <p className="rounded-card bg-surface px-4 py-6 text-center text-sm text-text-muted">
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
          />
        ))}

        <Button onClick={() => setPickerOpen(true)} className="w-full">
          <Plus aria-hidden="true" size={18} />
          Add exercise
        </Button>

        <Button variant="danger" onClick={() => setDiscardOpen(true)} className="mt-6 w-full">
          Discard workout
        </Button>
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
          finishActive();
          setFinishOpen(false);
          router.push("/");
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
