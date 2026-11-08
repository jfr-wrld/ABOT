"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AnimatedAbotMark, AnimatedWordmark } from "@/components/brand/AnimatedAbotMark";
import { useHydration } from "@/store/hydration";

/** Long enough for the plate to assemble; short enough that it never feels like a wait. */
const MIN_MS = 1150;
export const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const;

/**
 * Shown on every full load while saved workouts are read from the device. It is in the server
 * HTML, so the first paint is black with the plate, never a half-built page. It leaves when the
 * stores are ready and the minimum time has passed, scaling up slightly as it fades so the app
 * appears to come forward from behind it.
 */
export function SplashScreen() {
  const hydrated = useHydration((s) => s.hydrated);
  const [minDone, setMinDone] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), MIN_MS);
    return () => clearTimeout(t);
  }, []);

  const show = !(hydrated && minDone);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          role="status"
          aria-label="Loading ABOT"
          className="force-dark fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
          initial={false}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
        >
          {/* Once assembled, the plate glows once as if switched on, then holds while data loads. */}
          <motion.span
            aria-hidden="true"
            animate={
              reduce
                ? undefined
                : {
                    filter: [
                      "drop-shadow(0 0 0px rgb(204 255 0 / 0))",
                      "drop-shadow(0 0 22px rgb(204 255 0 / 0.5))",
                      "drop-shadow(0 0 6px rgb(204 255 0 / 0.2))",
                    ],
                  }
            }
            transition={{ delay: 0.9, duration: 0.6, ease: "easeOut" }}
          >
            <AnimatedAbotMark size={84} />
          </motion.span>
          <AnimatedWordmark delay={0.55} className="mt-5 text-3xl font-black tracking-tight text-text" />
          {/* A hairline that creeps across while the device storage is read. */}
          <span aria-hidden="true" className="mt-8 block h-px w-40 overflow-hidden bg-ink/10">
            <motion.span
              className="block h-full origin-left bg-accent"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: MIN_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
            />
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
