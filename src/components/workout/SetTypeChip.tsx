import type { SetType } from "@/types/workout";
import { SET_TYPE_META } from "@/types/workout";

const bg: Record<SetType, string> = {
  warmup: "text-warmup",
  normal: "text-text",
  dropset: "text-dropset",
  failure: "text-failure",
};

/** The square chip that starts every set row: the set number, or W / D / F. */
export function SetTypeChip({
  type,
  number,
  completed,
}: {
  type: SetType;
  number: number | null;
  completed?: boolean;
}) {
  const meta = SET_TYPE_META[type];
  const label = type === "normal" ? String(number ?? "") : meta.short;
  return (
    <span
      className={`flex size-9 items-center justify-center rounded-ctl text-sm font-bold ${
        completed ? "bg-accent-tint" : "bg-surface-2"
      } ${bg[type]}`}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

export function setTypeA11yName(type: SetType, number: number | null): string {
  return type === "normal" ? `Set ${number ?? ""}` : `${SET_TYPE_META[type].label} set`;
}
