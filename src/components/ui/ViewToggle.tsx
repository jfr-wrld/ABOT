"use client";

import { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { useT } from "@/i18n";

export type ViewMode = "list" | "grid";

/** List or grid, remembered per device under `key` (a convenience, not training data). */
export function useViewMode(key: string, initial: ViewMode = "list"): [ViewMode, (v: ViewMode) => void] {
  const storageKey = `abot.view.${key}`;
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === "grid" || saved === "list" ? saved : initial;
    } catch {
      return initial;
    }
  });
  const set = (v: ViewMode) => {
    setMode(v);
    try {
      localStorage.setItem(storageKey, v);
    } catch {
      // Without storage the choice lasts until the page closes.
    }
  };
  return [mode, set];
}

/** Two icon buttons, list and grid; the current one is pressed. */
export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const t = useT();
  const option = (v: ViewMode, label: string, Icon: typeof List) => (
    <button
      type="button"
      aria-pressed={value === v}
      aria-label={label}
      onClick={() => onChange(v)}
      className={`flex size-11 items-center justify-center rounded-[9px] transition-colors ${
        value === v ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
      }`}
    >
      <Icon aria-hidden="true" size={16} />
    </button>
  );
  return (
    <div role="group" aria-label={t("View")} className="flex shrink-0 gap-0.5 rounded-ctl bg-surface-2 p-0.5">
      {option("list", t("List view"), List)}
      {option("grid", t("Grid view"), LayoutGrid)}
    </div>
  );
}
