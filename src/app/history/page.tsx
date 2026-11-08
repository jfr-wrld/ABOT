"use client";

import { setNumbers } from "@/lib/sets";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronLeft, Dumbbell, Layers, MoreHorizontal, Play, Timer, Trash2, Trophy } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, PRESS_SPRING } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { SetTypeChip } from "@/components/workout/SetTypeChip";
import { ShareStoryButton } from "@/components/share/ShareStoryButton";
import { ExerciseThumb, exercisePhoto } from "@/components/exercise/ExerciseThumb";
import { EquipmentIcon } from "@/components/icons/EquipmentIcon";
import { MuscleMap } from "@/components/anatomy/MuscleMap";
import { useActionBarSpace } from "@/components/layout/useActionBarSpace";
import { CountFromZero, Rise, useEntrance } from "@/components/motion/Entrance";
import { sessionRecords, workedMuscles } from "@/lib/session-insights";
import { countSets, estimate1RM, formatDuration, isWorkingSet, sessionDurationSec, sessionVolume } from "@/lib/calc";
import { formatVolume, formatWeight } from "@/lib/units";
import {
  EQUIPMENT_LABELS,
  MUSCLE_GROUP_LABELS,
  type Exercise,
  type Routine,
  type SessionExercise,
  type WeightUnit,
  type WorkoutSession,
} from "@/types/workout";
import { exercisePath } from "@/lib/routes";

const SPRING = { type: "spring", stiffness: 300, damping: 26 } as const;

export default function SessionPage() {
  return (
    <HydrationGate>
      <SessionDetail />
    </HydrationGate>
  );
}

/** A finished workout as a routine, so "Repeat" starts the same lifts with the same numbers. */
function asRoutine(s: WorkoutSession): Routine {
  return {
    id: s.routineId ?? "",
    name: s.name,
    createdAt: s.startedAt,
    updatedAt: s.startedAt,
    exercises: s.exercises.map((ex) => ({
      id: ex.id,
      exerciseId: ex.exerciseId,
      restSeconds: ex.restSeconds,
      notes: ex.notes,
      ...(ex.supersetId ? { supersetId: ex.supersetId } : {}),
      sets: ex.sets.map((set) => ({ id: set.id, type: set.type, targetWeightKg: set.weightKg, targetReps: set.reps })),
    })),
  };
}

