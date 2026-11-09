"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/NumberField";
import { Choice } from "@/components/settings/controls";
import { useSettingsStore } from "@/store/useSettingsStore";
import { dayKey } from "@/lib/bodyweight";
import { newId } from "@/lib/id";
import { formatWeight, fromDisplay, toDisplay } from "@/lib/units";
import { tunables } from "@/lib/tunables";
import {
  ACTIVITY_LEVELS,
  DEFAULT_RATE,
  PHASE_BLURB,
  PHASE_DURATIONS,
  PHASE_LABEL,
  PHASE_CALIBRATION,
  PHASE_TYPES,
  fuelTarget,
  phaseTitle,
  type ActivePhaseConfig,
  type BiologicalSex,
  type BodyPhaseType,
} from "@/lib/phase-engine";
import { useT } from "@/i18n";
import { PHASE_ICON } from "./PhaseCommandCard";

/**
 * Pick or edit the body phase: type, weights, length, and the numbers the calorie target needs.
 * A preview shows the daily target and what changes in the coach and recovery map.
 */
export function PhaseSetupModal({ open, onClose, now }: { open: boolean; onClose: () => void; now: number }) {
  const t = useT();
  const settings = useSettingsStore();
  const current = settings.bodyPhase;
  const unit = settings.weightUnit;
  const startKg = settings.bodyweightKg ?? 75;
  const [type, setType] = useState<BodyPhaseType>(current?.phaseType ?? "BULKING");
  const [weeks, setWeeks] = useState<number>(current?.durationWeeks ?? 8);
  const [startW, setStartW] = useState<number | null>(round1(toDisplay(current?.startWeightKg ?? startKg, unit)));
  const [targetW, setTargetW] = useState<number | null>(current ? round1(toDisplay(current.targetWeightKg, unit)) : null);
  const [height, setHeight] = useState<number | null>(current?.heightCm ?? settings.heightCm);
  const [age, setAge] = useState<number | null>(current?.age ?? null);
  const [sex, setSex] = useState<BiologicalSex>(current?.biologicalSex ?? "male");
  const [activity, setActivity] = useState<number>(current?.activityMultiplier ?? 1.375);
  const [error, setError] = useState<string | null>(null);

  const startKgNow = startW === null ? null : fromDisplay(startW, unit);
  const rate = DEFAULT_RATE[type];
  const suggestedTarget = startKgNow === null ? null : startKgNow * (1 + (rate / 100) * weeks);
  const targetKg = targetW === null ? suggestedTarget : fromDisplay(targetW, unit);
  const draft: ActivePhaseConfig | null =
    startKgNow !== null && targetKg !== null && height !== null && age !== null
      ? {
          id: current?.id ?? newId(),
          phaseType: type,
          title: phaseTitle(type, weeks),
          startDate: current && current.phaseType === type ? current.startDate : dayKey(now),
          durationWeeks: weeks,
          startWeightKg: startKgNow,
          targetWeightKg: targetKg,
          heightCm: height,
          age,
          biologicalSex: sex,
          activityMultiplier: activity,
          weeklyRatePercent: rate,
          isActive: true,
        }
      : null;
  const preview = draft ? fuelTarget(draft, startKgNow!, 0, true) : null;

  function save() {
    if (!draft) return setError(t("Fill in your weight, height and age."));
    if (draft.age < 13 || draft.age > 100) return setError(t("Enter an age from 13 to 100."));
    if (draft.heightCm < 100 || draft.heightCm > 250) return setError(t("Enter a height from 100 to 250 cm."));
    settings.update({ bodyPhase: draft, ...(settings.heightCm === null ? { heightCm: draft.heightCm } : {}) });
    setError(null);
    onClose();
  }

  function end() {
    if (current) settings.update({ bodyPhase: { ...current, isActive: false } });
    onClose();
  }

  const field = "flex flex-col gap-1 text-xs font-semibold text-text-muted";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={current?.isActive ? t("Edit body phase") : t("Choose a body phase")}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="text-sm text-failure">
              {error}
            </p>
          )}
          <Button variant="primary" onClick={save} className="w-full">
            {current?.isActive ? t("Save phase") : t("Start phase")}
          </Button>
          {current?.isActive && (
            <Button variant="ghost" onClick={end} className="w-full">
              {t("End this phase")}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div role="radiogroup" aria-label={t("Phase")} className="grid grid-cols-2 gap-2">
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
                  setType(p);
                  setTargetW(null);
                }}
                className={`flex min-h-24 flex-col items-start gap-1 rounded-ctl border p-3 text-left ${on ? "border-accent bg-accent-tint" : "border-line-strong bg-surface-2"}`}
              >
                <Icon aria-hidden="true" size={18} className={on ? "text-accent" : "text-text-muted"} />
                <span className="text-sm font-bold">{t(PHASE_LABEL[p])}</span>
                <span className="text-[11px] leading-snug text-text-muted">{t(PHASE_BLURB[p])}</span>
              </button>
            );
          })}
        </div>

        <Choice<number>
          name="phase-weeks"
          label={t("Length")}
          value={weeks}
          options={PHASE_DURATIONS.map((w) => ({ value: w, label: t("{n} wk", { n: w }) }))}
          onChange={setWeeks}
        />

        <div className="grid grid-cols-2 gap-3">
          <label className={field}>
            {t("Weight now ({unit})", { unit })}
            <NumberField value={startW} onCommit={setStartW} max={900} />
          </label>
          <label className={field}>
            {t("Target weight ({unit})", { unit })}
            <NumberField
              value={targetW}
              onCommit={setTargetW}
              max={900}
              placeholder={suggestedTarget === null ? "" : String(round1(toDisplay(suggestedTarget, unit)))}
            />
          </label>
          <label className={field}>
            {t("Height (cm)")}
            <NumberField value={height} onCommit={setHeight} max={250} />
          </label>
          <label className={field}>
            {t("Age")}
            <NumberField value={age} onCommit={(n) => setAge(n === null ? null : Math.round(n))} max={100} />
          </label>
        </div>

        <Choice<BiologicalSex>
          name="phase-sex"
          label={t("Sex (for the calorie formula)")}
          value={sex}
          options={[
            { value: "male", label: t("Male") },
            { value: "female", label: t("Female") },
          ]}
          onChange={setSex}
        />

        <label className={field}>
          {t("Activity outside the gym")}
          <select
            value={activity}
            onChange={(e) => setActivity(Number(e.target.value))}
            className="h-11 rounded-ctl border border-line-strong bg-surface-2 px-2 text-sm font-semibold text-text"
          >
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a.value} value={a.value}>
                {t(a.label)}
              </option>
            ))}
          </select>
        </label>

        <section aria-label={t("Preview")} className="rounded-ctl border border-line bg-surface-2 p-3">
          <h3 className="label-caps">{t("Preview")}</h3>
          {preview ? (
            <>
              <p className="num mt-1 text-lg font-bold">
                {preview.kcal.toLocaleString(t.locale)} <span className="text-sm font-semibold text-text-muted">{t("kcal a day before training calories")}</span>
              </p>
              <p className="num text-xs text-text-muted">
                {t("{p} g protein · {c} g carbs · {f} g fat", { p: preview.proteinG, c: preview.carbsG, f: preview.fatG })}
              </p>
              {rate !== 0 && startKgNow !== null && (
                <p className="num mt-1 text-xs text-text-muted">
                  {t("Planned change: {weight} a week", { weight: `${rate > 0 ? "+" : "−"}${formatWeight(Math.abs((startKgNow * rate) / 100), unit)}` })}
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-xs text-text-muted">{t("Fill in your weight, height and age to see your daily target.")}</p>
          )}
          <ul className="mt-2 flex flex-col gap-1">
            {PHASE_CALIBRATION[type].map((line) => (
              <li key={line} className="flex gap-2 text-xs">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                {t(line)}
              </li>
            ))}
            <li className="flex gap-2 text-xs">
              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
              {t("A deload week every {n} weeks", { n: tunables().phase.deloadEvery })}
            </li>
          </ul>
        </section>
      </div>
    </Sheet>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
