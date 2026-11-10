"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LayoutGroup, MotionConfig, motion } from "framer-motion";
import { ArrowUpRight, Check, Crosshair, Pause, Play, Plus, X, Zap } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useHydration } from "@/store/hydration";
import { useNow } from "@/lib/useNow";
import { formatClock, formatDuration, sessionDurationSec } from "@/lib/calc";
import { formatWeight } from "@/lib/units";
import { liveSet, setProgress } from "@/lib/live-set";
import { useLiveWorkoutNotification } from "@/lib/notifications/useLiveWorkoutNotification";
import type { WeightUnit, WorkoutSession, WorkoutSet } from "@/types/workout";
import { usePagePath } from "@/components/layout/usePagePath";
import { feedback } from "@/lib/feedback";
import { isNativeApp } from "@/lib/native/files";
import { isAppActive, useAppActive } from "@/lib/native/app-active";
import { pageRingsRestOver } from "@/lib/rest-alert";
import { useAllExercises } from "@/store/useExerciseStore";
import { supersetLabels, type SupersetHandoff } from "@/lib/superset";
import { setNumbers } from "@/lib/sets";
import { scrollToExercise } from "@/lib/scroll-to-exercise";
import { useT } from "@/i18n";

/** Fast to settle, a little overshoot: the capsule should feel like hardware snapping open. */
const ISLAND_SPRING = { type: "spring", stiffness: 520, damping: 38, mass: 0.9 } as const;
/** Content fades in after the shape starts moving, so text never stretches with the capsule. */
const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.14, delay: 0.06 } };

/**
 * A black capsule that sits just above the dock, where the thumb already is. While a workout runs
 * it says where the lifter is: the exercise, the set and its target, the elapsed time and how many
 * sets are done (tap to go to that exercise); it morphs open into the rest countdown with
 * its controls, then shows "Go" when rest is over. Mid-superset it names the next exercise instead,
 * since there is no rest until the last one. One layoutId, so the change is a single shape
 * stretching, not one box swapped for another. Outside the app, the same state is shown as a
 * status notification (useLiveWorkoutNotification).
 */
export function DynamicIsland() {
  return (
    <Suspense fallback={null}>
      <Island />
    </Suspense>
  );
}

function Island() {
  const hydrated = useHydration((s) => s.hydrated);
  const active = useWorkoutStore((s) => s.active);
  const timer = useWorkoutStore((s) => s.restTimer);
  const rawHandoff = useWorkoutStore((s) => s.handoff);
  const pathname = usePagePath();
  const handoff = active && rawHandoff && liveHandoff(active, rawHandoff) ? rawHandoff : null;
  useLiveWorkoutNotification();
  useStartSound(hydrated);
  // The intro and sign-in have no dock, so there is nothing to sit above.
  const shown = hydrated && active !== null && pathname !== "/onboarding" && pathname !== "/login" && pathname !== "/permissions" && !pathname.startsWith("/workout/summary");

  // Pages pad their bottom by this much more, so the bar never covers the last row.
  useEffect(() => {
    document.documentElement.style.setProperty("--live-bar", shown ? "72px" : "0px");
    return () => document.documentElement.style.setProperty("--live-bar", "0px");
  }, [shown]);

  if (!shown || !active) return null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(16px,var(--dock-h,96px)-12px)+var(--action-bar,0px)+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-[640px] justify-center px-3">
        <LayoutGroup>
          {timer ? (
            <RestCapsule key="rest" />
          ) : handoff ? (
            <HandoffCapsule key="handoff" session={active} handoff={handoff} onWorkoutPage={pathname === "/workout"} />
          ) : (
            <CompactCapsule key="compact" session={active} onWorkoutPage={pathname === "/workout"} />
          )}
        </LayoutGroup>
      </div>
    </MotionConfig>
  );
}

/**
 * The start sound, from one place for every Start button: a workout that appears while the app
 * runs and began just now. Restoring one on launch, or one that sync brought in, stays quiet.
 */
function useStartSound(hydrated: boolean) {
  const id = useWorkoutStore((s) => s.active?.id ?? null);
  const startedAt = useWorkoutStore((s) => s.active?.startedAt ?? 0);
  const seen = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!hydrated) return;
    const before = seen.current;
    seen.current = id;
    if (before === null && id !== null && Date.now() - startedAt < 10_000) feedback.start();
  }, [hydrated, id, startedAt]);
}

