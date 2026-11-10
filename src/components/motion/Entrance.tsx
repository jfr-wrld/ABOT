"use client";

import { useEffect, useState } from "react";
import { animate, motion, useAnimationControls, useReducedMotionConfig } from "framer-motion";

const SPRING = { type: "spring", stiffness: 300, damping: 26 } as const;

/**
 * Entrance animations started from an effect. Pages mount inside AnimatePresence with
 * initial={false} (PageTransition), which skips any `initial`, so each animated element starts
 * from an inline style and is driven to its "show" variant once mounted ("still" with reduced
 * motion).
 */
export function useEntrance(): ReturnType<typeof useAnimationControls> {
  const controls = useAnimationControls();
  const reduce = useReducedMotionConfig();
  useEffect(() => {
    void controls.start(reduce ? "still" : "show");
  }, [controls, reduce]);
  return controls;
}

/** A block that rises into place, `order` beats after the page opens. */
export function Rise({
  order,
  children,
  className = "",
  step = 0.06,
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
  delay = 0.25,
  className = "",
}: {
  value: number;
  format: (n: number) => string;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotionConfig();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const c = animate(0, value, { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1], onUpdate: setShown });
    return () => c.stop();
  }, [value, reduce, delay]);
  return (
    <span className={className}>
      <span aria-hidden="true">{format(reduce ? value : shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
