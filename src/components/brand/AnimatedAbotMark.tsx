"use client";

import { useId, useSyncExternalStore } from "react";
import { motion } from "framer-motion";

import { MARK_A, MARK_BAR, MARK_PATH, MARK_PLATE_LEFT, MARK_PLATE_RIGHT } from "./mark-path";

const EASE = [0.22, 1, 0.36, 1] as const;
/** Heavy and short: things that weigh something land with a small overshoot, not a bounce. */
const LAND = { type: "spring", stiffness: 420, damping: 22, mass: 1.1 } as const;

/**
 * The ABOT mark loading up like a bar: the A punches up into place, the bar shows through it,
 * the two plates slide on from the sides and lock, and one band of light passes across
 * (the same sweep as a ticked set). About 0.9 s. With reduced motion it is simply drawn.
 */
const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribe = (fn: () => void) => {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
};

/**
 * Reduced motion, read so hydration matches the server: false while the prerendered HTML is
 * adopted, the real setting right after. (framer's useReducedMotionConfig is null on the server and
 * true on such a phone's first render, so the two markups differed and every page re-rendered.)
 */
function useReducedMotionAfterHydration(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(REDUCE).matches, () => false);
}

export function AnimatedAbotMark({ size = 88, delay = 0 }: { size?: number; delay?: number }) {
  const reduce = useReducedMotionAfterHydration();
  const id = useId().replace(/:/g, "");
  const at = (t: number) => (reduce ? 0 : delay + t);
  const still = reduce ?? false;

  return (
    <svg
      // A new element once reduced motion is known, so it is drawn at rest instead of animating.
      key={reduce ? "still" : "moving"}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      fill="none"
      className="overflow-visible text-accent"
    >
      <defs>
        <clipPath id={`mark-${id}`}>
          <path d={MARK_PATH} />
        </clipPath>
        <linearGradient id={`sweep-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.5" stopColor="white" stopOpacity="0.55" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 1. The bar shows through the A. */}
      <motion.path
        d={MARK_BAR}
        fill="currentColor"
        style={{ originX: 0.5, originY: 0.5 }}
        initial={still ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: at(0.18), duration: 0.32, ease: EASE }}
      />
      {/* 2. The A punches up into place. */}
      <motion.path
        d={MARK_A}
        fill="currentColor"
        style={{ originX: 0.5, originY: 1 }}
        initial={still ? false : { y: 18, scale: 0.7, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ delay: at(0), ...LAND }}
      />
      {/* 3. A plate slides on from each side and locks. */}
      {[MARK_PLATE_LEFT, MARK_PLATE_RIGHT].map((d, i) => (
        <motion.path
          key={i}
          d={d}
          fill="currentColor"
          initial={still ? false : { x: i === 0 ? -26 : 26, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: at(0.42), ...LAND }}
        />
      ))}
      {/* 4. One band of light across the mark. */}
      {!still && (
        <g clipPath={`url(#mark-${id})`}>
          <motion.rect
            y="0"
            width="40"
            height="100"
            fill={`url(#sweep-${id})`}
            initial={{ x: -50 }}
            animate={{ x: 120 }}
            transition={{ delay: at(0.78), duration: 0.5, ease: "easeInOut" }}
          />
        </g>
      )}
    </svg>
  );
}

/** "ABOT", each letter rising out of a slot one after another. */
export function AnimatedWordmark({ delay = 0, className = "" }: { delay?: number; className?: string }) {
  const reduce = useReducedMotionAfterHydration();
  return (
    <span key={reduce ? "still" : "moving"} aria-hidden="true" className={`flex overflow-hidden ${className}`}>
      {"ABOT".split("").map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={reduce ? false : { y: "105%" }}
          animate={{ y: 0 }}
          transition={{ delay: reduce ? 0 : delay + i * 0.06, type: "spring", stiffness: 380, damping: 26 }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}
