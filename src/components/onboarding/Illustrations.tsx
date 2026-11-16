"use client";

import { useEffect, useState, type ReactNode } from "react";
import { m as motion, useReducedMotionConfig } from "framer-motion";
import { Check, ClipboardList, CloudCheck, DumbbellLarge, Home, Search, Trophy, WifiOff } from "@/components/icons";
import { AbotMark } from "@/components/brand/AbotMark";
import { useT } from "@/i18n";

/*
 * The intro's illustrations, built from the app's own surfaces (the raised set row, the sunk
 * fields, the liquid-glass dock with its notch and the green button, the rest capsule, the Volt
 * week card) at their real size, so they look like ABOT today and follow it when those classes
 * change. Inside a phone they are laid out on a 390-wide screen and scaled down. They are
 * decorative: each slide's heading and text carry the meaning. Reduced motion shows the end state.
 */

const SPRING = { type: "spring", stiffness: 300, damping: 24 } as const;
/** The screen width the phone scenes are laid out at, as on a common phone. */
const SCREEN_W = 390;
/** How many times a scene acts itself out before it rests on its last frame (battery). */
const ROUNDS = 4;

/**
 * A step counter for a scene's little story: `steps` frames of `ms` each, played `ROUNDS` times,
 * then held on the last frame. Reduced motion holds the last frame from the start.
 */
function useStory(steps: number, ms: number): number {
  const reduce = useReducedMotionConfig();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const timer = setInterval(() => {
      setTick((n) => {
        if (n >= steps * ROUNDS - 1) {
          clearInterval(timer);
          return n;
        }
        return n + 1;
      });
    }, ms);
    return () => clearInterval(timer);
  }, [reduce, steps, ms]);
  return reduce ? steps - 1 : tick % steps;
}

/**
 * A phone in the app's raised material: a thin bezel round a screen, the scene laid out at
 * SCREEN_W and scaled to fit. `from` pins the scene to the top or the bottom of the screen.
 */