const capsule =
  "force-dark glass-capsule pointer-events-auto relative flex items-center overflow-hidden rounded-full border border-accent/25 text-text";

/** What the set asks for, as typed so far: "60 kg × 8", "8 reps", "45s"; empty when nothing is. */
function targetText(set: WorkoutSet, unit: WeightUnit, t: ReturnType<typeof useT>): string {
  if (set.durationSec) return formatDuration(set.durationSec);
  if (set.weightKg !== null && set.reps !== null) return `${formatWeight(set.weightKg, unit)} × ${set.reps}`;
  if (set.reps !== null) return t.n(set.reps, "{n} rep", "{n} reps");
  if (set.weightKg !== null) return formatWeight(set.weightKg, unit);
  return "";
}

/**
 * The running workout: the exercise and set the lifter is on (with its weight and reps) on the
 * left, the clock and sets done on the right, and the share of sets done as a hairline along the
 * bottom edge, like the rest countdown. A tap opens it into shortcuts (pause or resume, tick the
 * set, add a set, go to the exercise), so the common moves need no trip back to the logger.
 */
function CompactCapsule({ session, onWorkoutPage }: { session: WorkoutSession; onWorkoutPage: boolean }) {
  const t = useT();
  const now = useNow(1000);
  const { byId } = useAllExercises();
  const unit = useSettingsStore((st) => st.weightUnit);
  const store = useWorkoutStore.getState;
  // Open on the page it was opened on: moving to another page folds it away.
  const pathname = usePagePath();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (o: boolean) => setOpenOn(o ? pathname : null);
  const root = useRef<HTMLDivElement>(null);
  const elapsed = formatDuration(sessionDurationSec(session, now));
  const paused = session.pausedAt !== undefined;
  const live = liveSet(session);
  const { done, total } = setProgress(session);

  // A tap outside or Escape folds it too.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpenOn(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const headline = live
    ? (byId[live.exercise.exerciseId]?.name ?? t("Unknown exercise"))
    : total === 0
      ? t("No exercises yet")
      : t("All sets done");
  const target = live ? targetText(live.set, unit, t) : "";
  const detail = live
    ? [
        live.number === null ? t("Warm-up") : t("Set {n} of {of}", { n: live.number, of: live.of }),
        // Nothing typed for this set yet: what the set before it was, as the number to beat.
        target || (live.last ? t("last {set}", { set: targetText(live.last, unit, t) }) : ""),
      ]
        .filter(Boolean)
        .join(" · ")
    : total === 0
      ? t("Add an exercise to start")
      : t("Finish to save it");
  const status = paused ? t("Workout paused, {time}", { time: elapsed }) : t("Workout running, {time}", { time: elapsed });

  // Ticking from here uses what the bar shows: this set's numbers, or the set before it when empty.
  const reps = live ? (live.set.reps ?? live.last?.reps ?? null) : null;
  const canTick = reps !== null && reps > 0;
  const lastExercise = session.exercises[session.exercises.length - 1];
  const addTo = live?.exercise ?? lastExercise;

  function tick() {
    if (!live || !canTick) return;
    if (live.set.reps === null) store().updateSet(live.exercise.id, live.set.id, { reps, weightKg: live.set.weightKg ?? live.last?.weightKg ?? null });
    feedback.setComplete();
    store().completeSet(live.exercise.id, live.set.id, true);
    setOpen(false);
  }

  const fraction = total > 0 ? done / total : 0;
  return (
    <motion.div
      ref={root}
      layoutId="island"
      transition={ISLAND_SPRING}
      className={`${capsule} w-full flex-col items-stretch ${open ? "!rounded-[28px]" : "h-14 rounded-[28px]"}`}
    >
      <LiveWave paused={paused} beat={`${done}:${paused}`} />
      <button
        type="button"
        onClick={() => {
          feedback.tick();
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-controls="island-shortcuts"
        aria-label={`${status}. ${headline}, ${detail}`}
        className="relative flex h-14 w-full shrink-0 items-center text-left hover:bg-ink/[0.06]"
      >
        <motion.span {...fade} className="flex min-w-0 flex-1 items-center gap-3 pl-5 pr-5">
          <span className="flex min-w-0 flex-1 flex-col items-start" aria-hidden="true">
            <span className="label-caps max-w-full truncate">{detail}</span>
            <span className="max-w-full truncate text-sm font-semibold">{headline}</span>
          </span>
          <span className="flex shrink-0 flex-col items-end" aria-hidden="true">
            <span className="flex items-center gap-1.5">
              {paused ? <Pause size={11} className="text-accent" /> : <span className="size-1.5 rounded-full bg-accent" />}
              <span className="num text-[15px] font-bold">{elapsed}</span>
            </span>
            {(paused || total > 0) && (
              <span className="num text-[11px] text-text-muted">{paused ? t("Paused") : t("{done}/{total} sets", { done, total })}</span>
            )}
          </span>
        </motion.span>
      </button>
      {open && (
        <motion.div
          id="island-shortcuts"
          role="group"
          aria-label={t("Workout shortcuts")}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, delay: 0.08 }}
          className="relative grid grid-cols-4 gap-1.5 px-3 pb-3"
        >
          <Shortcut
            label={paused ? t("Resume") : t("Pause")}
            onClick={() => {
              feedback.tick();
              if (paused) store().resumeActive();
              else store().pauseActive();
            }}
            icon={paused ? <Play size={18} className="fill-current" /> : <Pause size={18} />}
          />
          <Shortcut label={t("Done set")} onClick={tick} disabled={!canTick} accent icon={<Check size={18} strokeWidth={3} />} />
          <Shortcut
            label={t("Add set")}
            onClick={() => {
              if (!addTo) return;
              feedback.tick();
              store().addSet(addTo.id);
            }}
            disabled={!addTo}
            icon={<Plus size={18} />}
          />
          {onWorkoutPage ? (
            <Shortcut
              label={t("Go to it")}
              onClick={() => {
                if (live) scrollToExercise(live.exercise.id);
                setOpen(false);
              }}
              disabled={!live}
              icon={<Crosshair size={18} />}
            />
          ) : (
            <Link
              href="/workout"
              aria-label={t("Open the workout in progress")}
              className="tap flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl bg-ink/[0.06] text-[11px] font-semibold text-text hover:bg-ink/10"
            >
              <ArrowUpRight aria-hidden="true" size={18} />
              {t("Open")}
            </Link>
          )}
        </motion.div>
      )}
      <div className="absolute inset-x-6 bottom-0 h-px bg-ink/10" aria-hidden="true">
        <div className="h-full bg-accent transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${fraction * 100}%` }} />
      </div>
    </motion.div>
  );
}

