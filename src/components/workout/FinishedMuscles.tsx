"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Exercise, SessionExercise } from "@/types/workout";
import { MUSCLE_GROUP_LABELS } from "@/types/workout";
import { MuscleMap } from "@/components/anatomy/MuscleMap";
import { isWorkingSet } from "@/lib/calc";
import { muscleText } from "@/lib/home";
import { useT } from "@/i18n";

/**
 * Once every set of an exercise is ticked, the card shows the muscles it worked, the same map
 * and chips as the finished workout. It opens once, then stays still; unticking a set hides it.
 */
export function FinishedMuscles({ item, exercise }: { item: SessionExercise; exercise: Exercise | undefined }) {
  const t = useT();
  const reduce = useReducedMotion();
  const finished = item.sets.length > 0 && item.sets.every((s) => s.completed) && item.sets.some(isWorkingSet);
  if (!finished || !exercise || exercise.primaryMuscles.length === 0) return null;
  const primary = exercise.primaryMuscles;
  const secondary = exercise.secondaryMuscles.filter((m) => !primary.includes(m));

  return (
    <motion.section
      aria-label={t("Muscles worked by {name}", { name: exercise.name })}
      initial={reduce ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div className="mx-1 mt-3 flex items-center gap-3 rounded-ctl bg-surface-2 p-2.5">
        <div className="w-28 shrink-0 [&_figcaption]:hidden">
          <MuscleMap primary={primary} secondary={secondary} width={112} />
        </div>
        <div className="min-w-0">
          <h3 className="label-caps">{t("Muscles worked")}</h3>
          <ul className="mt-2 flex flex-wrap gap-1">
            {primary.map((m) => (
              <li key={m} className="rounded-full border border-accent/40 bg-accent-tint px-2 py-0.5 text-xs font-semibold">
                {muscleText(MUSCLE_GROUP_LABELS[m], t)}
              </li>
            ))}
            {secondary.slice(0, 3).map((m) => (
              <li key={m} className="rounded-full border border-ink/10 px-2 py-0.5 text-xs text-text-muted">
                {muscleText(MUSCLE_GROUP_LABELS[m], t)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.section>
  );
}
