"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Trophy } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { ShareStoryButton } from "@/components/share/ShareStoryButton";
import { countSets, detectSessionPRs, formatDuration, sessionDurationSec, sessionVolume } from "@/lib/calc";
import { formatVolume, formatWeight } from "@/lib/units";
import { PR_KIND_LABEL } from "@/lib/story-data";
import type { PersonalRecord } from "@/types/workout";

export default function WorkoutSummaryPage() {
  return (
    <HydrationGate>
      <Summary />
    </HydrationGate>
  );
}

/** Shown right after Finish: what the workout added up to, and the way to share it. */
function Summary() {
  const { id } = useParams<{ id: string }>();
  const sessions = useWorkoutStore((s) => s.sessions);
  const { weightUnit } = useSettingsStore();
  const { byId } = useAllExercises();
  const session = sessions.find((s) => s.id === id);
  const prs = useMemo(() => (session ? detectSessionPRs(session, sessions, byId) : []), [session, sessions, byId]);
  // A lift can break weight, 1RM and set volume at once: one row per lift.
  const prsByLift = useMemo(() => {
    const out: Record<string, PersonalRecord[]> = {};
    for (const pr of prs) (out[pr.exerciseId] ??= []).push(pr);
    return out;
  }, [prs]);

  if (!session) {
    return (
      <main>
        <PageHeader title="Workout not found" back={{ href: "/", label: "Home" }} />
        <p className="px-4 pt-4 text-sm text-text-muted">This workout is not on this device. It may have been deleted.</p>
      </main>
    );
  }

  const exercises = session.exercises.length;

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        title="Workout saved"
        subtitle={`${session.name}, ${new Date(session.startedAt).toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}`}
      />

      <dl className="mx-4 mt-4 grid grid-cols-3 gap-2">
        <Stat label="Duration" value={formatDuration(sessionDurationSec(session))} />
        <Stat label="Volume" value={formatVolume(sessionVolume(session, byId), weightUnit)} />
        <Stat label="Sets" value={String(countSets(session).completed)} />
      </dl>
      <p className="mx-4 mt-2 text-sm text-text-muted">
        <span className="num">{exercises}</span> {exercises === 1 ? "exercise" : "exercises"} logged.
      </p>

      {prs.length > 0 && (
        <section aria-labelledby="summary-prs" className="mx-4 mt-4">
          <h2 id="summary-prs" className="flex items-center gap-2 text-sm font-semibold text-pr">
            <Trophy aria-hidden="true" size={16} />
            {prs.length} personal {prs.length === 1 ? "record" : "records"}
          </h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {Object.entries(prsByLift).map(([exerciseId, records]) => (
              <li key={exerciseId} className="panel px-3 py-2 text-sm">
                <span className="font-semibold">{byId[exerciseId]?.name ?? "Removed exercise"}</span>
                {records.map((pr) => (
                  <span key={pr.kind} className="block text-xs text-text-muted">
                    {PR_KIND_LABEL[pr.kind]}:{" "}
                    <span className="num">
                      {formatWeight(pr.weightKg, weightUnit)} × {pr.reps}
                    </span>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mx-4 mt-6 flex flex-col gap-2">
        <ShareStoryButton session={session} variant="primary" className="w-full" />
        <Link
          href={`/history/${session.id}`}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/[0.12] bg-surface-2 px-4 text-sm font-semibold text-text hover:border-white/25 hover:bg-[#24242a]"
        >
          See every set
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-text-muted hover:bg-white/[0.05] hover:text-text"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-ctl bg-surface px-3 py-2">
      <dt className="label-caps">{label}</dt>
      <dd className="num text-lg font-bold">{value}</dd>
    </div>
  );
}
