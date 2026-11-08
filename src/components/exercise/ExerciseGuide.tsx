"use client";

import type { Exercise } from "@/types/workout";
import { useT } from "@/i18n";

/** Form cues, and optionally the numbered step-by-step instructions. */
export function ExerciseGuide({ exercise, showInstructions }: { exercise: Exercise; showInstructions: boolean }) {
  const fromDataset = Boolean(exercise.sourceId);
  const t = useT();
  return (
    <>
      <section aria-labelledby={`cues-${exercise.id}`} className="panel p-3">
        <h2 id={`cues-${exercise.id}`} className="text-sm font-semibold">
          {t("Form cues")}
        </h2>
        {exercise.formCues.length === 0 ? (
          <p className="mt-1 text-sm text-text-muted">{t("No form cues for this exercise yet.")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {exercise.formCues.map((c) => (
              <li key={c} className="flex gap-2 text-sm">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                {c}
              </li>
            ))}
          </ul>
        )}
      </section>
      {showInstructions && (
        <section aria-labelledby={`steps-${exercise.id}`} className="panel p-3">
          <h2 id={`steps-${exercise.id}`} className="text-sm font-semibold">
            {t("Instructions")}
          </h2>
          {exercise.instructions.length === 0 ? (
            <p className="mt-1 text-sm text-text-muted">{t("No step-by-step instructions for this exercise.")}</p>
          ) : (
            <>
              <ol aria-label={t("Instructions")} className="mt-2 flex flex-col gap-2">
                {exercise.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-ctl bg-surface-2 text-xs font-bold num">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {fromDataset && (
                <p className="mt-2 text-xs text-text-muted">{t("Instructions from free-exercise-db (public domain).")}</p>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
