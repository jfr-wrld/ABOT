"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotionConfig } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Dumbbell, FileDown, Flame, House, Layers, ListOrdered, Pencil, Sparkles, Timer, Trophy } from "lucide-react";
import { RenameWorkoutSheet, SaveAsRoutineButton } from "@/components/workout/SessionActions";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { ShareStoryButton } from "@/components/share/ShareStoryButton";
import { WorkoutPhotos, useWorkoutPhotos } from "@/components/workout/WorkoutPhotos";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { MuscleMap } from "@/components/anatomy/MuscleMap";
import { CountFromZero, Rise, useEntrance } from "@/components/motion/Entrance";
import { countSets, formatDuration, sessionDurationSec, sessionVolume } from "@/lib/calc";
import { formatVolume, formatWeight } from "@/lib/units";
import { PR_KIND_LABEL } from "@/lib/story-data";
import { previousComparable, sessionRecords, workedMuscles } from "@/lib/session-insights";
import { MUSCLE_GROUP_LABELS, type Exercise, type PersonalRecord, type WeightUnit } from "@/types/workout";
import { historyPath } from "@/lib/routes";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";
import { estimateCalories } from "@/lib/calorie-estimator";
import { HealthSyncService } from "@/lib/health-sync";
import { useHealthSyncStore } from "@/store/useHealthSyncStore";
import type { WorkoutSession } from "@/types/workout";
import { muscleText } from "@/lib/home";
import { StreakMoment } from "@/components/streak/StreakMoment";
import { streakAlreadyShown, streakMoment } from "@/lib/streak-moment";
import { returnAfter } from "@/lib/comeback";

export default function WorkoutSummaryPage() {
  return (
    <HydrationGate>
      <Summary />
    </HydrationGate>
  );
}

/**
 * Shown right after Finish: a moment of completion first (the plate closes, a check, a burst of
 * small plates, Cyan when a record fell), then what the workout added up to, how it compares with
 * the last time, the records and first lifts, the muscles worked, and the way to share it.
 */
