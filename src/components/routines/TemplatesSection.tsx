"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { EquipmentNeeded } from "./EquipmentNeeded";
import { useT } from "@/i18n";
import {
  ROUTINE_TEMPLATES,
  TEMPLATE_PROGRAMS,
  hasTemplate,
  templateExercises,
  templateSetCount,
  type RoutineTemplate,
} from "@/data/routine-templates";

/**
 * Starter routines grouped by program. Each card previews its lifts with the same photos as the
 * library; adding one copies it into the user's routines, under the program's folder.
 */
export function TemplatesSection() {
  const router = useRouter();
  const routines = useRoutineStore((s) => s.routines);
  const { create, setExercises } = useRoutineStore();
  const active = useWorkoutStore((s) => s.active);
  const startFromRoutine = useWorkoutStore((s) => s.startFromRoutine);
  const { byId } = useAllExercises();
  const [preview, setPreview] = useState<RoutineTemplate | null>(null);
  const [notice, setNotice] = useState("");
  const t = useT();

  function add(tpl: RoutineTemplate) {
    const r = create(tpl.name, tpl.program);
    const exercises = templateExercises(tpl);
    setExercises(r.id, exercises);
    setNotice(t("{name} added to your routines, in {program}.", { name: tpl.name, program: tpl.program }));
    return { ...r, exercises };
  }

  return (
    <section aria-labelledby="templates-title" className="flex flex-col gap-4">
      <div>
        <h2 id="templates-title" className="text-base font-bold">
          {t("Templates")}
        </h2>
        <p className="text-xs text-text-muted">
          {t("Common training splits with target sets and reps. Add one, then set your weights as you log.")}
        </p>
      </div>
      {notice && (
        <p role="status" className="flex items-center gap-2 text-sm text-accent">
          <Check aria-hidden="true" size={16} />
          {notice}
        </p>
      )}

      {TEMPLATE_PROGRAMS.map((program) => (
        <section key={program.name} aria-labelledby={`program-${program.name}`}>
          <h3 id={`program-${program.name}`} className="text-sm font-semibold uppercase text-text-muted">
            {program.name}
          </h3>
          <p className="text-xs text-text-muted">{program.schedule}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {ROUTINE_TEMPLATES.filter((tpl) => tpl.program === program.name).map((tpl) => {
              const added = hasTemplate(routines, tpl);
              return (
                <li key={tpl.id} className="panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-base font-semibold">{tpl.name}</h4>
                      <p className="text-xs text-text-muted">
                        {tpl.focus} · {t("{n} exercises", { n: tpl.exercises.length })} · {t("{n} sets", { n: templateSetCount(tpl) })}
                      </p>
                    </div>
                    {added && (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent">
                        <Check aria-hidden="true" size={14} /> {t("Added")}
                      </span>
                    )}
                  </div>
                  <ul aria-hidden="true" className="mt-3 flex gap-1.5">
                    {tpl.exercises.map((e) =>
                      byId[e.exerciseId] ? (
                        <li key={e.exerciseId}>
                          <ExerciseThumb exercise={byId[e.exerciseId]} size={40} />
                        </li>
                      ) : null,
                    )}
                  </ul>
                  <EquipmentNeeded equipment={tpl.exercises.flatMap((e) => (byId[e.exerciseId] ? [byId[e.exerciseId].equipment] : []))} />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button onClick={() => setPreview(tpl)} aria-label={t("See exercises: {name}", { name: tpl.name })}>
                      {t("See exercises")}
                    </Button>
                    <Button onClick={() => add(tpl)} aria-label={`${added ? t("Add again") : t("Add to routines")}: ${tpl.name}`}>
                      {added ? t("Add again") : t("Add to routines")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <Sheet
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview ? `${preview.program}: ${preview.name}` : t("Template")}
        footer={
          preview && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => {
                    add(preview);
                    setPreview(null);
                  }}
                >
                  {t("Add to routines")}
                </Button>
                <Button
                  variant="primary"
                  disabled={active !== null}
                  onClick={() => {
                    const r = add(preview);
                    setPreview(null);
                    startFromRoutine(r);
                    router.push("/workout");
                  }}
                >
                  {t("Add and start")}
                </Button>
              </div>
              {active && <p className="text-xs text-text-muted">{t("Finish or discard the workout in progress to start this one.")}</p>}
            </div>
          )
        }
      >
        {preview && (
          <>
            <p className="text-sm text-text-muted">{preview.focus}.</p>
            <ol className="mt-3 flex flex-col gap-2">
              {preview.exercises.map((e) => {
                const def = byId[e.exerciseId];
                return (
                  <li key={e.exerciseId} className="flex items-center gap-3">
                    {def && <ExerciseThumb exercise={def} size={44} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{def?.name ?? e.exerciseId}</span>
                      <span className="block text-xs text-text-muted">
                        {t("Rest {n} min", { n: Math.round((e.restSeconds / 60) * 10) / 10 })}
                      </span>
                    </span>
                    <span className="num shrink-0 text-sm font-bold">
                      {e.sets} × {e.reps}
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </Sheet>
    </section>
  );
}
