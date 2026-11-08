"use client";

import { useState, type InputHTMLAttributes, type Ref } from "react";

/**
 * Numeric input that keeps a text draft (so "62." can be typed) and commits a number
 * or null on each change. `value` is in display units; the caller converts.
 */
export function NumberField({
  value,
  onCommit,
  min = 0,
  max,
  className = "",
  ref,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | null;
  onCommit: (n: number | null) => void;
  min?: number;
  max?: number;
  ref?: Ref<HTMLInputElement>;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [seenValue, setSeenValue] = useState(value);

  // Accept outside changes (autofill from the previous set) without fighting the user's typing:
  // when the committed value differs from the one this draft produced, re-derive the draft.
  if (value !== seenValue) {
    setSeenValue(value);
    setDraft(value === null ? "" : String(value));
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={draft}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        if (!/^\d*\.?\d*$/.test(raw)) return;
        const n = raw === "" || raw === "." ? null : Number(raw);
        let next = n === null || Number.isNaN(n) ? null : n;
        if (next !== null && max !== undefined && next > max) next = max;
        if (next !== null && next < min) next = min;
        setDraft(raw);
        setSeenValue(next);
        onCommit(next);
      }}
      onBlur={() => setDraft(value === null ? "" : String(value))}
      className={`h-11 w-full min-w-0 rounded-ctl border border-line-strong bg-surface-2 px-1 text-center text-base text-text placeholder:text-text-muted/70 ${className}`}
      {...rest}
    />
  );
}
