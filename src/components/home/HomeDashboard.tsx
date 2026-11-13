"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import { Activity, CalendarDays, Check, ChevronRight, Dumbbell, Flame, Layers, MapPin, Play, Plus, RotateCcw, Settings, SlidersHorizontal, Timer, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { useReminderStore } from "@/store/useReminderStore";
import { Button, PRESS_SPRING } from "@/components/ui/Button";
import { AbotWordmark } from "@/components/brand/AbotMark";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { CountFromZero, Rise, useEntrance } from "@/components/motion/Entrance";
import { RecoveryMap } from "@/components/anatomy/RecoveryMap";
import { PhaseCommandCard } from "@/components/phase/PhaseCommandCard";
import { GetAppBanner } from "@/components/get-app/GetAppBanner";
import { AnnouncementBanner } from "@/components/remote/AnnouncementBanner";
import { REGIONS } from "@/components/anatomy/regions";
import { Sheet } from "@/components/ui/Sheet";
import { regionTelemetry, sleepFactor } from "@/lib/muscle-recovery";
import { estimateCalories } from "@/lib/calorie-estimator";
import { useNow } from "@/lib/useNow";
import { countSets, formatDuration, sessionDurationSec, sessionVolume } from "@/lib/calc";
import { formatVolume, toDisplay } from "@/lib/units";
import {
  nextProtocol,
  routineMinutes,
  prCounts,
  relativeDay,
  weekStrip,
  weeklyFrequency,
  weeklyVolume,
  type NextProtocol,
} from "@/lib/home";
import type { Exercise, Routine, WorkoutSession } from "@/types/workout";
import type { Weekday } from "@/lib/notifications/schedule";
import { historyPath } from "@/lib/routes";
import { isoTime } from "@/lib/safe-date";
import { useT, type T } from "@/i18n";
import { MuscleIcon } from "@/components/icons/MuscleIcon";
import { routineFocus, trainingFocus } from "@/lib/training-focus";
import { weekStreak } from "@/lib/analytics";
import { asRoutine, comeback, dismissWelcomeBack, welcomeBackDismissed } from "@/lib/comeback";
import { currentStreak, type StreakMoment as StreakMomentData } from "@/lib/streak-moment";
import { StreakMoment } from "@/components/streak/StreakMoment";
import { ViewToggle, useViewMode } from "@/components/ui/ViewToggle";

/** A machined module: Carbon fill, hairline edge, tight padding. */
const TILE = "rounded-xl border border-line bg-surface p-3";
const SPRING = { type: "spring", stiffness: 300, damping: 26 } as const;

/**
 * Home as "today first": the week as one rail (trained days lit, planned days ringed, any day
 * tappable), the selected day as the one large card with its workout and Start, the week's
 * numbers on one row, then the body phase and the latest workouts. Every figure comes from
 * finished workouts on this device.
 */
export function HomeDashboard() {
  const t = useT();
  const sessions = useWorkoutStore((s) => s.sessions);
  const active = useWorkoutStore((s) => s.active);
  const routines = useRoutineStore((s) => s.routines);
  const schedule = useReminderStore((s) => s.schedule);
  const { weightUnit, firstDayOfWeek } = useSettingsStore();
  const { byId } = useAllExercises();
  // The running clock ticks inside ActiveCard; the rest of Home only needs the date.
  const now = useNow(60_000);

  const next = useMemo(() => nextProtocol(routines, sessions, schedule, now), [routines, sessions, schedule, now]);
  const days = useMemo(() => weekStrip(sessions, now, firstDayOfWeek), [sessions, now, firstDayOfWeek]);
  // The day the hero shows: today unless another day of this week was tapped.
  const [picked, setPicked] = useState<number | null>(null);
  const day = days.find((d) => d.start === picked) ?? days.find((d) => d.isToday) ?? days[0]!;

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pt-4">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1>
            <AbotWordmark />
          </h1>
          <Link
            href="/settings"
            aria-label={t("Settings")}
            className="-mr-2 flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface hover:text-text"
          >
            <Settings aria-hidden="true" size={22} />
          </Link>
        </div>
        <AnnouncementBanner />
        <WeekRail
          days={days}
          sessions={sessions}
          byId={byId}
          streak={weekStreak(sessions, now, firstDayOfWeek)}
          selected={day.start}
          onSelect={(start) => setPicked(days.find((d) => d.start === start)?.isToday ? null : start)}
        />
        <GetAppBanner />
      </header>

      {!active && <WelcomeBack now={now} />}

      <Rise step={0.07} order={1}>
        {active ? <ActiveCard /> : <DayHero day={day} next={next} byId={byId} now={now} />}
      </Rise>

      <Rise step={0.07} order={2}>
        <NumbersRow now={now} />
      </Rise>

      <Rise step={0.07} order={2}>
        <PhaseCommandCard now={now} />
      </Rise>

      <Rise step={0.07} order={3}>
        <RecentWorkouts unit={weightUnit} byId={byId} now={now} />
      </Rise>
    </main>
  );
}

