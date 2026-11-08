"use client";

import { useRef, type KeyboardEvent } from "react";

/**
 * A row of tabs (WAI-ARIA tabs pattern): arrow keys move between tabs and select them, Home and
 * End jump. The active tab carries the Volt underline. Panels use `tabPanelProps`.
 */
export function Tabs<T extends string>({
  id,
  label,
  tabs,
  value,
  onChange,
}: {
  id: string;
  label: string;
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent, i: number) {
    const last = tabs.length - 1;
    const next = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next]!.value);
    refs.current[next]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className="grid border-b border-line" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((t, i) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${t.value}`}
            aria-selected={selected}
            aria-controls={`${id}-panel-${t.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={`relative min-h-11 text-sm font-semibold transition-colors ${
              selected
                ? "text-text after:absolute after:inset-x-4 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function tabPanelProps(id: string, value: string) {
  return { role: "tabpanel" as const, id: `${id}-panel-${value}`, "aria-labelledby": `${id}-tab-${value}`, tabIndex: 0 };
}
