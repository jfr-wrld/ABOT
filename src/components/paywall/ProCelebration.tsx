"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, Brain, Mic, Sparkles } from "lucide-react";
import { AbotMark } from "@/components/brand/AbotMark";
import { useT } from "@/i18n";

/** What just became active: pro until a date, or lifetime. */
type Unlocked = { tier: "pro"; until: string | null } | { tier: "lifetime" };

export const useCelebrationStore = create<{ unlocked: Unlocked | null; show: (u: Unlocked) => void; close: () => void }>()((set) => ({
  unlocked: null,
  show: (unlocked) => set({ unlocked }),
  close: () => set({ unlocked: null }),
}));

const SPARKS = 12;
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
  const t = useT();
  const unlocked = useCelebrationStore((s) => s.unlocked);
  const close = useCelebrationStore((s) => s.close);
  const reduce = useReducedMotion();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!unlocked) return;
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unlocked, close]);

  if (!unlocked) return null;
  const term =
    unlocked.tier === "lifetime"
      ? t("Lifetime license. No end date.")
      : unlocked.until
        ? t("Active until {date}", { date: new Date(unlocked.until).toLocaleDateString(t.locale, { day: "numeric", month: "long", year: "numeric" }) })
        : t("Active on your account");
  // Lock-in timing: the plate lands at 0.35 s, the flash and sparks follow, then the words.
  const after = (s: number) => (reduce ? 0 : s);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-celebration-title"
      className="force-dark fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-[#09090b] px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(24px+env(safe-area-inset-top))] text-text"
    >
      {/* Volt glow behind the plate. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[38%] size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgb(204 255 0 / 0.22), transparent 62%)" }}
        initial={{ opacity: 0, scale: reduce ? 1 : 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: after(0.35), duration: reduce ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
      />

      <div className="relative flex size-44 items-center justify-center">
        {/* Shock ring from the impact. */}
        {!reduce && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border-2 border-[#ccff00]"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.6, opacity: [0, 0.9, 0] }}
            transition={{ delay: 0.35, duration: 0.8, ease: "easeOut" }}
          />
        )}
        {/* Sparks thrown outward at the lock-in. */}
        {!reduce &&
          Array.from({ length: SPARKS }, (_, i) => {
            const a = (i / SPARKS) * Math.PI * 2;
            const r = 110 + (i % 3) * 18;
            return (
              <motion.span
                key={i}
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-1 w-3 rounded-full bg-[#ccff00]"
                style={{ rotate: `${(a * 180) / Math.PI}deg`, translateX: "-50%", translateY: "-50%" }}
                initial={{ x: 0, y: 0, opacity: 0 }}
                animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r, opacity: [0, 1, 0] }}
                transition={{ delay: 0.38, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              />
            );
          })}
        {/* The plate: drops in, overshoots, locks. */}
        <motion.div
          className="text-[#ccff00] drop-shadow-[0_0_28px_rgb(204_255_0/0.55)]"
          initial={reduce ? false : { y: -260, rotate: -90, scale: 0.6, opacity: 0 }}
          animate={{ y: 0, rotate: 0, scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, mass: 0.9 }}
        >
          <AbotMark size={128} />
        </motion.div>
      </div>

      <motion.p
        className="mt-6 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#ccff00]"
        initial={{ opacity: 0, y: reduce ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: after(0.7), duration: 0.35 }}
      >
        {t("Payment received")}
      </motion.p>
      <motion.h2
        id="pro-celebration-title"
        className="mt-2 text-center text-4xl font-extrabold leading-none tracking-tight text-white"
        initial={{ opacity: 0, scale: reduce ? 1 : 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: after(0.8), type: "spring", stiffness: 300, damping: 18 }}
      >
        {unlocked.tier === "lifetime" ? t("Lifetime unlocked") : t("BLACK PRO unlocked")}
      </motion.h2>
      <motion.p
        className="mt-2 text-center text-sm text-zinc-300"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: after(0.95), duration: 0.35 }}
      >
        {term}
      </motion.p>

      <ul className="mt-7 grid w-full max-w-sm grid-cols-2 gap-2">
        {PERKS.map(({ icon: Icon, text }, i) => (
          <motion.li
            key={text}
            className="flex items-center gap-2 rounded-ctl border border-white/10 bg-[#121215] px-3 py-2.5 text-xs font-semibold leading-tight text-white"
            initial={{ opacity: 0, y: reduce ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: after(1.1 + i * 0.08), duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <Icon aria-hidden="true" size={16} className="shrink-0 text-[#ccff00]" />
            {t(text)}
          </motion.li>
        ))}
      </ul>

      <motion.button
        ref={button}
        type="button"
        onClick={close}
        className="mt-8 min-h-14 w-full max-w-sm rounded-ctl bg-[#ccff00] font-mono text-sm font-extrabold uppercase tracking-[0.1em] text-black hover:brightness-95"
        initial={{ opacity: 0, y: reduce ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: after(1.5), duration: 0.35 }}
      >
        {t("Start training")}
      </motion.button>
    </div>
  );
}
