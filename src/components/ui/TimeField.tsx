"use client";

import { useState, type InputHTMLAttributes, type Ref } from "react";
import { clockText, parseClock } from "@/lib/set-metrics";

/**
 * A time in seconds, typed as "1:30" or a plain number (seconds for a hold, minutes for cardio,
 * see parseClock). Keeps the typed text while focused and shows it as m:ss once it is left.
 */
export function TimeField({
  value,
  onCommit,
  plain,
  className = "",
  ref,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | null;
  onCommit: (sec: number | null) => void;
  plain: "sec" | "min";
  ref?: Ref<HTMLInputElement>;
}) {
  const shown = (v: number | null) => (v === null ? "" : clockText(v));
  const [draft, setDraft] = useState(shown(value));
  const [seenValue, setSeenValue] = useState(value);

  // An outside change (filled from the previous set) replaces the draft.
  if (value !== seenValue) {
    setSeenValue(value);
    setDraft(shown(value));
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={draft}
      onChange={(e) => {
        const raw = e.target.value;
        if (!/^[\d:.,]*$/.test(raw) || raw.length > 8) return;
        setDraft(raw);
        const sec = parseClock(raw, plain);
        // "1:" is still being typed: keep the last good value until it reads as a time.
        if (sec === null && raw.trim() !== "") return;
        setSeenValue(sec);
        onCommit(sec);
      }}
      onBlur={() => setDraft(shown(value))}
      className={`num h-11 w-full min-w-0 rounded-ctl border border-zinc-800 bg-well px-0.5 text-center text-lg font-bold tracking-tight text-text transition-colors placeholder:font-medium placeholder:text-text-muted hover:border-zinc-700 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 ${className}`}
      {...rest}
    />
  );
}
