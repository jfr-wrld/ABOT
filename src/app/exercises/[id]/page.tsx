"use client";

import { setNumbers } from "@/lib/sets";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2, Trophy } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAllExercises, useExerciseStore } from "@/store/useExerciseStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";
import { SetTypeChip } from "@/components/workout/SetTypeChip";
import { CHART, tooltipStyle } from "@/components/analytics/chartTheme";
import { buildPRTable, exerciseHistory } from "@/lib/calc";
import { formatWeight, toDisplay } from "@/lib/units";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS, primaryMusclesLabel } from "@/types/workout";

export default function ExerciseDetailPage() {
  return (
    <HydrationGate>
      <Detail />
    </HydrationGate>
  );
}

function Detail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { byId } = useAllExercises();
  const { updateCustom, removeCustom } = useExerciseStore();
  const sessions = useWorkoutStore((s) => s.sessions);
  const { weightUnit } = useSettingsStore();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const exercise = byId[id];
  const history = useMemo(() => exerciseHistory(id, sessions), [id, sessions]);
  const prs = useMemo(() => buildPRTable(sessions)[id], [id, sessions]);

  if (!exercise) {
    return (
      <main>
        <PageHeader title="Exercise not found" back={{ href: "/exercises", label: "Exercises" }} />
        <p className="px-4 pt-4 text-sm text-text-muted">No exercise with this id is in your library.</p>
      </main>
    );
  }

  const recent = [...sessions]
    .filter((s) => s.status === "completed" && s.exercises.some((e) => e.exerciseId === id))
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 10);

  const chartData = history.map((h) => ({
    date: new Date(h.date).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    e1rm: Math.round(toDisplay(h.estimated1RM, weightUnit) * 10) / 10,
    best: `${formatWeight(h.bestSetWeightKg, weightUnit, false)} × ${h.bestSetReps}`,
  }));

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        title={exercise.name}
        back={{ href: "/exercises", label: "Exercises" }}
        subtitle={`${primaryMusclesLabel(exercise)} · ${EQUIPMENT_LABELS[exercise.equipment]}${
          exercise.secondaryMuscles.length
            ? ` · also ${exercise.secondaryMuscles.map((m) => MUSCLE_GROUP_LABELS[m]).join(", ")}`
            : ""
        }`}
        action={
          exercise.isCustom ? (
            <div className="flex">
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                aria-label="Edit exercise"
                className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface hover:text-text"
              >
                <Pencil aria-hidden="true" size={18} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                aria-label="Delete exercise"
                className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-failure/10 hover:text-failure"
              >
                <Trash2 aria-hidden="true" size={18} />
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 px-4 pt-4">
        <section aria-labelledby="pr-heading" className="rounded-card bg-surface p-3">
          <h2 id="pr-heading" className="flex items-center gap-2 text-sm font-semibold">
            <Trophy aria-hidden="true" size={16} className="text-accent" /> Personal records
          </h2>
          {!prs ? (
            <p className="mt-2 text-sm text-text-muted">
              No completed working sets yet. Records appear after you log this exercise in a finished workout.
            </p>
          ) : (
            <dl className="mt-2 grid grid-cols-3 gap-2">
              <PR
                label="Heaviest weight"
                value={exercise.isBodyweight ? `${prs.heaviest_weight!.reps} reps` : formatWeight(prs.heaviest_weight!.weightKg, weightUnit)}
                sub={`× ${prs.heaviest_weight!.reps}`}
                date={prs.heaviest_weight!.achievedAt}
              />
              <PR
                label="Best 1RM (est.)"
                value={formatWeight(prs.best_1rm!.value, weightUnit)}
                sub={`${formatWeight(prs.best_1rm!.weightKg, weightUnit, false)} × ${prs.best_1rm!.reps}`}
                date={prs.best_1rm!.achievedAt}
              />
              <PR
                label="Best set volume"
                value={formatWeight(prs.best_set_volume!.value, weightUnit)}
                sub={`${formatWeight(prs.best_set_volume!.weightKg, weightUnit, false)} × ${prs.best_set_volume!.reps}`}
                date={prs.best_set_volume!.achievedAt}
              />
            </dl>
          )}
        </section>

        {!exercise.isBodyweight && (
          <figure className="rounded-card bg-surface p-3">
            <figcaption className="text-sm font-semibold">Estimated 1RM over time ({weightUnit}, Epley)</figcaption>
            {chartData.length < 2 ? (
              <p className="py-6 text-center text-sm text-text-muted">
                {chartData.length === 0
                  ? "No data yet. The line starts after your first finished workout with this exercise."
                  : "One point so far. A second workout draws the line."}
              </p>
            ) : (
              <div className="mt-2 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={CHART.grid} />
                    <XAxis dataKey="date" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={40} domain={["auto", "auto"]} />
                    <Tooltip
                      {...tooltipStyle}
                      cursor={{ stroke: CHART.axis }}
                      formatter={(v, _n, item) => [`${v} ${weightUnit} (best set ${(item.payload as { best: string }).best})`, "1RM"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="e1rm"
                      stroke={CHART.series}
                      strokeWidth={2}
                      dot={{ r: 4, fill: CHART.series, stroke: "#18181b", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </figure>
        )}

        <section aria-labelledby="hist-heading">
          <h2 id="hist-heading" className="text-sm font-semibold uppercase text-text-muted">
            History
          </h2>
          {recent.length === 0 ? (
            <p className="mt-2 rounded-card bg-surface px-4 py-6 text-center text-sm text-text-muted">
              Not logged yet. Add it to a workout and finish the workout to see sets here.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {recent.map((s) => {
                const ex = s.exercises.find((e) => e.exerciseId === id)!;
                const nums = setNumbers(ex.sets);
                return (
                  <li key={s.id} className="rounded-card bg-surface p-3">
                    <Link href={`/history/${s.id}`} className="flex items-baseline justify-between gap-2 hover:underline">
                      <span className="text-sm font-semibold">{s.name}</span>
                      <time dateTime={new Date(s.startedAt).toISOString()} className="text-xs text-text-muted">
                        {new Date(s.startedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </time>
                    </Link>
                    <ol className="mt-2 flex flex-col gap-1">
                      {ex.sets.map((st, i) => {
                        const num = nums[i] ?? null;
                        return (
                          <li key={st.id} className="flex items-center gap-3 text-sm tabular-nums">
                            <SetTypeChip type={st.type} number={num} />
                            {exercise.isBodyweight || st.weightKg === null
                              ? `${st.reps} reps`
                              : `${formatWeight(st.weightKg, weightUnit)} × ${st.reps}`}
                            {st.rpe !== null && <span className="text-xs text-text-muted">RPE {st.rpe}</span>}
                          </li>
                        );
                      })}
                    </ol>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {editOpen && (
        <ExerciseForm
          open={editOpen}
          initial={exercise}
          onClose={() => setEditOpen(false)}
          onSave={(data) => {
            updateCustom(exercise.id, data);
            setEditOpen(false);
          }}
        />
      )}

      <Sheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete ${exercise.name}?`}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setDeleteOpen(false)}>Keep it</Button>
            <Button
              variant="danger"
              onClick={() => {
                removeCustom(exercise.id);
                router.push("/exercises");
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          Past workouts keep their sets but will show “Removed exercise” for this one. Routines using it keep a
          dead reference until you edit them.
        </p>
      </Sheet>
    </main>
  );
}

function PR({ label, value, sub, date }: { label: string; value: string; sub: string; date: number }) {
  return (
    <div className="rounded-ctl bg-bg px-2 py-2">
      <dt className="text-[11px] font-semibold uppercase text-text-muted">{label}</dt>
      <dd className="text-base font-bold tabular-nums">{value}</dd>
      <dd className="text-xs text-text-muted">
        {sub} · {new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
      </dd>
    </div>
  );
}
