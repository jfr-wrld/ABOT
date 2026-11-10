"use client";

import Link from "next/link";
import { Beef, ChevronRight, Droplets, Flame, Hammer, Plus, Scale, Zap } from "lucide-react";
import { useFuelPacer, useTodayFuel } from "@/store/useFuelPacer";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PHASE_LABEL, type BodyPhaseType } from "@/lib/phase-engine";
import { toDisplay } from "@/lib/units";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";
import { usePhaseTelemetry } from "./usePhaseTelemetry";
import { MacroBar, Ring } from "./visuals";

export const PHASE_ICON: Record<BodyPhaseType, typeof Flame> = { CUTTING: Flame, BULKING: Hammer, RECOMP: Scale, STRENGTH_PEAK: Zap };

/**
 * The body phase on Home and Profile, read in a glance: phase and week, block bar, trend weight
 * with its last weeks as a line, today's calories split by macro, and protein and water rings
 * that fill with a tap. Everything else is one tap away on /phase.
 */
export function PhaseCommandCard({ now }: { now: number }) {
  const t = useT();
  const m = usePhaseTelemetry(now);
  const unit = useSettingsStore((s) => s.weightUnit);

  if (!m) {
    return (
      <Link href="/phase/setup" aria-label={t("Choose a body phase")} className="panel group flex items-center gap-3 p-4 hover:border-ink/[0.15]">
        <span aria-hidden="true" className="flex -space-x-2">
          {(Object.keys(PHASE_ICON) as BodyPhaseType[]).map((p) => {
            const Icon = PHASE_ICON[p];
            return (
              <span key={p} className="flex size-9 items-center justify-center rounded-full border-2 border-surface bg-surface-2 text-text-muted transition-colors group-hover:text-accent">
                <Icon size={16} />
              </span>
            );
          })}
        </span>
        <span className="min-w-0 flex-1">
          <span className="label-caps block">{t("Body phase")}</span>
          <span className="block text-sm font-semibold">{t("Cut, bulk, recomp or peak")}</span>
        </span>
        <ChevronRight aria-hidden="true" size={18} className="text-text-muted" />
      </Link>
    );
  }

  const Icon = PHASE_ICON[m.phase.phaseType];
  const { meso, fuel } = m;
  const weight = (Math.round(toDisplay(m.trendKg, unit) * 10) / 10).toFixed(1);
  const rate = m.ratePerWeek;

  return (
    <section aria-labelledby="phase-heading" className="panel overflow-hidden">
      {/* Compact on purpose: phase and week, then two figures. Detail lives one tap away on /phase. */}
      <Link href="/phase" className="flex flex-col gap-2.5 px-3 pb-2.5 pt-3 hover:bg-ink/[0.02]">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent">
            <Icon size={14} />
          </span>
          <h2 id="phase-heading" className="min-w-0 truncate text-sm font-bold">
            {t(PHASE_LABEL[m.phase.phaseType])}
          </h2>
          <span className="num shrink-0 text-xs font-bold text-text-muted">
            {meso.finished ? t("Done") : t("W{week}/{of}", { week: meso.week, of: meso.of })}
          </span>
          {meso.deload && !meso.finished && <span className="shrink-0 rounded-full bg-warmup/15 px-1.5 py-px text-[10px] font-bold uppercase text-warmup">{t("Deload")}</span>}
          <span className="flex-1" />
          <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-text-muted" />
        </div>

        <BlockBar of={meso.of} progress={meso.progress} week={meso.week} finished={meso.finished} label={t("Block progress")} thin />

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="label-caps">{t("Trend")}</p>
            <p className="num flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-lg font-bold leading-tight">
                {weight}
                <span className="ml-0.5 text-[11px] font-semibold text-text-muted">{unit}</span>
              </span>
              {rate !== null && (
                <span className="text-[11px] font-semibold text-text-muted">
                  {rate > 0 ? "+" : rate < 0 ? "−" : "±"}
                  {Math.abs(Math.round(toDisplay(rate, unit) * 10) / 10)}/{t("wk")}
                </span>
              )}
            </p>
          </div>
          <div className="min-w-0">
            <p className="label-caps">{t("Today")}</p>
            <p className="num text-lg font-bold leading-tight text-accent">
              {fuel.kcal.toLocaleString(t.locale)}
              <span className="ml-0.5 text-[11px] font-semibold text-text-muted">kcal</span>
            </p>
            <MacroBar protein={fuel.proteinG} carbs={fuel.carbsG} fat={fuel.fatG} className="mt-1 h-1" />
          </div>
        </div>
      </Link>
      <PacerChips proteinTarget={fuel.proteinG} waterTarget={m.waterMl} now={now} />
    </section>
  );
}

/**
 * Protein and water as two small tap targets on one row: a mini ring, today against the target,
 * and the step a tap adds. The full-size Pacer stays on /phase.
 */
