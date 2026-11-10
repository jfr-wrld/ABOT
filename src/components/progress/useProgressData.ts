"use client";

import { useMemo } from "react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { useProgressRange } from "@/store/useProgressRange";
import { weekStreak, weeklyBuckets } from "@/lib/analytics";
import { percentChange, periodTotals, rangeStart } from "@/lib/progress";
import { useNow } from "@/lib/useNow";

/**
 * The numbers the Progress tab and its detail pages share, for the chosen range: weekly
 * buckets, totals against the range before, and the week streak. One place, so the summary and
 * the pages always agree.
 */
export function useProgressData() {
  const sessions = useWorkoutStore((s) => s.sessions);
  const { weightUnit, firstDayOfWeek } = useSettingsStore();
  const { byId } = useAllExercises();
  const weeks = useProgressRange((s) => s.weeks);
  const now = useNow(60_000);

  const completed = useMemo(() => sessions.filter((s) => s.status === "completed"), [sessions]);
  const from = rangeStart(weeks, now, firstDayOfWeek);
  const prevFrom = rangeStart(weeks * 2, now, firstDayOfWeek);
  const to = now + 1;
  const buckets = useMemo(() => weeklyBuckets(sessions, weeks, now, firstDayOfWeek, byId), [sessions, weeks, now, firstDayOfWeek, byId]);
  const totals = useMemo(() => periodTotals(sessions, from, to, byId), [sessions, from, to, byId]);
  const previous = useMemo(() => periodTotals(sessions, prevFrom, from, byId), [sessions, prevFrom, from, byId]);
  const change = {
    volume: percentChange(totals.volumeKg, previous.volumeKg),
    workouts: percentChange(totals.workouts, previous.workouts),
    time: percentChange(totals.durationSec, previous.durationSec),
    sets: percentChange(totals.sets, previous.sets),
  };
  const streak = weekStreak(sessions, now, firstDayOfWeek);

  return { sessions, completed, byId, unit: weightUnit, firstDay: firstDayOfWeek, now, weeks, from, to, buckets, totals, change, streak };
}
