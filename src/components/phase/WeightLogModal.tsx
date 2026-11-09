"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/NumberField";
import { useBodyStore } from "@/store/useBodyStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { dayKey } from "@/lib/bodyweight";
import { formatWeight, fromDisplay, toDisplay } from "@/lib/units";
import { PROFILE_LIMITS } from "@/types/workout";
import { useT } from "@/i18n";

/** Today's weigh-in from the phase card, with body fat and waist if measured. */
export function WeightLogModal({ open, onClose, now }: { open: boolean; onClose: () => void; now: number }) {
  const t = useT();
  const unit = useSettingsStore((s) => s.weightUnit);
  const entries = useBodyStore((s) => s.entries);
  const logWeight = useBodyStore((s) => s.logWeight);
  const today = entries.find((e) => e.id === dayKey(now));
  const last = today ?? entries[entries.length - 1];
  const [weight, setWeight] = useState<number | null>(last ? Math.round(toDisplay(last.weightKg, unit) * 10) / 10 : null);
  const [fat, setFat] = useState<number | null>(today?.bodyFatPercent ?? null);
  const [waist, setWaist] = useState<number | null>(today?.waistCm ?? null);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const kg = weight === null ? null : fromDisplay(weight, unit);
    const [min, max] = PROFILE_LIMITS.bodyweightKg;
    if (kg === null || kg < min || kg > max) return setError(t("Enter {min} to {max}", { min: formatWeight(min, unit), max: formatWeight(max, unit) }));
    if (fat !== null && (fat < 2 || fat > 70)) return setError(t("Body fat is 2 to 70%."));
    if (waist !== null && (waist < 40 || waist > 250)) return setError(t("Waist is 40 to 250 cm."));
    logWeight(kg, now, { ...(fat !== null ? { bodyFatPercent: fat } : {}), ...(waist !== null ? { waistCm: waist } : {}) });
    onClose();
  }

  const field = "flex flex-col gap-1 text-xs font-semibold text-text-muted";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Log weight")}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="text-sm text-failure">
              {error}
            </p>
          )}
          <Button variant="primary" onClick={save} className="w-full">
            {today ? t("Update today's weigh-in") : t("Save weigh-in")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <label className={field}>
          {t("Weight ({unit})", { unit })}
          <NumberField value={weight} onCommit={setWeight} max={900} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={field}>
            {t("Body fat (%), optional")}
            <NumberField value={fat} onCommit={setFat} max={70} />
          </label>
          <label className={field}>
            {t("Waist (cm), optional")}
            <NumberField value={waist} onCommit={setWaist} max={250} />
          </label>
        </div>
        <p className="text-xs text-text-muted">{t("Weigh in at the same time each morning. The trend line smooths out water from one day to the next.")}</p>
      </div>
    </Sheet>
  );
}
