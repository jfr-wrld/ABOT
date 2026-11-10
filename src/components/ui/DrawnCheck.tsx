"use client";

import { motion } from "framer-motion";

/** The set-done tick (SetRow), drawn once where it mounts: a save that worked. */
export function DrawnCheck({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <motion.path d="M20 6 9 17l-5-5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.22, ease: "easeOut" }} />
    </svg>
  );
}