function PacerChips({ proteinTarget, waterTarget, now }: { proteinTarget: number; waterTarget: number; now: number }) {
  const t = useT();
  const { proteinG, waterMl } = useTodayFuel(now);
  const add = useFuelPacer((s) => s.add);
  const litres = (n: number) => (n / 1000).toLocaleString(t.locale, { maximumFractionDigits: 1 });
  const chip = (key: string, label: string, value: number, target: number, figure: string, step: string, aria: string, onAdd: () => void, Icon: typeof Droplets) => (
    <button
      key={key}
      type="button"
      onClick={() => {
        feedback.tick();
        onAdd();
      }}
      aria-label={aria}
      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-ctl px-2 text-left hover:bg-ink/[0.04] active:bg-ink/[0.07]"
    >
      <Ring value={value} max={target} size={28} stroke={3} label={`${label}: ${value} / ${target}`}>
        <Icon aria-hidden="true" size={11} className={value >= target ? "text-accent" : "text-text-muted"} />
      </Ring>
      <span className="num min-w-0 flex-1 truncate text-xs font-bold">{figure}</span>
      <span aria-hidden="true" className="num inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-accent">
        <Plus size={10} />
        {step}
      </span>
    </button>
  );
  return (
    <div role="group" aria-label={t("Today's protein and water")} className="flex gap-1 border-t border-line px-1 py-0.5">
      {chip("p", t("Protein"), proteinG, proteinTarget, `${proteinG}/${proteinTarget} g`, "25 g", t("Add 25 g protein"), () => add({ proteinG: 25 }), Beef)}
      {chip("w", t("Water"), waterMl, waterTarget, `${litres(waterMl)}/${litres(waterTarget)} L`, "0.5 L", t("Add 500 ml water"), () => add({ waterMl: 500 }), Droplets)}
    </div>
  );
}

/** One segment per week: done in Volt, this week half-lit. */
export function BlockBar({ of, progress, week, finished, label, thin = false }: { of: number; progress: number; week: number; finished: boolean; label: string; thin?: boolean }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={of} aria-valuenow={week} className={`flex gap-0.5 ${thin ? "h-1" : "h-1.5"}`}>
      {Array.from({ length: of }, (_, i) => {
        const done = (i + 1) / of <= progress + 1e-9;
        const current = i + 1 === week && !finished;
        return <span key={i} className={`h-full flex-1 rounded-full ${done ? "bg-accent" : current ? "bg-accent/45" : "bg-track"}`} />;
      })}
    </div>
  );
}

/**
 * Protein and water for today: a ring each that fills toward the target. Tapping the tile adds
 * 25 g or 500 ml; the step is printed under the figure so the tap's effect is known in advance.
 */
export function Pacer({
  proteinTarget,
  waterTarget,
  now,
  size = 44,
  bordered = true,
}: {
  proteinTarget: number;
  waterTarget: number;
  now: number;
  size?: number;
  bordered?: boolean;
}) {
  const t = useT();
  const { proteinG, waterMl } = useTodayFuel(now);
  const add = useFuelPacer((s) => s.add);
  // Water reads in litres ("1.5/2.5 L"): four-digit millilitres do not fit beside the ring at 360px.
  const show = (n: number, litres: boolean) => (litres ? (n / 1000).toLocaleString(t.locale, { maximumFractionDigits: 1 }) : n.toLocaleString(t.locale));
  const item = (key: string, label: string, value: number, target: number, unitLabel: string, step: string, aria: string, onAdd: () => void, Icon: typeof Droplets, litres = false) => (
    <button
      key={key}
      type="button"
      onClick={() => {
        feedback.tick();
        onAdd();
      }}
      aria-label={aria}
      className="flex min-h-14 min-w-0 flex-1 items-center gap-2.5 rounded-ctl px-2 py-1.5 text-left hover:bg-ink/[0.04] active:bg-ink/[0.07]"
    >
      <Ring value={value} max={target} size={size} stroke={4} label={`${label}: ${value} / ${target}`}>
        <Icon aria-hidden="true" size={Math.round(size * 0.36)} className={value >= target ? "text-accent" : "text-text-muted"} />
      </Ring>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-text-muted">{label}</span>
        <span className="num block whitespace-nowrap text-sm font-bold">
          {show(value, litres)}
          <span className="text-[11px] font-semibold text-text-muted">
            /{show(target, litres)} {unitLabel}
          </span>
        </span>
        <span aria-hidden="true" className="num mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-accent">
          <Plus size={11} />
          {step}
        </span>
      </span>
    </button>
  );
  return (
    <div role="group" aria-label={t("Today's protein and water")} className={`flex gap-1 px-2 py-1.5 ${bordered ? "border-t border-line" : ""}`}>
      {item("p", t("Protein"), proteinG, proteinTarget, "g", "25 g", t("Add 25 g protein"), () => add({ proteinG: 25 }), Beef)}
      {item("w", t("Water"), waterMl, waterTarget, "L", "0.5 L", t("Add 500 ml water"), () => add({ waterMl: 500 }), Droplets, true)}
    </div>
  );
}
