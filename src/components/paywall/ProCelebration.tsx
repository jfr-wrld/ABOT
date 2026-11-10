"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { create } from "zustand";
import { motion, useReducedMotionConfig } from "framer-motion";
import { Activity, ArrowRight, Brain, Mic, Sparkles } from "lucide-react";
import type { Unlocked } from "@/lib/celebration";
import { AbotMark } from "@/components/brand/AbotMark";
import { audioReady, unlockAudio } from "@/lib/sound-effects";
import { feedback } from "@/lib/feedback";
import { onBack } from "@/lib/native/back-stack";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useT } from "@/i18n";

export const useCelebrationStore = create<{ unlocked: Unlocked | null; show: (u: Unlocked) => void; close: () => void }>()((set) => ({
  unlocked: null,
  show: (unlocked) => set({ unlocked }),
  close: () => set({ unlocked: null }),
}));

const SPARKS = 24;
const EMBERS = 18;
const TICKS = 60;
/** The impact: everything dramatic is timed from the moment the plate lands. */
const HIT = 0.42;
const PERKS = [
  { icon: Brain, text: "Auto-overload coach" },
  { icon: Activity, text: "72h recovery inspector" },
  { icon: Mic, text: "Hands-free voice logger" },
  { icon: Sparkles, text: "Story presets, no watermark" },
] as const;

/**
 * The moment a purchase lands: the ABOT plate drops in and locks with a Volt flash and sparks,
 * then the plan, its term and what it opens. One screen, one action. With reduced motion the same
 * screen appears without the movement.
 */
export function ProCelebration() {
  const unlocked = useCelebrationStore((s) => s.unlocked);
  // Keyed, so each purchase starts from "checking" again.
  return unlocked ? <Celebration key={JSON.stringify(unlocked)} unlocked={unlocked} /> : null;
}

/**
 * "checking": is sound allowed yet? "armed": the browser blocks audio on a page nobody has tapped
 * (the return from the payment page is a fresh load), so the plate waits for one tap, which also
 * starts the sound. "playing": the animation and the sting, together.
 */
