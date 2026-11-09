"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { LayoutGroup, MotionConfig, motion } from "framer-motion";
import { Pause, X, Zap } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useHydration } from "@/store/hydration";
import { useNow } from "@/lib/useNow";
import { formatClock, formatDuration, sessionDurationSec } from "@/lib/calc";
import { useLiveWorkoutNotification } from "@/lib/notifications/useLiveWorkoutNotification";
import type { WorkoutSession } from "@/types/workout";
import { usePagePath } from "@/components/layout/usePagePath";
import { feedback } from "@/lib/feedback";
import { isNativeApp } from "@/lib/native/files";
import { notificationPermission } from "@/lib/notifications/reminder-service";
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
 * A black capsule that sits just above the dock, where the thumb already is. Compact while a
 * workout runs (elapsed time, tap to return to it); it morphs open into the rest countdown with
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
  // The intro and sign-in have no dock, so there is nothing to sit above.
  const shown = hydrated && active !== null && pathname !== "/onboarding" && pathname !== "/login" && pathname !== "/permissions" && !pathname.startsWith("/workout/summary");

  // Pages pad their bottom by this much more, so the bar never covers the last row.
  useEffect(() => {
    document.documentElement.style.setProperty("--live-bar", shown ? (timer || handoff ? "72px" : "52px") : "0px");
    return () => document.documentElement.style.setProperty("--live-bar", "0px");
  }, [shown, timer, handoff]);

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

const capsule =
  "force-dark pointer-events-auto flex items-center overflow-hidden rounded-full border border-accent/25 bg-black text-text shadow-[0_0_14px_rgb(204_255_0/0.14)]";

function CompactCapsule({ session, onWorkoutPage }: { session: WorkoutSession; onWorkoutPage: boolean }) {
  const t = useT();
  const now = useNow(1000);
  const elapsed = formatDuration(sessionDurationSec(session, now));
  const paused = session.pausedAt !== undefined;
  const body = (
    <motion.span {...fade} className="flex items-center gap-2 px-4">
      {paused ? (
        <Pause aria-hidden="true" size={12} className="text-accent" />
      ) : (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
      )}
      <span className="num text-[13px] font-semibold" aria-hidden="true">
        {elapsed}
      </span>
      {paused && (
        <span className="text-[11px] font-semibold text-text-muted" aria-hidden="true">
          {t("Paused")}
        </span>
      )}
    </motion.span>
  );
  return (
    <motion.div layoutId="island" transition={ISLAND_SPRING} className={`${capsule} h-9`}>
      {onWorkoutPage ? (
        <span className="flex h-full items-center" role="status" aria-label={paused ? t("Workout paused, {time}", { time: elapsed }) : t("Workout running, {time}", { time: elapsed })}>
          {body}
        </span>
      ) : (
        <Link
          href="/workout"
          aria-label={t("Open the workout in progress")}
          className="flex h-full items-center hover:bg-ink/[0.06]"
        >
          {body}
        </Link>
      )}
    </motion.div>
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
  const now = useNow(250, timer !== null);
  const firedFor = useRef<number | null>(null);

  const remainingMs = timer ? Math.max(0, timer.endsAt - now) : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const fraction = timer ? remainingMs / (timer.totalSec * 1000) : 0;

  useEffect(() => {
    if (!timer) {
      firedFor.current = null;
      return;
    }
    if (remainingMs > 0 || firedFor.current === timer.endsAt) return;
    firedFor.current = timer.endsAt;
    // In the app with notifications on, Android's rest-over alert already rings and buzzes.
    const systemRings = isNativeApp() && notificationPermission() === "granted";
    if (alert && !systemRings) feedback.restZero();
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
        <div
          className="h-full bg-accent transition-[width] duration-250 ease-linear motion-reduce:transition-none"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </motion.div>
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
