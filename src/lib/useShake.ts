"use client";

import { useAnimationControls } from "framer-motion";
import { feedback } from "./feedback";

/**
 * A field that refused its input shakes once (300 ms, 6 px) with a short buzz, so the refusal
 * is felt where the thumb is, not only read below it. Put `controls` on a motion wrapper's
 * `animate`. MotionConfig's reduced-motion setting drops the movement; the message stays.
 */
export function useShake() {
  const controls = useAnimationControls();
  const shake = () => {
    feedback.error();
    void controls.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.3 } });
  };
  return { controls, shake };
}
