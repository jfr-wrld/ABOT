"use client";

import { useState, type ReactNode } from "react";
import { ListOrdered, Play, Timer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { SEED_EXERCISES_BY_ID } from "@/data/exercises";
import { estimateMinutes, type RoutineTemplate } from "@/lib/seed-routines";
import { firstTemplate, type Days, type Goal, type Level } from "@/lib/first-plan";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/**
 * The last step of the intro: three taps (goal, experience, days a week) and a first workout
 * picked from the Template Vault, ready to start. The first finished workout is what keeps a new
 * lifter, so the intro ends at a Start button, not at an empty Home.
 */
export function FirstPlan({ onStart, onSkip }: { onStart: (tpl: RoutineTemplate) => void; onSkip: () => void }) {
  const t = useT();
  const [goal, setGoal] = useState<Goal>("muscle");
  const [level, setLevel] = useState<Level>("new");
  const [days, setDays] = useState<Days>(3);
  const tpl = firstTemplate({ goal, level, days });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight">{t("Your first workout")}</h1>
      <p className="mt-1 text-sm text-text-muted">{t("Three taps, then start. You can change everything later.")}</p>

      <div className="mt-5 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2">
        <Choice
          label={t("Goal")}
          value={goal}
          onChange={setGoal}
          options={[
            ["muscle", t("Build muscle")],
            ["strength", t("Get stronger")],
            ["fat_loss", t("Lose fat")],
            ["fitness", t("Stay fit")],
          ]}
        />
        <Choice
          label={t("Lifting experience")}
          value={level}
          onChange={setLevel}
          options={[
            ["new", t("New")],
            ["some", t("Under 2 years")],
            ["experienced", t("2 years +")],
          ]}
        />
        <Choice
          label={t("Days a week")}
          value={days}
          onChange={setDays}
          options={[
            [2, "2"],
            [3, "3"],
            [4, "4"],
            [5, "5+"],
          ]}
        />

        <section aria-labelledby="first-plan" className="rounded-xl border border-accent/40 bg-surface p-3">
          <p className="label-caps text-accent">{t("Start with")}</p>
          <h2 id="first-plan" className="mt-1 text-lg font-bold tracking-tight">
            {tpl.name}
          </h2>
          <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
            <span className="num inline-flex items-center gap-1">
              <Timer aria-hidden="true" size={13} />
              {t("{n} min", { n: estimateMinutes(tpl) })}
            </span>
            <span className="num inline-flex items-center gap-1">
              <ListOrdered aria-hidden="true" size={13} />
              {t.n(tpl.exercises.length, "{n} exercise", "{n} exercises")}
            </span>
          </div>
          <div aria-hidden="true" className="mt-2 flex gap-1.5">
            {tpl.exercises.slice(0, 6).map((e) => {
              const ex = SEED_EXERCISES_BY_ID[e.exerciseId];
              return ex ? <ExerciseThumb key={e.exerciseId} exercise={ex} size={36} /> : null;
            })}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-2 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
        <Button variant="primary" onClick={() => onStart(tpl)} className="min-h-12 w-full text-base">
          <Play aria-hidden="true" size={18} />
          {t("Start {name}", { name: tpl.name })}
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-text-muted transition-colors hover:bg-ink/[0.05] hover:text-text"
        >
          {t("Look around first")}
        </button>
      </div>
    </div>
  );
}

function Choice<V extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: V;
  onChange: (v: V) => void;
  options: [V, ReactNode][];
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, text]) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={value === v}
            onClick={() => {
              if (value !== v) feedback.tick();
              onChange(v);
            }}
            className={`tap min-h-11 rounded-full border px-4 text-sm font-semibold ${
              value === v ? "border-accent bg-accent text-on-accent" : "border-ink/[0.12] text-text-muted hover:border-ink/25 hover:text-text"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