function Summary() {
  const t = useT();
  const id = useSearchParams().get("id") ?? "";
  const sessions = useWorkoutStore((s) => s.sessions);
  const { weightUnit, firstDayOfWeek } = useSettingsStore();
  const { byId } = useAllExercises();
  const session = sessions.find((s) => s.id === id);

  const insights = useMemo(() => {
    if (!session) return null;
    const { records, newLifts } = sessionRecords(session, sessions, byId);
    const byLift: Record<string, PersonalRecord[]> = {};
    for (const pr of records) (byLift[pr.exerciseId] ??= []).push(pr);
    return {
      byLift,
      newLifts,
      muscles: workedMuscles(session, byId),
      previous: previousComparable(session, sessions),
    };
  }, [session, sessions, byId]);

  const recordLifts = insights ? Object.keys(insights.byLift).length : 0;
  const photos = useWorkoutPhotos(session?.id);

  // A workout that grew the week streak opens on the streak screen; the summary follows it.
  const [streak, setStreak] = useState(() =>
    streakAlreadyShown(id) ? null : streakMoment(sessions, id, Date.now(), firstDayOfWeek),
  );
  const closeStreak = useCallback(() => setStreak(null), []);
  const [renameOpen, setRenameOpen] = useState(false);

  // The finish chord and a buzz, behind Sounds & vibration, once the summary itself is in view.
  // Finish was just tapped, so audio is unlocked.
  const chimed = useRef(false);
  useEffect(() => {
    if (!session || streak || chimed.current) return;
    chimed.current = true;
    feedback.finish(recordLifts > 0);
    // Once per opening of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streak]);

  if (!session || !insights) {
    return (
      <main>
        <PageHeader title={t("Workout not found")} back={{ href: "/", label: t("Home") }} />
        <p className="px-4 pt-4 text-sm text-text-muted">{t("This workout is not on this device. It may have been deleted.")}</p>
      </main>
    );
  }

  if (streak) return <StreakMoment moment={streak} sessionId={id} onClose={closeStreak} />;

  const volume = sessionVolume(session, byId);
  const sets = countSets(session).completed;
  const prev = insights.previous;
  const prevVolume = prev ? sessionVolume(prev, byId) : 0;
  const backAfter = returnAfter(sessions, session);

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-col items-center px-4 pt-5 text-center">
        <Celebration record={recordLifts > 0} />
        <Rise order={6}>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{t("Workout saved")}</h1>
          <p className="mt-1 flex items-center justify-center gap-1 text-sm text-text-muted">
            <span>
              {session.name} ·{" "}
              {new Date(session.startedAt).toLocaleDateString(t.locale, { weekday: "long", day: "numeric", month: "long" })}
            </span>
            <button
              type="button"
              onClick={() => setRenameOpen(true)}
              aria-label={t("Rename workout")}
              className="-my-2 flex size-11 items-center justify-center rounded-ctl hover:bg-surface-2 hover:text-text"
            >
              <Pencil aria-hidden="true" size={15} />
            </button>
          </p>
          {backAfter !== null && (
            // The first workout after a break is the one that counts most: said once, plainly.
            <p className="mt-2 text-sm font-semibold text-accent">
              {t("First workout in {n} days. The hardest one is done.", { n: backAfter })}
            </p>
          )}
        </Rise>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-5">
        <Rise order={7}>
          <dl className="grid grid-cols-2 gap-2">
            <Tile icon={<Timer size={16} />} label={t("Duration")} value={sessionDurationSec(session)} format={(n) => formatDuration(Math.round(n))} />
            <Tile icon={<Dumbbell size={16} />} label={t("Volume")} value={volume} format={(n) => formatVolume(n, weightUnit)} />
            <Tile icon={<Layers size={16} />} label={t("Sets")} value={sets} format={(n) => String(Math.round(n))} />
            <Tile
              icon={<ListOrdered size={16} />}
              label={t("Exercises")}
              value={session.exercises.length}
              format={(n) => String(Math.round(n))}
            />
          </dl>
        </Rise>

        <Rise order={8}>
          <Calories session={session} byId={byId} unit={weightUnit} />
        </Rise>

        {prev && prevVolume > 0 && (
          <Rise order={8}>
            <Compare now={volume} before={prevVolume} unit={weightUnit} name={session.name} />
          </Rise>
        )}

        {recordLifts > 0 && (
          <Rise order={9}>
            <section aria-labelledby="summary-prs" className="flex flex-col gap-2">
              <h2 id="summary-prs" className="flex items-center gap-2 text-sm font-semibold text-pr">
                <Trophy aria-hidden="true" size={16} />
                {t.n(recordLifts, "{n} personal record", "{n} personal records")}
              </h2>
              <ul className="flex flex-col gap-2">
                {Object.entries(insights.byLift).map(([exerciseId, records], i) => (
                  <RecordCard key={exerciseId} exercise={byId[exerciseId]} records={records} unit={weightUnit} order={i} />
                ))}
              </ul>
            </section>
          </Rise>
        )}

        {insights.newLifts.length > 0 && (
          <Rise order={10}>
            <section aria-labelledby="summary-new" className="panel p-3">
              <h2 id="summary-new" className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles aria-hidden="true" size={16} className="text-accent" />
                {t.n(insights.newLifts.length, "{n} new lift", "{n} new lifts")}
              </h2>
              <p className="mt-0.5 text-xs text-text-muted">{t("Your baseline. Beat it next time for a record.")}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {insights.newLifts.map((exId) =>
                  byId[exId] ? (
                    <li key={exId} className="flex items-center gap-2 rounded-xl bg-surface-2 py-1 pl-1 pr-3">
                      <ExerciseThumb exercise={byId[exId]} size={32} />
                      <span className="text-xs font-semibold">{byId[exId].name}</span>
                    </li>
                  ) : null,
                )}
              </ul>
            </section>
          </Rise>
        )}

        {insights.muscles.primary.length > 0 && (
          <Rise order={11}>
            <section aria-labelledby="summary-muscles" className="panel flex items-center gap-3 p-3">
              <div className="w-32 shrink-0 [&_figcaption]:hidden">
                <MuscleMap primary={insights.muscles.primary} secondary={insights.muscles.secondary} width={128} />
              </div>
              <div className="min-w-0">
                <h2 id="summary-muscles" className="label-caps">
                  {t("Muscles worked")}
                </h2>
                <ul className="mt-2 flex flex-wrap gap-1">
                  {insights.muscles.primary.slice(0, 5).map((m) => (
                    <li key={m} className="rounded-full border border-accent/40 bg-accent-tint px-2 py-0.5 text-xs font-semibold">
                      {muscleText(MUSCLE_GROUP_LABELS[m], t)}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </Rise>
        )}

        <Rise order={12}>
          <WorkoutPhotos state={photos} sessionName={session.name} />
        </Rise>
      </div>

      {/* Room for the action bar, so the last block scrolls clear of it. */}
      <div className="h-56" aria-hidden="true" />
      <RenameWorkoutSheet session={session} open={renameOpen} onClose={() => setRenameOpen(false)} />

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-[640px] flex-col gap-2 border-t border-line bg-bg/85 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <ShareStoryButton session={session} photos={photos.photos} variant="primary" className="min-h-12 w-full text-base" />
        <SaveAsRoutineButton session={session} className="w-full" />
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={historyPath(session.id)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-ink/[0.12] bg-surface-2 px-3 text-sm font-semibold text-text hover:border-ink/25"
          >
            <ListOrdered aria-hidden="true" size={16} />
            {t("See every set")}
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-text-muted hover:bg-ink/[0.05] hover:text-text"
          >
            <House aria-hidden="true" size={16} />
            {t("Back to Home")}
          </Link>
        </div>
      </div>
    </main>
  );
}

const HEX = "M27 8 L73 8 L96 50 L73 92 L27 92 L4 50 Z";

/**
 * The completion mark: the plate outline is traced shut, it fills faintly, a check is drawn, and a
 * ring of small plates bursts outward (Cyan when a record fell, Volt otherwise). About 1.4 s.
 */
function Celebration({ record }: { record: boolean }) {
  const controls = useEntrance();
  const reduce = useReducedMotionConfig();
  const color = record ? "var(--color-pr)" : "var(--color-accent)";
  const shards = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    const d = 70 + (i % 3) * 14;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, size: 7 + (i % 3) * 3, rot: (i % 2 ? 1 : -1) * (90 + i * 20) };
  });
  return (
    <div aria-hidden="true" className="relative flex size-36 items-center justify-center">
      {!reduce &&
        shards.map((p, i) => (
          <motion.svg
            key={i}
            viewBox="0 0 100 100"
            width={p.size}
            height={p.size}
            className="absolute"
            style={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
            animate={controls}
            variants={{
              still: { opacity: 0 },
              show: {
                opacity: [0, 1, 1, 0],
                x: [0, p.x * 0.6, p.x],
                y: [0, p.y * 0.6, p.y + 18],
                scale: [0.4, 1, 0.8],
                rotate: [0, p.rot],
                transition: { delay: 0.95 + (i % 4) * 0.03, duration: 1.1, ease: "easeOut" },
              },
            }}
          >
            <path d={HEX} fill={i % 3 === 0 ? "var(--color-text)" : color} />
          </motion.svg>
        ))}
      <svg viewBox="0 0 100 100" className="size-28 overflow-visible">
        <motion.path
          d={HEX}
          fill={color}
          style={{ fillOpacity: 0 }}
          animate={controls}
          variants={{ still: { fillOpacity: 0.12 }, show: { fillOpacity: 0.12, transition: { delay: 0.7, duration: 0.4 } } }}
        />
        <motion.path
          d={HEX}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinejoin="round"
          style={{ pathLength: 0 }}
          animate={controls}
          variants={{
            still: { pathLength: 1 },
            show: { pathLength: 1, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] } },
          }}
        />
        <motion.path
          d="M31 52 L44 65 L70 37"
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pathLength: 0 }}
          animate={controls}
          variants={{
            still: { pathLength: 1 },
            show: { pathLength: 1, transition: { delay: 0.7, duration: 0.35, ease: "easeOut" } },
          }}
        />
      </svg>
    </div>
  );
}

