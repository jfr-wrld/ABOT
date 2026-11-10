"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import { Bike, Footprints, HardHat, Laptop, ShieldCheck, Timer, TrendingDown, TrendingUp, Utensils } from "lucide-react";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { PHASE_ICON } from "@/components/phase/PhaseCommandCard";
import { BlockPlate, MacroDonut, MacroLegend, PhaseCurve, Stepper } from "@/components/phase/visuals";
import { CountFromZero } from "@/components/motion/Entrance";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useEntitlements } from "@/store/useEntitlements";
import { useActionBarSpace } from "@/components/layout/useActionBarSpace";
import { dayKey } from "@/lib/bodyweight";
import { newId } from "@/lib/id";
import { feedback } from "@/lib/feedback";
import { fromDisplay, toDisplay } from "@/lib/units";
import { tunables } from "@/lib/tunables";
import { useNow } from "@/lib/useNow";
import {
  ACTIVITY_LEVELS,
  DEFAULT_RATE,
  PHASE_BLURB,
  PHASE_CALIBRATION,
  PHASE_DURATIONS,
  PHASE_LABEL,
  PHASE_TYPES,
  fuelTarget,
  phaseTitle,
  type ActivePhaseConfig,
  type BiologicalSex,
  type BodyPhaseType,
} from "@/lib/phase-engine";
import { useT } from "@/i18n";

const ACTIVITY_ICON = [Laptop, Footprints, Bike, HardHat];
const STEPS = 4;

/** Icons for each phase's PHASE_CALIBRATION lines, in the same order. */
const CHANGE_ICON: Record<BodyPhaseType, (typeof Timer)[]> = {
  CUTTING: [ShieldCheck, Timer],
  BULKING: [TrendingUp, Timer],
  RECOMP: [Utensils, ShieldCheck],
  STRENGTH_PEAK: [TrendingDown, Timer],
};

export default function PhaseSetupPage() {
  return (
    <HydrationGate>
      <Wizard />
    </HydrationGate>
  );
}

/**
 * Four short steps, one decision each: the phase, your body, the goal, then a review with the
 * daily target. Steps slide in the direction you move, so the order stays clear.
 */
