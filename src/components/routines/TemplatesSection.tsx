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

  function add(t: RoutineTemplate) {
    const r = create(t.name, t.program);
    const exercises = templateExercises(t);
    setExercises(r.id, exercises);
    setNotice(`${t.name} added to your routines, in ${t.program}.`);
    return { ...r, exercises };
  }

  return (
    <section aria-labelledby="templates-title" className="flex flex-col gap-4">
      <div>
        <h2 id="templates-title" className="text-base font-bold">
          Templates
        </h2>
        <p className="text-xs text-text-muted">
          Common training splits with target sets and reps. Add one, then set your weights as you log.
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
            {ROUTINE_TEMPLATES.filter((t) => t.program === program.name).map((t) => {
              const added = hasTemplate(routines, t);
              return (
                <li key={t.id} className="panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-base font-semibold">{t.name}</h4>
                      <p className="text-xs text-text-muted">
                        {t.focus} · <span className="num">{t.exercises.length}</span> exercises ·{" "}
                        <span className="num">{templateSetCount(t)}</span> sets
                      </p>
                    </div>
                    {added && (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent">
                        <Check aria-hidden="true" size={14} /> Added
                      </span>
                    )}
                  </div>
                  <ul aria-hidden="true" className="mt-3 flex gap-1.5">
                    {t.exercises.map((e) =>
                      byId[e.exerciseId] ? (
                        <li key={e.exerciseId}>
                          <ExerciseThumb exercise={byId[e.exerciseId]} size={40} />
                        </li>
                      ) : null,
                    )}
                  </ul>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button onClick={() => setPreview(t)} aria-label={`See exercises: ${t.name}`}>
                      See exercises
                    </Button>
                    <Button onClick={() => add(t)} aria-label={`${added ? "Add again" : "Add to routines"}: ${t.name}`}>
                      {added ? "Add again" : "Add to routines"}
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
        title={preview ? `${preview.program}: ${preview.name}` : "Template"}
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
                  Add to routines
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
                  Add and start
                </Button>
              </div>
              {active && <p className="text-xs text-text-muted">Finish or discard the workout in progress to start this one.</p>}
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
                        Rest <span className="num">{Math.round(e.restSeconds / 60 * 10) / 10}</span> min
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
