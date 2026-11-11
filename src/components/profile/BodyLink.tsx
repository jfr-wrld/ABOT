"use client";

import Link from "next/link";
import { ChevronRight, Scale } from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { formatWeight } from "@/lib/units";
import { useT } from "@/i18n";

export const BODY_PAGE = "/profile/body";

/** A row to Profile > Body showing the current weight; used where weight used to be typed in. */
export function BodyLink({ hint }: { hint?: string }) {
  const t = useT();
  const kg = useSettingsStore((s) => s.bodyweightKg);
  const unit = useSettingsStore((s) => s.weightUnit);
  return (
    <div>
      <Link href={BODY_PAGE} className="tap flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface px-3 py-2 hover:bg-surface-2 active:bg-press">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-ctl bg-surface-2">
          <Scale size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t("Body")}</span>
          <span className="num block truncate text-xs text-text-muted">
            {kg === null ? t("Add your weight") : t("{weight} · weigh-ins, body fat, waist", { weight: formatWeight(kg, unit) })}
          </span>
        </span>
        <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
      </Link>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

/** The Profile header's link to Body: the current weight, or an invitation to add it. */
export function BodyChip() {
  const t = useT();
  const kg = useSettingsStore((s) => s.bodyweightKg);
  const unit = useSettingsStore((s) => s.weightUnit);
  return (
    <Link href={BODY_PAGE} className="inline-flex min-h-11 items-center gap-1.5 rounded-ctl px-1 text-sm font-semibold text-text-muted hover:bg-ink/[0.05] hover:text-text">
      <Scale aria-hidden="true" size={16} />
      <span className="num">{kg === null ? t("Add weight") : formatWeight(kg, unit)}</span>
      <span className="sr-only">{t("Body")}</span>
    </Link>
  );
}
