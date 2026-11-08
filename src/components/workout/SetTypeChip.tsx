import type { SetType } from "@/types/workout";
import { SET_TYPE_META } from "@/types/workout";
import type { T } from "@/i18n";

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
      className={`num flex size-9 items-center justify-center rounded-lg border text-sm font-bold ${
        completed ? "border-accent/25 bg-row" : "border-ink/[0.06] bg-surface-2"
      } ${bg[type]}`}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

/** "Set 2" or "Warm-up set"; pass `t` for the chosen language (English without it). */
export function setTypeA11yName(type: SetType, number: number | null, t?: T): string {
  if (t) return type === "normal" ? t("Set {n}", { n: number ?? "" }) : t("{type} set", { type: t(SET_TYPE_META[type].label) });
  return type === "normal" ? `Set ${number ?? ""}` : `${SET_TYPE_META[type].label} set`;
}
