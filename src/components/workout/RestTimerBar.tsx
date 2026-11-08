"use client";

import { useEffect, useRef } from "react";
import { Minus, Plus, X } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useNow } from "@/lib/useNow";
import { formatClock } from "@/lib/calc";

/**
 * Sticky countdown under the header. The bar's width is the information (time left),
 * so it is the one piece of motion on the screen; it stops under reduced-motion since
 * the number next to it carries the same fact.
 */
export function RestTimerBar() {
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
    // Leave the "0:00" bar up for a moment so the lifter sees it finished, then clear.
    const t = setTimeout(skip, 2500);
    return () => clearTimeout(t);
  }, [timer, remainingMs, alert, skip]);

  if (!timer) return null;
  const done = remainingMs === 0;

  return (
    <div
      role="timer"
      aria-live={done ? "assertive" : "off"}
      aria-label={done ? "Rest finished" : `Rest, ${formatClock(remainingSec)} left`}
      className="sticky top-0 z-10 border-b border-line bg-bg"
    >
      <div className="relative flex items-center gap-2 px-3 py-2">
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-surface-2" aria-hidden="true">
          <div
            className="h-full bg-accent transition-[width] duration-250 ease-linear motion-reduce:transition-none"
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
        <span className="w-16 text-lg font-bold tabular-nums" aria-hidden="true">
          {done ? "Go" : formatClock(remainingSec)}
        </span>
        <span className="flex-1 text-xs text-text-muted" aria-hidden="true">
          {done ? "Rest finished" : "Resting"}
        </span>
        <button
          type="button"
          onClick={() => adjust(-15)}
          aria-label="Shorten rest by 15 seconds"
          className="flex size-11 items-center justify-center rounded-ctl border border-line-strong bg-surface-2 text-text hover:bg-[#303035]"
          disabled={done}
        >
          <Minus aria-hidden="true" size={18} />
        </button>
        <button
          type="button"
          onClick={() => adjust(15)}
          aria-label="Extend rest by 15 seconds"
          className="flex size-11 items-center justify-center rounded-ctl border border-line-strong bg-surface-2 text-text hover:bg-[#303035]"
          disabled={done}
        >
          <Plus aria-hidden="true" size={18} />
        </button>
        <button
          type="button"
          onClick={skip}
          aria-label="Skip rest"
          className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface-2 hover:text-text"
        >
          <X aria-hidden="true" size={20} />
        </button>
      </div>
    </div>
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