/* ---------------------------------------------------------------- welcome back */

/**
 * After ten days or more without a workout: no count of missed days, no broken streak, just
 * the last workout ready to repeat. The Coach Pill starts that session lighter (comeback).
 */
function WelcomeBack({ now }: { now: number }) {
  const t = useT();
  const router = useRouter();
  const sessions = useWorkoutStore((s) => s.sessions);
  const back = useMemo(() => comeback(sessions, now), [sessions, now]);
  const [hidden, setHidden] = useState(false);
  if (!back || hidden || welcomeBackDismissed(back.last.id)) return null;
  const { last } = back;

  return (
    <section aria-labelledby="welcome-back" className={`${TILE} flex flex-col gap-3 p-4`}>
      <div>
        <p className="label-caps text-accent">{t("Welcome back")}</p>
        <h2 id="welcome-back" className="mt-1 text-lg font-bold tracking-tight">
          {t("Pick up where you left off")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t("Last time: {name}, {n} days ago. Today's Coach targets start about 10% lighter.", { name: last.name, n: back.days })}
        </p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Button
          variant="primary"
          onClick={() => {
            useWorkoutStore.getState().startFromRoutine(asRoutine(last));
            router.push("/workout");
          }}
          className="min-h-12 text-base"
        >
          <RotateCcw aria-hidden="true" size={18} />
          <span className="truncate">{t("Repeat {name}", { name: last.name })}</span>
        </Button>
        <Button
          onClick={() => {
            dismissWelcomeBack(last.id);
            setHidden(true);
          }}
          className="min-h-12 !bg-transparent"
        >
          {t("Not now")}
        </Button>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- week rail */

/** Long weekday name for Date#getDay numbering (7 Jan 2024 was a Sunday). */
const weekdayLong = (t: T, wd: number) => new Date(2024, 0, 7 + wd).toLocaleDateString(t.locale, { weekday: "long" });

/**
 * The week as seven tappable days, the strip and the plan in one: a trained day shows the muscle
 * that got the most sets with its focus (Push, Pull...), a planned day still to come a Volt ring
 * with the focus of its workout, the rest a dot. Tapping a day shows it in the hero. Above: the
 * month, the streak, and the plan (days and time) with Adjust.
 */
function WeekRail({
  days,
  sessions,
  byId,
  streak,
  selected,
  onSelect,
}: {
  days: ReturnType<typeof weekStrip>;
  sessions: WorkoutSession[];
  byId: Record<string, Exercise>;
  streak: number;
  selected: number;
  onSelect: (start: number) => void;
}) {
  const t = useT();
  const controls = useEntrance();
  const reduce = useReducedMotionConfig();
  const firstDay = useSettingsStore((st) => st.firstDayOfWeek);
  const schedule = useReminderStore((s) => s.schedule);
  const routines = useRoutineStore((s) => s.routines);
  const [replay, setReplay] = useState<StreakMomentData | null>(null);
  const planDays = schedule.enabled ? ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).filter((wd) => schedule.days[wd].on).length : 0;

  const cells = useMemo(
    () =>
      days.map((d) => {
        const wd = new Date(d.start).getDay() as Weekday;
        if (d.trained) {
          const f = trainingFocus(sessions.filter((s) => s.status === "completed" && s.startedAt >= d.start && s.startedAt < d.start + 86_400_000), byId);
          return { kind: "trained" as const, focus: f, label: f?.label ?? null };
        }
        const plan = schedule.enabled && schedule.days[wd].on && (d.isToday || d.isFuture);
        if (plan) {
          const r = routines.find((x) => x.id === schedule.days[wd].routineId);
          return { kind: "planned" as const, focus: null, label: r ? (routineFocus(r, byId)?.label ?? null) : null };
        }
        return { kind: "none" as const, focus: null, label: null };
      }),
    [days, sessions, byId, schedule, routines],
  );
  const month = new Date(days[0]!.start).toLocaleDateString(t.locale, { month: "long", year: "numeric" });

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="label-caps truncate">{month}</p>
        <div className="-my-2 -mr-2 flex shrink-0 items-center">
          {streak > 0 && (
            // The streak plays its flame again on a tap, the same screen as after Finish.
            <button
              type="button"
              onClick={() => setReplay(currentStreak(sessions, Date.now(), firstDay))}
              aria-haspopup="dialog"
              aria-label={t.n(streak, "{n}-week streak", "{n}-week streak")}
              className="tap num flex min-h-11 items-center gap-1 rounded-ctl px-2 text-xs font-bold text-accent hover:bg-accent/10"
            >
              <Flame aria-hidden="true" size={14} />
              <span aria-hidden="true">{t("{n} wk", { n: streak })}</span>
            </button>
          )}
          {planDays > 0 ? (
            <Link
              href="/plan"
              aria-label={t("Adjust your plan")}
              className="tap num flex min-h-11 items-center gap-1.5 rounded-ctl px-2 text-xs font-bold text-text-muted hover:bg-surface hover:text-text"
            >
              <span>{t("{n} days · {time}", { n: planDays, time: schedule.time })}</span>
              <SlidersHorizontal aria-hidden="true" size={14} className="text-accent" />
            </Link>
          ) : (
            <Link
              href="/plan"
              className="tap flex min-h-11 items-center gap-1 rounded-ctl px-2 text-xs font-bold text-accent hover:bg-accent/10"
            >
              <CalendarDays aria-hidden="true" size={14} />
              {t("Set up week")}
            </Link>
          )}
        </div>
      </div>
      {replay && <StreakMoment moment={replay} onClose={() => setReplay(null)} />}
      <ol aria-label={t("This week")} className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const date = new Date(d.start);
          const c = cells[i]!;
          const on = d.start === selected;
          const status =
            c.kind === "trained" ? t("trained") : d.isToday ? (c.kind === "planned" ? t("today, planned") : t("today")) : c.kind === "planned" ? t("planned") : d.isFuture ? "" : t("rest");
          return (
            <li key={d.start}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(d.start)}
                className={`tap flex w-full flex-col items-center gap-1 rounded-xl py-1.5 transition-colors ${on ? "bg-surface ring-1 ring-line" : "hover:bg-surface/60"}`}
              >
                <span aria-hidden="true" className={`label-caps ${d.isToday ? "!text-text" : ""}`}>
                  {date.toLocaleDateString(t.locale, { weekday: "narrow" })}
                </span>
                <span aria-hidden="true" className={`num text-xs font-bold leading-none ${d.isToday || on ? "text-text" : "text-text-muted"}`}>
                  {date.getDate()}
                </span>
                <span aria-hidden="true" className="relative flex size-10 items-center justify-center">
                  {c.kind === "trained" ? (
                    <motion.span
                      className={`flex size-full items-center justify-center rounded-lg border bg-accent-tint ${d.isToday ? "border-accent" : "border-accent/40"}`}
                      style={{ scale: 0.4, opacity: 0 }}
                      animate={controls}
                      variants={{
                        still: { scale: 1, opacity: 1 },
                        show: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 420, damping: 18, delay: 0.15 + i * 0.06 } },
                      }}
                    >
                      {c.focus ? <MuscleIcon muscle={c.focus.muscle} size={28} /> : <Check size={16} strokeWidth={3} className="text-accent" />}
                    </motion.span>
                  ) : c.kind === "planned" ? (
                    // A training day still to come: a ring where the muscle will light up.
                    <motion.span
                      className={`size-3.5 rounded-full border-2 ${d.isToday ? "border-accent" : "border-accent/60"}`}
                      animate={d.isToday && !reduce ? { scale: [1, 1.25, 1] } : undefined}
                      transition={{ duration: 2.4, repeat: 2, ease: "easeInOut" }}
                    />
                  ) : (
                    <span className={`size-1.5 rounded-full ${d.isToday ? "bg-text" : "bg-ink/20"}`} />
                  )}
                </span>
                <span aria-hidden="true" className={`h-3 max-w-full truncate px-0.5 text-[10px] font-semibold leading-3 ${c.kind === "planned" ? "text-text" : "text-text-muted"}`}>
                  {c.label ? t(c.label) : ""}
                </span>
                <span className="sr-only">
                  {date.toLocaleDateString(t.locale, { weekday: "long", day: "numeric" })}
                  {c.label && `, ${t(c.label)}`}
                  {status && `, ${status}`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ---------------------------------------------------------------- hero */

/** A routine as the faces of its lifts: up to five photos and a "+N". */
function ThumbRow({ exerciseIds, byId, size = 44 }: { exerciseIds: string[]; byId: Record<string, Exercise>; size?: number }) {
  const shown = exerciseIds.slice(0, 5);
  const more = exerciseIds.length - shown.length;
  return (
    <ul aria-hidden="true" className="flex gap-1.5">
      {shown.map((id, i) =>
        byId[id] ? (
          <li key={`${id}-${i}`}>
            <ExerciseThumb exercise={byId[id]} size={size} />
          </li>
        ) : null,
      )}
      {more > 0 && (
        <li
          className="num flex items-center justify-center rounded-xl bg-surface-2 text-xs text-text-muted"
          style={{ width: size, height: size }}
        >
          +{more}
        </li>
      )}
    </ul>
  );
}

/** "TODAY · 16:30", "TOMORROW", "SATURDAY": when the hero's workout is. */
function whenLabel(t: T, start: number, now: number, time: string | null): string {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((start - today.getTime()) / 86_400_000);
  const day = diff === 0 ? t("Today") : diff === 1 ? t("Tomorrow") : weekdayLong(t, new Date(start).getDay());
  return time ? `${day} · ${time}` : day;
}

/**
 * The selected day as the one large card. Today: the planned (or next) workout with Start; on a
 * rest day, the rest and the next workout, with Train anyway; once trained, what was done. Another
 * day of the week: its planned workout, which can be started now too, or what was done.
 */
function DayHero({ day, next, byId, now }: { day: ReturnType<typeof weekStrip>[number]; next: NextProtocol | null; byId: Record<string, Exercise>; now: number }) {
  const t = useT();
  const router = useRouter();
  const reduce = useReducedMotionConfig();
  const sessions = useWorkoutStore((s) => s.sessions);
  const routines = useRoutineStore((s) => s.routines);
  const schedule = useReminderStore((s) => s.schedule);
  const unit = useSettingsStore((s) => s.weightUnit);
  const defaultRest = useSettingsStore((s) => s.defaultRestSeconds);
  const { startEmpty, startFromRoutine } = useWorkoutStore.getState();

  const wd = new Date(day.start).getDay() as Weekday;
  const planned = schedule.enabled && schedule.days[wd].on;
  const plannedRoutine = planned ? (routines.find((r) => r.id === schedule.days[wd].routineId && r.exercises.length > 0) ?? null) : null;
  const hasPlan = schedule.enabled && ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).some((d) => schedule.days[d].on);
  const done = day.trained
    ? sessions.filter((s) => s.status === "completed" && s.startedAt >= day.start && s.startedAt < day.start + 86_400_000).sort((a, b) => b.startedAt - a.startedAt)
    : [];

  const empty = () => {
    startEmpty(defaultRest);
    // Straight to picking what to do: an empty workout has nothing else to show.
    router.push("/workout?add=1");
  };
  const start = (r: Routine) => {
    startFromRoutine(r);
    router.push("/workout");
  };
  const nextLine = next && next.why.kind !== "yours" && next.why.kind !== "after" ? t("Next: {name} · {day}", { name: next.routine.name, day: whenLabel(t, startOfNext(next, now), now, null) }) : null;

  let body: ReactNode;
  if (done.length > 0) {
    const s = done[0]!;
    const kg = done.reduce((n, x) => n + sessionVolume(x, byId), 0);
    body = (
      <>
        <div className="relative min-w-0">
          <p className="label-caps flex items-center gap-1.5">
            <Check aria-hidden="true" size={13} strokeWidth={3} className="text-accent" />
            {t("Done")} · {whenLabel(t, day.start, now, null)}
          </p>
          <h2 id="hero-heading" className="mt-1 truncate text-2xl font-bold tracking-tight">
            {s.name}
          </h2>
          <p className="num mt-1 flex items-center gap-3 text-sm text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Timer aria-hidden="true" size={14} />
              {formatDuration(sessionDurationSec(s))}
            </span>
            <span className="inline-flex items-center gap-1">
              <Dumbbell aria-hidden="true" size={14} />
              {formatVolume(toDisplay(kg, unit), unit)}
            </span>
          </p>
        </div>
        {day.isToday && next && (
          // Done for today, the next workout one tap away (another session, or tomorrow's early).
          <div className="relative flex items-center gap-3 rounded-lg border border-line px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-text-muted">
              {nextLine ?? t("Next: {name}", { name: next.routine.name })}
            </span>
            <Button onClick={() => start(next.routine)} aria-label={t("Start {name}", { name: next.routine.name })} className="min-h-11 shrink-0 !px-3 text-sm">
              <Play aria-hidden="true" size={15} />
              {t("Start")}
            </Button>
          </div>
        )}
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Link href={historyPath(s.id)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-ink/[0.12] text-base font-semibold hover:border-ink/25">
            {t("See summary")}
            <ChevronRight aria-hidden="true" size={18} />
          </Link>
          <Button onClick={empty} aria-label={t("Start an empty workout")} className="size-12 !bg-transparent !px-0">
            <Plus aria-hidden="true" size={20} />
          </Button>
        </div>
      </>
    );
  } else {
    // The workout this card offers: the day's planned one, or (today, without one) the next.
    const routine = plannedRoutine ?? (day.isToday && !(hasPlan && !planned) ? (next?.routine ?? null) : null);
    const rest = !routine && (hasPlan || !day.isToday);
    if (routine) {
      const label = plannedRoutine
        ? whenLabel(t, day.start, now, schedule.time)
        : next && (next.why.kind === "tomorrow" || next.why.kind === "weekday")
          ? whenLabel(t, startOfNext(next, now), now, null)
          : t("Next up");
      body = (
        <>
          <div className="relative min-w-0">
            <p className="label-caps">{label}</p>
            <h2 id="hero-heading" className="mt-1 truncate text-2xl font-bold tracking-tight">
              {routine.name}
            </h2>
            <p className="num mt-1 flex items-center gap-3 text-sm text-text-muted">
              <span className="inline-flex items-center gap-1">
                <Timer aria-hidden="true" size={14} />
                {t("{n} min", { n: routineMinutes(routine) })}
              </span>
              <span className="inline-flex items-center gap-1">
                <Layers aria-hidden="true" size={14} />
                {t.n(routine.exercises.length, "{n} exercise", "{n} exercises")}
              </span>
            </p>
          </div>
          <div className="relative">
            <ThumbRow exerciseIds={routine.exercises.map((e) => e.exerciseId)} byId={byId} />
          </div>
          <div className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Button variant="primary" onClick={() => start(routine)} aria-label={t("Start {name}", { name: routine.name })} className="min-h-12 text-base">
              <Play aria-hidden="true" size={18} />
              {t("Start")}
            </Button>
            <Button onClick={empty} aria-label={t("Start an empty workout")} className="size-12 !bg-transparent !px-0">
              <Plus aria-hidden="true" size={20} />
            </Button>
          </div>
        </>
      );
    } else if (rest) {
      // Today with a plan and nothing planned, or another day with nothing planned.
      const upcoming = day.isToday && next ? next.routine : null;
      body = (
        <>
          <div className="relative min-w-0">
            <p className="label-caps">{whenLabel(t, day.start, now, null)}</p>
            <h2 id="hero-heading" className="mt-1 text-2xl font-bold tracking-tight">
              {t("Rest day")}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {day.isToday ? (nextLine ?? t("Recovery is where the muscle grows.")) : day.isFuture ? t("Nothing planned for this day.") : t("No workout this day.")}
            </p>
          </div>
          {upcoming && (
            <div className="relative">
              <ThumbRow exerciseIds={upcoming.exercises.map((e) => e.exerciseId)} byId={byId} size={36} />
            </div>
          )}
          <div className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            {upcoming ? (
              <Button onClick={() => start(upcoming)} aria-label={t("Train anyway: {name}", { name: upcoming.name })} className="min-h-12 text-base">
                <Play aria-hidden="true" size={18} />
                {t("Train anyway")}
              </Button>
            ) : (
              <Button onClick={empty} className="min-h-12 text-base">
                <Play aria-hidden="true" size={18} />
                {t("Start an empty workout")}
              </Button>
            )}
            <Link
              href="/plan"
              aria-label={t("Adjust your plan")}
              className="flex size-12 items-center justify-center rounded-xl border border-ink/[0.12] transition-colors hover:border-ink/25"
            >
              <SlidersHorizontal aria-hidden="true" size={18} />
            </Link>
          </div>
        </>
      );
    } else {
      body = (
        <>
          <div className="relative">
            <p className="label-caps">{t("Next up")}</p>
            <h2 id="hero-heading" className="mt-1 text-2xl font-bold tracking-tight">
              {t("Free session")}
            </h2>
            <p className="mt-1 text-sm text-text-muted">{t("Or set up your week: ABOT makes the workouts and reminds you.")}</p>
          </div>
          <div className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Button variant="primary" onClick={empty} className="min-h-12 text-base">
              <Play aria-hidden="true" size={18} />
              {t("Start an empty workout")}
            </Button>
            <Link
              href="/workout"
              aria-label={t("Create a routine")}
              className="flex size-12 items-center justify-center rounded-xl border border-ink/[0.12] transition-colors hover:border-ink/25"
            >
              <Plus aria-hidden="true" size={20} />
            </Link>
          </div>
          <Link href="/plan" className="relative -mb-1 flex min-h-11 items-center justify-center gap-1.5 text-sm font-semibold text-accent">
            <CalendarDays aria-hidden="true" size={16} />
            {t("Set up your week")}
          </Link>
        </>
      );
    }
  }

  return (
    <section aria-labelledby="hero-heading" className={`${TILE} relative overflow-hidden p-4`}>
      <HeroPlate />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={day.start}
          className="flex flex-col gap-3"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
        >
          {body}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

/** The start of the day the next workout is on. */
function startOfNext(next: NextProtocol, now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (next.why.kind === "today") return d.getTime();
  if (next.why.kind === "tomorrow") return d.getTime() + 86_400_000;
  if (next.why.kind === "weekday") {
    const ahead = (next.why.weekday - d.getDay() + 7) % 7 || 7;
    return d.getTime() + ahead * 86_400_000;
  }
  return d.getTime();
}

/**
 * A large plate outline behind the hero: the brand mark as hardware. It settles in with a short
 * turn, then rests; a plate turning for good kept Home redrawing and cost battery.
 */
function HeroPlate() {
  const reduce = useReducedMotionConfig();
  return (
    <motion.svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className="pointer-events-none absolute -right-12 -top-12 size-48 text-accent/[0.16]"
      initial={reduce ? undefined : { rotate: -30 }}
      animate={{ rotate: 0 }}
      transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
      fill="none"
      stroke="currentColor"
      strokeWidth={0.8}
    >
      <path d="M27 8 L73 8 L96 50 L73 92 L27 92 L4 50 Z" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="31" />
      <circle cx="50" cy="50" r="22" />
    </motion.svg>
  );
}

function ActiveCard() {
  const t = useT();
  const now = useNow(1000);
  const active = useWorkoutStore((s) => s.active)!;
  const { byId } = useAllExercises();
  const done = countSets(active).completed;
  return (
    <Link
      href="/workout"
      className="block rounded-xl border border-accent/40 bg-accent-tint p-4 transition-colors hover:border-accent/70"
    >
      <span className="label-caps flex items-center gap-1.5 !text-accent">
        <motion.span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-accent"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.2, repeat: 3 }}
        />
        {t("Workout in progress")}
      </span>
      <span className="mt-1 block truncate text-2xl font-bold tracking-tight">{active.name}</span>
      <span className="mt-2 block">
        <ThumbRow exerciseIds={active.exercises.map((e) => e.exerciseId)} byId={byId} size={36} />
      </span>
      <span className="num mt-2 flex items-center gap-3 text-sm text-text-muted">
        <span className="inline-flex items-center gap-1">
          <Timer aria-hidden="true" size={14} />
          {formatDuration(sessionDurationSec(active, now))}
        </span>
        <span className="inline-flex items-center gap-1">
          <Layers aria-hidden="true" size={14} />
          {t.n(done, "{n} set done", "{n} sets done")}
        </span>
      </span>
      <span className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent text-base font-bold text-on-accent">
        <Play aria-hidden="true" size={18} />
        {t("Continue workout")}
      </span>
    </Link>
  );
}

/* ---------------------------------------------------------------- numbers */

/** Volume short enough for a third of the row: 12,400, then 124k. */
const shortVolume = (n: number, locale: string) => (n >= 100_000 ? `${Math.round(n / 1000).toLocaleString(locale)}k` : Math.round(n).toLocaleString(locale));

/**
 * The week in three figures on one row: sessions against the plan (or the 7 days), the volume
 * with its change on last week, and muscles ready, which opens the recovery map.
 */
function NumbersRow({ now }: { now: number }) {
  const t = useT();
  const controls = useEntrance();
  const sessions = useWorkoutStore((s) => s.sessions);
  const schedule = useReminderStore((s) => s.schedule);
  const { weightUnit: unit, firstDayOfWeek } = useSettingsStore();
  const { byId } = useAllExercises();
  const active = useWorkoutStore((s) => s.active);
  const sleep = useSettingsStore((s) => s.lastSleep);
  const [open, setOpen] = useState(false);

  const volume = useMemo(() => weeklyVolume(sessions, now, firstDayOfWeek, byId), [sessions, now, firstDayOfWeek, byId]);
  const freq = weeklyFrequency(sessions, schedule, now, firstDayOfWeek);
  // Sets ticked in a workout still running tire the muscles too.
  const recovery = useMemo(() => regionTelemetry(active ? [...sessions, active] : sessions, byId, now, sleep), [sessions, active, byId, now, sleep]);
  const ready = REGIONS.filter((r) => recovery[r].stage === "fresh").length;
  const speed = sleepFactor(sleep, now);
  const target = freq.target ?? 7;
  const perWeek = freq.target !== null;
  const fraction = Math.min(1, freq.done / Math.max(1, target));
  const change = volume.changePct;

  return (
    <section aria-label={t("This week")} className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface">
      <div className="flex min-w-0 items-center gap-2 p-3">
        <svg viewBox="0 0 36 36" className="hidden size-9 shrink-0 -rotate-90 min-[380px]:block" aria-hidden="true">
          <circle cx="18" cy="18" r="14" fill="none" stroke="var(--color-track)" strokeWidth="4" />
          <motion.circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="4"
            strokeLinecap="round"
            style={{ pathLength: 0, opacity: fraction > 0 ? 1 : 0 }}
            animate={controls}
            variants={{
              still: { pathLength: fraction },
              show: { pathLength: fraction, transition: { duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] } },
            }}
          />
        </svg>
        <div className="min-w-0">
          <p aria-hidden="true" className="num text-lg font-bold leading-tight tabular-nums">
            {freq.done}
            <span className="text-xs font-semibold text-text-muted">/{target}</span>
          </p>
          <p aria-hidden="true" className="label-caps truncate">
            {perWeek ? t("Planned") : t("Days")}
          </p>
          <span className="sr-only">
            {perWeek ? t("{done} of {target} planned sessions this week", { done: freq.done, target }) : t("{done} of {target} days this week", { done: freq.done, target })}
          </span>
        </div>
      </div>

      <div className="min-w-0 p-3">
        <p className="num flex items-baseline gap-0.5 text-lg font-bold leading-tight tabular-nums">
          <CountFromZero delay={0.2} value={Math.round(toDisplay(volume.kg, unit))} format={(n) => shortVolume(n, t.locale)} />
          <span className="text-[11px] font-semibold text-text-muted">{unit}</span>
        </p>
        <p className="label-caps flex items-center gap-1 truncate">
          {t("Volume")}
          {change !== null && (
            <span className={`num inline-flex items-center gap-0.5 normal-case ${change >= 0 ? "!text-text" : ""}`}>
              {change >= 0 ? <TrendingUp aria-hidden="true" size={11} className="text-accent" /> : <TrendingDown aria-hidden="true" size={11} />}
              {change > 0 ? "+" : ""}
              {change}%<span className="sr-only"> {t("against last week")}</span>
            </span>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t("Muscle recovery: {ready} of {total} muscles ready. Open the map.", { ready, total: REGIONS.length })}
        className="flex min-w-0 items-center gap-2 rounded-r-xl p-3 text-left transition-colors hover:bg-ink/[0.03]"
      >
        <span aria-hidden="true" className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent min-[380px]:flex">
          <Activity size={16} />
        </span>
        <span aria-hidden="true" className="min-w-0">
          <span className="num block text-lg font-bold leading-tight tabular-nums">
            {ready}
            <span className="text-xs font-semibold text-text-muted">/{REGIONS.length}</span>
          </span>
          <span className="label-caps block truncate">{t("ready")}</span>
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t("Muscle recovery")}>
        <RecoveryMap data={recovery} now={now} />
        {speed !== 1 && sleep && (
          <p className="mt-3 text-xs font-semibold tabular-nums">
            {speed < 1
              ? t("Last night's sleep ({h}h {m}m) slows recovery to {pct}% of the usual rate.", { h: Math.floor(sleep.minutes / 60), m: sleep.minutes % 60, pct: Math.round(speed * 100) })
              : t("Last night's sleep ({h}h {m}m) speeds recovery to {pct}% of the usual rate.", { h: Math.floor(sleep.minutes / 60), m: sleep.minutes % 60, pct: Math.round(speed * 100) })}
          </p>
        )}
        <p className="mt-3 text-xs text-text-muted">
          {t(
            "Each working set adds fatigue: 15% to the main muscles, 7.5% to the helpers, more at a high RPE. It fades by itself: big muscles are fresh again in 72 hours, small ones in 48.",
          )}
        </p>
      </Sheet>
    </section>
  );
}

/* ---------------------------------------------------------------- recent */

function RecentWorkouts({ unit, byId, now }: { unit: "kg" | "lbs"; byId: Record<string, Exercise>; now: number }) {
  const t = useT();
  const sessions = useWorkoutStore((s) => s.sessions);
  const recent = useMemo(() => [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 3), [sessions]);
  const prs = useMemo(() => prCounts(recent, sessions, byId), [recent, sessions, byId]);

  const [view, setView] = useViewMode("recent");

  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-heading" className="label-caps">
          {t("Recent workouts")}
        </h2>
        {recent.length > 0 && (
          <div className="flex items-center gap-1">
            <Link
              href="/history/all"
              className="flex min-h-11 items-center gap-0.5 rounded-ctl px-2 text-xs font-semibold text-text-muted hover:bg-surface hover:text-text"
            >
              {t("See all")}
              <ChevronRight aria-hidden="true" size={14} />
            </Link>
            <ViewToggle value={view} onChange={setView} />
          </div>
        )}
      </div>
      {recent.length === 0 ? (
        <div className={`${TILE} flex flex-col items-center gap-2 py-6 text-center`}>
          <Dumbbell aria-hidden="true" size={22} className="text-text-muted" />
          <p className="text-sm text-text-muted">{t("No workouts yet.")}</p>
        </div>
      ) : (
        <ul className={view === "grid" ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "flex flex-col gap-2"}>
          {recent.map((s, i) => (
            <RecentCard key={s.id} session={s} pr={prs[s.id] ?? 0} unit={unit} byId={byId} now={now} order={i} grid={view === "grid"} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function RecentCard({
  session: s,
  pr,
  unit,
  byId,
  now,
  order,
  grid,
}: {
  session: WorkoutSession;
  pr: number;
  unit: "kg" | "lbs";
  byId: Record<string, Exercise>;
  now: number;
  order: number;
  grid: boolean;
}) {
  const t = useT();
  const controls = useEntrance();
  const bodyweightKg = useSettingsStore((st) => st.bodyweightKg);
  const gym = useLocationStore((st) => st.locations.find((l) => l.id === s.locationId)?.name);
  const { completed } = countSets(s);
  const est = estimateCalories(s, { bodyweightKg, byId });
  // Under a minute (a test tap, a mistake) the figure means nothing.
  const kcal = est.minutes >= 1 ? est.kcal : 0;
  const stats = (
    <p className="num flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-400">
      {gym && (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1 font-sans">
          <MapPin aria-hidden="true" size={12} className="shrink-0" />
          <span className="sr-only">{t("Gym")}: </span>
          <span className="truncate">{gym}</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Timer aria-hidden="true" size={12} />
        {formatDuration(sessionDurationSec(s))}
      </span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Dumbbell aria-hidden="true" size={12} />
        {formatVolume(sessionVolume(s, byId), unit)}
      </span>
      {kcal > 0 && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <Flame aria-hidden="true" size={12} />
          {kcal} kcal
          <span className="sr-only"> {t("estimated")}</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Layers aria-hidden="true" size={12} />
        {completed}
        <span className="sr-only"> {completed === 1 ? t("set") : t("sets")}</span>
      </span>
    </p>
  );
  const prChip = pr > 0 && (
    <span className="num inline-flex shrink-0 items-center gap-1 rounded-full border border-pr/40 px-1.5 py-px text-[11px] font-semibold text-pr">
      <Trophy aria-hidden="true" size={11} />
      {pr} PR
    </span>
  );
  const when = (
    <time dateTime={isoTime(s.startedAt)} className="num shrink-0 text-xs text-text-muted">
      {relativeDay(s.startedAt, now, t)}
    </time>
  );

  if (grid) {
    const ids = s.exercises.map((e) => e.exerciseId).filter((id) => byId[id]);
    return (
      <motion.li style={{ opacity: 0, y: 8 }} animate={controls} variants={{ still: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0, transition: { ...SPRING, delay: 0.35 + Math.min(order, 6) * 0.05 } } }}>
        <motion.div whileTap={{ scale: 0.97 }} transition={PRESS_SPRING} className="h-full">
          <Link href={historyPath(s.id)} className={`${TILE} flex h-full flex-col gap-2 transition-colors hover:border-line-hover`}>
            {/* Up to four of its exercises, as a 2 x 2 photo mosaic. */}
            <div aria-hidden="true" className="grid grid-cols-2 gap-1 overflow-hidden rounded-lg">
              {[0, 1, 2, 3].map((i) =>
                ids[i] ? (
                  <div key={i} className="flex aspect-square items-center justify-center overflow-hidden bg-surface-2 [&>span]:!size-full [&>span]:!rounded-none [&>span]:!border-0">
                    <ExerciseThumb exercise={byId[ids[i]]} size={36} />
                  </div>
                ) : (
                  <div key={i} className="aspect-square bg-surface-2" />
                ),
              )}
            </div>
            <span className="line-clamp-2 text-sm font-semibold leading-snug">{s.name}</span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {when}
              {prChip}
            </div>
            <div className="mt-auto">{stats}</div>
          </Link>
        </motion.div>
      </motion.li>
    );
  }

  return (
    <motion.li
      style={{ opacity: 0, x: -10 }}
      animate={controls}
      variants={{
        still: { opacity: 1, x: 0 },
        show: { opacity: 1, x: 0, transition: { ...SPRING, delay: 0.35 + Math.min(order, 6) * 0.05 } },
      }}
    >
      <motion.div whileTap={{ scale: 0.98 }} transition={PRESS_SPRING}>
        <Link href={historyPath(s.id)} className={`${TILE} flex items-center gap-3 transition-colors hover:border-line-hover`}>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate text-base font-semibold">{s.name}</span>
              {prChip}
              <span className="ml-auto">{when}</span>
            </div>
            {/* Photos and figures share a row while they fit; the figures wrap below on narrow cards. */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <ThumbRow exerciseIds={s.exercises.map((e) => e.exerciseId)} byId={byId} size={30} />
              {stats}
            </div>
          </div>
          <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-text-muted" />
        </Link>
      </motion.div>
    </motion.li>
  );
}
