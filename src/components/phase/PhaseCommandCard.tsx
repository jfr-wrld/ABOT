"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Droplets, Flame, Hammer, Plus, Scale, Zap } from "@/components/icons";
import { Beef } from "lucide-react";
import { addProtein, addWater, useTodayFuel } from "@/store/useFuelPacer";
import { dayOf, useFoodLog } from "@/store/useFoodLog";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useEntitlements } from "@/store/useEntitlements";
import { PHASE_LABEL, weeklyCheckIn, type BodyPhaseType } from "@/lib/phase-engine";
import { toDisplay } from "@/lib/units";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";
import { usePhaseTelemetry } from "./usePhaseTelemetry";
import { Ring } from "./visuals";

export const PHASE_ICON: Record<BodyPhaseType, typeof Flame> = { CUTTING: Flame, BULKING: Hammer, RECOMP: Scale, STRENGTH_PEAK: Zap };
/** Each phase's own colour (globals.css): the card takes it on, so Home is not green on green. */
export const PHASE_COLOR: Record<BodyPhaseType, string> = {
  CUTTING: "var(--color-phase-cut)",
  BULKING: "var(--color-phase-bulk)",
  RECOMP: "var(--color-phase-recomp)",
  STRENGTH_PEAK: "var(--color-phase-peak)",
};

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
  const today = dayOf(now);
  const eatenToday = useFoodLog((s) => Math.round(s.entries.reduce((n, e) => (e.day === today ? n + e.kcal : n), 0)));

  if (!m) {
    return (
      <Link href="/phase/setup" aria-label={t("Choose a body phase")} className="panel group flex items-center gap-3 p-4 hover:border-ink/[0.15]">
        <span aria-hidden="true" className="flex -space-x-2">
          {(Object.keys(PHASE_ICON) as BodyPhaseType[]).map((p) => {
            const Icon = PHASE_ICON[p];
            return (
              <span
                key={p}
                className="tile flex size-9 items-center justify-center rounded-full border-2 border-surface"
                style={{ color: PHASE_COLOR[p], backgroundColor: `color-mix(in oklab, ${PHASE_COLOR[p]} 14%, var(--color-surface))` }}
              >
                <Icon size={16} />
              </span>
            );
          })}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="field-label">{t("Body phase")}</span>
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
  const color = PHASE_COLOR[m.phase.phaseType];
  const { meso, fuel } = m;
  const checkIn = weeklyCheckIn(m.phase, m.points, now);
  const eaten = eatenToday;
  const weight = (Math.round(toDisplay(m.trendKg, unit) * 10) / 10).toFixed(1);
  const rate = m.ratePerWeek;
  const left = fuel.kcal - eaten;

  return (
    <section
      aria-labelledby="phase-heading"
      className="panel overflow-hidden"
      // The phase colour as a wash from the top corner, fading into the surface; the edge stays the
      // ordinary faint line so the colour reads as light on the card, not as an outline.
      style={{ backgroundImage: `var(--neo-card-face), linear-gradient(150deg, color-mix(in oklab, ${color} 20%, var(--color-surface)) 0%, var(--color-surface) 75%)` }}
    >
      {/* The block as weeks, today's room to eat as the lead figure, the weight trend beside it.
          The phase's icon stays beside its name (owner, 2026-11-15). */}
      <Link href="/phase" className="flex flex-col gap-3 px-3.5 pb-3 pt-3 hover:bg-ink/[0.02]">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="tile flex size-8 shrink-0 items-center justify-center rounded-full"
            style={{ color, backgroundColor: `color-mix(in oklab, ${color} 26%, var(--color-surface))` }}
          >
            <Icon size={16} style={{ color }} />
          </span>
          <h2 id="phase-heading" className="min-w-0 truncate text-base font-bold">
            {t(PHASE_LABEL[m.phase.phaseType])}
          </h2>
          {meso.deload && !meso.finished && <span className="shrink-0 text-xs font-bold text-warmup">{t("Deload")}</span>}
          <span className="flex-1" />
          {/* Something waits on the phase page: the week's check-in, or the end-of-block summary. The
              dot marks that state; there is no dot otherwise. */}
          {(meso.finished || (checkIn && checkIn.kind !== "need_weighins")) && (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold" style={{ color }}>
              <span aria-hidden="true" className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
              {meso.finished ? t("See what's next") : t("Check-in")}
            </span>
          )}
          <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-text-muted" />
        </div>

        <BlockWeeks week={meso.week} of={meso.of} progress={meso.progress} finished={meso.finished} color={color} label={meso.finished ? t("Done") : t("W{week}/{of}", { week: meso.week, of: meso.of })} />

        <div className="grid grid-cols-[1fr_auto] items-end gap-4">
          <div className="min-w-0">
            <p className="field-label">{left >= 0 ? t("Left today") : t("Over today")}</p>
            <p className="num flex items-baseline gap-1 whitespace-nowrap">
              <span className="text-[28px] font-bold leading-none" style={{ color: left >= 0 ? color : "var(--color-caution)" }}>
                {Math.abs(left).toLocaleString(t.locale)}
              </span>
              <span className="text-xs font-semibold text-text-muted">{t("of {n} kcal", { n: fuel.kcal.toLocaleString(t.locale) })}</span>
            </p>
            <span aria-hidden="true" className="sunk mt-2 block h-1.5 overflow-hidden rounded-full">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.min(100, fuel.kcal > 0 ? (eaten / fuel.kcal) * 100 : 0)}%`, backgroundColor: left >= 0 ? color : "var(--color-caution)" }}
              />
            </span>
          </div>
          <div className="text-right">
            <p className="field-label">{t("Trend")}</p>
            <p className="num whitespace-nowrap text-lg font-bold leading-tight">
              {weight}
              <span className="ml-0.5 text-xs font-semibold text-text-muted">{unit}</span>
            </p>
            {rate !== null && (
              <p className="num inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-semibold text-text-muted">
                {rate > 0 ? <ArrowUpRight aria-hidden="true" size={12} /> : rate < 0 ? <ArrowDownRight aria-hidden="true" size={12} /> : "±"}
                {rate !== 0 && <span className="sr-only">{rate > 0 ? "+" : "−"}</span>}
                {Math.abs(Math.round(toDisplay(rate, unit) * 10) / 10)}/{t("wk")}
              </p>
            )}
          </div>
        </div>
      </Link>
      <PacerChips proteinTarget={fuel.proteinG} waterTarget={m.waterMl} now={now} color={color} />
    </section>
  );
}

/**
 * The block, one segment a week: weeks behind are filled, this week fills by the day, weeks ahead
 * sit sunk. Says "week 6 of 12" as a shape, so the fraction beside it is only a label.
 */
function BlockWeeks({ week, of, progress, finished, color, label }: { week: number; of: number; progress: number; finished: boolean; color: string; label: string }) {
  const into = finished ? 1 : Math.max(0.08, Math.min(1, progress * of - (week - 1)));
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="flex flex-1 gap-1">
        {Array.from({ length: of }, (_, i) => {
          const fill = finished || i < week - 1 ? 1 : i === week - 1 ? into : 0;
          return (
            <span key={i} className="sunk block h-2 flex-1 overflow-hidden rounded-full">
              {fill > 0 && <span className="block h-full rounded-full" style={{ width: `${fill * 100}%`, backgroundColor: color }} />}
            </span>
          );
        })}
      </span>
      <span className="num shrink-0 text-xs font-bold text-text-muted">{label}</span>
    </div>
  );
}

/**
 * Protein and water as two small tap targets on one row: a mini ring, today against the target,
 * and the step a tap adds. The full-size Pacer stays on /phase.
 */
function PacerChips({ proteinTarget, waterTarget, now, color }: { proteinTarget: number; waterTarget: number; now: number; color: string }) {
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
        color={color}
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
        color={color}
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
  /** The card's phase colour, so the row does not bring a second accent in. Volt when absent. */
  color?: string;
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

function Ghost({ id, text, done, color = "var(--color-accent)" }: { id: number; text: string; done: (id: number) => void; color?: string }) {
  return (
    <motion.span
      aria-hidden="true"
      className="num pointer-events-none absolute right-2 top-1 text-[11px] font-bold"
      style={{ color }}
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
function PulseRing({ pulse, children, color = "var(--color-accent)" }: { pulse: number; children: ReactNode; color?: string }) {
  const glow = (n: number, a: number) => `0 0 ${n}px color-mix(in oklab, ${color} ${a}%, transparent)`;
  return (
    <motion.span
      key={pulse}
      className="inline-flex rounded-full"
      initial={pulse ? { scale: 1, boxShadow: glow(0, 0) } : false}
      animate={pulse ? { scale: [1, 1.22, 1], boxShadow: [glow(0, 0), glow(16, 70), glow(0, 0)] } : undefined}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.span>
  );
}

function PacerChip({ label, value, target, step, figure, stepText, aria, onAdd, Icon, color }: ChipProps) {
  const m = useAddMoment(value, target, step);
  const hit = value >= target;
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
      <PulseRing pulse={m.pulse} color={color}>
        <Ring value={value} max={target} size={30} stroke={3} segments={10} color={color} label={`${label}: ${value} / ${target}`}>
          <Icon aria-hidden="true" size={11} className={hit ? undefined : "text-text-muted"} style={hit ? { color } : undefined} />
        </Ring>
      </PulseRing>
      <span className="num min-w-0 flex-1 truncate text-xs font-bold">{figure}</span>
      {/* The step reads as a small key, in the text colour: the tap is the action, not a second accent. */}
      <span aria-hidden="true" className="num inline-flex shrink-0 items-center gap-0.5 rounded-full bg-ink/[0.07] px-1.5 py-0.5 text-[11px] font-bold">
        <Plus size={10} />
        {stepText}
      </span>
      {m.ghosts.map((id) => (
        <Ghost key={id} id={id} text={stepText} done={m.done} color={color} />
      ))}
    </button>
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
        <Ring value={value} max={target} size={size} stroke={4} segments={14} label={`${label}: ${value} / ${target}`}>
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