function Wizard() {
  const t = useT();
  const router = useRouter();
  const reduce = useReducedMotionConfig();
  const settings = useSettingsStore();
  const { canAccessPro, openPaywall } = useEntitlements();
  const unit = settings.weightUnit;
  const current = settings.bodyPhase?.isActive ? settings.bodyPhase : null;
  useActionBarSpace(76);
  const now = useNow(60_000);

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [type, setType] = useState<BodyPhaseType>(current?.phaseType ?? "BULKING");
  const [weightKg, setWeightKg] = useState<number>(current?.startWeightKg ?? settings.bodyweightKg ?? 70);
  const [heightCm, setHeightCm] = useState<number>(current?.heightCm ?? settings.heightCm ?? 170);
  const [age, setAge] = useState<number>(current?.age ?? 25);
  const [sex, setSex] = useState<BiologicalSex>(current?.biologicalSex ?? "male");
  const [activity, setActivity] = useState<number>(current?.activityMultiplier ?? 1.375);
  const [weeks, setWeeks] = useState<number>(current?.durationWeeks ?? 8);
  const [targetKg, setTargetKg] = useState<number | null>(current?.targetWeightKg ?? null);

  const rate = DEFAULT_RATE[type];
  const suggested = weightKg * (1 + (rate / 100) * weeks);
  const target = targetKg ?? suggested;
  const draft: ActivePhaseConfig = {
    id: current?.id ?? newId(),
    phaseType: type,
    title: phaseTitle(type, weeks),
    startDate: current && current.phaseType === type ? current.startDate : dayKey(now),
    durationWeeks: weeks,
    startWeightKg: weightKg,
    targetWeightKg: target,
    heightCm,
    age,
    biologicalSex: sex,
    activityMultiplier: activity,
    weeklyRatePercent: rate,
    isActive: true,
  };
  const fuel = fuelTarget(draft, weightKg, 0, true);
  const shown = (kg: number) => Math.round(toDisplay(kg, unit) * 10) / 10;

  const go = (to: number) => {
    feedback.tick();
    setDir(to > step ? 1 : -1);
    setStep(to);
  };
  function save() {
    if (!canAccessPro("body_phase_protocols")) return openPaywall("body_phase_protocols");
    feedback.setComplete();
    settings.update({ bodyPhase: draft, ...(settings.heightCm === null ? { heightCm } : {}) });
    router.push("/phase");
  }

  const titles = [t("Pick a phase"), t("About you"), t("Your goal"), t("Your plan")];
  const slide = reduce ? {} : { initial: { x: dir * 48, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: dir * -48, opacity: 0 } };

  return (
    <main className="flex flex-1 flex-col pb-4">
      <PageHeader title={titles[step]!} back={{ href: current ? "/phase" : "/", label: current ? t("Body phase") : t("Home") }} />
      <div className="px-4 pt-3">
        <div role="progressbar" aria-label={t("Step {n} of {total}", { n: step + 1, total: STEPS })} aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1} className="flex gap-1">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-accent" : "bg-track"}`} />
          ))}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden px-4 pt-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} {...slide} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
            {step === 0 && (
              <div role="radiogroup" aria-label={t("Phase")} className="grid grid-cols-2 gap-3">
                {PHASE_TYPES.map((p) => {
                  const Icon = PHASE_ICON[p];
                  const on = p === type;
                  return (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        feedback.tick();
                        setType(p);
                        setTargetKg(null);
                      }}
                      className={`flex flex-col gap-2 rounded-card border p-3 text-left transition-colors ${on ? "border-accent bg-accent-tint" : "border-line bg-surface hover:border-line-hover"}`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon aria-hidden="true" size={18} className={on ? "text-accent" : "text-text-muted"} />
                        <span className="text-sm font-bold">{t(PHASE_LABEL[p])}</span>
                      </span>
                      <PhaseCurve phase={p} active={on} width={140} height={48} />
                      <span className="text-xs leading-snug text-text-muted">{t(PHASE_BLURB[p])}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col gap-5">
                <Field label={t("Weight")}>
                  <Stepper label={t("Weight")} value={shown(weightKg)} onChange={(n) => setWeightKg(fromDisplay(n, unit))} step={0.5} min={30} max={unit === "lbs" ? 880 : 400} unit={unit} decimals={1} />
                </Field>
                <Field label={t("Height")}>
                  <Stepper label={t("Height")} value={heightCm} onChange={setHeightCm} step={1} min={100} max={250} unit="cm" />
                </Field>
                <Field label={t("Age")}>
                  <Stepper label={t("Age")} value={age} onChange={setAge} step={1} min={13} max={100} />
                </Field>
                <Field label={t("Sex, for the calorie formula")}>
                  <div role="radiogroup" aria-label={t("Sex, for the calorie formula")} className="grid grid-cols-2 gap-2">
                    {(["male", "female"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={sex === s}
                        onClick={() => setSex(s)}
                        className={`min-h-11 rounded-ctl border text-sm font-semibold ${sex === s ? "border-accent bg-accent-tint text-text" : "border-line-strong bg-surface-2 text-text-muted"}`}
                      >
                        {s === "male" ? t("Male") : t("Female")}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={t("Outside the gym")}>
                  <div role="radiogroup" aria-label={t("Outside the gym")} className="grid grid-cols-2 gap-2">
                    {ACTIVITY_LEVELS.map((a, i) => {
                      const Icon = ACTIVITY_ICON[i]!;
                      const on = activity === a.value;
                      return (
                        <button
                          key={a.value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setActivity(a.value)}
                          className={`flex min-h-16 items-center gap-2 rounded-ctl border px-3 text-left text-xs font-semibold ${on ? "border-accent bg-accent-tint text-text" : "border-line-strong bg-surface-2 text-text-muted"}`}
                        >
                          <Icon aria-hidden="true" size={18} className={on ? "shrink-0 text-accent" : "shrink-0"} />
                          {t(a.label)}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-5">
                <Field label={t("Length")}>
                  <div role="radiogroup" aria-label={t("Length")} className="grid grid-cols-5 gap-1.5">
                    {PHASE_DURATIONS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        role="radio"
                        aria-checked={weeks === w}
                        onClick={() => {
                          setWeeks(w);
                          setTargetKg(null);
                        }}
                        className={`num min-h-11 rounded-ctl border text-sm font-bold ${weeks === w ? "border-accent bg-accent-tint text-text" : "border-line-strong bg-surface-2 text-text-muted"}`}
                      >
                        {w}
                        <span className="text-[10px] font-semibold"> {t("wk")}</span>
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="flex justify-center py-2">
                  <BlockPlate weeks={weeks} done={0} current={0} size={148}>
                    <span className="num text-3xl font-bold">{weeks}</span>
                    <span className="label-caps">{t("weeks")}</span>
                  </BlockPlate>
                </div>
                <Field label={t("Target weight")}>
                  <Stepper label={t("Target weight")} value={shown(target)} onChange={(n) => setTargetKg(fromDisplay(n, unit))} step={0.5} min={30} max={unit === "lbs" ? 880 : 400} unit={unit} decimals={1} />
                </Field>
                {rate !== 0 && (
                  <p className="num text-center text-xs text-text-muted">
                    {t("About {weight} {unit} a week", { weight: `${rate > 0 ? "+" : "−"}${Math.abs(shown((weightKg * rate) / 100))}`, unit })}
                  </p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col items-center gap-5">
                <MacroDonut protein={fuel.proteinG} carbs={fuel.carbsG} fat={fuel.fatG} size={176}>
                  <CountFromZero value={fuel.kcal} format={(n) => Math.round(n).toLocaleString(t.locale)} className="num text-3xl font-bold text-accent" />
                  <span className="label-caps">{t("kcal a day")}</span>
                </MacroDonut>
                <div className="w-full max-w-xs">
                  <MacroLegend protein={fuel.proteinG} carbs={fuel.carbsG} fat={fuel.fatG} labels={[t("Protein"), t("Carbs"), t("Fat")]} />
                </div>
                <ul className="flex w-full flex-col gap-2">
                  {PHASE_CALIBRATION[type].map((text, i) => {
                    const Icon = CHANGE_ICON[type][i] ?? Timer;
                    return (
                      <li key={text} className="flex items-center gap-3 rounded-ctl bg-surface px-3 py-2.5 text-sm">
                        <Icon aria-hidden="true" size={18} className="shrink-0 text-accent" />
                        {t(text)}
                      </li>
                    );
                  })}
                  <li className="flex items-center gap-3 rounded-ctl bg-surface px-3 py-2.5 text-sm">
                    <Timer aria-hidden="true" size={18} className="shrink-0 text-accent" />
                    {t("Deload every {n} weeks", { n: tunables().phase.deloadEvery })}
                  </li>
                </ul>
                <p className="text-center text-[11px] text-text-muted">{t("Estimate before training calories, which are added each day. Not medical advice.")}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[640px] gap-2 border-t border-line bg-bg px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
        {step > 0 && (
          <Button onClick={() => go(step - 1)} className="min-w-24">
            {t("Back")}
          </Button>
        )}
        {step < STEPS - 1 ? (
          <Button variant="primary" onClick={() => go(step + 1)} className="flex-1">
            {t("Next")}
          </Button>
        ) : (
          <Button variant="primary" onClick={save} className="flex-1">
            {current ? t("Save phase") : t("Start phase")}
          </Button>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="label-caps">{label}</h2>
      {children}
    </section>
  );
}