function Celebration({ unlocked }: { unlocked: Unlocked }) {
  const t = useT();
  const close = useCelebrationStore((s) => s.close);
  // Android's back closes it, like the X.
  useEffect(() => onBack(close), [close]);
  const reduce = useReducedMotionConfig();
  const button = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<"checking" | "armed" | "playing">("checking");

  useEffect(() => {
    let live = true;
    const soundOn = useSettingsStore.getState().tapFeedback;
    void (soundOn ? audioReady() : Promise.resolve(true)).then((ready) => {
      if (!live) return;
      if (ready) {
        feedback.subscribed();
        setPhase("playing");
      } else setPhase("armed");
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, close]);

  function reveal() {
    unlockAudio();
    feedback.subscribed();
    setPhase("playing");
  }

  if (phase !== "playing") {
    return (
      <div role="dialog" aria-modal="true" aria-label={titleOf(unlocked, t)} className="force-dark fixed inset-0 z-[60] bg-[#09090b] text-text">
        {phase === "armed" && (
          <button
            type="button"
            autoFocus
            onClick={reveal}
            className="flex size-full flex-col items-center justify-center gap-6 focus:outline-none"
          >
            <motion.span
              aria-hidden="true"
              className="text-[#ccff00]/80"
              animate={reduce ? undefined : { scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <AbotMark size={112} />
            </motion.span>
            <span className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-[#ccff00]">{t("Tap to unlock")}</span>
          </button>
        )}
      </div>
    );
  }

  const longDate = (iso: string) => new Date(iso).toLocaleDateString(t.locale, { day: "numeric", month: "long", year: "numeric" });
  const term =
    unlocked.kind === "upgraded"
      ? t("Your PRO is now lifetime. No end date.")
      : unlocked.tier === "lifetime"
        ? t("Lifetime license. No end date.")
        : unlocked.kind === "extended"
          ? t("BLACK PRO now runs until {date}", { date: longDate(unlocked.until) })
          : unlocked.until
            ? t("Active until {date}", { date: longDate(unlocked.until) })
            : t("Active on your account");
  const after = (s: number) => (reduce ? 0 : s);
  // Loops only run with motion allowed; with reduced motion the screen is still.
  const loop = (t: object) => (reduce ? { duration: 0 } : { repeat: Infinity, ...t });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-celebration-title"
      className="force-dark fixed inset-0 z-[60] overflow-hidden bg-[#09090b] text-text"
    >
      {/* Embers rising for as long as the screen is open. */}
      {!reduce && <Embers />}

      {/* One flash on impact (a single pulse, never a strobe). */}
      {!reduce && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 bg-[#f4ffcc]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.32, 0] }}
          transition={{ delay: HIT, duration: 0.45, times: [0, 0.15, 1] }}
        />
      )}

      {/* The whole stage shakes once with the hit. */}
      <motion.div
        className="relative flex size-full flex-col items-center justify-center px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(24px+env(safe-area-inset-top))]"
        animate={reduce ? undefined : { x: [0, -9, 8, -6, 4, -2, 0], y: [0, 6, -5, 3, -2, 0, 0] }}
        transition={{ delay: HIT, duration: 0.42 }}
      >
        {/* Breathing Volt glow behind the plate. */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[34%] size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgb(204 255 0 / 0.26), rgb(204 255 0 / 0.06) 40%, transparent 64%)" }}
          initial={{ opacity: 0, scale: reduce ? 1 : 0.3 }}
          animate={reduce ? { opacity: 1, scale: 1 } : { opacity: [0, 1, 0.75, 1], scale: [0.3, 1.1, 1, 1.06, 1] }}
          transition={reduce ? { duration: 0 } : { delay: HIT, duration: 1.2, ease: "easeOut" }}
        />
        {!reduce && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[34%] size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "radial-gradient(circle, rgb(204 255 0 / 0.12), transparent 55%)" }}
            animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ delay: 1.6, duration: 3.4, ease: "easeInOut", repeat: Infinity }}
          />
        )}

        <div className="relative flex size-56 items-center justify-center">
          {/* Charging: a ring draws itself before the plate arrives. */}
          {!reduce && (
            <svg aria-hidden="true" viewBox="0 0 200 200" className="absolute inset-0 size-full -rotate-90">
              <motion.circle
                cx="100"
                cy="100"
                r="92"
                fill="none"
                stroke="#ccff00"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0.9 }}
                animate={{ pathLength: 1, opacity: [0.9, 0.9, 0] }}
                transition={{ pathLength: { duration: HIT - 0.04, ease: "easeIn" }, opacity: { duration: HIT + 0.3, times: [0, 0.75, 1] } }}
              />
            </svg>
          )}

          {/* The dial: tick marks turning slowly, a dashed ring the other way. */}
          <motion.svg
            aria-hidden="true"
            viewBox="0 0 200 200"
            className="absolute -inset-6 size-[calc(100%+48px)] text-[#ccff00]"
            initial={{ opacity: 0, scale: reduce ? 1 : 0.7 }}
            animate={{ opacity: 1, scale: 1, rotate: reduce ? 0 : 360 }}
            transition={{ opacity: { delay: after(HIT + 0.15), duration: 0.5 }, scale: { delay: after(HIT + 0.15), duration: 0.6, ease: [0.22, 1, 0.36, 1] }, rotate: loop({ duration: 36, ease: "linear" }) }}
          >
            {Array.from({ length: TICKS }, (_, i) => (
              <line
                key={i}
                x1="100"
                y1="4"
                x2="100"
                y2={i % 5 === 0 ? 14 : 9}
                stroke="currentColor"
                strokeWidth={i % 5 === 0 ? 1.6 : 1}
                strokeOpacity={i % 5 === 0 ? 0.75 : 0.3}
                transform={`rotate(${(i * 360) / TICKS} 100 100)`}
              />
            ))}
          </motion.svg>
          <motion.svg
            aria-hidden="true"
            viewBox="0 0 200 200"
            className="absolute inset-2 size-[calc(100%-16px)] text-[#ccff00]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5, rotate: reduce ? 0 : -360 }}
            transition={{ opacity: { delay: after(HIT + 0.3), duration: 0.5 }, rotate: loop({ duration: 20, ease: "linear" }) }}
          >
            <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 9" />
          </motion.svg>

          {/* Shockwaves from the impact. */}
          {!reduce &&
            [0, 0.12].map((d) => (
              <motion.span
                key={d}
                aria-hidden="true"
                className="absolute inset-6 rounded-full border-2 border-[#ccff00]"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 2.4, opacity: [0, 0.85, 0] }}
                transition={{ delay: HIT + d, duration: 0.9, ease: "easeOut" }}
              />
            ))}

          {/* Sparks thrown outward, falling a little as they fly. */}
          {!reduce &&
            Array.from({ length: SPARKS }, (_, i) => {
              const a = (i / SPARKS) * Math.PI * 2 + (i % 2) * 0.13;
              const r = 120 + (i % 4) * 26;
              return (
                <motion.span
                  key={i}
                  aria-hidden="true"
                  className={`absolute left-1/2 top-1/2 rounded-full bg-[#ccff00] ${i % 3 === 0 ? "h-1 w-5" : "h-[3px] w-3"}`}
                  style={{ rotate: `${(a * 180) / Math.PI}deg`, translateX: "-50%", translateY: "-50%" }}
                  initial={{ x: 0, y: 0, opacity: 0 }}
                  animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r + 40, opacity: [0, 1, 1, 0] }}
                  transition={{ delay: HIT + 0.02, duration: 0.9 + (i % 3) * 0.15, ease: [0.16, 1, 0.3, 1] }}
                />
              );
            })}

          {/* The plate: falls hard, locks, then floats while the screen is open. */}
          <motion.div
            className="relative text-[#ccff00] drop-shadow-[0_0_34px_rgb(204_255_0/0.6)]"
            initial={reduce ? false : { y: -340, rotate: -120, scale: 0.5, opacity: 0 }}
            animate={{ y: 0, rotate: 0, scale: 1, opacity: 1 }}
            transition={{ y: { duration: HIT, ease: [0.55, 0, 1, 0.45] }, rotate: { duration: HIT, ease: "easeIn" }, scale: { duration: HIT }, opacity: { duration: 0.15 } }}
          >
            <motion.div
              animate={reduce ? undefined : { scaleY: [1, 0.86, 1.06, 1], scaleX: [1, 1.1, 0.97, 1] }}
              transition={{ delay: HIT, duration: 0.4 }}
            >
              <motion.div
                animate={reduce ? undefined : { y: [0, -9, 0], rotate: [0, 3, 0, -3, 0] }}
                transition={{ delay: 1.4, duration: 4, ease: "easeInOut", repeat: Infinity }}
              >
                <AbotMark size={132} />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>

        <motion.p
          className="mt-8 font-mono text-[11px] font-bold uppercase text-[#ccff00]"
          initial={{ opacity: 0, letterSpacing: reduce ? "0.22em" : "0.9em" }}
          animate={{ opacity: 1, letterSpacing: "0.22em" }}
          transition={{ delay: after(HIT + 0.3), duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {t("Payment received")}
        </motion.p>
        <motion.h2
          id="pro-celebration-title"
          className="mt-2 bg-[linear-gradient(110deg,#ffffff_40%,#ccff00_50%,#ffffff_60%)] bg-[length:300%_100%] bg-clip-text text-center text-[2.6rem] font-extrabold leading-[0.95] tracking-tight text-transparent"
          initial={{ opacity: 0, scale: reduce ? 1 : 1.35, filter: reduce ? "blur(0px)" : "blur(10px)", backgroundPosition: "100% 0" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)", backgroundPosition: reduce ? "100% 0" : ["100% 0", "0% 0"] }}
          transition={{
            opacity: { delay: after(HIT + 0.38), duration: 0.3 },
            scale: { delay: after(HIT + 0.38), type: "spring", stiffness: 260, damping: 16 },
            filter: { delay: after(HIT + 0.38), duration: 0.35 },
            backgroundPosition: loop({ delay: 1.6, duration: 1.4, ease: "easeInOut", repeatDelay: 2.6 }),
          }}
        >
          {unlocked.kind === "extended" ? <DaysAdded days={unlocked.days} reduce={!!reduce} /> : titleOf(unlocked, t)}
        </motion.h2>
        <motion.p
          className="mt-2.5 text-center text-sm text-zinc-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: after(HIT + 0.55), duration: 0.35 }}
        >
          {term}
        </motion.p>

        {unlocked.kind === "extended" ? (
          <DateRoll from={longDate(unlocked.from)} until={longDate(unlocked.until)} delay={after(HIT + 0.7)} reduce={!!reduce} />
        ) : (
          <ul className="mt-7 grid w-full max-w-sm grid-cols-2 gap-2 [perspective:600px]">
            {PERKS.map(({ icon: Icon, text }, i) => (
              <motion.li
                key={text}
                className="flex items-center gap-2 rounded-ctl border border-[#ccff00]/20 bg-[#121215]/90 px-3 py-2.5 text-xs font-semibold leading-tight text-white"
                initial={{ opacity: 0, rotateX: reduce ? 0 : -80, y: reduce ? 0 : 10 }}
                animate={{ opacity: 1, rotateX: 0, y: 0 }}
                transition={{ delay: after(HIT + 0.7 + i * 0.09), duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.span
                  aria-hidden="true"
                  className="shrink-0 text-[#ccff00]"
                  animate={reduce ? undefined : { scale: [1, 1.25, 1] }}
                  transition={{ delay: 2.4 + i * 0.6, duration: 0.5, repeat: Infinity, repeatDelay: 4 }}
                >
                  <Icon size={16} />
                </motion.span>
                {t(text)}
              </motion.li>
            ))}
          </ul>
        )}

        <motion.button
          ref={button}
          type="button"
          onClick={close}
          className="mt-8 min-h-14 w-full max-w-sm rounded-ctl bg-[#ccff00] font-mono text-sm font-extrabold uppercase tracking-[0.1em] text-black hover:brightness-95"
          initial={{ opacity: 0, y: reduce ? 0 : 16 }}
          animate={{
            opacity: 1,
            y: 0,
            boxShadow: reduce
              ? "0 0 0px rgb(204 255 0 / 0)"
              : ["0 0 0px rgb(204 255 0 / 0)", "0 0 28px rgb(204 255 0 / 0.55)", "0 0 0px rgb(204 255 0 / 0)"],
          }}
          transition={{
            opacity: { delay: after(HIT + 1.1), duration: 0.35 },
            y: { delay: after(HIT + 1.1), duration: 0.35 },
            boxShadow: loop({ delay: 2.2, duration: 2.4, ease: "easeInOut" }),
          }}
        >
          {t("Start training")}
        </motion.button>
      </motion.div>
    </div>
  );
}

/**
 * Volt embers drifting up behind everything, forever. Positions and timings come from the
 * index (no randomness), so each render is the same and nothing jumps.
 */
function Embers() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {Array.from({ length: EMBERS }, (_, i) => {
        const left = (i * 37 + 11) % 100;
        const size = 2 + (i % 3);
        const dur = 4.2 + (i % 5) * 0.8;
        return (
          <motion.span
            key={i}
            className="absolute bottom-0 rounded-full bg-[#ccff00]"
            style={{ left: `${left}%`, width: size, height: size, boxShadow: "0 0 8px rgb(204 255 0 / 0.8)" }}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: [40, -520 - (i % 4) * 90], x: [0, (i % 2 ? 1 : -1) * (12 + (i % 3) * 8), 0], opacity: [0, 0.9, 0] }}
            transition={{ delay: 0.9 + ((i * 0.53) % 3.2), duration: dur, ease: "easeOut", repeat: Infinity, repeatDelay: (i % 4) * 0.4 }}
          />
        );
      })}
    </div>
  );
}

