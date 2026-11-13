"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import { Bike, Dumbbell, Footprints, HardHat, Laptop, ShieldCheck, Timer, TrendingDown, TrendingUp, Utensils } from "lucide-react";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { PHASE_ICON } from "@/components/phase/PhaseCommandCard";
import { BlockPlate, MacroDonut, MacroLegend, PhaseCurve, Stepper } from "@/components/phase/visuals";
import { CountFromZero } from "@/components/motion/Entrance";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useEntitlements } from "@/store/useEntitlements";
import { useBodyStore } from "@/store/useBodyStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { ROUTINE_TEMPLATES, templateToRoutine, type RoutineTemplate } from "@/lib/seed-routines";
import { Crown } from "lucide-react";
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
  DEFAULT_SESSIONS,
  PHASE_DURATIONS,
  PHASE_GOAL,
  programTemplates,
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
  // From a finished block's summary (?next=BULKING): a new phase, not an edit of the old one.
  const nextParam = useSearchParams().get("next");
  const next = PHASE_TYPES.includes(nextParam as BodyPhaseType) ? (nextParam as BodyPhaseType) : null;
  const current = settings.bodyPhase?.isActive && !next ? settings.bodyPhase : null;
  useActionBarSpace(76);
  const now = useNow(60_000);

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  // Nothing is picked for a new phase: the first step asks the goal, so "Next" waits for an answer.
  const [picked, setPicked] = useState<BodyPhaseType | null>(next ?? current?.phaseType ?? null);
  const type: BodyPhaseType = picked ?? "BULKING";
  // What ABOT already knows fills itself in: the latest weigh-in, the profile's height, the age
  // and sex given last time.
  const latestKg = useBodyStore((s) => s.entries.at(-1)?.weightKg ?? null);
  const knownAge = settings.birthYear ? new Date(now).getFullYear() - settings.birthYear : null;
  const [weightKg, setWeightKg] = useState<number>(latestKg ?? settings.bodyweightKg ?? current?.startWeightKg ?? 70);
  const [heightCm, setHeightCm] = useState<number>(settings.heightCm ?? current?.heightCm ?? 170);
  const [age, setAge] = useState<number>(knownAge ?? current?.age ?? 25);
  const [sex, setSex] = useState<BiologicalSex>(settings.biologicalSex ?? current?.biologicalSex ?? "male");
  const pro = canAccessPro("body_phase_protocols");
  const [activity, setActivity] = useState<number>(current?.activityMultiplier ?? 1.375);
  const [weeks, setWeeks] = useState<number>(current?.durationWeeks ?? 8);
  const [targetKg, setTargetKg] = useState<number | null>(current?.targetWeightKg ?? null);
  // A training week set up already decides the routines; the phase only counts its days.
  const plan = settings.trainingPlan;
  const [days, setDays] = useState<number | null>(current?.sessionsPerWeek ?? plan?.weekdays.length ?? null);
  const sessionsPerWeek = days ?? DEFAULT_SESSIONS[type];
  const routines = useRoutineStore((s) => s.routines);
  const program = programTemplates(sessionsPerWeek)
    .map((id) => ROUTINE_TEMPLATES.find((tpl) => tpl.id === id))
    .filter((tpl): tpl is RoutineTemplate => !!tpl);
  // Templates already saved (by name) are not added twice.
  const missing = program.filter((tpl) => !routines.some((r) => r.name === tpl.name));
  const [addRoutines, setAddRoutines] = useState(true);

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
    sessionsPerWeek,
    // A new phase starts from its own numbers; editing one keeps what its check-ins learned.
    ...(current && current.phaseType === type && current.kcalAdjust ? { kcalAdjust: current.kcalAdjust, checkInDay: current.checkInDay } : {}),
  };
  const fuel = fuelTarget(draft, weightKg, 0, true);
  const shown = (kg: number) => Math.round(toDisplay(kg, unit) * 10) / 10;

  const go = (to: number) => {
    feedback.tick();
    setDir(to > step ? 1 : -1);
    setStep(to);
  };
  function save() {
    if (!pro) return openPaywall("body_phase_protocols");
    feedback.setComplete();
    // The answers become the profile's, so the next phase (and Body) start from them.
    settings.update({ bodyPhase: draft, heightCm, birthYear: new Date(now).getFullYear() - age, biologicalSex: sex });
    if (addRoutines && !plan) {
      const { create, setExercises } = useRoutineStore.getState();
      for (const tpl of missing) {
        const copy = templateToRoutine(tpl);
        const r = create(copy.name, copy.folder);
        setExercises(r.id, copy.exercises);
      }
    }
    const logged = latestKg ?? settings.bodyweightKg;
    if (logged === null || Math.abs(logged - weightKg) >= 0.05) useBodyStore.getState().logWeight(weightKg);
    router.push("/phase");
  }

  const titles = [t("What is your goal?"), t("About you"), t("How long, and where to"), t("Your plan")];
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
            {step === 0 && !pro && (
              <p className="mb-3 flex items-start gap-2 rounded-ctl border border-line bg-surface p-3 text-xs text-text-muted">
                <Crown aria-hidden="true" size={16} className="mt-px shrink-0 text-accent" />
                {t("Body phase is part of PRO. Plan it here and see your daily numbers for free; starting it needs PRO.")}
              </p>
            )}
            {step === 0 && (
              <div role="radiogroup" aria-label={t("Goal")} className="grid grid-cols-2 gap-3">
                {PHASE_TYPES.map((p) => {
                  const Icon = PHASE_ICON[p];
                  const on = p === picked;
                  return (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        feedback.tick();
                        setPicked(p);
                        setTargetKg(null);
                      }}
                      className={`flex flex-col gap-2 rounded-card border p-3 text-left transition-colors ${on ? "border-accent bg-accent-tint" : "border-line bg-surface hover:border-line-hover"}`}
                    >
                      <span className="flex items-start gap-2">
                        <Icon aria-hidden="true" size={18} className={`mt-px shrink-0 ${on ? "text-accent" : "text-text-muted"}`} />
                        <span className="text-sm font-bold leading-snug">{t(PHASE_GOAL[p])}</span>
                      </span>
                      <span className="label-caps">{t(PHASE_LABEL[p])}</span>
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
                        <span className="text-[11px] font-semibold"> {t("wk")}</span>
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
                <section aria-labelledby="program-heading" className="flex w-full flex-col gap-2 rounded-card border border-line bg-surface p-3">
                  <h2 id="program-heading" className="label-caps">
                    {t("Training")}
                  </h2>
                  <div role="radiogroup" aria-label={t("Training days a week")} className="grid grid-cols-5 gap-1.5">
                    {[2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={sessionsPerWeek === n}
                        aria-label={t.n(n, "{n} day a week", "{n} days a week")}
                        onClick={() => setDays(n)}
                        className={`num min-h-11 rounded-ctl border text-sm font-bold ${sessionsPerWeek === n ? "border-accent bg-accent-tint text-text" : "border-line-strong bg-surface-2 text-text-muted"}`}
                      >
                        {n}
                        <span className="text-[11px] font-semibold">×</span>
                      </button>
                    ))}
                  </div>
                  {plan ? (
                    <p className="text-xs text-text-muted">
                      {t("Your training week already has its workouts.")}{" "}
                      <Link href="/plan" className="font-semibold text-accent underline-offset-2 hover:underline">
                        {t("Adjust your plan")}
                      </Link>
                    </p>
                  ) : (
                  <>
                  <p className="text-xs text-text-muted">{t("Days a week. Your routines:")}</p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {program.map((tpl) => (
                      <li key={tpl.id} className="flex items-center gap-2">
                        <Dumbbell aria-hidden="true" size={14} className="shrink-0 text-accent" />
                        <span className="min-w-0 flex-1 truncate">{tpl.name}</span>
                        {!missing.includes(tpl) && <span className="shrink-0 text-xs text-text-muted">{t("Saved")}</span>}
                      </li>
                    ))}
                  </ul>
                  {missing.length > 0 && (
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" checked={addRoutines} onChange={(e) => setAddRoutines(e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
                      {t.n(missing.length, "Add it to my routines", "Add them to my routines")}
                    </label>
                  )}
                  </>
                  )}
                </section>
                <p className="text-center text-[11px] text-text-muted">{t("Your training adds to this: the average of your workouts over the last 4 weeks. An estimate, not medical advice.")}</p>
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
          <Button variant="primary" onClick={() => go(step + 1)} disabled={step === 0 && picked === null} className="flex-1">
            {step === 0 && picked === null ? t("Pick a goal") : t("Next")}
          </Button>
        ) : (
          <Button variant="primary" onClick={save} className="flex-1">
            {!pro && <Crown aria-hidden="true" size={16} />}
            {!pro ? t("Unlock PRO to start") : current ? t("Save phase") : t("Start phase")}
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
