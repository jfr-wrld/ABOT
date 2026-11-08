"use client";

import type { ReactNode } from "react";
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
  const t = useT();
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
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors ${
          checked ? "border-accent bg-accent" : "border-line-strong bg-surface-2"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 size-6 rounded-full transition-[left] ${checked ? "left-7 bg-on-accent" : "left-0.5 bg-text"}`}
        />
        <span className="sr-only">{checked ? t("On") : t("Off")}</span>
      </button>
    </div>
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
    <fieldset>
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
