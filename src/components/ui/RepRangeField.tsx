"use client";

import { useState, type InputHTMLAttributes } from "react";

/** "8" -> {8, null}, "8-12" or "8–12" -> {8, 12}; null for anything else. */
export function parseRepRange(text: string): { min: number; max: number | null } | null {
  const m = /^\s*(\d{1,3})\s*(?:[-–]\s*(\d{1,3}))?\s*$/.exec(text);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] === undefined ? null : Number(m[2]);
  if (min <= 0) return null;
  return { min, max: max !== null && max > min ? max : null };
}

const shown = (min: number | null, max: number | null | undefined) => (min === null ? "" : max ? `${min}-${max}` : String(min));

/**
 * Target reps as one number or a range ("8-12"), for a routine. The range's top is where the
 * Coach's double progression adds weight; its bottom fills the set when the workout starts.
 */
export function RepRangeField({
  min,
  max,
  onCommit,
  className = "",
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max"> & {
  min: number | null;
  max: number | null | undefined;
  onCommit: (v: { min: number | null; max: number | null }) => void;
}) {
  const [draft, setDraft] = useState(shown(min, max));
  const [seen, setSeen] = useState(shown(min, max));
  if (shown(min, max) !== seen) {
    setSeen(shown(min, max));
    setDraft(shown(min, max));
  }
  return (
    <input
      type="text"
      inputMode="text"
      autoComplete="off"
      value={draft}
      onChange={(e) => {
        const raw = e.target.value;
        if (!/^[\d\s\-–]*$/.test(raw) || raw.length > 7) return;
        setDraft(raw);
        if (raw.trim() === "") {
          setSeen("");
          onCommit({ min: null, max: null });
          return;
        }
        const r = parseRepRange(raw);
        // "8-" is still being typed: keep the last good value.
        if (!r) return;
        setSeen(shown(r.min, r.max));
        onCommit(r);
      }}
      onBlur={() => setDraft(shown(min, max))}
      className={`num h-11 w-full min-w-0 rounded-ctl border border-zinc-800 bg-well px-0.5 text-center text-lg font-bold tracking-tight text-text transition-colors placeholder:font-medium placeholder:text-text-muted hover:border-zinc-700 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 ${className}`}
      {...rest}
    />
  );
}
