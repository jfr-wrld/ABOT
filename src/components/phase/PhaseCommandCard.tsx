"use client";

import { useState } from "react";
import { Droplets, Flame, Hammer, Plus, Scale, Settings2, Shield, Soup, Zap } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useFuelPacer, useTodayFuel } from "@/store/useFuelPacer";
import { useEntitlements } from "@/store/useEntitlements";
import { CHART, numTick, tooltipStyle } from "@/components/analytics/chartTheme";
import { ProBadge } from "@/components/paywall/ProBadge";
import { PHASE_LABEL, RISK_LABEL, type BodyPhaseType } from "@/lib/phase-engine";
import { toDisplay } from "@/lib/units";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";
import { usePhaseTelemetry, type PhaseTelemetry } from "./usePhaseTelemetry";
import { PhaseSetupModal } from "./PhaseSetupModal";
import { WeightLogModal } from "./WeightLogModal";
import { NutritionGuideModal } from "./NutritionGuideModal";

export const PHASE_ICON: Record<BodyPhaseType, typeof Flame> = { CUTTING: Flame, BULKING: Hammer, RECOMP: Scale, STRENGTH_PEAK: Zap };

/**
 * The active body phase at a glance: week of the block, trend weight, today's fuel target,
 * relative strength, and a one-tap protein and water tally. `full` (Profile) adds the raw
 * against trend weight chart. Without a phase it invites the lifter to pick one.
 */
