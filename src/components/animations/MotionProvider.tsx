"use client";

import { MotionConfig } from "framer-motion";
import { useEffectsMode } from "@/components/layout/EffectsController";

/**
 * With reduce-motion on, framer-motion drops movement and scale but keeps fades. Settings >
 * Visual effects on Light does the same for everyone on this phone.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const mode = useEffectsMode();
  return <MotionConfig reducedMotion={mode === "lite" ? "always" : "user"}>{children}</MotionConfig>;
}
