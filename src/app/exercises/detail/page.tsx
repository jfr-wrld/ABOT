"use client";

import { setText } from "@/lib/set-metrics";
import { setNumbers } from "@/lib/sets";
import { useMemo, useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/navigation/BackLink";
import { useSearchParams, useRouter } from "next/navigation";
import { CalendarClock, ChevronLeft, Dumbbell, Play, Plus, Repeat, Trophy, TrendingDown, TrendingUp, Pencil, Trash2 } from "lucide-react";
import { motion, useReducedMotionConfig } from "framer-motion";
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
import { EQUIPMENT_LABELS, type Exercise } from "@/types/workout";
import { Tabs, tabPanelProps } from "@/components/ui/Tabs";
import { MuscleMap } from "@/components/anatomy/MuscleMap";
import { PhotoLoop } from "@/components/exercise/PhotoLoop";
import { CountFromZero, Rise, useEntrance } from "@/components/motion/Entrance";
import { relativeDay } from "@/lib/home";
import { useNow } from "@/lib/useNow";
import { useActionBarSpace } from "@/components/layout/useActionBarSpace";
import { estimate1RM, isWorkingSet } from "@/lib/calc";
import type { WeightUnit, WorkoutSession, WorkoutSet } from "@/types/workout";
import { exercisePath, historyPath } from "@/lib/routes";
import { useT } from "@/i18n";
import { FavoriteButton } from "@/components/exercise/FavoriteButton";
import { muscleNames } from "@/components/exercise/MuscleTags";

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

/** Workouts listed on the History tab; older ones are in the main history. */
const HISTORY_SHOWN = 10;

function Detail() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const router = useRouter();
  const { byId } = useAllExercises();
  const { updateCustom, removeCustom } = useExerciseStore();
  const extendedTried = useExerciseStore((s) => s.extendedTried);
  const sessions = useWorkoutStore((s) => s.sessions);
  const { weightUnit } = useSettingsStore();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // The open tab lives in the address, so Back from a past workout returns to History.
  const asked = params.get("tab");
  const tab: DetailTab = DETAIL_TABS.some((d) => d.value === asked) ? (asked as DetailTab) : "summary";
  const setTab = (next: DetailTab) => router.replace(next === "summary" ? exercisePath(id) : `${exercisePath(id)}&tab=${next}`, { scroll: false });
  const reduce = useReducedMotionConfig();
  const t = useT();

  const exercise = byId[id];
  const history = useMemo(() => exerciseHistory(id, sessions, { byId, allGyms: true }), [id, sessions, byId]);
  const done = useMemo(
    () => sessions.filter((s) => s.status === "completed" && s.exercises.some((e) => e.exerciseId === id)).sort((a, b) => b.startedAt - a.startedAt),
    [sessions, id],
  );

  if (!exercise) {
    // The larger library loads a moment after the page: a link to one of its exercises waits for it.
    if (!extendedTried && /^(fedb|atlas)-/.test(id)) {
      return (
        <main>
          <p role="status" className="px-4 pt-8 text-center text-sm text-text-muted">
            {t("Loading the exercise library")}
          </p>
        </main>
      );
    }
    return (
      <main>
        <PageHeader title={t("Exercise not found")} back={{ href: "/exercises", label: t("Exercises") }} />
        <p className="px-4 pt-4 text-sm text-text-muted">{t("No exercise with this id is in your library.")}</p>
      </main>
    );
  }

  const recent = done.slice(0, HISTORY_SHOWN);

  // The year joins the date once the line spans more than one.
  const years = new Set(history.map((h) => new Date(h.date).getFullYear()));
  const chartData = history.map((h) => ({
    date: new Date(h.date).toLocaleDateString(t.locale, years.size > 1 ? { day: "numeric", month: "short", year: "2-digit" } : { day: "numeric", month: "short" }),
    e1rm: Math.round(toDisplay(h.estimated1RM, weightUnit) * 10) / 10,
    best: `${formatWeight(h.bestSetWeightKg, weightUnit, false)} × ${h.bestSetReps}`,
  }));

  return (
    <main className="flex flex-1 flex-col">
      <Hero
        exercise={exercise}
        actions={
          <div className="-mr-2 flex gap-1">
            {/* Over the photo, so the star sits on the same dark disc as the other actions. */}
            <FavoriteButton id={exercise.id} name={exercise.name} tone="overlay" />
            {exercise.isCustom && (
              <>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                aria-label={t("Edit exercise")}
                className="flex size-11 items-center justify-center rounded-full bg-black/40 backdrop-blur hover:bg-black/60"
              >
                <Pencil aria-hidden="true" size={18} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                aria-label={t("Delete exercise")}
                className="flex size-11 items-center justify-center rounded-full bg-black/40 text-text backdrop-blur hover:bg-failure/30"
              >
                <Trash2 aria-hidden="true" size={18} />
              </button>
              </>
            )}
          </div>
        }
      />

      <div className="px-4 pt-4">
        <Rise order={1}>
          <QuickStats exercise={exercise} done={done} unit={weightUnit} />
        </Rise>
      </div>

      <div className="flex flex-col gap-3 px-4 pt-3">
        <Tabs id="ex-detail" label={t("Exercise details")} tabs={DETAIL_TABS.map((d) => ({ ...d, label: t(d.label) }))} value={tab} onChange={setTab} />

        {tab === "summary" && (
          <div {...tabPanelProps("ex-detail", "summary")} className="flex flex-col gap-3 outline-none">
            <MusclesWorked exercise={exercise} />
            <RecordsSummary exercise={exercise} />
            {!exercise.isBodyweight && (
              <figure className="panel p-3">
                <figcaption className="flex items-center justify-between gap-2 text-sm font-semibold">
                  <span>{t("Estimated 1RM over time ({unit}, Epley)", { unit: weightUnit })}</span>
                  {chartData.length >= 2 && <TrendChip from={chartData[0].e1rm} to={chartData[chartData.length - 1].e1rm} unit={weightUnit} />}
                </figcaption>
                {chartData.length < 2 ? (
                  <p className="py-6 text-center text-sm text-text-muted">
                    {chartData.length === 0
                      ? t("No data yet. The line starts after your first finished workout with this exercise.")
                      : t("One point so far. A second workout draws the line.")}
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
                          formatter={(v, _n, item) => [
                            t("{value} {unit} (best set {best})", { value: String(v), unit: weightUnit, best: (item.payload as { best: string }).best }),
                            t("1RM"),
                          ]}
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
          <section {...tabPanelProps("ex-detail", "history")} aria-label={t("History")} className="outline-none">
            {recent.length === 0 ? (
              <p className="mt-2 panel px-4 py-6 text-center text-sm text-text-muted">
                {t("Not logged yet. Add it to a workout and finish the workout to see sets here.")}
              </p>
            ) : (
              <>
                <ul className="mt-2 flex flex-col gap-2">
                  {recent.map((s, i) => (
                    <Rise key={s.id} order={i} step={0.05}>
                      <HistoryCard session={s} exercise={exercise} unit={weightUnit} />
                    </Rise>
                  ))}
                </ul>
                {done.length > HISTORY_SHOWN && (
                  <p className="mt-3 text-center text-xs text-text-muted">
                    {t("The last {shown} of {n} workouts. The rest are in History.", { shown: HISTORY_SHOWN, n: done.length })}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {tab === "howto" && (
          <div {...tabPanelProps("ex-detail", "howto")} className="flex flex-col gap-3 outline-none">
            <SmartExerciseMedia exercise={exercise} videoOnly />
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
        title={t("Delete {name}?", { name: exercise.name })}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setDeleteOpen(false)}>{t("Keep it")}</Button>
            <Button
              variant="danger"
              onClick={() => {
                removeCustom(exercise.id);
                router.push("/exercises");
              }}
            >
              {t("Delete")}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          {t(
            "Past workouts keep their sets but will show “Removed exercise” for this one. Routines using it keep a dead reference until you edit them.",
          )}
        </p>
      </Sheet>
    </main>
  );
}

/** A small map of the worked muscles with a legend: which part of the body this trains, at a glance. */
function MusclesWorked({ exercise }: { exercise: Exercise }) {
  const t = useT();
  const names = (ms: Exercise["primaryMuscles"]) => muscleNames(ms, t, ", ");
  return (
    <section aria-labelledby="muscles-heading" className="panel flex items-center gap-3 p-3">
      <div className="w-36 shrink-0">
        <MuscleMap primary={exercise.primaryMuscles} secondary={exercise.secondaryMuscles} width={144} />
      </div>
      <div className="min-w-0">
        <h2 id="muscles-heading" className="label-caps">
          {t("Muscles worked")}
        </h2>
        <p className="mt-2 flex items-start gap-2 text-sm">
          <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
          <span>
            <span className="text-text-muted">{t("Primary muscle")} </span>
            {names(exercise.primaryMuscles) || t("Not set")}
          </span>
        </p>
        {exercise.secondaryMuscles.length > 0 && (
          <p className="mt-1 flex items-start gap-2 text-sm">
            <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent/40" />
            <span>
              <span className="text-text-muted">{t("Secondary muscles")} </span>
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
  const t = useT();
  return (
    <header>
      {/* Only the photo stays dark in light mode; the name below it follows the page's theme. */}
      <div className="force-dark relative">
        {/* At most 40% of the screen, so the stats and tabs start on the first screen. */}
        <PhotoLoop exercise={exercise} className="aspect-[4/3] max-h-[40vh] w-full" />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 pb-6 pt-3">
        <BackLink
          href="/exercises"
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full bg-black/50 pl-1.5 pr-3 text-sm font-semibold backdrop-blur hover:bg-black/70"
        >
          <ChevronLeft aria-hidden="true" size={18} />
          {t("Exercises")}
        </BackLink>
        {actions}
        </div>
      </div>
      <Rise order={0} className="px-4 pt-4">
        <h1 className="text-2xl font-bold leading-tight tracking-tight">{exercise.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1.5 text-text">
            <MuscleIcon muscle={exercise.primaryMuscles[0]} size={24} />
            {muscleNames(exercise.primaryMuscles, t)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-accent">
              <EquipmentIcon equipment={exercise.equipment} size={20} />
            </span>
            {t(EQUIPMENT_LABELS[exercise.equipment])}
          </span>
          {exercise.secondaryMuscles.length > 0 && (
            <span className="text-xs">{t("also {muscles}", { muscles: muscleNames(exercise.secondaryMuscles, t, ", ") })}</span>
          )}
        </div>
      </Rise>
    </header>
  );
}


/**
 * Four figures at a glance, counting up: best, heaviest, how often, how recently. Every finished
 * workout counts (`done`, newest first), so they agree with the records below.
 */
function QuickStats({ exercise, done, unit }: { exercise: Exercise; done: WorkoutSession[]; unit: WeightUnit }) {
  let bestE1rm = 0;
  let heaviest = 0;
  let mostReps = 0;
  for (const s of done) {
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
  const last = done[0]?.startedAt;
  const now = useNow(60_000);
  const t = useT();
  const tiles = [
    exercise.isBodyweight
      ? { icon: <Trophy size={16} />, label: t("Most reps"), value: mostReps, format: (n: number) => String(Math.round(n)), pr: mostReps > 0 }
      : { icon: <Trophy size={16} />, label: t("Best e1RM"), value: bestE1rm, format: (n: number) => (bestE1rm ? formatWeight(n, unit) : "–"), pr: bestE1rm > 0 },
    { icon: <Dumbbell size={16} />, label: t("Heaviest"), value: heaviest, format: (n: number) => (heaviest ? formatWeight(n, unit) : "–") },
    { icon: <Repeat size={16} />, label: t("Workouts"), value: done.length, format: (n: number) => String(Math.round(n)) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2">
      {tiles.map((tile) => (
        <div key={tile.label} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
          <span
            aria-hidden="true"
            className={`hidden size-9 shrink-0 items-center justify-center rounded-lg min-[360px]:flex ${tile.pr ? "bg-pr/10 text-pr" : "bg-surface-2 text-text-muted"}`}
          >
            {tile.icon}
          </span>
          <div className="min-w-0">
            <dt className="label-caps">{tile.label}</dt>
            <dd className={`num truncate text-base font-bold tabular-nums min-[360px]:text-lg ${tile.pr ? "text-pr" : ""}`}>
              <CountFromZero value={tile.value} format={tile.format} />
            </dd>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
        <span aria-hidden="true" className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-muted min-[360px]:flex">
          <CalendarClock size={16} />
        </span>
        <div className="min-w-0">
          <dt className="label-caps">{t("Last done")}</dt>
          <dd className="num truncate text-base font-bold min-[360px]:text-lg">{last ? relativeDay(last, now, t) : t("Never")}</dd>
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
  const t = useT();
  const now = useNow(60_000);
  const ex = session.exercises.find((e) => e.exerciseId === exercise.id)!;
  const nums = setNumbers(ex.sets);
  // The bar measures what the lift is measured in: load, else reps, time or distance.
  const measure = (s: WorkoutSet) =>
    exercise.logType === "duration"
      ? (s.durationSec ?? 0)
      : exercise.logType === "distance_duration"
        ? (s.distanceM ?? 0)
        : exercise.logType === "reps_only" || exercise.isBodyweight
          ? (s.reps ?? 0)
          : (s.weightKg ?? 0);
  const max = Math.max(...ex.sets.map(measure), 0);
  return (
    <li className="panel p-3">
      <Link href={historyPath(session.id)} className="-mx-1 -mt-1 flex min-h-11 items-center justify-between gap-2 rounded-ctl px-1 hover:underline">
        <span className="truncate text-sm font-semibold">{session.name}</span>
        <time dateTime={new Date(session.startedAt).toISOString()} className="num shrink-0 text-xs text-text-muted">
          {relativeDay(session.startedAt, now, t)}
        </time>
      </Link>
      <ol className="mt-2 flex flex-col gap-1">
        {ex.sets.map((st, i) => {
          const num = nums[i] ?? null;
          const fill = max > 0 ? measure(st) / max : 0;
          return (
            <li key={st.id} className="num flex items-center gap-3 text-sm">
              <SetTypeChip type={st.type} number={num} />
              <span className="w-28 shrink-0">
                {setText(st, exercise.logType, unit, { isBodyweight: exercise.isBodyweight, reps: (n) => t("{n} reps", { n: String(n) }) })}
              </span>
              <span aria-hidden="true" className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-track">
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
              {st.rpe !== null && <span className="shrink-0 text-xs text-text-muted">{t("RPE {n}", { n: st.rpe })}</span>}
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
  const { startEmpty, addExercise } = useWorkoutStore.getState();
  const rest = useSettingsStore((s) => s.defaultRestSeconds);
  const inWorkout = active?.exercises.some((e) => e.exerciseId === exercise.id) ?? false;
  const [added, setAdded] = useState(false);
  const t = useT();
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
            {added || inWorkout ? t("In your workout") : t("Add to workout")}
          </Button>
          <Link
            href="/workout"
            aria-label={t("Open the workout in progress")}
            className="flex size-12 items-center justify-center rounded-xl border border-ink/[0.12] hover:border-ink/25"
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
          {t("Start a workout with this")}
        </Button>
      )}
    </div>
  );
}
