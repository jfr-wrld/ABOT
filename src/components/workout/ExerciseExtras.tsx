"use client";

import { useState } from "react";
import { ChevronDown, NotebookPen } from "lucide-react";
import type { Exercise, SessionExercise } from "@/types/workout";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { variationLabel, variationsFor } from "@/data/variations";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/**
 * Under the exercise name: the variation chosen for today (grip, stance, angle) and the note,
 * both in view while lifting instead of behind the options menu. With neither set, two quiet
 * buttons offer them.
 */
export function ExerciseExtras({ item, exercise, name }: { item: SessionExercise; exercise: Exercise | undefined; name: string }) {
  const t = useT();
  const [variationOpen, setVariationOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const options = variationsFor(exercise);
  const note = item.notes?.trim();

  return (
    <div className="mt-2 flex flex-col gap-1.5 px-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {options.length > 0 && (
          <button
            type="button"
            onClick={() => setVariationOpen(true)}
            aria-haspopup="dialog"
            aria-label={item.variation ? t("Variation: {variation}. Change", { variation: t(variationLabel(item.variation)) }) : t("Choose a variation")}
            className={`flex min-h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold ${
              item.variation ? "border-accent/50 bg-accent-tint text-text" : "border-line-strong text-text-muted hover:text-text"
            }`}
          >
            {item.variation ? t(variationLabel(item.variation)) : t("Variation")}
            <ChevronDown aria-hidden="true" size={14} />
          </button>
        )}
        {!note && (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            aria-haspopup="dialog"
            aria-label={t("Add a note for {name}", { name })}
            className="flex min-h-9 items-center gap-1 rounded-full border border-line-strong px-3 text-xs font-semibold text-text-muted hover:text-text"
          >
            <NotebookPen aria-hidden="true" size={14} />
            {t("Note")}
          </button>
        )}
      </div>
      {note && (
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          aria-label={t("Note for {name}: {note}. Edit", { name, note })}
          className="flex items-start gap-1.5 rounded-ctl bg-surface-2 px-2.5 py-2 text-left text-sm text-text-muted hover:text-text"
        >
          <NotebookPen aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2 whitespace-pre-line">{note}</span>
        </button>
      )}

      <Sheet open={variationOpen} onClose={() => setVariationOpen(false)} title={t("Variation for {name}", { name })}>
        <div role="radiogroup" aria-label={t("Variation")} className="grid grid-cols-2 gap-2">
          {[undefined, ...options].map((key) => {
            const on = item.variation === key;
            return (
              <button
                key={key ?? "none"}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  feedback.tick();
                  useWorkoutStore.getState().setExerciseVariation(item.id, key);
                  setVariationOpen(false);
                }}
                className={`min-h-12 rounded-ctl border px-3 text-left text-sm font-semibold ${
                  on ? "border-accent bg-accent-tint text-text" : "border-line-strong text-text hover:bg-surface-2"
                }`}
              >
                {key ? t(variationLabel(key)) : t("Standard")}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-text-muted">{t("Records stay with the exercise; the variation is kept in this workout's history.")}</p>
      </Sheet>

      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title={t("Note for {name}", { name })}>
        <textarea
          aria-label={t("Notes for this exercise")}
          value={item.notes ?? ""}
          onChange={(e) => useWorkoutStore.getState().setExerciseNotes(item.id, e.target.value)}
          rows={3}
          placeholder={t("Seat height, grip, cues")}
          className="w-full rounded-ctl border border-line-strong bg-surface-2 px-3 py-2 text-base placeholder:text-text-muted"
        />
        <Button className="mt-3 w-full" onClick={() => setNoteOpen(false)}>
          {t("Done")}
        </Button>
      </Sheet>
    </div>
  );
}
