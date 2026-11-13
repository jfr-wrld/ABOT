"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useReminderStore } from "@/store/useReminderStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { weekdayName } from "@/components/plan/PlanSetup";
import { orderWeekdays } from "@/lib/training-plan";
import type { Weekday } from "@/lib/notifications/schedule";
import { useT } from "@/i18n";

const DAY = 86_400_000;

/**
 * The training week on Home: each planned day with its workout, today marked and done days
 * ticked, the session time, and Adjust (the same steps as at install). Reads the schedule, so a
 * day changed by hand in Settings shows here too. Without a week yet it offers to set one up.
 */
export function PlanCard({ now }: { now: number }) {
  const t = useT();
  const schedule = useReminderStore((s) => s.schedule);
  const routines = useRoutineStore((s) => s.routines);
  const sessions = useWorkoutStore((s) => s.sessions);
  const plan = useSettingsStore((s) => s.trainingPlan);
  const firstDay = useSettingsStore((s) => s.firstDayOfWeek);

  const days = useMemo(() => {
    const on = ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).filter((wd) => schedule.days[wd]?.on);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const weekStart = today.getTime() - ((today.getDay() - firstDay + 7) % 7) * DAY;
    return orderWeekdays(on, firstDay).map((wd) => {
      const start = weekStart + ((wd - firstDay + 7) % 7) * DAY;
      const routine = routines.find((r) => r.id === schedule.days[wd].routineId) ?? null;
      const done = sessions.some((s) => s.status === "completed" && s.startedAt >= start && s.startedAt < start + DAY);
      return { wd, routine, done, isToday: start === today.getTime(), past: start < today.getTime() };
    });
  }, [schedule, routines, sessions, now, firstDay]);

  if (!schedule.enabled || days.length === 0) {
    return (
      <section aria-labelledby="plan-card" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <div>
          <p className="label-caps">{t("Your week")}</p>
          <h2 id="plan-card" className="mt-1 text-lg font-bold tracking-tight">
            {t("Set up your training week")}
          </h2>
          <p className="mt-1 text-sm text-text-muted">{t("Pick your days and where you train. ABOT makes the workouts, fills My Routines and reminds you.")}</p>
        </div>
        <Link href="/plan" className="tap flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent text-base font-semibold text-on-accent">
          <CalendarDays aria-hidden="true" size={18} />
          {t("Set up my week")}
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="plan-card" className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="plan-card" className="label-caps">
            {t("Your week")}
          </h2>
          <p className="num mt-0.5 text-sm font-semibold">
            {t("{n} days at {time}", { n: days.length, time: schedule.time })}
          </p>
        </div>
        <Link
          href="/plan"
          className="tap -mr-1 -mt-1 flex min-h-11 items-center gap-1.5 rounded-ctl px-2 text-sm font-semibold text-accent hover:bg-accent/10"
          aria-label={plan ? t("Adjust your plan") : t("Set up your week")}
        >
          <SlidersHorizontal aria-hidden="true" size={15} />
          {t("Adjust")}
        </Link>
      </div>
      <ol className="flex flex-col">
        {days.map((d) => (
          <li
            key={d.wd}
            className={`flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm ${d.isToday ? "bg-accent-tint" : ""} ${d.past && !d.done ? "text-text-muted" : ""}`}
          >
            <span className={`w-10 shrink-0 font-bold ${d.isToday ? "text-text" : "text-text-muted"}`}>{weekdayName(t, d.wd, "short")}</span>
            <span className="min-w-0 flex-1 truncate">{d.routine?.name ?? t("Free session")}</span>
            {d.done ? (
              <Check aria-label={t("done")} size={16} strokeWidth={3} className="shrink-0 text-accent" />
            ) : d.isToday ? (
              <span className="label-caps shrink-0 !text-accent">{t("today")}</span>
            ) : null}
          </li>
        ))}
      </ol>
      <Link href="/routines" className="flex min-h-10 items-center justify-between rounded-lg px-2 text-xs font-semibold text-text-muted hover:text-text">
        {t("Edit the workouts in My Routines")}
        <ChevronRight aria-hidden="true" size={14} />
      </Link>
    </section>
  );
}
