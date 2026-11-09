"use client";

import { useMemo } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useBodyStore } from "@/store/useBodyStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { estimateCalories } from "@/lib/calorie-estimator";
import { dayKey } from "@/lib/bodyweight";
import { waterTargetMl } from "@/lib/nutrition-guide";
import {
  fuelTarget,
  mesocycleWeek,
  strengthShield,
  trainingKcalPerDay,
  trendRatePerWeek,
  trendWeight,
  type ActivePhaseConfig,
  type FuelTarget,
  type MesocycleWeek,
  type StrengthShield,
  type TrendPoint,
} from "@/lib/phase-engine";

export interface PhaseTelemetry {
  phase: ActivePhaseConfig;
  meso: MesocycleWeek;
  points: TrendPoint[];
  /** Latest trend weight, kg (falls back to the profile weight, then the phase's start). */
  trendKg: number;
  ratePerWeek: number | null;
  fuel: FuelTarget;
  trainingDay: boolean;
  shield: StrengthShield | null;
  waterMl: number;
}

/** Everything the phase card shows, worked out from the stores; null without an active phase. */
export function usePhaseTelemetry(now: number): PhaseTelemetry | null {
  const phase = useSettingsStore((s) => s.bodyPhase);
  const profileKg = useSettingsStore((s) => s.bodyweightKg);
  const entries = useBodyStore((s) => s.entries);
  const sessions = useWorkoutStore((s) => s.sessions);
  const active = useWorkoutStore((s) => s.active);
  const { byId } = useAllExercises();
  // Recomputed at most once a minute: the card does not need the second.
  const minute = Math.floor(now / 60_000);

  return useMemo(() => {
    if (!phase?.isActive) return null;
    const at = minute * 60_000;
    const points = trendWeight(entries);
    const trendKg = points.at(-1)?.emaKg ?? profileKg ?? phase.startWeightKg;
    const perDay = trainingKcalPerDay(sessions, at, (s) => estimateCalories(s, { bodyweightKg: trendKg, byId }).kcal);
    const today = dayKey(at);
    const trainingDay = active !== null || sessions.some((s) => s.status === "completed" && dayKey(s.startedAt) === today);
    return {
      phase,
      meso: mesocycleWeek(phase, at),
      points,
      trendKg,
      ratePerWeek: trendRatePerWeek(points, at),
      fuel: fuelTarget(phase, trendKg, perDay, trainingDay),
      trainingDay,
      shield: strengthShield(sessions, byId, points, at, phase),
      waterMl: waterTargetMl(trendKg),
    };
  }, [phase, entries, profileKg, sessions, active, byId, minute]);
}