function SessionDetail() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const sessions = useWorkoutStore((s) => s.sessions);
  const active = useWorkoutStore((s) => s.active);
  const deleteSession = useWorkoutStore((s) => s.deleteSession);
  const startFromRoutine = useWorkoutStore((s) => s.startFromRoutine);
  const { weightUnit } = useSettingsStore();
  const { byId } = useAllExercises();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useActionBarSpace(76);

  const session = sessions.find((s) => s.id === id);
  // A record counts once per lift, and only when it beat an earlier one: a first attempt beats
  // nothing (the same rule as the PR pill on Home).
  const prs = useMemo(() => (session ? sessionRecords(session, sessions, byId).records : []), [session, sessions, byId]);
  const prSetIds = useMemo(() => new Set(prs.map((p) => p.setId)), [prs]);
  const prLifts = new Set(prs.map((p) => p.exerciseId)).size;

  if (!session) {
    return (
      <main>
        <PageHeader title="Workout not found" back={{ href: "/", label: "Home" }} />
        <p className="px-4 pt-4 text-sm text-text-muted">This workout is not on this device. It may have been deleted.</p>
      </main>
    );
  }

  const total = sessionVolume(session, byId);
  const sets = countSets(session).completed;
  const muscles = workedMuscles(session, byId);

  return (
    <main className="flex flex-1 flex-col">
      <Hero session={session} byId={byId} onMenu={() => setMenu(true)} />

      <div className="flex flex-col gap-3 px-4 pt-4">
        <Rise order={1}>
          <dl className="grid grid-cols-2 gap-2">
            <Stat icon={<Timer size={16} />} label="Duration" value={sessionDurationSec(session)} format={(n) => formatDuration(Math.round(n))} />
            <Stat icon={<Dumbbell size={16} />} label="Volume" value={total} format={(n) => formatVolume(n, weightUnit)} />
            <Stat icon={<Layers size={16} />} label="Sets" value={sets} format={(n) => String(Math.round(n))} />
            <Stat icon={<Trophy size={16} />} label="Records" value={prLifts} format={(n) => String(Math.round(n))} pr={prLifts > 0} />
          </dl>
        </Rise>



        {muscles.primary.length > 0 && (
          <Rise order={3}>
            <section aria-labelledby="muscles-heading" className="panel flex items-center gap-3 p-3">
              <div className="w-36 shrink-0 [&_figcaption]:hidden">
                <MuscleMap primary={muscles.primary} secondary={muscles.secondary} width={144} />
              </div>
              <div className="min-w-0">
                <h2 id="muscles-heading" className="label-caps">
                  Muscles worked
                </h2>
                <ul className="mt-2 flex flex-wrap gap-1">
                  {muscles.primary.slice(0, 5).map((m) => (
                    <li key={m} className="rounded-full border border-accent/40 bg-accent-tint px-2 py-0.5 text-xs font-semibold">
                      {MUSCLE_GROUP_LABELS[m]}
                    </li>
                  ))}
                  {muscles.secondary.slice(0, 3).map((m) => (
                    <li key={m} className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-text-muted">
                      {MUSCLE_GROUP_LABELS[m]}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </Rise>
        )}

        {session.exercises.map((ex, i) => (
          <Rise key={ex.id} order={4 + Math.min(i, 6)}>
            <ExerciseCard ex={ex} def={byId[ex.exerciseId]} total={total} unit={weightUnit} prSetIds={prSetIds} />
          </Rise>
        ))}
      </div>

      {/* Room for the action bar, so the last card can scroll clear of it. */}
      <div className="h-24" aria-hidden="true" />

      {/* Actions within thumb reach, over the content. */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[640px] border-t border-line bg-bg/85 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-2">
          {active ? (
            <Link
              href="/workout"
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-accent/40 text-sm font-semibold"
            >
              <Play aria-hidden="true" size={16} className="text-accent" />
              Current workout
            </Link>
          ) : (
            <Button
              variant="primary"
              onClick={() => {
                startFromRoutine(asRoutine(session));
                router.push("/workout");
              }}
              className="min-h-12 text-base"
            >
              <Play aria-hidden="true" size={18} />
              Repeat
            </Button>
          )}
          <ShareStoryButton session={session} label="Share story" className="min-h-12 w-full" />
        </div>
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={session.name}>
        <button
          type="button"
          onClick={() => {
            setMenu(false);
            setConfirm(true);
          }}
          className="flex h-12 w-full items-center gap-3 rounded-ctl px-3 text-left text-base font-semibold text-failure hover:bg-failure/10"
        >
          <Trash2 aria-hidden="true" size={18} /> Delete this workout
        </button>
      </Sheet>

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this workout?"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setConfirm(false)}>Keep it</Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteSession(session.id);
                router.push("/");
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          Its sets leave your history and any records it set are recalculated. This cannot be undone.
        </p>
      </Sheet>
    </main>
  );
}

/**
 * The top of the page: the workout's own exercise photos blurred into a backdrop (they are small
 * files, so they are used as colour and texture, not detail), the crisp photos in a row on top,
 * then the date and name. The backdrop drifts slightly, like a slow camera.
 */
function Hero({ session, byId, onMenu }: { session: WorkoutSession; byId: Record<string, Exercise>; onMenu: () => void }) {
  const reduce = useReducedMotion();
  const defs = session.exercises.map((e) => byId[e.exerciseId]).filter(Boolean) as Exercise[];
  const photos = defs.map((d) => exercisePhoto(d)).filter(Boolean).slice(0, 4) as string[];
  const date = new Date(session.startedAt);
  return (
    <header className="relative overflow-hidden border-b border-line">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 grid grid-cols-2"
        animate={reduce ? undefined : { scale: [1.15, 1.05, 1.15] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      >
        {photos.map((src, i) => (
          <div key={i} className={`bg-cover bg-center ${photos.length === 1 ? "col-span-2" : ""}`} style={{ backgroundImage: `url(${src})` }} />
        ))}
      </motion.div>
      {/* Blur and a dark wash so white text holds 4.5:1 over any photo. */}
      <div aria-hidden="true" className="absolute inset-0 bg-bg/70 backdrop-blur-xl" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bg to-transparent" />

      <div className="relative flex flex-col gap-4 px-4 pb-4 pt-3">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full bg-black/40 pl-1.5 pr-3 text-sm font-semibold backdrop-blur hover:bg-black/60"
          >
            <ChevronLeft aria-hidden="true" size={18} />
            Home
          </Link>
          <button
            type="button"
            onClick={onMenu}
            aria-label="Workout options"
            aria-haspopup="dialog"
            className="-mr-2 flex size-11 items-center justify-center rounded-full bg-black/40 backdrop-blur hover:bg-black/60"
          >
            <MoreHorizontal aria-hidden="true" size={20} />
          </button>
        </div>
        <Rise order={0}>
          <ul aria-hidden="true" className="flex gap-1.5">
            {defs.slice(0, 5).map((d, i) => (
              <li key={`${d.id}-${i}`}>
                <ExerciseThumb exercise={d} size={52} />
              </li>
            ))}
          </ul>
          <p className="num mt-3 text-xs uppercase tracking-wider text-text-muted">
            {date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} ·{" "}
            {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-tight tracking-tight">{session.name}</h1>
        </Rise>
      </div>
    </header>
  );
}

function Stat({
  icon,
  label,
  value,
  format,
  pr = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  format: (n: number) => string;
  pr?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
      <span aria-hidden="true" className={`hidden size-9 shrink-0 items-center justify-center rounded-lg min-[360px]:flex ${pr ? "bg-pr/10 text-pr" : "bg-surface-2 text-text-muted"}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="label-caps">{label}</dt>
        <dd className={`num truncate text-base font-bold tabular-nums min-[360px]:text-lg ${pr ? "text-pr" : ""}`}>
          <CountFromZero value={value} format={format} />
        </dd>
      </div>
    </div>
  );
}

/**
 * One exercise: photo, name and gear, its share of the workout's volume as a bar, and its sets.
 * Each set has a bar for its load against the heaviest set of the exercise; records are Cyan and
 * the best set by estimated 1RM is marked. Tap the header to fold the sets away.
 */
function ExerciseCard({
  ex,
  def,
  total,
  unit,
  prSetIds,
}: {
  ex: SessionExercise;
  def: Exercise | undefined;
  total: number;
  unit: WeightUnit;
  prSetIds: Set<string>;
}) {
  const [open, setOpen] = useState(true);
  const controls = useEntrance();
  const nums = setNumbers(ex.sets);
  const volume = ex.sets.filter(isWorkingSet).reduce((n, s) => n + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
  const share = total > 0 ? Math.min(1, volume / total) : 0;
  const maxKg = Math.max(...ex.sets.map((s) => s.weightKg ?? 0), 0);
  const best = ex.sets
    .filter((s) => isWorkingSet(s) && (s.weightKg ?? 0) > 0)
    .reduce<{ id: string; e: number } | null>((b, s) => {
      const e = estimate1RM(s.weightKg!, s.reps!);
      return !b || e > b.e ? { id: s.id, e } : b;
    }, null);
  const panelId = `sets-${ex.id}`;

  return (
    <section aria-labelledby={`ex-${ex.id}`} className="panel overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        {def ? <ExerciseThumb exercise={def} size={48} /> : <span className="size-12 rounded-xl bg-surface-2" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <h2 id={`ex-${ex.id}`} className="truncate text-base font-semibold">
            {def ? (
              <Link href={exercisePath(def.id)} className="text-text underline-offset-4 hover:underline">
                {def.name}
              </Link>
            ) : (
              "Removed exercise"
            )}
          </h2>
          {def && (
            <p className="flex items-center gap-1.5 text-xs text-text-muted">
              <EquipmentIcon equipment={def.equipment} size={14} />
              {EQUIPMENT_LABELS[def.equipment]} · <span className="num">{ex.sets.filter((s) => s.completed).length}</span> sets
            </p>
          )}
          {share > 0 && (
            <div className="mt-1.5 flex items-center gap-2" title="Share of this workout's volume">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
                <motion.span
                  className="block h-full origin-left rounded-full bg-accent"
                  style={{ scaleX: 0 }}
                  animate={controls}
                  variants={{ still: { scaleX: share }, show: { scaleX: share, transition: { duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
                />
              </span>
              <span className="num text-[10px] text-text-muted">
                {Math.round(share * 100)}%<span className="sr-only"> of the workout&apos;s volume</span>
              </span>
            </div>
          )}
        </div>
        <motion.button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${open ? "Hide" : "Show"} sets of ${def?.name ?? "exercise"}`}
          whileTap={{ scale: 0.9 }}
          transition={PRESS_SPRING}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-white/[0.06] hover:text-text"
        >
          <motion.span animate={{ rotate: open ? 0 : -90 }} transition={SPRING}>
            <ChevronDown aria-hidden="true" size={20} />
          </motion.span>
        </motion.button>
      </div>
      {ex.notes && <p className="-mt-1 px-3 pb-2 text-xs text-text-muted">{ex.notes}</p>}

      <AnimatePresence initial={false}>
        {open && (
          <motion.ol
            id={panelId}
            key="sets"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-1 overflow-hidden border-t border-line px-3 py-2"
          >
            {ex.sets.map((s, i) => {
              const num = nums[i] ?? null;
              const isPr = prSetIds.has(s.id);
              const isBest = best?.id === s.id;
              const fill = maxKg > 0 && s.weightKg ? s.weightKg / maxKg : 0;
              return (
                <li key={s.id} className={`flex min-h-10 items-center gap-3 rounded-lg px-1 text-sm ${s.completed ? "" : "opacity-45"}`}>
                  <SetTypeChip type={s.type} number={num} />
                  <span className="num w-28 shrink-0">
                    {def?.isBodyweight || s.weightKg === null ? `${s.reps} reps` : `${formatWeight(s.weightKg, unit)} × ${s.reps}`}
                  </span>
                  <span aria-hidden="true" className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-800/80">
                    <motion.span
                      className={`block h-full origin-left rounded-full ${isPr ? "bg-pr" : "bg-accent/60"}`}
                      style={{ scaleX: 0 }}
                      animate={controls}
                      variants={{
                        still: { scaleX: fill },
                        show: { scaleX: fill, transition: { duration: 0.6, delay: 0.5 + i * 0.05, ease: [0.22, 1, 0.36, 1] } },
                      }}
                    />
                  </span>
                  {s.rpe !== null && (
                    <span className="shrink-0 text-xs text-text-muted">
                      RPE <span className="num">{s.rpe}</span>
                    </span>
                  )}
                  {isPr ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-pr">
                      <Trophy aria-hidden="true" size={12} /> PR
                    </span>
                  ) : isBest ? (
                    <span className="label-caps shrink-0 !text-text">Best</span>
                  ) : null}
                </li>
              );
            })}
          </motion.ol>
        )}
      </AnimatePresence>
    </section>
  );
}