export function PhaseCommandCard({ now, full = false }: { now: number; full?: boolean }) {
  const t = useT();
  const telemetry = usePhaseTelemetry(now);
  const [setup, setSetup] = useState(false);
  const [log, setLog] = useState(false);
  const [guide, setGuide] = useState(false);
  const { canAccessPro, openPaywall } = useEntitlements();

  const openSetup = () => (canAccessPro("body_phase_protocols") ? setSetup(true) : openPaywall("body_phase_protocols"));

  return (
    <>
      {telemetry ? (
        <ActiveCard telemetry={telemetry} full={full} now={now} onSetup={openSetup} onLog={() => setLog(true)} onGuide={() => setGuide(true)} />
      ) : (
        <section aria-labelledby="phase-cta" className="panel flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="phase-cta" className="label-caps">
                {t("Body phase")} <ProBadge className="ml-1 align-middle" />
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                {t("Pick a cut, lean bulk, recomp or strength peak. ABOT sets your daily calories and macros and tunes the coach and recovery to it.")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
            {(Object.keys(PHASE_ICON) as BodyPhaseType[]).map((p) => {
              const Icon = PHASE_ICON[p];
              return (
                <span key={p} className="flex flex-col items-center gap-1 rounded-ctl bg-surface-2 py-2 text-[11px] font-semibold text-text-muted">
                  <Icon size={16} />
                  {t(PHASE_LABEL[p])}
                </span>
              );
            })}
          </div>
          <button
            type="button"
            onClick={openSetup}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-on-accent hover:brightness-110"
          >
            {t("Choose a body phase")}
          </button>
        </section>
      )}
      {/* Mounted only while open, so each opening starts from the saved values. */}
      {setup && <PhaseSetupModal open onClose={() => setSetup(false)} now={now} />}
      {log && <WeightLogModal open onClose={() => setLog(false)} now={now} />}
      {guide && telemetry && <NutritionGuideModal open onClose={() => setGuide(false)} telemetry={telemetry} />}
    </>
  );
}

function ActiveCard({
  telemetry: m,
  full,
  now,
  onSetup,
  onLog,
  onGuide,
}: {
  telemetry: PhaseTelemetry;
  now: number;
  full: boolean;
  onSetup: () => void;
  onLog: () => void;
  onGuide: () => void;
}) {
  const t = useT();
  const unit = useSettingsStore((s) => s.weightUnit);
  const Icon = PHASE_ICON[m.phase.phaseType];
  const { meso, fuel, shield } = m;
  const rate = m.ratePerWeek;
  const shown = (kg: number) => (Math.round(toDisplay(kg, unit) * 10) / 10).toFixed(1);

  return (
    <section aria-labelledby="phase-heading" className="panel flex flex-col gap-3 p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="phase-heading" className="label-caps flex flex-wrap items-center gap-x-1.5">
            <Icon aria-hidden="true" size={13} className="text-accent" />
            <span>
              {t("Active protocol")} {"//"} {t(PHASE_LABEL[m.phase.phaseType])}
            </span>
          </h2>
          <p className="num mt-1 text-sm font-semibold">
            {meso.finished
              ? t("Block finished")
              : t("Week {week} of {of}", { week: meso.week, of: meso.of })}
            {meso.deload && !meso.finished && <span className="ml-2 rounded-full bg-warmup/15 px-2 py-0.5 text-[11px] font-bold uppercase text-warmup">{t("Deload week")}</span>}
          </p>
        </div>
        <button type="button" onClick={onSetup} aria-label={t("Edit body phase")} className="flex size-11 shrink-0 items-center justify-center rounded-ctl text-text-muted hover:bg-ink/[0.05] hover:text-text">
          <Settings2 aria-hidden="true" size={18} />
        </button>
      </header>

      <div
        role="progressbar"
        aria-label={t("Block progress")}
        aria-valuemin={0}
        aria-valuemax={meso.of}
        aria-valuenow={meso.week}
        className="flex h-2 gap-0.5 overflow-hidden rounded-full"
      >
        {Array.from({ length: meso.of }, (_, i) => {
          const done = (i + 1) / meso.of <= meso.progress + 1e-9;
          const current = i + 1 === meso.week && !meso.finished;
          return <span key={i} className={`h-full flex-1 ${done ? "bg-accent" : current ? "bg-accent/45" : "bg-surface-2"}`} />;
        })}
      </div>

      <dl className="grid gap-2">
        <div className="flex items-center justify-between gap-3 rounded-ctl bg-surface-2 px-3 py-2">
          <div className="min-w-0">
            <dt className="label-caps">{t("Trend weight")}</dt>
            <dd className="num text-lg font-bold">
              {shown(m.trendKg)} <span className="text-sm font-semibold text-text-muted">{unit}</span>
              {rate !== null && (
                <span className="ml-2 text-xs font-semibold text-text-muted">
                  {rate > 0 ? "+" : rate < 0 ? "−" : "±"}
                  {t("{weight} {unit}/wk", { weight: shown(Math.abs(rate)), unit })}
                </span>
              )}
            </dd>
          </div>
          <button
            type="button"
            onClick={onLog}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-ctl border border-ink/[0.12] px-3 text-xs font-bold hover:border-ink/25"
          >
            <Plus aria-hidden="true" size={14} />
            {t("Log weight")}
          </button>
        </div>

        <div className="rounded-ctl bg-surface-2 px-3 py-2">
          <dt className="label-caps">{m.phase.phaseType === "RECOMP" ? (m.trainingDay ? t("Fuel target, training day") : t("Fuel target, rest day")) : t("Daily fuel target")}</dt>
          <dd className="num">
            <span className="text-lg font-bold text-accent">{fuel.kcal.toLocaleString(t.locale)}</span> <span className="text-sm font-semibold text-text-muted">kcal</span>
            <span className="mt-0.5 block text-xs font-semibold text-text-muted">
              {t("{p} g protein · {c} g carbs · {f} g fat", { p: fuel.proteinG, c: fuel.carbsG, f: fuel.fatG })}
            </span>
          </dd>
        </div>

        <div className="rounded-ctl bg-surface-2 px-3 py-2">
          <dt className="label-caps">{t("Relative strength")}</dt>
          <dd className="num">
            {shield ? (
              <>
                <span className="text-lg font-bold">{t("{x}× body weight", { x: shield.ratio.toFixed(2) })}</span>
                {shield.changePct !== null && (
                  <span className={`ml-2 text-xs font-semibold ${shield.changePct >= 0 ? "text-accent" : "text-failure"}`}>
                    {shield.changePct >= 0 ? "▲ +" : "▼ "}
                    {shield.changePct.toFixed(1)}%
                  </span>
                )}
                {shield.risk && (
                  <span className={`mt-0.5 flex items-center gap-1 text-xs font-semibold ${shield.risk === "low" ? "text-accent" : shield.risk === "high" ? "text-failure" : "text-text-muted"}`}>
                    <Shield aria-hidden="true" size={12} />
                    {t(RISK_LABEL[shield.risk])}
                  </span>
                )}
              </>
            ) : (
              <span className="font-sans text-xs text-text-muted">{t("Log a barbell squat, bench, deadlift or press and a weigh-in to see this.")}</span>
            )}
          </dd>
        </div>
      </dl>

      <Pacer proteinTarget={fuel.proteinG} waterTarget={m.waterMl} now={now} />

      <button
        type="button"
        onClick={onGuide}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-ink/[0.12] bg-surface-2 px-4 text-sm font-semibold hover:border-ink/25"
      >
        <Soup aria-hidden="true" size={16} />
        {t("Food guide")}
      </button>

      {full && <TrendChart telemetry={m} />}
      <p className="text-[11px] text-text-muted">{t("Targets are estimates from Mifflin-St Jeor and your logged training, not medical advice.")}</p>
    </section>
  );
}

/** One-tap protein and water tally for today. */
function Pacer({ proteinTarget, waterTarget, now }: { proteinTarget: number; waterTarget: number; now: number }) {
  const t = useT();
  const { proteinG, waterMl } = useTodayFuel(now);
  const add = useFuelPacer((s) => s.add);
  const row = (label: string, value: number, target: number, unitLabel: string, button: string, aria: string, onAdd: () => void, Icon: typeof Droplets) => {
    const pct = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
    return (
      <div className="flex items-center gap-3">
        <Icon aria-hidden="true" size={16} className="shrink-0 text-text-muted" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-semibold">{label}</span>
            <span className="num text-text-muted">
              {value.toLocaleString(t.locale)} / {target.toLocaleString(t.locale)} {unitLabel}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={target} aria-valuenow={value}>
            <div className={`h-full ${pct >= 100 ? "bg-accent" : "bg-accent/60"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            feedback.tick();
            onAdd();
          }}
          aria-label={aria}
          className="num inline-flex min-h-11 min-w-[76px] shrink-0 items-center justify-center rounded-ctl border border-ink/[0.12] px-2 text-xs font-bold hover:border-ink/25"
        >
          {button}
        </button>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-2" aria-label={t("Today's protein and water")} role="group">
      {row(t("Protein today"), proteinG, proteinTarget, "g", "+25 g", t("Add 25 g protein"), () => add({ proteinG: 25 }), Soup)}
      {row(t("Water today"), waterMl, waterTarget, "ml", "+500 ml", t("Add 500 ml water"), () => add({ waterMl: 500 }), Droplets)}
    </div>
  );
}

/** Raw weigh-ins against the trend line, last 60 entries. */
function TrendChart({ telemetry: m }: { telemetry: PhaseTelemetry }) {
  const t = useT();
  const unit = useSettingsStore((s) => s.weightUnit);
  const data = m.points.slice(-60).map((p) => ({
    date: new Date(p.date).toLocaleDateString(t.locale, { day: "numeric", month: "short" }),
    raw: Math.round(toDisplay(p.weightKg, unit) * 10) / 10,
    trend: Math.round(toDisplay(p.emaKg, unit) * 10) / 10,
  }));
  if (data.length < 2) return <p className="text-xs text-text-muted">{t("Log your weight on a few days to see the trend line.")}</p>;
  return (
    <figure aria-label={t("Scale weight against trend weight, {unit}", { unit })} className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="date" tick={numTick} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={numTick} tickLine={false} axisLine={false} domain={["dataMin - 1", "dataMax + 1"]} />
          <Tooltip {...tooltipStyle} cursor={{ stroke: CHART.axis }} formatter={(v, name) => [`${v} ${unit}`, name === "raw" ? t("Scale") : t("Trend")]} />
          <Line type="monotone" dataKey="raw" stroke={CHART.axis} strokeWidth={1} dot={{ r: 2 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="trend" stroke={CHART.series} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <figcaption className="mt-1 flex gap-3 text-[11px] text-text-muted">
        <span>— {t("Scale")}</span>
        <span className="text-accent">— {t("Trend")}</span>
      </figcaption>
    </figure>
  );
}

