"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, MotionConfig, motion } from "framer-motion";
import { Minus, Plus, X } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useHydration } from "@/store/hydration";
import { useNow } from "@/lib/useNow";
import { formatClock, formatDuration, sessionDurationSec } from "@/lib/calc";
import type { WorkoutSession } from "@/types/workout";

/** Fast to settle, a little overshoot: the capsule should feel like hardware snapping open. */
const ISLAND_SPRING = { type: "spring", stiffness: 520, damping: 38, mass: 0.9 } as const;
/** Content fades in after the shape starts moving, so text never stretches with the capsule. */
const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.14, delay: 0.06 } };

/**
 * A black capsule pinned under the status bar, centred where a phone's punch-hole camera sits.
 * Compact while a workout runs (elapsed time, tap to return to it); it morphs open into the rest
 * countdown with its controls, then shows "Go" when rest is over. One layoutId, so the change is
 * a single shape stretching, not one box swapped for another.
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
  const pathname = usePathname();
  if (!hydrated || !active) return null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="pointer-events-none sticky top-0 z-30 flex justify-center px-4 pt-[max(8px,env(safe-area-inset-top))]">
        <LayoutGroup>
          {timer ? (
            <RestCapsule key="rest" />
          ) : (
            <CompactCapsule key="compact" session={active} onWorkoutPage={pathname === "/workout"} />
          )}
        </LayoutGroup>
      </div>
    </MotionConfig>
  );
}

const capsule =
  "pointer-events-auto flex items-center overflow-hidden rounded-full border border-accent/25 bg-black text-text shadow-[0_0_14px_rgb(204_255_0/0.14)]";

function CompactCapsule({ session, onWorkoutPage }: { session: WorkoutSession; onWorkoutPage: boolean }) {
  const now = useNow(1000);
  const elapsed = formatDuration(sessionDurationSec(session, now));
  const body = (
    <motion.span {...fade} className="flex items-center gap-2 px-4">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
      <span className="num text-[13px] font-semibold" aria-hidden="true">
        {elapsed}
      </span>
    </motion.span>
  );
  return (
    <motion.div layoutId="island" transition={ISLAND_SPRING} className={`${capsule} h-9`}>
      {onWorkoutPage ? (
        <span className="flex h-full items-center" role="status" aria-label={`Workout running, ${elapsed}`}>
          {body}
        </span>
      ) : (
        <Link
          href="/workout"
          aria-label="Open the workout in progress"
          className="flex h-full items-center hover:bg-white/[0.06]"
        >
          {body}
        </Link>
      )}
    </motion.div>
  );
}

function RestCapsule() {
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
    if (alert) {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([200, 100, 200]);
      beep();
    }
    // Hold "Go" for a moment so the lifter sees rest is over, then fold back to compact.
    const t = setTimeout(skip, 2500);
    return () => clearTimeout(t);
  }, [timer, remainingMs, alert, skip]);

  if (!timer) return null;
  const done = remainingMs === 0;

  return (
    <motion.div
      layoutId="island"
      transition={ISLAND_SPRING}
      role="timer"
      aria-live={done ? "assertive" : "off"}
      aria-label={done ? "Rest finished" : `Rest, ${formatClock(remainingSec)} left`}
      className={`${capsule} relative h-14 w-full max-w-[420px] rounded-[28px]`}
    >
      <motion.div {...fade} className="flex w-full items-center gap-1 pl-5 pr-1.5">
        <div className="flex min-w-0 flex-1 items-baseline gap-2" aria-hidden="true">
          <span className="label-caps">{done ? "Rest over" : "Rest"}</span>
          <span className="num text-xl font-extrabold text-accent">{done ? "Go" : formatClock(remainingSec)}</span>
        </div>
        <IslandButton label="Shorten rest by 15 seconds" onClick={() => adjust(-15)} disabled={done}>
          <Minus aria-hidden="true" size={18} />
        </IslandButton>
        <IslandButton label="Extend rest by 15 seconds" onClick={() => adjust(15)} disabled={done}>
          <Plus aria-hidden="true" size={18} />
        </IslandButton>
        <IslandButton label="Skip rest" onClick={skip}>
          <X aria-hidden="true" size={18} />
        </IslandButton>
      </motion.div>
      {/* Time left as a hairline along the bottom edge: the one moving part while you rest. */}
      <div className="absolute inset-x-6 bottom-0 h-px bg-white/10" aria-hidden="true">
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
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-white/10 hover:text-text active:bg-white/15 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

let audioCtx: AudioContext | null = null;
function beep() {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    const play = (at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.3, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.2);
    };
    play(ctx.currentTime);
    play(ctx.currentTime + 0.25);
  } catch {
    // Audio is a convenience; a blocked AudioContext is not an error worth surfacing.
  }
}
