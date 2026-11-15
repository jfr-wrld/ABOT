"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import { Check, DumbbellLarge, Play, Timer } from "@/components/icons";
import { MuscleMap } from "@/components/anatomy/MuscleMap";
import { LiftList } from "@/components/routines/RoutineCard";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useReminderStore } from "@/store/useReminderStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { nextProtocol } from "@/lib/home";
import { routineSummary } from "@/lib/routine-summary";
import { useNow } from "@/lib/useNow";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";
import type { Routine } from "@/types/workout";

const DAY = 86_400_000;
const startOfDay = (t: number) => new Date(new Date(t).setHours(0, 0, 0, 0)).getTime();

/**
 * What the centre of the dock is about: today's planned workout, or, once a workout is finished
 * today, the one after it. `doneToday` drives the "done" moment before the hand-over.
 */
function useToday() {
  const sessions = useWorkoutStore((s) => s.sessions);
  const routines = useRoutineStore((s) => s.routines);
  const schedule = useReminderStore((s) => s.schedule);
  const now = useNow(60_000);
  return useMemo(() => {
    const day = startOfDay(now);
    const doneToday = sessions.some((s) => s.status === "completed" && s.startedAt >= day && s.startedAt < day + DAY);
    const next = nextProtocol(routines, sessions, schedule, now);
    return { routine: next?.routine ?? null, doneToday, day };
  }, [sessions, routines, schedule, now]);
}

/** Shown once per day: the tick when today's workout is done, before the dumbbell comes back. */
const SEEN_KEY = "abot.today.doneSeen";
function doneSeen(day: number): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === String(day);
  } catch {
    return false;
  }
}
function markDoneSeen(day: number) {
  try {
    sessionStorage.setItem(SEEN_KEY, String(day));
  } catch {
    // Without storage the tick may show again on the next visit.
  }
}

/**
 * The dock's centre button (owner, 2026-11-15): an icon-only, raised green disc with a glassy
 * sheen and a dumbbell (a Play mark read as a music player). When today's workout is done, a
 * tick lands first, then the dumbbell slides back in for the next workout. A tap opens the day's workout in a sheet: its muscle map, the lifts
 * and Start. (A muscle map inside the disc was tried and read poorly at that size.)
 */
export function TodayButton() {
  const t = useT();
  const reduce = useReducedMotionConfig();
  const { routine, doneToday, day } = useToday();
  const router = useRouter();
  // While a workout runs the disc is about that workout (owner, 2026-11-15): a stopwatch in place
  // of the dumbbell, and a tap goes straight back to it rather than through the day's sheet.
  const live = useWorkoutStore((s) => (s.active ? s.active.name : null));
  const [open, setOpen] = useState(false);
  // "done" first when today's workout is finished and the tick has not played yet today.
  const [phase, setPhase] = useState<"plan" | "done">("plan");
  useEffect(() => {
    if (!doneToday || doneSeen(day)) return;
    const show = setTimeout(() => setPhase("done"), 0);
    const hand = setTimeout(() => {
      markDoneSeen(day);
      setPhase("plan");
    }, reduce ? 600 : 1800);
    return () => {
      clearTimeout(show);
      clearTimeout(hand);
    };
  }, [doneToday, day, reduce]);

  const label = live
    ? t("Continue workout: {name}", { name: live })
    : routine
    ? doneToday
      ? t("Done today. Next: {name}", { name: routine.name })
      : t("Today: {name}", { name: routine.name })
    : t("No workout planned");

  return (
    <>
      <button
        type="button"
        onClick={() => {
          feedback.tick();
          if (live) router.push("/workout");
          else setOpen(true);
        }}
        aria-label={label}
        aria-haspopup={live ? undefined : "dialog"}
        className={`today-fab ${live ? "today-fab-live" : ""} absolute left-1/2 top-0 z-10 flex size-[60px] -translate-x-1/2 -translate-y-[18px] items-center justify-center overflow-hidden rounded-full`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {live ? (
            <motion.span
              key="live"
              aria-hidden="true"
              className="flex items-center justify-center"
              initial={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0, rotate: -90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
            >
              <Timer size={30} variant="bold" />
            </motion.span>
          ) : phase === "done" ? (
            <motion.span
              key="done"
              aria-hidden="true"
              className="flex size-full items-center justify-center"
              initial={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0, rotate: -40 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={reduce ? { opacity: 0 } : { y: -24, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}
            >
              <Check size={30} variant="bold" />
            </motion.span>
          ) : (
            <motion.span
              key={routine?.id ?? "none"}
              aria-hidden="true"
              className="flex items-center justify-center"
              initial={reduce ? { opacity: 0 } : { y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { y: -24, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              <DumbbellLarge size={30} variant="bold" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <TodaySheet open={open} onClose={() => setOpen(false)} routine={routine} doneToday={doneToday} />
    </>
  );
}

function TodaySheet({ open, onClose, routine, doneToday }: { open: boolean; onClose: () => void; routine: Routine | null; doneToday: boolean }) {
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
