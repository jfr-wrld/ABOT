"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ChevronRight, Plus, Settings, Trophy } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { useReminderStore } from "@/store/useReminderStore";
import { Button, PRESS_SPRING } from "@/components/ui/Button";
import { AbotWordmark } from "@/components/brand/AbotMark";
import { useNow } from "@/lib/useNow";
import { countSets, formatDuration, sessionDurationSec, sessionVolume } from "@/lib/calc";
import { formatVolume } from "@/lib/units";
import {
  muscleRecovery,
  nextProtocol,
  prCounts,
  weekStrip,
  weeklyFrequency,
  weeklyVolume,
  type NextProtocol,
} from "@/lib/home";
import type { Exercise } from "@/types/workout";

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
  const { weightUnit, firstDayOfWeek } = useSettingsStore();
  const { byId } = useAllExercises();
  const now = useNow(active ? 1000 : 60_000);

  const next = useMemo(() => nextProtocol(routines, sessions, schedule, now), [routines, sessions, schedule, now]);

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
          </div>
        </div>
        <WeekStrip days={weekStrip(sessions, now, firstDayOfWeek)} />
      </header>

      {active ? <ActiveCard now={now} /> : <ProtocolHero next={next} />}

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

function ProtocolHero({ next }: { next: NextProtocol | null }) {
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
          <p className="label-caps">Next up</p>
          <h2 id="hero-heading" className="mt-1 text-2xl font-bold tracking-tight">
            Free session
          </h2>
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

  const { routine } = next;
  return (
    <section aria-labelledby="hero-heading" className={`${TILE} flex flex-col gap-3 p-4`}>
      <div className="min-w-0">
        <p className="label-caps">Next up</p>
        <h2 id="hero-heading" className="mt-1 truncate text-2xl font-bold tracking-tight">
          {routine.name}
        </h2>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Button
          variant="primary"
          onClick={() => {
            startFromRoutine(routine);
            router.push("/workout");
          }}
          aria-label={`Start ${routine.name}`}
          className="min-h-12 text-base"
        >
          Start
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
  const [figure, unit] = formatVolume(volume.kg, weightUnit).split(" ");

  return (
    <section aria-label="This week">
      <dl className="grid grid-cols-3 gap-2">
        <Metric label={`${unit} lifted`} value={figure}>
          {volume.changePct !== null && (
            <span className={volume.changePct >= 0 ? "text-text" : "text-text-muted"}>
              {volume.changePct > 0 ? "+" : ""}
              {volume.changePct}%<span className="sr-only"> against last week</span>
            </span>
          )}
        </Metric>
        <Metric label="Sessions" value={freq.target !== null ? `${freq.done}/${freq.target}` : String(freq.done)}>
          {freq.target !== null && (
            <span className="flex gap-0.5 pt-1" aria-hidden="true">
              {Array.from({ length: freq.target }, (_, i) => (
                <span key={i} className={`h-1 flex-1 rounded-full ${i < freq.done ? "bg-accent" : "bg-zinc-800"}`} />
              ))}
            </span>
          )}
        </Metric>
        <Metric label="Ready" value={`${ready}/6`} />
      </dl>
    </section>
  );
}

/** One instrument: a caps label, a mono figure, and at most one short mark under it. */
function Metric({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className={`${TILE} min-w-0`}>
      <dt className="label-caps truncate">{label}</dt>
      <dd className="num mt-1 truncate text-xl font-bold tracking-tight tabular-nums">{value}</dd>
      {children && <dd className="num mt-0.5 flex min-h-4 text-[11px] text-text-muted">{children}</dd>}
    </div>
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
        <p className={`${TILE} py-5 text-center text-sm text-text-muted`}>No workouts yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {recent.map((s) => {
            const { completed } = countSets(s);
            const pr = prs[s.id] ?? 0;
            return (
              <li key={s.id}>
                <motion.div whileTap={{ scale: 0.98 }} transition={PRESS_SPRING}>
                  <Link href={`/history/${s.id}`} className={`${TILE} flex items-center gap-3 transition-colors hover:border-line-hover`}>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
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