/**
 * The estimated calories (MET method, see lib/calorie-estimator), whether the workout reached
 * Health Connect, and the .tcx file for Strava, Garmin or Huawei Health.
 */
function Calories({ session, byId, unit }: { session: WorkoutSession; byId: Record<string, Exercise>; unit: WeightUnit }) {
  const t = useT();
  const bodyweightKg = useSettingsStore((s) => s.bodyweightKg);
  const sync = useHealthSyncStore((s) => s.bySession[session.id]);
  const send = useHealthSyncStore((s) => s.send);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const est = estimateCalories(session, { bodyweightKg, byId });

  async function shareTcx() {
    setFileNote(null);
    try {
      const r = await HealthSyncService.shareWorkoutTCX(session, { byId, unit });
      if (r === "saved") setFileNote(t("Saved the .tcx file to Downloads."));
    } catch (e) {
      setFileNote(t("Could not share the file: {error}", { error: e instanceof Error ? e.message : String(e) }));
    }
  }

  return (
    <section aria-labelledby="summary-kcal" className="panel flex flex-col gap-2 p-3">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-muted">
          <Flame size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="summary-kcal" className="label-caps">
            {t("Calories (estimate)")}
          </h2>
          <p className="num text-lg font-bold tabular-nums">{est.kcal} kcal</p>
        </div>
      </div>
      <p className="text-xs text-text-muted tabular-nums">
        {est.bodyweightKnown ? (
          t("MET {met} for {kg} kg body weight and {min} minutes.", { met: est.met, kg: est.bodyweightKg, min: Math.round(est.minutes) })
        ) : (
          <>
            {t("Worked out for {kg} kg. Set your body weight for a closer figure.", { kg: est.bodyweightKg })}{" "}
            <Link href="/settings?section=health" className="font-semibold text-text underline underline-offset-4">
              {t("Set body weight")}
            </Link>
          </>
        )}
      </p>
      {sync && (
        <p role="status" className={`text-xs ${sync.state === "failed" ? "text-failure" : "text-text-muted"}`}>
          {sync.state === "sending"
            ? t("Sending to Health Connect...")
            : sync.state === "sent"
              ? t("Sent to Health Connect.")
              : t("Not sent to Health Connect: {error}", { error: t(sync.reason) })}
          {sync.state === "failed" && (
            <button type="button" onClick={() => send(session, byId)} className="ml-2 min-h-11 font-semibold text-text underline underline-offset-4">
              {t("Try again")}
            </button>
          )}
        </p>
      )}
      <button
        type="button"
        onClick={shareTcx}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-ink/[0.12] bg-surface-2 px-3 text-sm font-semibold text-text hover:border-ink/25"
      >
        <FileDown aria-hidden="true" size={16} />
        {t("Share as .tcx (Strava, Garmin, Huawei)")}
      </button>
      {fileNote && (
        <p role="status" className="text-xs text-text-muted">
          {fileNote}
        </p>
      )}
    </section>
  );
}

