"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ChevronRight, Plus, Settings, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { useReminderStore } from "@/store/useReminderStore";
import { Button, PRESS_SPRING } from "@/components/ui/Button";
import { AbotWordmark } from "@/components/brand/AbotMark";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { useNow } from "@/lib/useNow";
import { countSets, formatDuration, sessionDurationSec, sessionVolume } from "@/lib/calc";
import { formatVolume } from "@/lib/units";
import {
  RECOVERY_HOURS,
  muscleRecovery,
  nextProtocol,
  prCounts,
  sessionMuscles,
  weekStrip,
  weeklyFrequency,
  weeklyVolume,
  type NextProtocol,
} from "@/lib/home";
import { MUSCLE_GROUP_LABELS, type Exercise, type Routine } from "@/types/workout";

/** A machined module: Carbon fill, hairline edge, tight padding. */
const TILE = "rounded-xl border border-line bg-surface p-3";

/**
 * Home as a command centre: this week at a glance, one start button for the routine that is
 * due, the week's numbers, and the log. Every figure comes from finished workouts on this device.
 */
export function HomeDashboard() {
  const sessions = useWorkoutStore((s) => s.sessions);
  const active = useWorkoutStore((s) => s.active);
  const routines = useRoutineStore((s) => s.routines);
  const schedule = useReminderStore((s) => s.schedule);
  const { weightUnit, firstDayOfWeek, profileName, profilePhoto } = useSettingsStore();
  const { byId } = useAllExercises();
  const now = useNow(active ? 1000 : 60_000);

  const next = useMemo(() => nextProtocol(routines, sessions, schedule, now), [routines, sessions, schedule, now]);
  const others = routines.filter((r) => r.exercises.length > 0 && r.id !== next?.routine.id).slice(0, 6);

  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pt-4">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1>
            <AbotWordmark />
          </h1>
          <div className="-mr-2 flex items-center">
            <Link
              href="/settings"
              aria-label="Settings"
              className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface hover:text-text"
            >
              <Settings aria-hidden="true" size={22} />
            </Link>
            <Link
              href="/profile"
              aria-label="Profile"
              className="flex size-11 items-center justify-center rounded-ctl transition-opacity hover:opacity-80"
            >
              <span aria-hidden="true">
                <ProfileAvatar name={profileName} photo={profilePhoto} size={32} />
              </span>
            </Link>
          </div>
        </div>
        <WeekStrip days={weekStrip(sessions, now, firstDayOfWeek)} />
      </header>

      {active ? <ActiveCard now={now} /> : <ProtocolHero next={next} byId={byId} />}

      {!active && others.length > 0 && <OtherRoutines routines={others} />}

      <Metrics now={now} />

      <RecentWorkouts unit={weightUnit} byId={byId} />
    </main>
  );
}

/* ---------------------------------------------------------------- week strip */

