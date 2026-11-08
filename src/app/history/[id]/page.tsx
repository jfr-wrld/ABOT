"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { SetTypeChip } from "@/components/workout/SetTypeChip";
import { countSets, detectSessionPRs, formatDuration, sessionDurationSec, sessionVolume } from "@/lib/calc";
import { formatVolume, formatWeight } from "@/lib/units";

export default function SessionPage() {
  return (
    <HydrationGate>
      <SessionDetail />
    </HydrationGate>
  );
}

function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sessions = useWorkoutStore((s) => s.sessions);
  const deleteSession = useWorkoutStore((s) => s.deleteSession);
  const { weightUnit } = useSettingsStore();
  const { byId } = useAllExercises();
  const [confirm, setConfirm] = useState(false);

  const session = sessions.find((s) => s.id === id);
  const prs = useMemo(() => (session ? detectSessionPRs(session, sessions) : []), [session, sessions]);
  const prSetIds = new Set(prs.map((p) => p.setId));

  if (!session) {
    return (
      <main>
        <PageHeader title="Workout not found" back={{ href: "/", label: "Home" }} />
        <p className="px-4 pt-4 text-sm text-text-muted">This workout is not on this device. It may have been deleted.</p>
      </main>
    );
  }

  const date = new Date(session.startedAt);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        title={session.name}
        back={{ href: "/", label: "Home" }}
        subtitle={date.toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
      />

      <dl className="mx-4 mt-4 grid grid-cols-3 gap-2">
        <Stat label="Duration" value={formatDuration(sessionDurationSec(session))} />
        <Stat label="Volume" value={formatVolume(sessionVolume(session), weightUnit)} />
        <Stat label="Sets" value={String(countSets(session).completed)} />
      </dl>

      {prs.length > 0 && (
        <p className="mx-4 mt-3 flex items-center gap-2 text-sm text-accent">
          <Trophy aria-hidden="true" size={16} />
          {prs.length} personal {prs.length === 1 ? "record" : "records"} in this workout
        </p>
      )}

      <div className="flex flex-col gap-3 px-4 pt-4">
        {session.exercises.map((ex) => {
          const def = byId[ex.exerciseId];
          let n = 0;
          return (
            <section key={ex.id} className="rounded-card bg-surface p-3">
              <h2 className="text-base font-semibold">
                {def ? (
                  <Link href={`/exercises/${def.id}`} className="text-accent hover:underline">
                    {def.name}
                  </Link>
                ) : (
                  "Removed exercise"
                )}
              </h2>
              {ex.notes && <p className="mt-1 text-xs text-text-muted">{ex.notes}</p>}
              <ol className="mt-2 flex flex-col gap-1">
                {ex.sets.map((s) => {
                  const num = s.type === "warmup" ? null : ++n;
                  return (
                    <li key={s.id} className="flex items-center gap-3 text-sm">
                      <SetTypeChip type={s.type} number={num} />
                      <span className="tabular-nums">
                        {def?.isBodyweight || s.weightKg === null
                          ? `${s.reps} reps`
                          : `${formatWeight(s.weightKg, weightUnit)} × ${s.reps}`}
                      </span>
                      {s.rpe !== null && <span className="text-xs text-text-muted">RPE {s.rpe}</span>}
                      {prSetIds.has(s.id) && (
                        <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-accent">
                          <Trophy aria-hidden="true" size={12} /> PR
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}

        <Button variant="danger" onClick={() => setConfirm(true)} className="mt-4">
          Delete this workout
        </Button>
      </div>

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-ctl bg-surface px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase text-text-muted">{label}</dt>
      <dd className="text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}
