"use client";

import { useRouter } from "next/navigation";
import { Play } from "@/components/icons";
import { MuscleMap } from "@/components/anatomy/MuscleMap";
import { LiftList } from "@/components/routines/RoutineCard";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { routineSummary } from "@/lib/routine-summary";
import { useT } from "@/i18n";
import type { Routine } from "@/types/workout";

export function TodaySheet({ open, onClose, routine, doneToday }: { open: boolean; onClose: () => void; routine: Routine | null; doneToday: boolean }) {
  const t = useT();
  const router = useRouter();
  const { byId } = useAllExercises();
  const active = useWorkoutStore((s) => s.active);
  const startFromRoutine = useWorkoutStore((s) => s.startFromRoutine);
  const sum = routine ? routineSummary(routine, byId) : null;
  const title = routine ? (doneToday ? t("Next: {name}", { name: routine.name }) : routine.name) : t("No workout planned");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        routine && (
          <Button
            variant="primary"
            className="min-h-12 w-full text-base"
            onClick={() => {
              onClose();
              if (!active) startFromRoutine(routine);
              router.push("/workout");
            }}
          >
            <Play aria-hidden="true" size={18} />
            {active ? t("Continue workout") : t("Start")}
          </Button>
        )
      }
    >
      {routine && sum ? (
        <div className="flex flex-col gap-3">
          {doneToday && <p className="text-sm font-semibold text-accent">{t("Today's workout is done.")}</p>}
          {sum.muscles.length > 0 && (
            <div className="mx-auto w-full max-w-[260px]">
              <MuscleMap primary={sum.muscles} width={260} />
            </div>
          )}
          <LiftList
            open
            items={sum.lines.map((l) => ({
              name: byId[l.exerciseId]?.name ?? t("Removed exercise"),
              detail: l.reps ? `${l.sets}×${l.reps}` : t("{n} sets", { n: l.sets }),
              superset: !!l.superset,
            }))}
          />
        </div>
      ) : (
        <p className="text-sm text-text-muted">{t("Set up your week to see today's workout here.")}</p>
      )}
    </Sheet>
  );
}
