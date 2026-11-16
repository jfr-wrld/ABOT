"use client";

import { LazyMotion } from "framer-motion";

const loadFeatures = () => import("./motion-features").then((m) => m.default);

/**
 * Components use the slim `m` (imported as `motion`), and the animation features load as their
 * own chunk right after the page starts, so they stay out of the first download.
 */
export function MotionFeatures({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}