type T = ReturnType<typeof useT>;

/** The headline for each case. The extended case counts its days up on screen instead. */
function titleOf(u: Unlocked, t: T): string {
  if (u.kind === "upgraded") return t("Upgraded to lifetime");
  if (u.kind === "extended") return t("+{n} days added", { n: u.days });
  return u.tier === "lifetime" ? t("Lifetime unlocked") : t("BLACK PRO unlocked");
}

/** "+365 days added", the number counting up from zero as the title lands. */
function DaysAdded({ days, reduce }: { days: number; reduce: boolean }) {
  const t = useT();
  const [n, setN] = useState(reduce ? days : 0);
  useEffect(() => {
    if (reduce) return;
    const c = animate(0, days, { delay: HIT + 0.45, duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [days, reduce]);
  return (
    <>
      <span aria-hidden="true">{t("+{n} days added", { n })}</span>
      <span className="sr-only">{t("+{n} days added", { n: days })}</span>
    </>
  );
}

/** The old end date struck through, an arrow, and the new one landing in Volt. */
function DateRoll({ from, until, delay, reduce }: { from: string; until: string; delay: number; reduce: boolean }) {
  const t = useT();
  return (
    <motion.div
      className="mt-7 flex w-full max-w-sm items-center gap-2 rounded-ctl border border-[#ccff00]/25 bg-[#121215]/90 p-3"
      initial={{ opacity: 0, y: reduce ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">{t("Was until")}</p>
        <p className="relative mt-0.5 inline-block text-sm font-semibold text-zinc-400">
          {from}
          <motion.span
            aria-hidden="true"
            className="absolute inset-x-0 top-1/2 h-[2px] origin-left bg-zinc-400"
            initial={{ scaleX: reduce ? 1 : 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: reduce ? 0 : delay + 0.35, duration: 0.35 }}
          />
        </p>
      </div>
      <motion.span
        aria-hidden="true"
        className="shrink-0 text-[#ccff00]"
        initial={{ x: reduce ? 0 : -8, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: reduce ? 0 : delay + 0.55, duration: 0.3 }}
      >
        <ArrowRight size={18} />
      </motion.span>
      <div className="min-w-0 flex-1 text-right">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#ccff00]">{t("Now until")}</p>
        <motion.p
          className="mt-0.5 text-sm font-extrabold text-white"
          initial={{ opacity: 0, scale: reduce ? 1 : 1.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: reduce ? 0 : delay + 0.7, type: "spring", stiffness: 320, damping: 16 }}
        >
          {until}
        </motion.p>
      </div>
    </motion.div>
  );
}
