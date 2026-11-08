"use client";

import { setNumbers } from "@/lib/sets";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CalendarClock, ChevronLeft, Dumbbell, Play, Plus, Repeat, Trophy, TrendingDown, TrendingUp, Pencil, Trash2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAllExercises, useExerciseStore } from "@/store/useExerciseStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { EquipmentIcon } from "@/components/icons/EquipmentIcon";
import { MuscleIcon } from "@/components/icons/MuscleIcon";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";
import { SmartExerciseMedia } from "@/components/exercise/SmartExerciseMedia";
import { ExerciseGuide } from "@/components/exercise/ExerciseGuide";
import { RecordsSummary } from "@/components/exercise/RecordsSummary";
import { SetTypeChip } from "@/components/workout/SetTypeChip";
import { CHART, numTick, tooltipStyle } from "@/components/analytics/chartTheme";
import { exerciseHistory } from "@/lib/calc";
import { formatWeight, toDisplay } from "@/lib/units";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS, primaryMusclesLabel, type Exercise } from "@/types/workout";
import { Tabs, tabPanelProps } from "@/components/ui/Tabs";
import { MuscleMap } from "@/components/anatomy/MuscleMap";
import { PhotoLoop } from "@/components/exercise/PhotoLoop";
import { CountFromZero, Rise, useEntrance } from "@/components/motion/Entrance";
import { relativeDay } from "@/lib/home";
import { useNow } from "@/lib/useNow";
import { useActionBarSpace } from "@/components/layout/useActionBarSpace";
import { estimate1RM, isWorkingSet } from "@/lib/calc";
import type { WeightUnit, WorkoutSession } from "@/types/workout";

