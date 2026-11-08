"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { HydrationGate } from "@/components/ui/Loading";
import { Button } from "@/components/ui/Button";
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
  const startEmpty = useWorkoutStore((s) => s.startEmpty);
  const { weightUnit, defaultRestSeconds } = useSettingsStore();
  const now = useNow(1000, active !== null);

  const recent = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 10);

  return (
    <main className="flex flex-1 flex-col px-4 pt-4">
      <h1 className="text-xl font-bold">Heavy</h1>

      {active ? (
        <Link
          href="/workout"
          className="mt-4 block rounded-card border border-accent bg-accent-tint p-4 hover:bg-accent/25"
        >
          <span className="text-[11px] font-semibold uppercase text-accent">Workout in progress</span>
          <span className="mt-1 block text-lg font-bold">{active.name}</span>
          <span className="block text-sm text-text-muted">
            {formatDuration(sessionDurationSec(active, now))} · {countSets(active).completed} sets done. Tap to
            continue.
          </span>
        </Link>
      ) : (
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
      )}

      <section className="mt-8" aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="text-sm font-semibold uppercase text-text-muted">
          Recent workouts
        </h2>
        {recent.length === 0 ? (
          <p className="mt-3 rounded-card bg-surface px-4 py-6 text-center text-sm text-text-muted">
            Nothing logged yet. Finish a workout and it will show up here with its volume and duration.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {recent.map((s) => {
              const { completed } = countSets(s);
              return (
                <li key={s.id} className="rounded-card bg-surface p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-base font-semibold">{s.name}</span>
                    <time dateTime={new Date(s.startedAt).toISOString()} className="shrink-0 text-xs text-text-muted">
                      {new Date(s.startedAt).toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </time>
                  </div>
                  <p className="mt-1 text-sm text-text-muted">
                    {formatDuration(sessionDurationSec(s))} · {formatVolume(sessionVolume(s), weightUnit)} ·{" "}
                    {completed} {completed === 1 ? "set" : "sets"} · {s.exercises.length} {s.exercises.length === 1 ? "exercise" : "exercises"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
