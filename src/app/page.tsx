"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasSeenOnboarding } from "@/lib/onboarding";
import { ChevronRight, Settings } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { HydrationGate } from "@/components/ui/Loading";
import { Button } from "@/components/ui/Button";
import { AbotWordmark } from "@/components/brand/AbotMark";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { useNow } from "@/lib/useNow";
import { countSets, formatDuration, sessionDurationSec, sessionVolume } from "@/lib/calc";
import { formatVolume } from "@/lib/units";

export default function HomePage() {
  return (
    <HydrationGate>
      <HomeScreen />
    </HydrationGate>
  );
}

function HomeScreen() {
  const router = useRouter();
  const active = useWorkoutStore((s) => s.active);
  const sessions = useWorkoutStore((s) => s.sessions);
  const { startEmpty, startFromRoutine } = useWorkoutStore();
  const routines = useRoutineStore((s) => s.routines);
  const { weightUnit, defaultRestSeconds, profileName, profilePhoto } = useSettingsStore();
  const now = useNow(1000, active !== null);
  const { byId } = useAllExercises();
  // First open on a device with nothing logged: show the intro once. Anyone with data skips it.
  const [needsIntro] = useState(() => sessions.length === 0 && routines.length === 0 && active === null && !hasSeenOnboarding());
  useEffect(() => {
    if (needsIntro) router.replace("/onboarding");
  }, [needsIntro, router]);

  if (needsIntro) return null;

  const recent = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 10);
  const startable = routines.filter((r) => r.exercises.length > 0).slice(0, 4);

  return (
    <main className="flex flex-1 flex-col px-4 pt-4">
      <div className="flex items-center justify-between">
        <h1>
          <AbotWordmark />
        </h1>
        <div className="-mr-2 flex items-center">
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface hover:text-text"
          >
            <Settings aria-hidden="true" size={22} />
          </Link>
          <Link
            href="/profile"
            aria-label="Profile"
            className="flex size-11 items-center justify-center rounded-ctl transition-opacity hover:opacity-80"
          >
            <span aria-hidden="true">
              <ProfileAvatar name={profileName} photo={profilePhoto} size={32} />
            </span>
          </Link>
        </div>
      </div>

      {active ? (
        <Link
          href="/workout"
          className="mt-4 block rounded-card border border-accent/40 bg-accent-tint p-4 transition-colors hover:border-accent/70"
        >
          <span className="label-caps !text-accent">Workout in progress</span>
          <span className="mt-1 block text-lg font-bold tracking-tight">{active.name}</span>
          <span className="block text-sm text-text-muted">
            <span className="num">{formatDuration(sessionDurationSec(active, now))}</span> ·{" "}
            <span className="num">{countSets(active).completed}</span> sets done. Tap to continue.
          </span>
        </Link>
      ) : (
        <>
          <Button
            variant="primary"
            onClick={() => {
              startEmpty(defaultRestSeconds);
              router.push("/workout");
            }}
            className="mt-4 w-full"
          >
            Start an empty workout
          </Button>
          {startable.length > 0 && (
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {startable.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      startFromRoutine(r);
                      router.push("/workout");
                    }}
                    className="panel flex min-h-14 w-full flex-col items-start justify-center px-3 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="w-full truncate text-sm font-semibold">{r.name}</span>
                    <span className="text-xs text-text-muted">
                      {r.exercises.length} {r.exercises.length === 1 ? "exercise" : "exercises"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <section className="mt-8" aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="text-sm font-semibold uppercase text-text-muted">
          Recent workouts
        </h2>
        {recent.length === 0 ? (
          <p className="mt-3 panel px-4 py-6 text-center text-sm text-text-muted">
            Nothing logged yet. Finish a workout and it will show up here with its volume and duration.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {recent.map((s) => {
              const { completed } = countSets(s);
              return (
                <li key={s.id}>
                  <Link href={`/history/${s.id}`} className="panel block p-4 transition-colors hover:bg-surface-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-base font-semibold">{s.name}</span>
                      <time dateTime={new Date(s.startedAt).toISOString()} className="num shrink-0 text-xs text-text-muted">
                        {new Date(s.startedAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                      </time>
                    </div>
                    {/* The stats line is all figures, so it is set in mono as one unit. */}
                    <p className="num mt-1 flex items-center justify-between text-[13px] text-text-muted">
                      <span>
                        {formatDuration(sessionDurationSec(s))} · {formatVolume(sessionVolume(s, byId), weightUnit)} · {completed}{" "}
                        {completed === 1 ? "set" : "sets"} · {s.exercises.length} {s.exercises.length === 1 ? "exercise" : "exercises"}
                      </span>
                      <ChevronRight aria-hidden="true" size={16} />
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
