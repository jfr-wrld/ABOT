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
import { AnimatePresence, motion } from "framer-motion";
import { LIST_ITEM } from "@/components/motion/listItem";
import { ExercisePicker } from "@/components/workout/ExercisePicker";
import { FinishDialog } from "@/components/workout/FinishDialog";
import { Sheet } from "@/components/ui/Sheet";
import { RoutineLibrary } from "@/components/routines/RoutineLibrary";
import { detectSessionPRs, previousSets } from "@/lib/calc";
import { supersetLabels } from "@/lib/superset";
import { scrollToExercise } from "@/lib/scroll-to-exercise";
import type { PRKind } from "@/types/workout";
import { summaryPath } from "@/lib/routes";
import { autoSyncFinished } from "@/store/useHealthSyncStore";
import { useT } from "@/i18n";

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
  const t = useT();
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
    if (activeId) router.prefetch(summaryPath(activeId));
  }, [activeId, router]);

  // Mid-superset there is no rest: bring the next exercise of the group up to the thumb.
  const handoffTo = useWorkoutStore((s) => (s.handoff ? `${s.handoff.sessionExerciseId}:${s.handoff.setIndex}` : null));
  useEffect(() => {
    if (!handoffTo) return;
    // After the tick's re-render, so the card is laid out where it will stay.
    const id = requestAnimationFrame(() => scrollToExercise(handoffTo.split(":")[0]!));
    return () => cancelAnimationFrame(id);
  }, [handoffTo]);

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

      <h1 className="sr-only">{t("Active workout: {name}", { name: active.name })}</h1>

      <div className="flex flex-col gap-3 px-3 pt-4">
        {active.exercises.length === 0 && (
          <p className="panel px-4 py-6 text-center text-sm text-text-muted">
            {t("This workout has no exercises yet. Add one below to start logging sets.")}
          </p>
        )}
        <AnimatePresence initial={false}>
        {active.exercises.map((item, i) => (
          // layout="position": moving an exercise up or down slides it; removing one closes the gap.
          <motion.div key={item.id} layout="position" {...LIST_ITEM} transition={{ ...LIST_ITEM.transition, layout: { type: "spring", stiffness: 500, damping: 40 } }}>
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
            joinedAbove={!!item.supersetId && active.exercises[i - 1]?.supersetId === item.supersetId}
            joinedBelow={!!item.supersetId && active.exercises[i + 1]?.supersetId === item.supersetId}
          />
          </motion.div>
        ))}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-card border border-ink/[0.12] bg-surface text-sm font-semibold text-text transition-colors duration-200 hover:border-ink/25 hover:bg-surface-2 active:bg-ink/[0.08]"
        >
          <Plus aria-hidden="true" size={18} className="text-accent" />
          {t("Add exercise")}
        </button>

        {/* Kept quiet on purpose: Finish is the one action this screen should pull the eye to. */}
        <button
          type="button"
          onClick={() => setDiscardOpen(true)}
          className="mx-auto mt-6 min-h-11 rounded-ctl px-4 text-xs font-medium text-failure transition-colors hover:bg-failure/10 hover:text-failure"
        >
          {t("Discard workout")}
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
          if (done) autoSyncFinished(done, byId);
          setFinishOpen(false);
          router.push(done ? summaryPath(done.id) : "/");
        }}
      />

      <Sheet
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title={t("Discard this workout?")}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setDiscardOpen(false)}>{t("Keep it")}</Button>
            <Button
              variant="danger"
              onClick={() => {
                discardActive();
                setDiscardOpen(false);
                router.push("/");
              }}
            >
              {t("Discard")}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          {t("Everything logged in this workout will be deleted. This cannot be undone.")}
        </p>
      </Sheet>
    </main>
  );
}