function Tile({ icon, label, value, format }: { icon: React.ReactNode; label: string; value: number; format: (n: number) => string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
      <span aria-hidden="true" className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-muted min-[360px]:flex">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="label-caps">{label}</dt>
        <dd className="num truncate text-base font-bold tabular-nums min-[360px]:text-lg">
          <CountFromZero value={value} format={format} delay={0.9} />
        </dd>
      </div>
    </div>
  );
}

/** This workout's volume against the last one from the same routine, as two bars and the change. */
function Compare({ now, before, unit, name }: { now: number; before: number; unit: WeightUnit; name: string }) {
  const t = useT();
  const controls = useEntrance();
  const max = Math.max(now, before);
  const change = Math.round(((now - before) / before) * 100);
  const up = change >= 0;
  const rows = [
    { label: t("Last time"), value: before, cls: "bg-zinc-600" },
    { label: t("Today"), value: now, cls: "bg-accent" },
  ];
  return (
    <section aria-labelledby="summary-compare" className="panel p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="summary-compare" className="label-caps truncate">
          {t("Volume vs last {name}", { name })}
        </h2>
        <span
          className={`num inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${
            up ? "bg-accent text-on-accent" : "bg-surface-2 text-text-muted"
          }`}
        >
          {up ? <ArrowUpRight aria-hidden="true" size={13} /> : <ArrowDownRight aria-hidden="true" size={13} />}
          {up ? "+" : ""}
          {change}%
        </span>
      </div>
      <dl className="mt-3 flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={r.label} className="grid grid-cols-[72px_1fr_auto] items-center gap-2">
            <dt className="text-xs text-text-muted">{r.label}</dt>
            <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <motion.span
                className={`block h-full origin-left rounded-full ${r.cls}`}
                style={{ scaleX: 0 }}
                animate={controls}
                variants={{
                  still: { scaleX: r.value / max },
                  show: { scaleX: r.value / max, transition: { delay: 1.1 + i * 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
                }}
              />
            </span>
            <dd className="num text-xs font-semibold tabular-nums">{formatVolume(r.value, unit)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const SHORT: Record<PersonalRecord["kind"], string> = { heaviest_weight: "Weight", best_1rm: "e1RM", best_set_volume: "Volume" };

/** One chip per set: a set that broke several kinds of record at once is shown once. */
function bySet(records: PersonalRecord[]): { pr: PersonalRecord; kinds: PersonalRecord["kind"][] }[] {
  const out = new Map<string, { pr: PersonalRecord; kinds: PersonalRecord["kind"][] }>();
  for (const pr of records) {
    const row = out.get(pr.setId) ?? { pr, kinds: [] };
    row.kinds.push(pr.kind);
    out.set(pr.setId, row);
  }
  return [...out.values()];
}

/** One lift's records: photo, name, and a chip per record-setting set with the kinds it broke. */
function RecordCard({
  exercise,
  records,
  unit,
  order,
}: {
  exercise: Exercise | undefined;
  records: PersonalRecord[];
  unit: WeightUnit;
  order: number;
}) {
  const t = useT();
  const controls = useEntrance();
  return (
    <motion.li
      className="flex items-center gap-3 rounded-xl border border-pr/30 bg-pr/[0.05] p-2.5"
      style={{ opacity: 0, scale: 0.94 }}
      animate={controls}
      variants={{
        still: { opacity: 1, scale: 1 },
        show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 340, damping: 20, delay: 1.2 + order * 0.1 } },
      }}
    >
      {exercise ? <ExerciseThumb exercise={exercise} size={44} /> : <span className="size-11 rounded-xl bg-surface-2" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{exercise?.name ?? t("Removed exercise")}</p>
        <ul className="mt-1 flex flex-wrap gap-1">
          {bySet(records).map(({ pr, kinds }) => (
            <li key={pr.setId} className="num flex items-baseline gap-1.5 rounded-md bg-row px-1.5 py-0.5 text-[11px] text-pr">
              <span className="font-bold">
                {formatWeight(pr.weightKg, unit)} × {pr.reps}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-pr">{kinds.map((k) => t(SHORT[k])).join(" · ")}</span>
              <span className="sr-only">{kinds.map((k) => t(PR_KIND_LABEL[k])).join(", ")}</span>
            </li>
          ))}
        </ul>
      </div>
      <Trophy aria-hidden="true" size={20} className="shrink-0 text-pr" />
    </motion.li>
  );
}