type DetailTab = "summary" | "history" | "howto";
const DETAIL_TABS: { value: DetailTab; label: string }[] = [
  { value: "summary", label: "Summary" },
  { value: "history", label: "History" },
  { value: "howto", label: "How to" },
];

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
  const [tab, setTab] = useState<DetailTab>("summary");
  const reduce = useReducedMotion();

  const exercise = byId[id];
  const history = useMemo(() => exerciseHistory(id, sessions, { byId, allGyms: true }), [id, sessions, byId]);

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
      <Hero
        exercise={exercise}
        actions={
          exercise.isCustom ? (
            <div className="-mr-2 flex gap-1">
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                aria-label="Edit exercise"
                className="flex size-11 items-center justify-center rounded-full bg-black/40 backdrop-blur hover:bg-black/60"
              >
                <Pencil aria-hidden="true" size={18} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                aria-label="Delete exercise"
                className="flex size-11 items-center justify-center rounded-full bg-black/40 text-text backdrop-blur hover:bg-failure/30"
              >
                <Trash2 aria-hidden="true" size={18} />
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="px-4 pt-4">
        <Rise order={1}>
          <QuickStats exercise={exercise} recent={recent} unit={weightUnit} />
        </Rise>
      </div>

      <div className="flex flex-col gap-3 px-4 pt-3">
        <Tabs id="ex-detail" label="Exercise details" tabs={DETAIL_TABS} value={tab} onChange={setTab} />

        {tab === "summary" && (
          <div {...tabPanelProps("ex-detail", "summary")} className="flex flex-col gap-3 outline-none">
            <MusclesWorked exercise={exercise} />
            <RecordsSummary exercise={exercise} />
            {!exercise.isBodyweight && (
              <figure className="panel p-3">
                <figcaption className="flex items-center justify-between gap-2 text-sm font-semibold">
                  <span>Estimated 1RM over time ({weightUnit}, Epley)</span>
                  {chartData.length >= 2 && <TrendChip from={chartData[0].e1rm} to={chartData[chartData.length - 1].e1rm} unit={weightUnit} />}
                </figcaption>
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
                        <XAxis dataKey="date" tick={numTick} axisLine={false} tickLine={false} />
                        <YAxis tick={numTick} axisLine={false} tickLine={false} width={40} domain={["auto", "auto"]} />
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
                          dot={{ r: 4, fill: CHART.series, stroke: CHART.surface, strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                          isAnimationActive={!reduce}
                          animationDuration={900}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </figure>
            )}

          </div>
        )}

        {tab === "history" && (
          <section {...tabPanelProps("ex-detail", "history")} aria-label="History" className="outline-none">
            {recent.length === 0 ? (
              <p className="mt-2 panel px-4 py-6 text-center text-sm text-text-muted">
                Not logged yet. Add it to a workout and finish the workout to see sets here.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {recent.map((s, i) => (
                  <Rise key={s.id} order={i} step={0.05}>
                    <HistoryCard session={s} exercise={exercise} unit={weightUnit} />
                  </Rise>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "howto" && (
          <div {...tabPanelProps("ex-detail", "howto")} className="flex flex-col gap-3 outline-none">
            <SmartExerciseMedia exercise={exercise} />
            <ExerciseGuide exercise={exercise} showInstructions />
          </div>
        )}
      </div>

      {/* Room for the action bar, so the last block scrolls clear of it. */}
      <div className="h-24" aria-hidden="true" />
      <TrainBar exercise={exercise} />

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

/** A small map of the worked muscles with a legend: which part of the body this trains, at a glance. */
function MusclesWorked({ exercise }: { exercise: Exercise }) {
  const names = (ms: Exercise["primaryMuscles"]) => ms.map((m) => MUSCLE_GROUP_LABELS[m]).join(", ");
  return (
    <section aria-labelledby="muscles-heading" className="panel flex items-center gap-3 p-3">
      <div className="w-36 shrink-0">
        <MuscleMap primary={exercise.primaryMuscles} secondary={exercise.secondaryMuscles} width={144} />
      </div>
      <div className="min-w-0">
        <h2 id="muscles-heading" className="label-caps">
          Muscles worked
        </h2>
        <p className="mt-2 flex items-start gap-2 text-sm">
          <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
          <span>
            <span className="text-text-muted">Primary </span>
            {names(exercise.primaryMuscles) || "Not set"}
          </span>
        </p>
        {exercise.secondaryMuscles.length > 0 && (
          <p className="mt-1 flex items-start gap-2 text-sm">
            <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent/40" />
            <span>
              <span className="text-text-muted">Secondary </span>
              {names(exercise.secondaryMuscles)}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}


/**
 * The top of the page: the exercise's own start and end photos alternating like a GIF across the
 * full width, with the back pill over them; then the name, and the muscle and gear with icons.
 */
function Hero({ exercise, actions }: { exercise: Exercise; actions?: React.ReactNode }) {
  return (
    <header className="relative">
      <PhotoLoop exercise={exercise} className="aspect-[4/3] max-h-[52vh] w-full" />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 pb-6 pt-[max(12px,env(safe-area-inset-top))]">
        <Link
          href="/exercises"
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full bg-black/50 pl-1.5 pr-3 text-sm font-semibold backdrop-blur hover:bg-black/70"
        >
          <ChevronLeft aria-hidden="true" size={18} />
          Exercises
        </Link>
        {actions}
      </div>
      <Rise order={0} className="px-4 pt-4">
        <h1 className="text-2xl font-bold leading-tight tracking-tight">{exercise.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1.5 text-text">
            <MuscleIcon muscle={exercise.primaryMuscles[0]} size={24} />
            {primaryMusclesLabel(exercise)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-accent">
              <EquipmentIcon equipment={exercise.equipment} size={20} />
            </span>
            {EQUIPMENT_LABELS[exercise.equipment]}
          </span>
          {exercise.secondaryMuscles.length > 0 && (
            <span className="text-xs">also {exercise.secondaryMuscles.map((m) => MUSCLE_GROUP_LABELS[m]).join(", ")}</span>
          )}
        </div>
      </Rise>
    </header>
  );
}


/** Four figures at a glance, counting up: best, heaviest, how often, how recently. */
function QuickStats({ exercise, recent, unit }: { exercise: Exercise; recent: WorkoutSession[]; unit: WeightUnit }) {
  let bestE1rm = 0;
  let heaviest = 0;
  let mostReps = 0;
  for (const s of recent) {
    for (const ex of s.exercises) {
      if (ex.exerciseId !== exercise.id) continue;
      for (const set of ex.sets) {
        if (!isWorkingSet(set)) continue;
        mostReps = Math.max(mostReps, set.reps ?? 0);
        if (set.weightKg) {
          heaviest = Math.max(heaviest, set.weightKg);
          bestE1rm = Math.max(bestE1rm, estimate1RM(set.weightKg, set.reps!));
        }
      }
    }
  }
  const last = recent[0]?.startedAt;
  const now = useNow(60_000);
  const tiles = [
    exercise.isBodyweight
      ? { icon: <Trophy size={16} />, label: "Most reps", value: mostReps, format: (n: number) => String(Math.round(n)), pr: mostReps > 0 }
      : { icon: <Trophy size={16} />, label: "Best e1RM", value: bestE1rm, format: (n: number) => (bestE1rm ? formatWeight(n, unit) : "–"), pr: bestE1rm > 0 },
    { icon: <Dumbbell size={16} />, label: "Heaviest", value: heaviest, format: (n: number) => (heaviest ? formatWeight(n, unit) : "–") },
    { icon: <Repeat size={16} />, label: "Workouts", value: recent.length, format: (n: number) => String(Math.round(n)) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2">
      {tiles.map((t) => (
        <div key={t.label} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
          <span
            aria-hidden="true"
            className={`hidden size-9 shrink-0 items-center justify-center rounded-lg min-[360px]:flex ${t.pr ? "bg-pr/10 text-pr" : "bg-surface-2 text-text-muted"}`}
          >
            {t.icon}
          </span>
          <div className="min-w-0">
            <dt className="label-caps">{t.label}</dt>
            <dd className={`num truncate text-base font-bold tabular-nums min-[360px]:text-lg ${t.pr ? "text-pr" : ""}`}>
              <CountFromZero value={t.value} format={t.format} />
            </dd>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
        <span aria-hidden="true" className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-muted min-[360px]:flex">
          <CalendarClock size={16} />
        </span>
        <div className="min-w-0">
          <dt className="label-caps">Last done</dt>
          <dd className="num truncate text-base font-bold min-[360px]:text-lg">{last ? relativeDay(last, now) : "Never"}</dd>
        </div>
      </div>
    </dl>
  );
}

/** First to latest point of the e1RM line, as a chip: Volt when it went up. */
function TrendChip({ from, to, unit }: { from: number; to: number; unit: WeightUnit }) {
  const diff = Math.round((to - from) * 10) / 10;
  const up = diff >= 0;
  return (
    <span
      className={`num inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${
        up ? "bg-accent text-on-accent" : "bg-surface-2 text-text-muted"
      }`}
    >
      {up ? <TrendingUp aria-hidden="true" size={13} /> : <TrendingDown aria-hidden="true" size={13} />}
      {up ? "+" : ""}
      {diff} {unit}
    </span>
  );
}

/** One past workout with this lift: when, and each set with a bar for its load. */
function HistoryCard({ session, exercise, unit }: { session: WorkoutSession; exercise: Exercise; unit: WeightUnit }) {
  const controls = useEntrance();
  const now = useNow(60_000);
  const ex = session.exercises.find((e) => e.exerciseId === exercise.id)!;
  const nums = setNumbers(ex.sets);
  const max = Math.max(...ex.sets.map((s) => s.weightKg ?? 0), 0);
  return (
    <li className="panel p-3">
      <Link href={`/history/${session.id}`} className="flex items-baseline justify-between gap-2 hover:underline">
        <span className="truncate text-sm font-semibold">{session.name}</span>
        <time dateTime={new Date(session.startedAt).toISOString()} className="num shrink-0 text-xs text-text-muted">
          {relativeDay(session.startedAt, now)}
        </time>
      </Link>
      <ol className="mt-2 flex flex-col gap-1">
        {ex.sets.map((st, i) => {
          const num = nums[i] ?? null;
          const fill = max > 0 && st.weightKg ? st.weightKg / max : 0;
          return (
            <li key={st.id} className="num flex items-center gap-3 text-sm">
              <SetTypeChip type={st.type} number={num} />
              <span className="w-28 shrink-0">
                {exercise.isBodyweight || st.weightKg === null ? `${st.reps} reps` : `${formatWeight(st.weightKg, unit)} × ${st.reps}`}
              </span>
              <span aria-hidden="true" className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-800/80">
                <motion.span
                  className="block h-full origin-left rounded-full bg-accent/60"
                  style={{ scaleX: 0 }}
                  animate={controls}
                  variants={{
                    still: { scaleX: fill },
                    show: { scaleX: fill, transition: { duration: 0.6, delay: 0.15 + i * 0.05, ease: [0.22, 1, 0.36, 1] } },
                  }}
                />
              </span>
              {st.rpe !== null && <span className="shrink-0 text-xs text-text-muted">RPE {st.rpe}</span>}
            </li>
          );
        })}
      </ol>
    </li>
  );
}

/**
 * Within thumb reach: add this lift to the workout that is running, or start one with it.
 * After adding, the bar says so for a moment instead of jumping away.
 */
function TrainBar({ exercise }: { exercise: Exercise }) {
  const router = useRouter();
  const active = useWorkoutStore((s) => s.active);
  const { startEmpty, addExercise } = useWorkoutStore();
  const rest = useSettingsStore((s) => s.defaultRestSeconds);
  const inWorkout = active?.exercises.some((e) => e.exerciseId === exercise.id) ?? false;
  const [added, setAdded] = useState(false);
  useActionBarSpace(76);
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[640px] border-t border-line bg-bg/85 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
      {active ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Button
            variant="primary"
            disabled={inWorkout}
            onClick={() => {
              addExercise(exercise.id, rest);
              setAdded(true);
            }}
            className="min-h-12 text-base"
          >
            <Plus aria-hidden="true" size={18} />
            {added || inWorkout ? "In your workout" : "Add to workout"}
          </Button>
          <Link
            href="/workout"
            aria-label="Open the workout in progress"
            className="flex size-12 items-center justify-center rounded-xl border border-white/[0.12] hover:border-white/25"
          >
            <Play aria-hidden="true" size={18} />
          </Link>
        </div>
      ) : (
        <Button
          variant="primary"
          onClick={() => {
            startEmpty(rest);
            useWorkoutStore.getState().addExercise(exercise.id, rest);
            router.push("/workout");
          }}
          className="min-h-12 w-full text-base"
        >
          <Play aria-hidden="true" size={18} />
          Start a workout with this
        </Button>
      )}
    </div>
  );
}