/**
 * A filled wave across 0..400 (two bar widths) with whole periods, so sliding by half loops
 * cleanly: the crest runs along y = 8 +/- amp and the shape is filled down to the bottom (y = 40).
 */
function wavePath(period: number, amp: number): string {
  let d = "";
  for (let x = 0; x <= 400; x += 4) d += `${x === 0 ? "M" : "L"}${x} ${(14 + amp * Math.sin((2 * Math.PI * x) / period)).toFixed(2)}`;
  return `${d} L400 40 L0 40 Z`;
}

/** Three filled swells: a Volt back wave, a brighter Volt front wave the other way, a light crest. */
const WAVES = [
  { d: wavePath(200, 9), color: "var(--color-accent)", opacity: 0.16, run: "6s", breathe: "2.6s", reverse: true },
  { d: wavePath(100, 7), color: "var(--color-accent)", opacity: 0.26, run: "3.8s", breathe: "1.9s", reverse: false },
  { d: wavePath(400 / 6, 4), color: "#ffffff", opacity: 0.07, run: "2.8s", breathe: "3.2s", reverse: false },
];

/** How long the wave moves after something happens, before it holds still. */
const WAVE_MOVES_MS = 4000;

/**
 * The running bar's wave: solid swells along its bottom edge that rise and fall for a few
 * seconds whenever the workout moves on (a set ticked, a start, a resume), then hold still, and
 * sink to a thin floor when it is paused. A wave that never stopped kept the screen redrawing
 * for the whole workout, which cost real battery.
 */
