"use client";

import { MotionConfig } from "framer-motion";

/** With reduce-motion on, framer-motion drops movement and scale but keeps fades. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
