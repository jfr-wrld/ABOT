"use client";

import { ChevronDown } from "lucide-react";
import { PHASE_LABEL, type BodyPhaseType, type FuelTarget } from "@/lib/phase-engine";
import { useT } from "@/i18n";

/**
 * Where today's calorie target comes from, behind one tap: daily life, training (the average of
 * the last four weeks, so it barely moves day to day), and the phase's deficit or surplus.
 */
export function TargetBreakdown({ fuel, phase, trainingDay }: { fuel: FuelTarget; phase: BodyPhaseType; trainingDay: boolean }) {
  const t = useT();
  const n = (v: number) => Math.round(v).toLocaleString(t.locale);
  const life = fuel.tdee - fuel.trainingKcal;
  const phaseLine =
    phase === "RECOMP" ? (trainingDay ? t("Recomp, training day") : t("Recomp, rest day")) : phase === "STRENGTH_PEAK" ? t("Strength peak, at maintenance") : t(PHASE_LABEL[phase]);
  const rows: [string, string][] = [
    [t("Daily life"), n(life)],
    [t("Training, a day on average"), `+${n(fuel.trainingKcal)}`],
    [phaseLine, `${fuel.delta > 0 ? "+" : fuel.delta < 0 ? "−" : "±"}${n(Math.abs(fuel.delta))}`],
  ];
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-xs font-semibold text-text-muted hover:text-text [&::-webkit-details-marker]:hidden">
        {t("How the target is worked out")}
        <ChevronDown aria-hidden="true" size={14} className="transition-transform group-open:rotate-180" />
      </summary>
      <dl className="num flex flex-col gap-1 pb-1 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-text-muted">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-line pt-1">
          <dt className="font-semibold">{t("Target today")}</dt>
          <dd className="font-bold text-accent">{t("{n} kcal", { n: n(fuel.kcal) })}</dd>
        </div>
      </dl>
      <p className="text-[11px] text-text-muted">{t("Training counts as your daily average over the last 4 weeks, so the target stays steady from day to day.")}</p>
    </details>
  );
}
