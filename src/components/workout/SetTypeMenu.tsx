"use client";

import { Trash2 } from "lucide-react";
import type { SetType } from "@/types/workout";
import { SET_TYPE_META } from "@/types/workout";
import { Sheet } from "@/components/ui/Sheet";

const ORDER: SetType[] = ["warmup", "normal", "dropset", "failure"];
const color: Record<SetType, string> = {
  warmup: "text-warmup",
  normal: "text-text",
  dropset: "text-dropset",
  failure: "text-failure",
};
const hint: Record<SetType, string> = {
  warmup: "Not counted in volume or records",
  normal: "Counts toward volume and records",
  dropset: "Weight lowered right after the previous set",
  failure: "Taken to the point you could not finish a rep",
};

export function SetTypeMenu({
  open,
  current,
  onSelect,
  onRemove,
  onClose,
}: {
  open: boolean;
  current: SetType;
  onSelect: (t: SetType) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Set type">
      <ul className="flex flex-col gap-1">
        {ORDER.map((t) => (
          <li key={t}>
            <button
              type="button"
              aria-pressed={t === current}
              onClick={() => {
                onSelect(t);
                onClose();
              }}
              className={`flex min-h-12 w-full items-center gap-3 rounded-ctl px-3 text-left hover:bg-surface-2 active:bg-press-strong ${
                t === current ? "bg-surface-2" : ""
              }`}
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-ctl bg-bg text-sm font-bold ${color[t]}`}
                aria-hidden="true"
              >
                {SET_TYPE_META[t].short || "1"}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{SET_TYPE_META[t].label}</span>
                <span className="text-xs text-text-muted">{hint[t]}</span>
              </span>
            </button>
          </li>
        ))}
        <li className="mt-2 border-t border-line pt-2">
          <button
            type="button"
            onClick={() => {
              onRemove();
              onClose();
            }}
            className="flex min-h-12 w-full items-center gap-3 rounded-ctl px-3 text-left text-failure hover:bg-failure/10"
          >
            <Trash2 aria-hidden="true" size={18} />
            <span className="text-sm font-semibold">Remove this set</span>
          </button>
        </li>
      </ul>
    </Sheet>
  );
}
