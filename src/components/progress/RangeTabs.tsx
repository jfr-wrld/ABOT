"use client";

import { motion } from "framer-motion";
import { PRESS_SPRING } from "@/components/ui/Button";

/**
 * Segmented control whose Volt plate slides to the chosen option: one object moving, so it
 * reads as a switch being thrown rather than two buttons swapping colour.
 */
export function RangeTabs<T extends string | number>({
  label,
  options,
  value,
  onChange,
  id,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Unique per control on the page, so two controls never share a sliding plate. */
  id: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-ctl border border-line bg-surface p-1">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={`relative min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors ${
              selected ? "text-on-accent" : "text-text-muted hover:text-text"
            }`}
          >
            {selected && (
              <motion.span
                layoutId={`${id}-plate`}
                transition={PRESS_SPRING}
                aria-hidden="true"
                className="absolute inset-0 rounded-lg bg-accent"
              />
            )}
            <span className="relative num">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