function WeekStrip({ days }: { days: ReturnType<typeof weekStrip> }) {
  return (
    <ol aria-label="This week" className="grid grid-cols-7 gap-1.5">
      {days.map((d) => {
        const date = new Date(d.start);
        const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
        const status = d.trained ? "trained" : d.isToday ? "today" : d.isFuture ? "" : "rest";
        return (
          <li key={d.start} className="flex flex-col items-center gap-1">
            <span aria-hidden="true" className={`label-caps ${d.isToday ? "!text-text" : ""}`}>
              {weekday.slice(0, 1)}
            </span>
            <span
              aria-hidden="true"
              className={`flex h-9 w-full max-w-11 items-center justify-center rounded-lg ${
                d.trained ? "bg-accent text-on-accent" : d.isToday ? "border border-white/70" : ""
              }`}
            >
              {d.trained ? (
                <Check size={16} strokeWidth={3} />
              ) : (
                <span className={`size-1.5 rounded-full ${d.isToday ? "bg-text" : "bg-zinc-800"}`} />
              )}
            </span>
            <span aria-hidden="true" className={`num text-[11px] ${d.isToday ? "text-text" : "text-text-muted"}`}>
              {date.getDate()}
            </span>
            <span className="sr-only">
              {date.toLocaleDateString(undefined, { weekday: "long", day: "numeric" })}
              {status && `, ${status}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------------------------------------------------------- hero */

function routineMuscles(r: Routine, byId: Record<string, Exercise>): string[] {
  return [...new Set(r.exercises.flatMap((e) => byId[e.exerciseId]?.primaryMuscles ?? []))]
    .slice(0, 3)
    .map((m) => MUSCLE_GROUP_LABELS[m]);
}

function MuscleChips({ muscles }: { muscles: string[] }) {
  if (muscles.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Muscles">
      {muscles.map((m) => (
        <li key={m} className="label-caps rounded-md bg-surface-2 px-1.5 py-0.5">
          {m}
        </li>
      ))}
    </ul>
  );
}

function ProtocolHero({ next, byId }: { next: NextProtocol | null; byId: Record<string, Exercise> }) {
  const router = useRouter();
  const { startEmpty, startFromRoutine } = useWorkoutStore();
  const defaultRest = useSettingsStore((s) => s.defaultRestSeconds);

  const empty = () => {
    startEmpty(defaultRest);
    router.push("/workout");
  };

  if (!next) {
    return (
      <section aria-labelledby="hero-heading" className={`${TILE} flex flex-col gap-3 p-4`}>
        <div>
          <p className="label-caps">Next protocol // none yet</p>
          <h2 id="hero-heading" className="mt-1 text-2xl font-bold tracking-tight">
            Free session
          </h2>
          <p className="mt-1 text-sm text-text-muted">Save a routine for a one-tap start here.</p>
        </div>
        <Button variant="primary" onClick={empty} className="min-h-12 w-full text-base">
          Start an empty workout
        </Button>
        <Link
          href="/routines"
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] text-sm font-semibold transition-colors hover:border-white/25"
        >
          <Plus aria-hidden="true" size={16} />
          Create a routine
        </Link>
      </section>
    );
  }

  const { routine, reason } = next;
  const sets = routine.exercises.reduce((n, e) => n + e.sets.length, 0);
  return (
    <section aria-labelledby="hero-heading" className={`${TILE} flex flex-col gap-3 p-4`}>
      <div className="min-w-0">
        <p className="label-caps">Next protocol // {reason}</p>
        <h2 id="hero-heading" className="mt-1 truncate text-2xl font-bold tracking-tight">
          {routine.name}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <MuscleChips muscles={routineMuscles(routine, byId)} />
          <span className="num text-xs text-text-muted">
            {routine.exercises.length} ex{sets > 0 ? ` · ${sets} sets` : ""}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Button
          variant="primary"
          onClick={() => {
            startFromRoutine(routine);
            router.push("/workout");
          }}
          className="min-h-12 text-base"
        >
          <span className="truncate">Start {routine.name}</span>
        </Button>
        <Button onClick={empty} aria-label="Start an empty workout" className="min-h-12 !bg-transparent">
          <Plus aria-hidden="true" size={16} />
          Empty
        </Button>
      </div>
    </section>
  );
}

function ActiveCard({ now }: { now: number }) {
  const active = useWorkoutStore((s) => s.active)!;
  return (
    <Link
      href="/workout"
      className="block rounded-xl border border-accent/40 bg-accent-tint p-4 transition-colors hover:border-accent/70"
    >
      <span className="label-caps !text-accent">Workout in progress</span>
      <span className="mt-1 block truncate text-2xl font-bold tracking-tight">{active.name}</span>
      <span className="num mt-1 block text-sm text-text-muted">
        {formatDuration(sessionDurationSec(active, now))} · {countSets(active).completed} sets done
      </span>
      <span className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-accent text-base font-bold text-on-accent">
        Continue workout
      </span>
    </Link>
  );
}

function OtherRoutines({ routines }: { routines: Routine[] }) {
  const router = useRouter();
  const startFromRoutine = useWorkoutStore((s) => s.startFromRoutine);
  return (
    <section aria-labelledby="others-heading" className="-mt-2">
      <h2 id="others-heading" className="sr-only">
        Other routines
      </h2>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {routines.map((r) => (
          <li key={r.id} className="shrink-0">
            <button
              type="button"
              onClick={() => {
                startFromRoutine(r);
                router.push("/workout");
              }}
              aria-label={`Start ${r.name}`}
              className="flex min-h-11 max-w-[11rem] items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-semibold transition-colors hover:border-line-hover"
            >
              <span className="truncate">{r.name}</span>
              <span className="num text-xs text-text-muted">{r.exercises.length}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------- metrics */

function Metrics({ now }: { now: number }) {
  const sessions = useWorkoutStore((s) => s.sessions);
  const schedule = useReminderStore((s) => s.schedule);
  const { weightUnit, firstDayOfWeek } = useSettingsStore();
  const { byId } = useAllExercises();

  const volume = useMemo(() => weeklyVolume(sessions, now, firstDayOfWeek, byId), [sessions, now, firstDayOfWeek, byId]);
  const freq = weeklyFrequency(sessions, schedule, now, firstDayOfWeek);
  const recovery = useMemo(() => muscleRecovery(sessions, byId, now), [sessions, byId, now]);
  const ready = recovery.filter((r) => r.hoursLeft === 0).length;

  return (
    <section aria-labelledby="week-heading" className="flex flex-col gap-2">
      <h2 id="week-heading" className="label-caps">
        This week
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <div className={TILE}>
          <p className="label-caps">Volume</p>
          <p className="num mt-1 truncate text-2xl font-bold tracking-tight tabular-nums">{formatVolume(volume.kg, weightUnit)}</p>
          <p className="num mt-0.5 flex items-center gap-1 text-xs text-text-muted">
            {volume.changePct === null ? (
              "No week to compare"
            ) : (
              <>
                {volume.changePct >= 0 ? (
                  <TrendingUp aria-hidden="true" size={14} className="text-text" />
                ) : (
                  <TrendingDown aria-hidden="true" size={14} />
                )}
                <span className={volume.changePct >= 0 ? "text-text" : ""}>
                  {volume.changePct > 0 ? "+" : ""}
                  {volume.changePct}%
                </span>
                vs last wk
              </>
            )}
          </p>
        </div>

        <div className={TILE}>
          <p className="label-caps">Frequency</p>
          <p className="num mt-1 text-2xl font-bold tracking-tight tabular-nums">
            {freq.done}
            {freq.target !== null && <span className="text-text-muted">/{freq.target}</span>}
            <span className="ml-1.5 text-xs font-semibold text-text-muted">SESSIONS</span>
          </p>
          {freq.target !== null ? (
            <div className="mt-2 flex gap-1" aria-hidden="true">
              {Array.from({ length: freq.target }, (_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i < freq.done ? "bg-accent" : "bg-zinc-800"}`} />
              ))}
            </div>
          ) : (
            <Link href="/settings#schedule" className="num -my-2 inline-flex min-h-11 items-center text-xs text-text-muted underline underline-offset-4 hover:text-text">
              Set a weekly plan
            </Link>
          )}
        </div>

        <div className={`${TILE} col-span-2`}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="label-caps">Recovery</p>
            <p className="num text-xs text-text-muted">
              <span className="font-semibold text-text">{ready}/6</span> ready · {RECOVERY_HOURS} h rule
            </p>
          </div>
          <ul className="mt-2 grid grid-cols-3 gap-1.5">
            {recovery.map((r) => (
              <li
                key={r.group}
                className={`flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 ${r.hoursLeft === 0 ? "bg-surface-2" : "bg-bg"}`}
              >
                <span className={`truncate text-xs font-semibold ${r.hoursLeft === 0 ? "text-text" : "text-text-muted"}`}>{r.group}</span>
                {r.hoursLeft === 0 ? (
                  <>
                    <Check aria-hidden="true" size={14} strokeWidth={3} className="shrink-0 text-text" />
                    <span className="sr-only">ready</span>
                  </>
                ) : (
                  <span className="num text-[11px] text-text-muted">
                    {r.hoursLeft}h<span className="sr-only"> until ready</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- recent */

function RecentWorkouts({ unit, byId }: { unit: "kg" | "lbs"; byId: Record<string, Exercise> }) {
  const sessions = useWorkoutStore((s) => s.sessions);
  const recent = useMemo(() => [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 10), [sessions]);
  const prs = useMemo(() => prCounts(recent, sessions, byId), [recent, sessions, byId]);

  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
      <h2 id="recent-heading" className="label-caps">
        Recent workouts
      </h2>
      {recent.length === 0 ? (
        <p className={`${TILE} py-5 text-center text-sm text-text-muted`}>No workouts yet. Finished sessions land here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {recent.map((s) => {
            const { completed } = countSets(s);
            const pr = prs[s.id] ?? 0;
            const muscles = sessionMuscles(s, byId).map((m) => MUSCLE_GROUP_LABELS[m]);
            return (
              <li key={s.id}>
                <motion.div whileTap={{ scale: 0.98 }} transition={PRESS_SPRING}>
                  <Link href={`/history/${s.id}`} className={`${TILE} flex items-center gap-3 transition-colors hover:border-line-hover`}>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-base font-semibold">{s.name}</span>
                        {pr > 0 && (
                          <span className="num inline-flex shrink-0 items-center gap-1 rounded-full border border-pr/40 px-1.5 py-px text-[11px] font-semibold text-pr">
                            <Trophy aria-hidden="true" size={11} />
                            {pr} PR
                          </span>
                        )}
                        <time
                          dateTime={new Date(s.startedAt).toISOString()}
                          className="num ml-auto shrink-0 text-xs text-text-muted"
                        >
                          {new Date(s.startedAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                        </time>
                      </div>
                      <MuscleChips muscles={muscles} />
                      <p className="num text-xs text-zinc-400">
                        {formatDuration(sessionDurationSec(s))} · {formatVolume(sessionVolume(s, byId), unit)} · {completed}{" "}
                        {completed === 1 ? "set" : "sets"}
                      </p>
                    </div>
                    <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-text-muted" />
                  </Link>
                </motion.div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
