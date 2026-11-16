"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { animate, m as motion, useAnimationControls, useReducedMotionConfig } from "framer-motion";

const SPRING = { type: "spring", stiffness: 380, damping: 30 } as const;

/**
 * Whether the page on screen is opened for the first time this session (PageTransition sets it).
 * Entrances play once: the second time a page opens it is simply there, already in place, so
 * moving between tabs never waits on the same animation again (owner, 2026-11-15).
 */
const FirstVisit = createContext(true);
export const FirstVisitProvider = FirstVisit.Provider;

/** Whether this page's entrance plays: its first visit this session, and motion allowed. */
export function usePlayEntrance(): boolean {
  const reduce = useReducedMotionConfig();
  return useContext(FirstVisit) && !reduce;
}

/**
 * Entrance animations started from an effect. Pages mount inside AnimatePresence with
 * initial={false} (PageTransition), which skips any `initial`, so each animated element starts
 * from an inline style and is driven to its "show" variant once mounted ("still" with reduced
 * motion).
 */
export function useEntrance(): ReturnType<typeof useAnimationControls> {
  const controls = useAnimationControls();
  const play = usePlayEntrance();
  useEffect(() => {
    // "still" lands at once: a default tween there would still fade the page in on every visit.
    void (play ? controls.start("show") : controls.start("still", { duration: 0 }));
  }, [controls, play]);
  return controls;
}

/** A block that rises into place, `order` beats after the page opens. */
export function Rise({
  order,
  children,
  className = "",
  step = 0.04,
}: {
  order: number;
  children: React.ReactNode;
  className?: string;
  step?: number;
}) {
  const controls = useEntrance();
  return (
    <motion.div
      className={className}
      style={{ opacity: 0, y: 14 }}
      animate={controls}
      variants={{ still: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0, transition: { ...SPRING, delay: order * step } } }}
    >
      {children}
    </motion.div>
  );
}

/** A figure that counts up from zero when the page opens; screen readers get the final value. */
export function CountFromZero({
  value,
  format,
  delay = 0.15,
  className = "",
}: {
  value: number;
  format: (n: number) => string;
  delay?: number;
  className?: string;
}) {
  const play = usePlayEntrance();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!play) return;
    const c = animate(0, value, { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1], onUpdate: setShown });
    return () => c.stop();
  }, [value, play, delay]);
  return (
    <span className={className}>
      <span aria-hidden="true">{format(play ? shown : value)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
