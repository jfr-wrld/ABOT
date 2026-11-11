"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Settings2, ShieldCheck, Soup } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { CountFromZero, Rise } from "@/components/motion/Entrance";
import { CHART, numTick, tooltipStyle } from "@/components/analytics/chartTheme";
import { PHASE_ICON, Pacer } from "@/components/phase/PhaseCommandCard";
import { usePhaseTelemetry, type PhaseTelemetry } from "@/components/phase/usePhaseTelemetry";
import { BlockPlate, ChangeMeter, MacroDonut, MacroLegend, Stepper } from "@/components/phase/visuals";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useBodyStore } from "@/store/useBodyStore";
import { dayKey } from "@/lib/bodyweight";
import { feedback } from "@/lib/feedback";
import { fromDisplay, toDisplay } from "@/lib/units";
import { useNow } from "@/lib/useNow";
import { PHASE_LABEL, RISK_LABEL } from "@/lib/phase-engine";
import { useT } from "@/i18n";

export default function PhasePage() {
  return (
    <HydrationGate>
      <PhaseScreen />
    </HydrationGate>
  );
}

function PhaseScreen() {
  const t = useT();
  const now = useNow(60_000);
  const m = usePhaseTelemetry(now);

  if (!m) {
    return (
      <main className="flex flex-1 flex-col">
        <PageHeader title={t("Body phase")} back={{ href: "/", label: t("Home") }} />
        <section className="mx-4 mt-6 flex flex-col items-center gap-4 rounded-card border border-line bg-surface p-6 text-center">
          <BlockPlate weeks={8} done={0} current={null} size={120} />
          <p className="text-sm text-text-muted">{t("No phase running.")}</p>
          <Link href="/phase/setup" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-bold text-on-accent hover:brightness-110">
            {t("Choose a body phase")}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 pb-8">
      <PageHeader
        title={t(PHASE_LABEL[m.phase.phaseType])}
        back={{ href: "/", label: t("Home") }}
        action={
          <Link href="/phase/setup" aria-label={t("Edit body phase")} className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-ink/[0.05] hover:text-text">
            <Settings2 aria-hidden="true" size={20} />
          </Link>
        }
      />
      <Rise order={0} className="px-4">
        <Hero m={m} />
      </Rise>
      <Rise order={1} className="px-4">
        <Fuel m={m} />
      </Rise>
      <Rise order={2} className="px-4">
        <section aria-label={t("Today's protein and water")} className="rounded-card border border-line bg-surface">
          <Pacer proteinTarget={m.fuel.proteinG} waterTarget={m.waterMl} now={now} size={52} bordered={false} />
        </section>
      </Rise>
      <Rise order={3} className="px-4">
        <Weigh m={m} now={now} />
      </Rise>
      <Rise order={4} className="px-4">
        <Strength m={m} />
      </Rise>
      <p className="px-4 text-center text-[11px] text-text-muted">{t("Targets are estimates from Mifflin-St Jeor and your logged training. Not medical advice.")}</p>
    </main>
  );
}

/** The plate: weeks lit so far, this week half-lit; beside it the weight from start to target. */
function Hero({ m }: { m: PhaseTelemetry }) {
  const t = useT();
  const unit = useSettingsStore((s) => s.weightUnit);
  const { meso, phase } = m;
  const Icon = PHASE_ICON[phase.phaseType];
  const done = Math.floor(meso.progress * meso.of + 1e-9);
  const shown = (kg: number) => (Math.round(toDisplay(kg, unit) * 10) / 10).toFixed(1);
  // Where the trend sits between start and target, 0..1 (either direction).
  const span = phase.targetWeightKg - phase.startWeightKg;
  const along = span === 0 ? 1 : Math.max(0, Math.min(1, (m.trendKg - phase.startWeightKg) / span));

  return (
    <section aria-labelledby="hero-week" className="flex items-center gap-4">
      <BlockPlate weeks={meso.of} done={done} current={meso.finished ? null : meso.week - 1} size={156}>
        <Icon aria-hidden="true" size={16} className="text-accent" />
        <span id="hero-week" className="num text-3xl font-bold leading-none">
          {meso.finished ? meso.of : meso.week}
          <span className="text-base font-semibold text-text-muted">/{meso.of}</span>
        </span>
        <span className="label-caps">{meso.finished ? t("Done") : t("Week")}</span>
      </BlockPlate>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {meso.deload && !meso.finished && (
          <span className="w-fit rounded-ctl bg-warmup/15 px-2 py-1 text-xs font-bold text-warmup">{t("Deload week: lighter loads")}</span>
        )}
        <div>
          <p className="label-caps">{t("Trend")}</p>
          <p className="num text-2xl font-bold">
            {shown(m.trendKg)}
            <span className="ml-1 text-sm font-semibold text-text-muted">{unit}</span>
          </p>
          {m.ratePerWeek !== null && (
            <p className="num text-xs text-text-muted">
              {m.ratePerWeek > 0 ? "+" : m.ratePerWeek < 0 ? "−" : "±"}
              {Math.abs(Math.round(toDisplay(m.ratePerWeek, unit) * 10) / 10)} {unit}/{t("wk")}
            </p>
          )}
        </div>
        <div aria-label={t("From {start} to {target} {unit}", { start: shown(phase.startWeightKg), target: shown(phase.targetWeightKg), unit })} role="img">
          <div className="relative h-1.5 rounded-full bg-track">
            <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${along * 100}%` }} />
          </div>
          <div className="num mt-1 flex justify-between text-[11px] text-text-muted" aria-hidden="true">
            <span>{shown(phase.startWeightKg)}</span>
            <span>{shown(phase.targetWeightKg)}</span>
          </div>
        </div>
        <p className="num text-xs text-text-muted">{meso.finished ? t("Block finished") : t("{n} days left", { n: meso.daysLeft })}</p>
      </div>
    </section>
  );
}

/** Today's calories split by macro, with the meal plan one tap away. */
function Fuel({ m }: { m: PhaseTelemetry }) {
  const t = useT();
  const { fuel } = m;
  return (
    <section aria-labelledby="fuel-heading" className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="fuel-heading" className="label-caps">
          {m.phase.phaseType === "RECOMP" ? (m.trainingDay ? t("Today, training day") : t("Today, rest day")) : t("Today")}
        </h2>
        <span className="num text-[11px] text-text-muted">
          {fuel.delta > 0 ? "+" : fuel.delta < 0 ? "−" : "±"}
          {Math.abs(fuel.delta)} {t("vs maintenance")}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <MacroDonut protein={fuel.proteinG} carbs={fuel.carbsG} fat={fuel.fatG} size={124}>
          <CountFromZero value={fuel.kcal} format={(n) => Math.round(n).toLocaleString(t.locale)} className="num text-xl font-bold text-accent" />
          <span className="label-caps">kcal</span>
        </MacroDonut>
        <div className="min-w-0 flex-1">
          <MacroLegend protein={fuel.proteinG} carbs={fuel.carbsG} fat={fuel.fatG} labels={[t("Protein"), t("Carbs"), t("Fat")]} />
        </div>
      </div>
      <Link href="/phase/fuel" className="mt-3 flex min-h-11 items-center gap-2 rounded-ctl bg-surface-2 px-3 text-sm font-semibold hover:bg-press">
        <Soup aria-hidden="true" size={18} className="text-accent" />
        <span className="flex-1">{t("Meals and foods")}</span>
        <ChevronRight aria-hidden="true" size={16} className="text-text-muted" />
      </Link>
    </section>
  );
}

/** Today's weigh-in with a stepper, optional body fat and waist, and the trend chart. */
function Weigh({ m, now }: { m: PhaseTelemetry; now: number }) {
  const t = useT();
  const unit = useSettingsStore((s) => s.weightUnit);
  const entries = useBodyStore((s) => s.entries);
  const logWeight = useBodyStore((s) => s.logWeight);
  const today = entries.find((e) => e.id === dayKey(now));
  const start = today?.weightKg ?? m.trendKg;
  const [value, setValue] = useState(Math.round(toDisplay(start, unit) * 10) / 10);
  const [more, setMore] = useState(false);
  const [fat, setFat] = useState(today?.bodyFatPercent ?? 20);
  const [waist, setWaist] = useState(today?.waistCm ?? 80);
  const [saved, setSaved] = useState(false);

  function save() {
    feedback.setComplete();
    logWeight(fromDisplay(value, unit), now, more ? { bodyFatPercent: fat, waistCm: waist } : {});
    setSaved(true);
  }

  const data = m.points.slice(-60).map((p) => ({
    date: new Date(p.date).toLocaleDateString(t.locale, { day: "numeric", month: "short" }),
    raw: Math.round(toDisplay(p.weightKg, unit) * 10) / 10,
    trend: Math.round(toDisplay(p.emaKg, unit) * 10) / 10,
  }));

  return (
    <section aria-labelledby="weigh-heading" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="weigh-heading" className="label-caps">
          {today ? t("Today's weigh-in") : t("Weigh in")}
        </h2>
        <Link href="/profile/body" className="-my-3 -mr-2 flex min-h-11 items-center rounded-ctl px-2 text-xs font-semibold text-text-muted hover:text-text">
          {t("All weigh-ins")}
        </Link>
      </div>
      <Stepper label={t("Weight")} value={value} onChange={(n) => (setValue(n), setSaved(false))} step={0.1} min={20} max={unit === "lbs" ? 880 : 400} unit={unit} decimals={1} />
      {more && (
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <Stepper label={t("Body fat %")} value={fat} onChange={(n) => (setFat(n), setSaved(false))} step={0.5} min={2} max={70} unit="%" decimals={1} />
          <Stepper label={t("Waist")} value={waist} onChange={(n) => (setWaist(n), setSaved(false))} step={0.5} min={40} max={250} unit="cm" decimals={1} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => setMore((v) => !v)} aria-expanded={more} className="!px-2 text-xs">
          {more ? t("Weight only") : t("Add body fat and waist")}
        </Button>
        <Button variant="primary" onClick={save} className="ml-auto min-w-28">
          {saved ? t("Saved") : today ? t("Update") : t("Save")}
        </Button>
      </div>
      {data.length >= 2 ? (
        <figure aria-label={t("Scale weight against trend weight, {unit}", { unit })} className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="date" tick={numTick} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tick={numTick} tickLine={false} axisLine={false} domain={["dataMin - 1", "dataMax + 1"]} />
              <Tooltip {...tooltipStyle} cursor={{ stroke: CHART.axis }} formatter={(v, name) => [`${v} ${unit}`, name === "raw" ? t("Scale") : t("Trend")]} />
              <Line type="monotone" dataKey="raw" stroke={CHART.axis} strokeWidth={1} dot={{ r: 2 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="trend" stroke={CHART.series} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </figure>
      ) : (
        <p className="text-xs text-text-muted">{t("Weigh in on a few mornings to see your trend line.")}</p>
      )}
    </section>
  );
}

/** Strength per kg of body weight, and on a cut whether muscle is holding. */
function Strength({ m }: { m: PhaseTelemetry }) {
  const t = useT();
  const s = m.shield;
  return (
    <section aria-labelledby="strength-heading" className="rounded-card border border-line bg-surface p-4">
      <h2 id="strength-heading" className="label-caps">
        {t("Relative strength")}
      </h2>
      {s ? (
        <div className="mt-2 flex flex-col gap-2">
          <p className="num text-2xl font-bold">
            {s.ratio.toFixed(2)}
            <span className="ml-1 text-sm font-semibold text-text-muted">× {t("body weight")}</span>
          </p>
          {s.changePct !== null && (
            <>
              <ChangeMeter pct={s.changePct} />
              <p className="num flex justify-between text-[11px] text-text-muted">
                <span>−5%</span>
                <span className={s.changePct >= 0 ? "font-bold text-accent" : "font-bold text-failure"}>
                  {s.changePct >= 0 ? "+" : ""}
                  {s.changePct.toFixed(1)}% {t("vs 4 weeks before")}
                </span>
                <span>+5%</span>
              </p>
            </>
          )}
          {s.risk && (
            <p className={`flex items-center gap-1.5 text-sm font-semibold ${s.risk === "low" ? "text-accent" : s.risk === "high" ? "text-failure" : "text-text-muted"}`}>
              <ShieldCheck aria-hidden="true" size={16} />
              {t(RISK_LABEL[s.risk])}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-text-muted">{t("Log a barbell squat, bench, deadlift or press, and a weigh-in, to see this.")}</p>
      )}
    </section>
  );
}
