"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronRight, Dumbbell, Layers, Play, Plus, Settings, Timer, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { useReminderStore } from "@/store/useReminderStore";
import { Button, PRESS_SPRING } from "@/components/ui/Button";
import { AbotWordmark } from "@/components/brand/AbotMark";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { CountFromZero, Rise, useEntrance } from "@/components/motion/Entrance";
import { RecoveryMap } from "@/components/anatomy/RecoveryMap";
import { REGIONS, type Region } from "@/components/anatomy/regions";
import { Sheet } from "@/components/ui/Sheet";
import { regionTelemetry, type RegionTelemetry } from "@/lib/muscle-recovery";
import { useNow } from "@/lib/useNow";
import { countSets, formatDuration, sessionDurationSec, sessionVolume } from "@/lib/calc";
import { formatVolume, toDisplay } from "@/lib/units";
import {
  nextProtocol,
  prCounts,
  relativeDay,
  weekDayVolumes,
  weekStrip,
  weeklyFrequency,
  weeklyVolume,
  type NextProtocol,
} from "@/lib/home";
import type { Exercise, WorkoutSession } from "@/types/workout";
import { historyPath } from "@/lib/routes";
import { useT } from "@/i18n";
import { ViewToggle, useViewMode } from "@/components/ui/ViewToggle";

/** A machined module: Carbon fill, hairline edge, tight padding. */
const TILE = "rounded-xl border border-line bg-surface p-3";
const SPRING = { type: "spring", stiffness: 300, damping: 26 } as const;

/**
 * Home as a command centre, told in pictures more than words: this week's days, the next routine
 * as its exercise photos, the week as a bar chart, a ring and a body map, and the log as cards
 * with photos and icons. Every figure comes from finished workouts on this device.
 */
export function HomeDashboard() {
  const t = useT();
  const sessions = useWorkoutStore((s) => s.sessions);
  const active = useWorkoutStore((s) => s.active);
  const routines = useRoutineStore((s) => s.routines);
  const schedule = useReminderStore((s) => s.schedule);
  const { weightUnit, firstDayOfWeek } = useSettingsStore();
  const { byId } = useAllExercises();
  const now = useNow(active ? 1000 : 60_000);

  const next = useMemo(() => nextProtocol(routines, sessions, schedule, now), [routines, sessions, schedule, now]);

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pt-4">
      <header className="flex flex-col gap-4">
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
        <WeekStrip days={weekStrip(sessions, now, firstDayOfWeek)} />
      </header>

      <Rise step={0.07} order={1}>{active ? <ActiveCard now={now} /> : <ProtocolHero next={next} byId={byId} />}</Rise>

      <Rise step={0.07} order={2}>
        <ThisWeek now={now} />
      </Rise>

      <Rise step={0.07} order={3}>
        <RecentWorkouts unit={weightUnit} byId={byId} now={now} />
      </Rise>
    </main>
  );
}

/* ---------------------------------------------------------------- week strip */

