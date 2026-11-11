"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { feedback } from "@/lib/feedback";
import { InfoTip } from "@/components/ui/InfoTip";
import { useT } from "@/i18n";

/** A labelled on/off switch with its explanation behind the info icon. */
export function Toggle({
  id,
  label,
  info,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  info: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <InfoTip
        title={
          <label htmlFor={id} className="text-sm font-semibold">
            {label}
          </label>
        }
        name={label}
      >
        {info}
      </InfoTip>
      <Switch id={id} checked={checked} onChange={onChange} />
    </div>
  );
}

/**
 * The one on/off switch of Settings: a tick, a knob that springs across, and its state for
 * screen readers. Every switch uses it, so they all look and feel the same.
 */
export function Switch({
  checked,
  onChange,
  id,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const t = useT();
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        feedback.tick();
        onChange(!checked);
      }}
      className={`relative flex h-8 w-14 shrink-0 items-center rounded-full border px-0.5 transition-colors disabled:opacity-40 ${
        checked ? "justify-end border-accent bg-accent" : "justify-start border-line-strong bg-surface-2"
      }`}
    >
      {/* The knob springs across with a slight overshoot, like a physical toggle. */}
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        aria-hidden="true"
        className={`size-6 rounded-full ${checked ? "bg-on-accent" : "bg-text"}`}
      />
      <span className="sr-only">{checked ? t("On") : t("Off")}</span>
    </button>
  );
}

/** One choice out of a few, as a row of segments (radio group). */
export function Choice<T extends string | number>({
  name,
  label,
  info,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  info?: ReactNode;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset id={`setting-${name}`} className="scroll-mt-20">
      <legend className="mb-2">
        {info ? (
          <InfoTip title={<span className="text-sm font-semibold">{label}</span>} name={label}>
            {info}
          </InfoTip>
        ) : (
          <span className="text-sm font-semibold">{label}</span>
        )}
      </legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <label
            key={String(o.value)}
            className={`flex min-h-11 cursor-pointer items-center justify-center rounded-ctl border px-2 text-center text-sm font-semibold ${
              value === o.value ? "border-accent bg-accent-tint text-text" : "border-line-strong bg-surface-2 text-text-muted"
            }`}
          >
            <input type="radio" name={name} value={String(o.value)} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
