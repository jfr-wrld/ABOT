"use client";

import Link from "next/link";
import { CalendarCheck, ChevronRight, Flag, Scale } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { dayKey } from "@/lib/bodyweight";
import { feedback } from "@/lib/feedback";
import { toDisplay } from "@/lib/units";
import { DEFAULT_SESSIONS, KCAL_ADJUST_MAX, NEXT_PHASE, PHASE_GOAL, PHASE_LABEL, sessionsThisWeek, weeklyCheckIn } from "@/lib/phase-engine";
import { useT } from "@/i18n";
import type { PhaseTelemetry } from "./usePhaseTelemetry";

/** "−0.4 kg" in the lifter's unit, signed. */
function useKg() {
  const unit = useSettingsStore((s) => s.weightUnit);
  return (kg: number) => {
    const v = Math.round(toDisplay(Math.abs(kg), unit) * 10) / 10;
    return `${kg > 0 ? "+" : kg < 0 ? "−" : "±"}${v} ${unit}`;
  };
}

/**
 * The weekly check-in: the trend against the plan, and one tap to move the target 150 kcal when
 * it is off. Answering (either way) hides it for a week.
 */
export function CheckInCard({ m, now }: { m: PhaseTelemetry; now: number }) {
  const t = useT();
  const kg = useKg();
  const update = useSettingsStore((s) => s.update);
  const c = weeklyCheckIn(m.phase, m.points, now);
  if (!c) return null;

  const answer = (adjust: number) => {
    feedback.tick();
    const total = Math.max(-KCAL_ADJUST_MAX, Math.min(KCAL_ADJUST_MAX, (m.phase.kcalAdjust ?? 0) + adjust));
    update({ bodyPhase: { ...m.phase, kcalAdjust: total, checkInDay: dayKey(now) } });
  };

  const text =
    c.kind === "need_weighins"
      ? t("Weigh in on 4 mornings across two weeks and ABOT can tell whether the plan is working.")
      : c.kind === "on_track"
        ? t("On track: {actual} a week, the plan is {plan}.", { actual: kg(c.actualPerWeekKg!), plan: kg(c.plannedPerWeekKg) })
        : c.kind === "too_slow"
          ? t("Slower than planned: {actual} a week against {plan}.", { actual: kg(c.actualPerWeekKg!), plan: kg(c.plannedPerWeekKg) })
          : c.kind === "too_fast"
            ? t("Faster than planned: {actual} a week against {plan}. Going this fast costs muscle.", { actual: kg(c.actualPerWeekKg!), plan: kg(c.plannedPerWeekKg) })
            : t("Your weight is moving {actual} a week; this phase holds it steady.", { actual: kg(c.actualPerWeekKg!) });

  return (
    <section aria-labelledby="checkin-heading" className="rounded-card border border-accent/40 bg-accent-tint p-4">
      <h2 id="checkin-heading" className="flex items-center gap-2 text-sm font-bold">
        <Scale aria-hidden="true" size={16} className="text-accent" />
        {t("Weekly check-in")}
      </h2>
      <p className="num mt-1 text-sm">{text}</p>
      {c.adjustKcal !== 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button onClick={() => answer(0)}>{t("Keep the plan")}</Button>
          <Button variant="primary" onClick={() => answer(c.adjustKcal)}>
            {c.adjustKcal < 0 ? t("Eat {n} kcal less", { n: Math.abs(c.adjustKcal) }) : t("Eat {n} kcal more", { n: c.adjustKcal })}
          </Button>
        </div>
      ) : c.kind !== "need_weighins" ? (
        <Button onClick={() => answer(0)} className="mt-3 w-full">
          {t("Got it")}
        </Button>
      ) : null}
    </section>
  );
}

/** This week's workouts against the plan, with the routines one tap away. */
export function WeekTraining({ m, now }: { m: PhaseTelemetry; now: number }) {
  const t = useT();
  const sessions = useWorkoutStore((s) => s.sessions);
  const firstDay = useSettingsStore((s) => s.firstDayOfWeek);
  const planned = m.phase.sessionsPerWeek ?? DEFAULT_SESSIONS[m.phase.phaseType];
  const done = sessionsThisWeek(sessions, now, firstDay);
  return (
    <Link href="/routines" className="flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface px-4 py-2 hover:bg-surface-2">
      <CalendarCheck aria-hidden="true" size={20} className={done >= planned ? "shrink-0 text-accent" : "shrink-0 text-text-muted"} />
      <span className="min-w-0 flex-1">
        <span className="label-caps block">{t("Training this week")}</span>
        <span className="num block text-sm font-semibold">{t("{done} of {planned} workouts", { done, planned })}</span>
      </span>
      <span aria-hidden="true" className="flex gap-1">
        {Array.from({ length: planned }, (_, i) => (
          <span key={i} className={`size-2.5 rounded-full ${i < done ? "bg-accent" : "bg-track"}`} />
        ))}
      </span>
      <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-text-muted" />
    </Link>
  );
}

/** When the block is over: what it did, what to do next, and a way to close it. */
export function PhaseSummary({ m }: { m: PhaseTelemetry }) {
  const t = useT();
  const kg = useKg();
  const update = useSettingsStore((s) => s.update);
  const p = m.phase;
  const change = m.trendKg - p.startWeightKg;
  const next = NEXT_PHASE[p.phaseType];
  const strength = m.shield?.changePct ?? null;
  return (
    <section aria-labelledby="summary-heading" className="rounded-card border border-accent/40 bg-surface p-4">
      <h2 id="summary-heading" className="flex items-center gap-2 text-sm font-bold">
        <Flag aria-hidden="true" size={16} className="text-accent" />
        {t("{weeks} weeks done", { weeks: p.durationWeeks })}
      </h2>
      <dl className="num mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="label-caps">{t("Weight")}</dt>
          <dd className="text-xl font-bold">{kg(change)}</dd>
        </div>
        {strength !== null && (
          <div>
            <dt className="label-caps">{t("Strength")}</dt>
            <dd className={`text-xl font-bold ${strength >= 0 ? "text-accent" : "text-failure"}`}>
              {strength >= 0 ? "+" : ""}
              {strength.toFixed(1)}%
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-sm text-text-muted">{t(next.why)}</p>
      <div className="mt-3 flex flex-col gap-2">
        {next.suggest.map((type) => (
          <Link
            key={type}
            href={`/phase/setup?next=${type}`}
            className="flex min-h-11 items-center gap-2 rounded-ctl border border-line-strong bg-surface-2 px-3 text-sm font-semibold hover:bg-press"
          >
            <span className="min-w-0 flex-1">
              {t(PHASE_GOAL[type])} <span className="text-xs font-normal text-text-muted">· {t(PHASE_LABEL[type])}</span>
            </span>
            <ChevronRight aria-hidden="true" size={16} className="text-text-muted" />
          </Link>
        ))}
        <Button variant="ghost" onClick={() => update({ bodyPhase: { ...p, isActive: false } })}>
          {t("End this phase")}
        </Button>
      </div>
    </section>
  );
}