function LiveWave({ paused, beat }: { paused: boolean; beat: string }) {
  const active = useAppActive();
  const [movingFor, setMovingFor] = useState<string | null>(null);
  useEffect(() => {
    if (!active) return;
    // A new beat (or coming back to the app) starts a few seconds of movement.
    const start = setTimeout(() => setMovingFor(beat), 0);
    const stop = setTimeout(() => setMovingFor(null), WAVE_MOVES_MS);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [beat, active]);
  const still = movingFor !== beat;
  return (
    <span
      aria-hidden="true"
      data-paused={paused || undefined}
      data-still={still || undefined}
      className="live-wave pointer-events-none absolute inset-x-0 top-5 h-9 overflow-hidden"
    >
      {WAVES.map((w, i) => (
        <span
          key={i}
          className="live-wave-amp absolute inset-0"
          style={{ "--breathe": w.breathe, animationDelay: `${-i * 0.7}s` } as React.CSSProperties}
        >
          <svg
            viewBox="0 0 400 40"
            preserveAspectRatio="none"
            className="live-wave-line absolute top-0 left-0 h-full w-[200%]"
            style={{ "--run": w.run, animationDirection: w.reverse ? "reverse" : "normal" } as React.CSSProperties}
          >
            <path d={w.d} fill={w.color} fillOpacity={w.opacity} />
          </svg>
        </span>
      ))}
    </span>
  );
}

/** One shortcut in the opened bar: an icon over a short label, a full 56 px tall target. */
function Shortcut({ label, icon, onClick, disabled, accent }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`tap flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold disabled:opacity-35 ${
        accent ? "bg-accent text-on-accent hover:brightness-110" : "bg-ink/[0.06] text-text hover:bg-ink/10"
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}

/** The handoff still points at a superset exercise whose set is not done yet. */
function liveHandoff(session: WorkoutSession, h: SupersetHandoff): boolean {
  const ex = session.exercises.find((e) => e.id === h.sessionExerciseId);
  return !!ex && !!supersetLabels(session.exercises)[ex.id] && ex.sets[h.setIndex]?.completed === false;
}

/** Mid-superset: where to go next, with no rest. Tapping brings that card into view. */
function HandoffCapsule({ session, handoff, onWorkoutPage }: { session: WorkoutSession; handoff: SupersetHandoff; onWorkoutPage: boolean }) {
  const t = useT();
  const { byId } = useAllExercises();
  const ex = session.exercises.find((e) => e.id === handoff.sessionExerciseId)!;
  const label = supersetLabels(session.exercises)[ex.id]!;
  const name = byId[ex.exerciseId]?.name ?? t("Unknown exercise");
  const n = setNumbers(ex.sets)[handoff.setIndex];
  const setText = n === null || n === undefined ? t("Warm-up") : t("Set {n}", { n });
  const aria = t("Next: {name}, {set}, no rest", { name, set: setText });
  const body = (
    <motion.span {...fade} className="flex min-w-0 flex-1 items-center gap-3 pl-5 pr-5">
      <Zap aria-hidden="true" size={18} className="shrink-0 fill-accent text-accent" />
      <span className="flex min-w-0 flex-col items-start" aria-hidden="true">
        <span className="label-caps">
          {t("Up next")} <span className="num">{`${label.letter}${label.order}`}</span> · {t("No rest")}
        </span>
        <span className="flex w-full min-w-0 items-baseline gap-2 text-sm font-semibold">
          <span className="truncate">{name}</span>
          <span className="num shrink-0 text-accent">{setText}</span>
        </span>
      </span>
    </motion.span>
  );
  return (
    <motion.div layoutId="island" transition={ISLAND_SPRING} className={`${capsule} h-14 w-full rounded-[28px]`}>
      <span role="status" className="sr-only">
        {aria}
      </span>
      {onWorkoutPage ? (
        <button
          type="button"
          onClick={() => scrollToExercise(ex.id)}
          aria-label={aria}
          className="flex h-full w-full items-center text-left hover:bg-ink/[0.06]"
        >
          {body}
        </button>
      ) : (
        <Link href="/workout" aria-label={aria} className="flex h-full w-full items-center hover:bg-ink/[0.06]">
          {body}
        </Link>
      )}
    </motion.div>
  );
}

function RestCapsule() {
  const t = useT();
  const timer = useWorkoutStore((s) => s.restTimer);
  const adjust = useWorkoutStore((s) => s.adjustRest);
  const skip = useWorkoutStore((s) => s.skipRest);
  const alert = useSettingsStore((s) => s.restTimerAlert);
  // Whole seconds are all the label shows, so one render a second. The zero is caught by its own
  // timeout below, not by polling.
  const now = useNow(1000, timer !== null);
  const [, setZeroTick] = useState(0);
  const firedFor = useRef<number | null>(null);

  const remainingMs = timer ? Math.max(0, timer.endsAt - now) : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const endsAt = timer?.endsAt;
  const totalSec = timer?.totalSec ?? 0;

  // 3, 2, 1: one pip per second, so the lifter can get under the bar before zero. Scheduled once
  // per rest, at those instants, and a render exactly at zero.
  useEffect(() => {
    if (endsAt === undefined) return;
    const ids: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => {
      const wait = endsAt - ms - Date.now();
      if (wait >= 0) ids.push(setTimeout(fn, wait));
    };
    if (alert && totalSec >= 10) for (const ms of [3000, 2000, 1000]) at(ms, () => isAppActive() && feedback.restCountdown());
    at(0, () => setZeroTick((n) => n + 1));
    return () => ids.forEach(clearTimeout);
  }, [endsAt, totalSec, alert]);

  useEffect(() => {
    if (!timer) {
      firedFor.current = null;
      return;
    }
    if (remainingMs > 0 || firedFor.current === timer.endsAt) return;
    firedFor.current = timer.endsAt;
    if (pageRingsRestOver({ alert, native: isNativeApp(), visible: isAppActive() && document.visibilityState === "visible", overdueMs: Date.now() - timer.endsAt })) feedback.restZero();
    // Hold "Go" for a moment so the lifter sees rest is over, then fold back to compact.
    const id = setTimeout(skip, 2500);
    return () => clearTimeout(id);
  }, [timer, remainingMs, alert, skip]);

  if (!timer) return null;
  const done = remainingMs === 0;

  return (
    <motion.div
      layoutId="island"
      transition={ISLAND_SPRING}
      role="timer"
      aria-live={done ? "assertive" : "off"}
      aria-label={done ? t("Rest finished") : t("Rest, {time} left", { time: formatClock(remainingSec) })}
      className={`${capsule} relative h-14 w-full rounded-[28px]`}
    >
      <motion.div {...fade} className="flex w-full items-center gap-1 pl-5 pr-1.5">
        <div className="flex min-w-0 flex-1 items-baseline gap-2" aria-hidden="true">
          <span className="label-caps">{done ? t("Rest over") : t("Rest")}</span>
          <span className="num text-xl font-extrabold text-accent">{done ? t("Go") : formatClock(remainingSec)}</span>
        </div>
        {/* The step is written on the buttons, so it is clear how much each tap changes. */}
        <IslandButton label={t("Shorten rest by 15 seconds")} onClick={() => {
            feedback.tick();
            adjust(-15);
          }} disabled={done} wide>
          <span aria-hidden="true" className="num text-sm font-semibold">
            −15s
          </span>
        </IslandButton>
        <IslandButton label={t("Extend rest by 15 seconds")} onClick={() => {
            feedback.tick();
            adjust(15);
          }} disabled={done} wide>
          <span aria-hidden="true" className="num text-sm font-semibold">
            +15s
          </span>
        </IslandButton>
        <IslandButton label={t("Skip rest")} onClick={skip}>
          <X aria-hidden="true" size={18} />
        </IslandButton>
      </motion.div>
      {/* Time left as a hairline along the bottom edge: the one moving part while you rest. */}
      <div className="absolute inset-x-6 bottom-0 h-px bg-ink/10" aria-hidden="true">
        {/* One compositor animation per rest (and per +/-15 s): no renders while it runs. */}
        <RestBar key={timer.endsAt} endsAt={timer.endsAt} totalSec={timer.totalSec} />
      </div>
    </motion.div>
  );
}

function RestBar({ endsAt, totalSec }: { endsAt: number; totalSec: number }) {
  // The start point is read once, when this rest (or this adjustment) begins.
  const [start] = useState(() => {
    const left = Math.max(0, endsAt - Date.now());
    return { left, from: totalSec > 0 ? Math.min(1, left / (totalSec * 1000)) : 0 };
  });
  return (
    <div
      className="h-full origin-left bg-accent motion-reduce:!animate-none"
      style={
        {
          "--from": start.from,
          transform: `scaleX(${start.from})`,
          animation: start.left > 0 ? `rest-bar ${start.left}ms linear forwards` : "none",
        } as React.CSSProperties
      }
    />
  );
}

function IslandButton({
  label,
  onClick,
  disabled,
  wide,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Room for a short text label instead of an icon. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex h-11 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-ink/10 hover:text-text active:bg-ink/15 disabled:opacity-40 ${
        wide ? "min-w-11 px-2" : "w-11"
      }`}
    >
      {children}
    </button>
  );
}
