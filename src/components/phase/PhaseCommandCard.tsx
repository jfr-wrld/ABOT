"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Beef, ChevronRight, Droplets, Flame, Hammer, Plus, Scale, Zap } from "lucide-react";
import { addProtein, addWater, useTodayFuel } from "@/store/useFuelPacer";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useEntitlements } from "@/store/useEntitlements";
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
  const pro = useEntitlements().canAccessPro("body_phase_protocols");

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
          <span className="flex items-center gap-1.5">
            <span className="label-caps">{t("Body phase")}</span>
            {/* Said before the four setup steps, not after them. */}
            {!pro && <span className="rounded-full border border-accent/50 px-1.5 text-[11px] font-bold text-accent">PRO</span>}
          </span>
          <span className="block text-sm font-semibold">{t("Lose fat or build muscle, with daily targets")}</span>
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
  const litres = (n: number) => (n / 1000).toLocaleString(t.locale, { maximumFractionDigits: 1 });
  return (
    <div role="group" aria-label={t("Today's protein and water")} className="flex gap-1 border-t border-line px-1 py-0.5">
      <PacerChip
        label={t("Protein")}
        value={proteinG}
        target={proteinTarget}
        step={25}
        figure={`${proteinG}/${proteinTarget} g`}
        stepText="25 g"
        aria={t("Add 25 g protein")}
        onAdd={() => addProtein(25)}
        Icon={Beef}
      />
      <PacerChip
        label={t("Water")}
        value={waterMl}
        target={waterTarget}
        step={500}
        figure={`${litres(waterMl)}/${litres(waterTarget)} L`}
        stepText="0.5 L"
        aria={t("Add 500 ml water")}
        onAdd={() => addWater(500)}
        Icon={Droplets}
      />
    </div>
  );
}

type ChipProps = {
  label: string;
  value: number;
  target: number;
  step: number;
  figure: string;
  stepText: string;
  aria: string;
  onAdd: () => void;
  Icon: typeof Droplets;
};

/**
 * What a protein or water tap feels like: a "+25 g" ghost rises from the chip, and the tap that
 * reaches the target pulses the ring in Volt with the set-complete sound. Ticks otherwise.
 */
function useAddMoment(value: number, target: number, step: number) {
  const [ghosts, setGhosts] = useState<number[]>([]);
  const [pulse, setPulse] = useState(0);
  const fire = () => {
    const reached = value < target && value + step >= target;
    if (reached) {
      feedback.setComplete();
      setPulse((p) => p + 1);
    } else feedback.tick();
    setGhosts((g) => [...g, Date.now() + Math.random()]);
  };
  const done = (id: number) => setGhosts((g) => g.filter((x) => x !== id));
  return { ghosts, pulse, fire, done };
}

function Ghost({ id, text, done }: { id: number; text: string; done: (id: number) => void }) {
  return (
    <motion.span
      aria-hidden="true"
      className="num pointer-events-none absolute right-2 top-1 text-[11px] font-bold text-accent"
      initial={{ y: 0, opacity: 1 }}
      animate={{ y: -18, opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      onAnimationComplete={() => done(id)}
    >
      +{text}
    </motion.span>
  );
}

/** The ring wrapper: one Volt pulse each time `pulse` goes up (never on first show). */
function PulseRing({ pulse, children }: { pulse: number; children: ReactNode }) {
  return (
    <motion.span
      key={pulse}
      className="inline-flex rounded-full"
      initial={pulse ? { scale: 1, boxShadow: "0 0 0px rgb(204 255 0 / 0)" } : false}
      animate={pulse ? { scale: [1, 1.22, 1], boxShadow: ["0 0 0px rgb(204 255 0 / 0)", "0 0 16px rgb(204 255 0 / 0.7)", "0 0 0px rgb(204 255 0 / 0)"] } : undefined}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.span>
  );
}

function PacerChip({ label, value, target, step, figure, stepText, aria, onAdd, Icon }: ChipProps) {
  const m = useAddMoment(value, target, step);
  return (
    <button
      type="button"
      onClick={() => {
        m.fire();
        onAdd();
      }}
      aria-label={aria}
      className="tap relative flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-ctl px-2 text-left hover:bg-ink/[0.04] active:bg-ink/[0.07]"
    >
      <PulseRing pulse={m.pulse}>
        <Ring value={value} max={target} size={28} stroke={3} label={`${label}: ${value} / ${target}`}>
          <Icon aria-hidden="true" size={11} className={value >= target ? "text-accent" : "text-text-muted"} />
        </Ring>
      </PulseRing>
      <span className="num min-w-0 flex-1 truncate text-xs font-bold">{figure}</span>
      <span aria-hidden="true" className="num inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-accent">
        <Plus size={10} />
        {stepText}
      </span>
      {m.ghosts.map((id) => (
        <Ghost key={id} id={id} text={stepText} done={m.done} />
      ))}
    </button>
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
  // Water reads in litres ("1.5/2.5 L"): four-digit millilitres do not fit beside the ring at 360px.
  const show = (n: number, litres: boolean) => (litres ? (n / 1000).toLocaleString(t.locale, { maximumFractionDigits: 1 }) : n.toLocaleString(t.locale));
  return (
    <div role="group" aria-label={t("Today's protein and water")} className={`flex gap-1 px-2 py-1.5 ${bordered ? "border-t border-line" : ""}`}>
      <PacerItem
        label={t("Protein")}
        value={proteinG}
        target={proteinTarget}
        step={25}
        figure={show(proteinG, false)}
        targetText={`/${show(proteinTarget, false)} g`}
        stepText="25 g"
        aria={t("Add 25 g protein")}
        onAdd={() => addProtein(25)}
        Icon={Beef}
        size={size}
      />
      <PacerItem
        label={t("Water")}
        value={waterMl}
        target={waterTarget}
        step={500}
        figure={show(waterMl, true)}
        targetText={`/${show(waterTarget, true)} L`}
        stepText="0.5 L"
        aria={t("Add 500 ml water")}
        onAdd={() => addWater(500)}
        Icon={Droplets}
        size={size}
      />
    </div>
  );
}

function PacerItem({ label, value, target, step, figure, targetText, stepText, aria, onAdd, Icon, size }: Omit<ChipProps, "figure"> & { figure: string; targetText: string; size: number }) {
  const m = useAddMoment(value, target, step);
  return (
    <button
      type="button"
      onClick={() => {
        m.fire();
        onAdd();
      }}
      aria-label={aria}
      className="tap relative flex min-h-14 min-w-0 flex-1 items-center gap-2.5 rounded-ctl px-2 py-1.5 text-left hover:bg-ink/[0.04] active:bg-ink/[0.07]"
    >
      <PulseRing pulse={m.pulse}>
        <Ring value={value} max={target} size={size} stroke={4} label={`${label}: ${value} / ${target}`}>
          <Icon aria-hidden="true" size={Math.round(size * 0.36)} className={value >= target ? "text-accent" : "text-text-muted"} />
        </Ring>
      </PulseRing>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-text-muted">{label}</span>
        <span className="num block whitespace-nowrap text-sm font-bold">
          {figure}
          <span className="text-[11px] font-semibold text-text-muted">{targetText}</span>
        </span>
        <span aria-hidden="true" className="num mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-accent">
          <Plus size={11} />
          {stepText}
        </span>
      </span>
      {m.ghosts.map((id) => (
        <Ghost key={id} id={id} text={stepText} done={m.done} />
      ))}
    </button>
  );
}
