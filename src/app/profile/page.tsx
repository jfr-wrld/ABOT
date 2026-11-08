"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, CloudOff, Settings, Trophy } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { NumberField } from "@/components/ui/NumberField";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { profileStats } from "@/lib/profile";
import { useNow } from "@/lib/useNow";
import { formatVolume, formatWeight, fromDisplay, toDisplay } from "@/lib/units";
import { PROFILE_LIMITS } from "@/types/workout";

export default function ProfilePage() {
  return (
    <HydrationGate>
      <ProfileScreen />
    </HydrationGate>
  );
}

function ProfileScreen() {
  const s = useSettingsStore();
  const sessions = useWorkoutStore((st) => st.sessions);
  const { byId } = useAllExercises();
  const now = useNow(60_000);
  const stats = useMemo(() => profileStats(sessions, byId, now, s.firstDayOfWeek), [sessions, byId, now, s.firstDayOfWeek]);
  const unit = s.weightUnit;
  const outside = (v: number | null, [min, max]: readonly [number, number]) => v !== null && (v < min || v > max);
  const bwOff = outside(s.bodyweightKg, PROFILE_LIMITS.bodyweightKg);
  const heightOff = outside(s.heightCm, PROFILE_LIMITS.heightCm);

  const since = stats.firstWorkoutAt
    ? `Training since ${new Date(stats.firstWorkoutAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
    : "No workouts logged yet";
  const hours = stats.trainingSec / 3600;

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Profile" back={{ href: "/", label: "Home" }} />

      <div className="flex flex-col gap-4 px-4 pb-8 pt-4">
        {/* Identity: who this device belongs to. Everything below is about them. */}
        <section className="flex items-center gap-4">
          <ProfileAvatar name={s.profileName} />
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold tracking-tight">{s.profileName.trim() || "Your profile"}</h2>
            <p className="text-sm text-text-muted">{since}</p>
          </div>
        </section>

        <section aria-labelledby="lifetime-heading" className="panel p-3">
          <h2 id="lifetime-heading" className="label-caps">
            Lifetime
          </h2>
          {stats.workouts === 0 ? (
            <p className="mt-2 text-sm text-text-muted">
              No finished workouts yet. Totals and top lifts fill in as you finish workouts.
            </p>
          ) : (
            <dl className="mt-2 grid grid-cols-2 gap-2">
              <Stat label="Workouts" value={String(stats.workouts)} />
              <Stat label="Working sets" value={String(stats.sets)} />
              <Stat label="Volume" value={formatVolume(stats.volumeKg, unit)} />
              <Stat label="Time trained" value={hours >= 1 ? `${hours.toFixed(1)} h` : `${Math.round(stats.trainingSec / 60)} min`} />
              <div className="col-span-2 flex items-baseline justify-between rounded-xl bg-bg px-3 py-2.5">
                <dt className="label-caps">Week streak</dt>
                <dd className="num text-lg font-bold text-accent">
                  {stats.weekStreak} {stats.weekStreak === 1 ? "week" : "weeks"}
                </dd>
              </div>
            </dl>
          )}
        </section>

        {stats.topLifts.length > 0 && (
          <section aria-labelledby="lifts-heading" className="panel p-3">
            <h2 id="lifts-heading" className="label-caps flex items-center gap-1.5">
              <Trophy aria-hidden="true" size={12} className="text-pr" />
              Top lifts
            </h2>
            <p className="mt-1 text-xs text-text-muted">Ranked by estimated 1RM from your best set.</p>
            <ol className="mt-2 flex flex-col gap-1">
              {stats.topLifts.map(({ exercise, record }, i) => (
                <li key={exercise.id}>
                  <Link
                    href={`/exercises/${exercise.id}`}
                    className="flex min-h-14 items-center gap-3 rounded-xl px-2 transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="num w-4 text-sm text-text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{exercise.name}</span>
                      <span className="num block text-xs text-text-muted">
                        {formatWeight(record.weightKg, unit)} × {record.reps}
                      </span>
                    </span>
                    <span className="num text-right">
                      <span className="block text-base font-bold text-pr">{formatWeight(record.value, unit)}</span>
                      <span className="label-caps block">e1RM</span>
                    </span>
                    <ChevronRight aria-hidden="true" size={16} className="text-text-muted" />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section aria-labelledby="body-heading" className="panel flex flex-col gap-3 p-3">
          <div>
            <h2 id="body-heading" className="label-caps">
              About you
            </h2>
            <p className="mt-1 text-xs text-text-muted">Optional. Saved on this device and in your backups.</p>
          </div>
          <div>
            <label htmlFor="profile-name" className="mb-1 block text-sm font-semibold">
              Name
            </label>
            <input
              id="profile-name"
              value={s.profileName}
              maxLength={PROFILE_LIMITS.nameMax}
              autoComplete="name"
              onChange={(e) => s.update({ profileName: e.target.value })}
              placeholder="What should ABOT call you?"
              className="h-11 w-full rounded-ctl border border-zinc-800 bg-well px-3 text-base text-text placeholder:text-text-muted hover:border-zinc-700 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="profile-bw" className="mb-1 block text-sm font-semibold">
                Bodyweight <span className="font-normal text-text-muted">({unit})</span>
              </label>
              <NumberField
                id="profile-bw"
                aria-label={`Bodyweight in ${unit}`}
                value={s.bodyweightKg === null ? null : Math.round(toDisplay(s.bodyweightKg, unit) * 10) / 10}
                // Stored as typed: a range check per keystroke would wipe "7" on the way to "72.5".
                onCommit={(n) => s.update({ bodyweightKg: n === null ? null : fromDisplay(n, unit) })}
                max={unit === "kg" ? PROFILE_LIMITS.bodyweightKg[1] : 882}
                placeholder="–"
                aria-invalid={bwOff || undefined}
                aria-describedby={bwOff ? "profile-bw-error" : undefined}
                className="!px-3 !text-left !text-base"
              />
              {bwOff && (
                <p id="profile-bw-error" className="mt-1 text-xs text-failure">
                  Enter {formatWeight(PROFILE_LIMITS.bodyweightKg[0], unit)} to {formatWeight(PROFILE_LIMITS.bodyweightKg[1], unit)}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="profile-height" className="mb-1 block text-sm font-semibold">
                Height <span className="font-normal text-text-muted">(cm)</span>
              </label>
              <NumberField
                id="profile-height"
                aria-label="Height in cm"
                value={s.heightCm}
                onCommit={(n) => s.update({ heightCm: n })}
                max={PROFILE_LIMITS.heightCm[1]}
                placeholder="–"
                aria-invalid={heightOff || undefined}
                aria-describedby={heightOff ? "profile-height-error" : undefined}
                className="!px-3 !text-left !text-base"
              />
              {heightOff && (
                <p id="profile-height-error" className="mt-1 text-xs text-failure">
                  Enter {PROFILE_LIMITS.heightCm[0]} to {PROFILE_LIMITS.heightCm[1]} cm
                </p>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="account-heading" className="panel p-3">
          <h2 id="account-heading" className="label-caps">
            Account
          </h2>
          <div className="mt-2 flex items-start gap-3">
            <CloudOff aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-text-muted" />
            <div>
              <p className="text-sm font-semibold">Guest on this device</p>
              <p className="text-sm text-text-muted">
                Your workouts live on this phone only. Export a backup in Settings to keep a copy.
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-white/[0.12] bg-surface-2 text-sm font-semibold transition-colors hover:border-white/25"
          >
            Back up with an account
          </Link>
        </section>

        <Link
          href="/settings"
          className="panel flex min-h-14 items-center gap-3 px-4 text-sm font-semibold transition-colors hover:bg-surface-2"
        >
          <Settings aria-hidden="true" size={18} className="text-text-muted" />
          <span className="flex-1">All settings</span>
          <ChevronRight aria-hidden="true" size={16} className="text-text-muted" />
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-bg px-3 py-2.5">
      <dt className="label-caps">{label}</dt>
      <dd className="num truncate text-xl font-bold tracking-tight">{value}</dd>
    </div>
  );
}