/** Trained days light up one after another; today keeps a slow breathing ring. */
function WeekStrip({ days }: { days: ReturnType<typeof weekStrip> }) {
  const t = useT();
  const controls = useEntrance();
  const reduce = useReducedMotion();
  return (
    <ol aria-label={t("This week")} className="grid grid-cols-7 gap-1.5">
      {days.map((d, i) => {
        const date = new Date(d.start);
        const weekday = date.toLocaleDateString(t.locale, { weekday: "short" });
        const status = d.trained ? t("trained") : d.isToday ? t("today") : d.isFuture ? "" : t("rest");
        return (
          <li key={d.start} className="flex flex-col items-center gap-1">
            <span aria-hidden="true" className={`label-caps ${d.isToday ? "!text-text" : ""}`}>
              {weekday.slice(0, 1)}
            </span>
            <span aria-hidden="true" className="relative flex h-9 w-full max-w-11 items-center justify-center">
              {d.isToday && !d.trained && (
                <motion.span
                  className="absolute inset-0 rounded-lg border border-ink/70"
                  animate={reduce ? undefined : { opacity: [1, 0.45, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              {d.trained ? (
                <motion.span
                  className="flex size-full items-center justify-center rounded-lg bg-accent text-on-accent"
                  style={{ scale: 0.4, opacity: 0 }}
                  animate={controls}
                  variants={{
                    still: { scale: 1, opacity: 1 },
                    show: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 420, damping: 18, delay: 0.15 + i * 0.06 } },
                  }}
                >
                  <Check size={16} strokeWidth={3} />
                </motion.span>
              ) : (
                <span className={`size-1.5 rounded-full ${d.isToday ? "bg-text" : "bg-zinc-800"}`} />
              )}
            </span>
            <span className="sr-only">
              {date.toLocaleDateString(t.locale, { weekday: "long", day: "numeric" })}
              {status && `, ${status}`}
            </span>
          </li>
        );
      })}
    </ol>
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

function ProtocolHero({ next, byId }: { next: NextProtocol | null; byId: Record<string, Exercise> }) {
  const t = useT();
  const router = useRouter();
  const { startEmpty, startFromRoutine } = useWorkoutStore();
  const defaultRest = useSettingsStore((s) => s.defaultRestSeconds);

  const empty = () => {
    startEmpty(defaultRest);
    router.push("/workout");
  };

  if (!next) {
    return (
      <section aria-labelledby="hero-heading" className={`${TILE} relative flex flex-col gap-3 overflow-hidden p-4`}>
        <HeroPlate />
        <div className="relative">
          <p className="label-caps">{t("Next up")}</p>
          <h2 id="hero-heading" className="mt-1 text-2xl font-bold tracking-tight">
            {t("Free session")}
          </h2>
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
      </section>
    );
  }

  const { routine } = next;
  return (
    <section aria-labelledby="hero-heading" className={`${TILE} relative flex flex-col gap-3 overflow-hidden p-4`}>
      <HeroPlate />
      <div className="relative min-w-0">
        <p className="label-caps">{t("Next up")}</p>
        <h2 id="hero-heading" className="mt-1 truncate text-2xl font-bold tracking-tight">
          {routine.name}
        </h2>
      </div>
      <div className="relative">
        <ThumbRow exerciseIds={routine.exercises.map((e) => e.exerciseId)} byId={byId} />
      </div>
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Button
          variant="primary"
          onClick={() => {
            startFromRoutine(routine);
            router.push("/workout");
          }}
          aria-label={t("Start {name}", { name: routine.name })}
          className="min-h-12 text-base"
        >
          <Play aria-hidden="true" size={18} />
          {t("Start")}
        </Button>
        <Button onClick={empty} aria-label={t("Start an empty workout")} className="size-12 !bg-transparent !px-0">
          <Plus aria-hidden="true" size={20} />
        </Button>
      </div>
    </section>
  );
}

/** A large plate outline turning slowly behind the hero: the brand mark as hardware, at rest. */
function HeroPlate() {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className="pointer-events-none absolute -right-12 -top-12 size-48 text-accent/[0.16]"
      animate={reduce ? undefined : { rotate: 360 }}
      transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
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

function ActiveCard({ now }: { now: number }) {
  const t = useT();
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
          transition={{ duration: 1.2, repeat: Infinity }}
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

/* ---------------------------------------------------------------- this week */

function ThisWeek({ now }: { now: number }) {
  const t = useT();
  const sessions = useWorkoutStore((s) => s.sessions);
  const schedule = useReminderStore((s) => s.schedule);
  const { weightUnit, firstDayOfWeek } = useSettingsStore();
  const { byId } = useAllExercises();

  const volume = useMemo(() => weeklyVolume(sessions, now, firstDayOfWeek, byId), [sessions, now, firstDayOfWeek, byId]);
  const days = useMemo(() => weekDayVolumes(sessions, now, firstDayOfWeek, byId), [sessions, now, firstDayOfWeek, byId]);
  const strip = weekStrip(sessions, now, firstDayOfWeek);
  const freq = weeklyFrequency(sessions, schedule, now, firstDayOfWeek);
  const active = useWorkoutStore((s) => s.active);
  // Sets ticked in a workout still running tire the muscles too.
  const recovery = useMemo(() => regionTelemetry(active ? [...sessions, active] : sessions, byId, now), [sessions, active, byId, now]);

  return (
    <section aria-label={t("This week")} className="grid grid-cols-2 gap-2">
      <VolumeCard
        kg={volume.kg}
        change={volume.changePct}
        days={days}
        letters={strip.map((d) => new Date(d.start).toLocaleDateString(t.locale, { weekday: "narrow" }))}
        todayIndex={strip.findIndex((d) => d.isToday)}
        unit={weightUnit}
      />
      <SessionsRing done={freq.done} target={freq.target ?? 7} perWeek={freq.target !== null} />
      <RecoveryCard data={recovery} now={now} />
    </section>
  );
}

/** The week's volume: a counting figure, the change, and a bar per day that grows into place. */
function VolumeCard({
  kg,
  change,
  days,
  letters,
  todayIndex,
  unit,
}: {
  kg: number;
  change: number | null;
  days: number[];
  letters: string[];
  todayIndex: number;
  unit: "kg" | "lbs";
}) {
  const t = useT();
  const controls = useEntrance();
  const max = Math.max(...days, 1);
  return (
    <div className={`${TILE} col-span-2 flex items-end justify-between gap-3`}>
      <div className="min-w-0">
        <p className="label-caps">{t("Volume")}</p>
        <p className="num mt-1 flex items-baseline gap-1 text-3xl font-bold tracking-tight tabular-nums">
          <CountFromZero delay={0.2} value={Math.round(toDisplay(kg, unit))} format={(n) => Math.round(n).toLocaleString(t.locale)} />
          <span className="text-sm font-semibold text-text-muted">{unit}</span>
        </p>
        {change !== null && (
          <p className={`num mt-1 inline-flex items-center gap-1 text-xs ${change >= 0 ? "text-text" : "text-text-muted"}`}>
            {change >= 0 ? <TrendingUp aria-hidden="true" size={14} className="text-accent" /> : <TrendingDown aria-hidden="true" size={14} />}
            {change > 0 ? "+" : ""}
            {change}%<span className="sr-only"> {t("against last week")}</span>
          </p>
        )}
      </div>
      <div aria-hidden="true" className="flex h-20 shrink-0 items-end gap-1.5">
        {days.map((v, i) => (
          <div key={i} className="flex h-full flex-col items-center justify-end gap-1">
            <motion.span
              className={`block w-3 origin-bottom rounded-sm ${i === todayIndex ? "bg-accent" : v > 0 ? "bg-accent/45" : "bg-zinc-800"}`}
              style={{ height: `${Math.max(6, (v / max) * 100)}%`, scaleY: 0 }}
              animate={controls}
              variants={{
                still: { scaleY: 1 },
                show: { scaleY: 1, transition: { type: "spring", stiffness: 220, damping: 20, delay: 0.25 + i * 0.05 } },
              }}
            />
            <span className={`text-[9px] ${i === todayIndex ? "text-text" : "text-text-muted"}`}>{letters[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Sessions as a ring that draws itself: against the schedule when there is one, else the 7 days. */
function SessionsRing({ done, target, perWeek }: { done: number; target: number; perWeek: boolean }) {
  const t = useT();
  const controls = useEntrance();
  const r = 30;
  const fraction = Math.min(1, done / Math.max(1, target));
  return (
    <div className={`${TILE} flex flex-col items-center justify-center gap-1`}>
      <div className="relative size-[76px]">
        <svg viewBox="0 0 76 76" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="38" cy="38" r={r} fill="none" stroke="var(--color-track)" strokeWidth="7" />
          <motion.circle
            cx="38"
            cy="38"
            r={r}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="7"
            strokeLinecap="round"
            style={{ pathLength: 0, opacity: fraction > 0 ? 1 : 0 }}
            animate={controls}
            variants={{
              still: { pathLength: fraction },
              show: { pathLength: fraction, transition: { duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] } },
            }}
          />
        </svg>
        <span className="num absolute inset-0 flex items-center justify-center text-xl font-bold tabular-nums">
          {done}
          <span className="text-xs font-semibold text-text-muted">/{target}</span>
        </span>
      </div>
      <p className="label-caps">{perWeek ? t("Planned") : t("Days")}</p>
      <span className="sr-only">
        {perWeek
          ? t("{done} of {target} planned sessions this week", { done, target })
          : t("{done} of {target} days this week", { done, target })}
      </span>
    </div>
  );
}

/**
 * The body, front and back, coloured by how tired each muscle is. Tapping opens the full map:
 * one side at a time, each muscle with its recovery and time to ready.
 */
function RecoveryCard({ data, now }: { data: Record<Region, RegionTelemetry>; now: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ready = REGIONS.filter((r) => data[r].stage === "fresh").length;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t("Muscle recovery: {ready} of {total} muscles ready. Open the map.", { ready, total: REGIONS.length })}
        className={`${TILE} force-dark flex flex-col items-center justify-center gap-1 !bg-black !pb-2 text-left transition-colors hover:!border-line-strong`}
      >
        <div className="w-full px-1" aria-hidden="true">
          <RecoveryMap data={data} now={now} compact />
        </div>
        <p className="num text-sm font-bold tabular-nums text-text" aria-hidden="true">
          {ready}/{REGIONS.length}
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">{t("ready")}</span>
        </p>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("Muscle recovery")}>
        <RecoveryMap data={data} now={now} />
        <p className="mt-3 text-xs text-text-muted">
          {t(
            "Each working set adds fatigue: 15% to the main muscles, 7.5% to the helpers, more at a high RPE. It fades by itself: big muscles are fresh again in 72 hours, small ones in 48.",
          )}
        </p>
      </Sheet>
    </>
  );
}

/* ---------------------------------------------------------------- recent */

function RecentWorkouts({ unit, byId, now }: { unit: "kg" | "lbs"; byId: Record<string, Exercise>; now: number }) {
  const t = useT();
  const sessions = useWorkoutStore((s) => s.sessions);
  const recent = useMemo(() => [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 10), [sessions]);
  const prs = useMemo(() => prCounts(recent, sessions, byId), [recent, sessions, byId]);

  const [view, setView] = useViewMode("recent");

  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-heading" className="label-caps">
          {t("Recent workouts")}
        </h2>
        {recent.length > 0 && <ViewToggle value={view} onChange={setView} />}
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

function RecentCard({
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
  const { completed } = countSets(s);
  const stats = (
    <p className="num flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-400">
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Timer aria-hidden="true" size={12} />
        {formatDuration(sessionDurationSec(s))}
      </span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Dumbbell aria-hidden="true" size={12} />
        {formatVolume(sessionVolume(s, byId), unit)}
      </span>
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
    <time dateTime={new Date(s.startedAt).toISOString()} className="num shrink-0 text-xs text-text-muted">
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
