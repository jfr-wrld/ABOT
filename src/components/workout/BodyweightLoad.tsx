"use client";

import Link from "next/link";
import type { Exercise, SessionExercise, WeightUnit } from "@/types/workout";
import { bodyweightFactor } from "@/data/bodyweight-load";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { formatWeight } from "@/lib/units";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/**
 * Under a bodyweight exercise: the body weight its sets count, and whether the weight column is
 * added load (a belt, a vest) or assistance (a band, the assisted machine). Without a body weight
 * on record, one line says where to add it, since volume and records need it.
 */
export function BodyweightLoad({ item, exercise, unit }: { item: SessionExercise; exercise: Exercise | undefined; unit: WeightUnit }) {
  const t = useT();
  const bodyweightKg = useSettingsStore((s) => s.bodyweightKg);
  const setAssisted = useWorkoutStore((s) => s.setAssisted);
  const factor = bodyweightFactor(exercise);
  if (!exercise?.isBodyweight || factor <= 0) return null;
  const assisted = item.assisted === true;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-text-muted">
      {bodyweightKg ? (
        <span>
          {t("Body weight")} <span className="num font-semibold text-text">{formatWeight(bodyweightKg, unit)}</span>
          {factor < 1 && <span> · {t("{n}% counted", { n: Math.round(factor * 100) })}</span>}
        </span>
      ) : (
        <Link href="/profile/body" className="min-h-11 content-center font-semibold text-accent underline-offset-2 hover:underline">
          {t("Add your body weight to count it in volume")}
        </Link>
      )}
      <div role="group" aria-label={t("Weight column")} className="ml-auto flex rounded-ctl bg-surface-2 p-0.5">
        {[false, true].map((a) => (
          <button
            key={String(a)}
            type="button"
            aria-pressed={assisted === a}
            onClick={() => {
              if (assisted === a) return;
              feedback.tick();
              setAssisted(item.id, a);
            }}
            className={`min-h-9 rounded-[calc(var(--radius-ctl)-2px)] px-3 font-semibold ${
              assisted === a ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
            }`}
          >
            {a ? t("Assisted") : t("Added")}
          </button>
        ))}
      </div>
    </div>
  );
}
