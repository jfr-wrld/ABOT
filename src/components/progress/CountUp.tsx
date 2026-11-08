"use client";

import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * A figure that counts from its last value to the new one when the range changes, so the eye
 * reads the size of the change. Mono digits keep the width still while it runs. With reduced
 * motion it jumps straight to the value.
 */
export function CountUp({ value, format, className = "" }: { value: number; format: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduce) {
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(v),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  // The accessible text is always the final value, never a frame of the count.
  return (
    <span className={className}>
      <span aria-hidden="true">{format(reduce ? value : shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