function Phone({ children, width = 212, height = 292, from = "top" }: { children: ReactNode; width?: number; height?: number; from?: "top" | "bottom" }) {
  const bezel = 6;
  const scale = (width - bezel * 2) / SCREEN_W;
  return (
    <div className="raised-card relative shrink-0 rounded-[34px] bg-surface" style={{ width, height, padding: bezel }}>
      <div className="relative size-full overflow-hidden rounded-[28px] bg-bg">
        <div
          className={`absolute left-0 ${from === "top" ? "top-0 origin-top-left" : "bottom-0 origin-bottom-left"}`}
          style={{ width: SCREEN_W, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** One set row as the logger draws it: set number, last time, kg and reps fields, the check. */
function SetRow({ n, last, kg, reps, done, record, pressing }: { n: number; last: string; kg: string; reps: string; done?: boolean; record?: boolean; pressing?: boolean }) {
  return (
    <div
      className={`relative grid grid-cols-[40px_1fr_64px_48px_44px] items-center gap-1.5 overflow-hidden rounded-xl border px-1 py-1 transition-colors duration-200 ${
        done ? "border-accent/25 bg-accent/[0.06]" : "border-ink/[0.04]"
      }`}
    >
      <span className={`tile num flex size-9 items-center justify-center rounded-lg text-sm font-bold ${done ? "text-accent" : ""}`}>{n}</span>
      {record ? (
        <motion.span
          className="num inline-flex items-center gap-1 text-[11px] font-bold text-pr"
          initial={{ opacity: 0, y: 6, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={SPRING}
        >
          <Trophy size={12} /> PR
        </motion.span>
      ) : (
        <span className="num truncate text-[11px] text-text-muted">{last}</span>
      )}
      <span className="sunk num flex h-11 items-center justify-center rounded-ctl bg-bg text-lg font-bold">{kg}</span>
      <span className="sunk num flex h-11 items-center justify-center rounded-ctl bg-bg text-lg font-bold">{reps}</span>
      <motion.span
        className={`flex size-11 items-center justify-center rounded-xl border transition-colors duration-150 ${
          done ? "border-accent bg-accent text-on-accent" : "raised text-text-muted"
        }`}
        animate={{ scale: pressing ? 0.86 : 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 20 }}
      >
        <Check size={22} variant="linear" />
      </motion.span>
      {/* The band of light that crosses a row as its set is ticked. */}
      {done && (
        <motion.span
          className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-transparent via-accent/25 to-transparent"
          initial={{ x: -90 }}
          animate={{ x: 380 }}
          transition={{ duration: 0.65, ease: [0.2, 0.7, 0.2, 1] }}
        />
      )}
    </div>
  );
}

/**
 * Slide 1: the exercise card from the logger. A fingertip taps the check on set 2, the row
 * lights and a record pops in gold where last time's numbers were.
 */
export function LogSetScene() {
  const t = useT();
  // 0 idle, 1 the finger arrives, 2 it presses: done, 3-4 the record shows.
  const step = useStory(5, 650);
  const done = step >= 2;
  return (
    <div aria-hidden="true" className="raised-card relative w-full max-w-[340px] rounded-card bg-surface p-3">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="tile flex size-10 items-center justify-center rounded-xl text-accent">
          <DumbbellLarge size={20} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">Bench Press</span>
          <span className="block text-xs text-text-muted">{t("Chest")}</span>
        </span>
      </div>
      <div className="mb-1 grid grid-cols-[40px_1fr_64px_48px_44px] gap-1.5 px-1 text-[11px] text-text-muted">
        <span className="text-center">{t("Set")}</span>
        <span>{t("Last time")}</span>
        <span className="text-center">kg</span>
        <span className="text-center">{t("Reps")}</span>
        <span />
      </div>
      <div className="flex flex-col gap-1.5">
        <SetRow n={1} last="80 × 8" kg="80" reps="8" done />
        <SetRow n={2} last="80 × 8" kg="82.5" reps="8" done={done} record={step >= 3} pressing={step === 2} />
        <div className="opacity-50">
          <SetRow n={3} last="80 × 7" kg="82.5" reps="8" />
        </div>
      </div>
      {/* A fingertip: comes in from below, presses the check, leaves. */}
      <motion.span
        className="pointer-events-none absolute size-10 rounded-full border-2 border-ink/70 bg-ink/15"
        style={{ right: 14, top: 112 }}
        animate={
          step === 1 || step === 2
            ? { x: 0, y: 0, opacity: 1, scale: step === 2 ? 0.82 : 1 }
            : { x: 40, y: 70, opacity: 0, scale: 1 }
        }
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      />
    </div>
  );
}

/** The dock as the app draws it: liquid glass with a notch, the green button in it, four tabs. */
function MiniDock({ lit }: { lit: number }) {
  const t = useT();
  const tabs = [
    { label: t("Home"), Icon: Home },
    { label: t("Workout"), Icon: ClipboardList },
    { label: t("Exercises"), Icon: Search },
    { label: t("Profile"), Icon: null },
  ];
  return (
    <div className="relative px-3 pb-3">
      <span className="today-fab absolute left-1/2 top-0 z-10 flex size-[60px] -translate-x-1/2 -translate-y-[18px] items-center justify-center rounded-full">
        <DumbbellLarge size={30} variant="bold" />
      </span>
      {/* The intro is always dark, so its dock is the dark glass even when the phone is in light mode. */}
      <ul
        className="liquid-glass dock-notch relative flex rounded-2xl p-1"
        style={{ background: "color-mix(in oklab, #09090b 55%, transparent)", borderColor: "rgb(255 255 255 / 0.13)", boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.24), 0 14px 40px rgb(0 0 0 / 0.45)" }}
      >
        {tabs.map(({ label, Icon }, i) => (
          <li key={i} className={`relative min-w-0 flex-1 ${i === 2 ? "ml-[72px]" : ""}`}>
            {i === lit && <span className="glass-lens absolute inset-0 rounded-xl" style={{ background: "rgb(255 255 255 / 0.1)" }} />}
            <span className={`relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium ${i === lit ? "text-text" : "text-text-muted"}`}>
              {Icon ? (
                <Icon size={22} variant={i === lit ? "bold" : "linear"} className={i === lit ? "text-accent" : ""} />
              ) : (
                <span className="size-[22px] rounded-full border-2 border-current opacity-60" />
              )}
              <span className="truncate">{label}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Slide 2: the bottom of the workout screen. A set is ticked, the rest capsule rises above the
 * dock and counts down, inside the thumb's reach.
 */
export function RestScene() {
  const t = useT();
  const reduce = useReducedMotionConfig();
  // Counts 1:30 down a second at a time for a while, then holds.
  const step = useStory(14, 1000);
  const left = 90 - step;
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <div aria-hidden="true" className="relative">
      {/* The thumb's comfortable arc, drawn from the lower corner of the phone. */}
      <svg className="pointer-events-none absolute -bottom-2 -right-12 z-10 h-40 w-44 overflow-visible" viewBox="0 0 176 160" fill="none">
        <motion.path
          d="M170 158 C 150 80, 80 40, 8 64"
          stroke="currentColor"
          className="text-accent"
          strokeOpacity={0.7}
          strokeWidth={1.5}
          strokeDasharray="4 6"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, delay: 0.4, ease: "easeOut" }}
        />
      </svg>
      <Phone from="bottom" height={256}>
        <div className="flex items-center gap-3 px-4 pb-3">
          <span className="tile flex size-12 items-center justify-center rounded-xl text-accent">
            <DumbbellLarge size={24} />
          </span>
          <span className="text-xl font-bold">Bench Press</span>
        </div>
        <div className="flex flex-col gap-1.5 px-3 pb-4">
          <SetRow n={2} last="80 × 8" kg="82.5" reps="8" done />
          <SetRow n={3} last="80 × 7" kg="82.5" reps="8" />
          <SetRow n={4} last="80 × 6" kg="82.5" reps="8" />
        </div>
        <motion.div
          className="glass-capsule relative mx-3 mb-6 flex h-16 items-center gap-3 overflow-hidden rounded-full border border-accent/25 px-6 text-text"
          initial={reduce ? false : { y: 40, opacity: 0, scale: 0.92 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ ...SPRING, delay: 0.5 }}
        >
          <span className="text-base text-text-muted">{t("Rest")}</span>
          <span className="num text-[28px] font-bold text-accent">{clock}</span>
          <span className="num ml-auto flex gap-5 text-base font-semibold text-text-muted">
            <span>−15s</span>
            <span>+15s</span>
          </span>
          <span className="absolute inset-x-6 bottom-0 h-[3px] rounded-full bg-ink/10">
            <motion.span className="block h-full origin-left rounded-full bg-accent" animate={{ scaleX: left / 90 }} transition={{ duration: 1, ease: "linear" }} />
          </span>
        </motion.div>
        <MiniDock lit={1} />
      </Phone>
    </div>
  );
}

/**
 * Slide 3: Home on a phone with no signal. The week card and the day's card are all there
 * offline; then a backup lands, as it can whenever the lifter wants one.
 */
export function DeviceScene() {
  const t = useT();
  // 0-1 Home shows, 2 the offline badge, 3-5 the backup chip.
  const step = useStory(6, 700);
  return (
    <div aria-hidden="true" className="relative">
      <Phone>
        <div className="flex items-center justify-center px-4 pb-4 pt-6 text-accent">
          <AbotMark size={30} />
        </div>
        <div className="px-4">
          {/* Home's wallet stack: the Volt week card behind, the day's card over its lower edge. */}
          <div className="wallet-card grid grid-cols-2 divide-x divide-line overflow-hidden rounded-card pb-9">
            <div className="p-4">
              <p className="num text-2xl font-bold leading-tight">
                2<span className="text-sm font-semibold text-text-muted">/4</span>
              </p>
              <p className="field-label">{t("Planned")}</p>
            </div>
            <div className="p-4">
              <p className="num text-2xl font-bold leading-tight">
                12.4<span className="text-sm font-semibold text-text-muted">k</span>
              </p>
              <p className="field-label">{t("Volume")}</p>
            </div>
          </div>
          <div className="wallet-front -mt-9">
            <div className="raised-card rounded-card bg-surface p-4">
              <p className="text-xl font-bold">Push Day</p>
              <p className="mt-1 text-sm text-text-muted">Bench Press · Overhead Press · Dips</p>
              <span className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-accent text-base font-bold text-on-accent">{t("Start")}</span>
            </div>
          </div>
          <div className="mt-3 h-24 rounded-card border border-line bg-surface/60" />
        </div>
      </Phone>
      <motion.span
        className="glass-icon absolute -right-5 -top-3 flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-text"
        initial={false}
        animate={step >= 2 ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }}
        transition={SPRING}
      >
        <WifiOff size={16} /> {t("Offline")}
      </motion.span>
      <motion.span
        className="raised-card absolute -left-5 bottom-10 flex h-10 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-semibold text-text"
        initial={false}
        animate={step >= 3 ? { x: 0, opacity: 1 } : { x: -24, opacity: 0 }}
        transition={SPRING}
      >
        <CloudCheck size={16} className="text-accent" /> {t("Backed up")}
      </motion.span>
    </div>
  );
}

/**
 * The app pitch (Android web only): a locked phone with ABOT's live workout notification, the rest
 * countdown ticking and the +30s / Skip buttons, the thing a browser tab cannot do.
 */
export function AppScene() {
  const t = useT();
  const reduce = useReducedMotionConfig();
  const step = useStory(20, 1000);
  const left = 84 - step;
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div aria-hidden="true" className="relative">
      <Phone>
        <div className="flex flex-col items-center pt-14">
          <span className="num text-[76px] font-bold leading-none tracking-tight text-ink/90">07:42</span>
          <span className="mt-2 text-base text-text-muted">{t("Locked")}</span>
        </div>
        <motion.div
          className="liquid-glass mx-4 mt-10 flex flex-col gap-3 rounded-3xl p-5"
          initial={reduce ? false : { y: 40, opacity: 0, scale: 0.94 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ ...SPRING, delay: 0.35 }}
        >
          <div className="flex items-center gap-2.5">
            <span className="today-fab flex size-8 items-center justify-center rounded-[10px]">
              <DumbbellLarge size={18} variant="bold" />
            </span>
            <span className="text-base font-semibold text-text-muted">ABOT</span>
            <span className="num ml-auto text-lg font-bold text-accent">{clock}</span>
          </div>
          <span className="text-xl font-bold leading-tight">Bench Press</span>
          <span className="text-base text-text-muted">{t("Set 3 of 4 · rest")}</span>
          <span className="sunk h-2 overflow-hidden rounded-full">
            <motion.span className="block h-full origin-left rounded-full bg-accent" animate={{ scaleX: left / 84 }} transition={{ duration: 1, ease: "linear" }} />
          </span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <span className="raised rounded-xl py-3 text-center text-base font-semibold">+30s</span>
            <span className="raised rounded-xl py-3 text-center text-base font-semibold">{t("Skip")}</span>
          </div>
        </motion.div>
      </Phone>
    </div>
  );
}
