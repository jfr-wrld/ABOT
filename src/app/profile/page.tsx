"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ChevronRight, CloudOff, Settings, Trophy } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { NumberField } from "@/components/ui/NumberField";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { BodyweightSection } from "@/components/profile/BodyweightSection";
import { profileStats } from "@/lib/profile";
import { squareJpeg } from "@/lib/photo";
import { useNow } from "@/lib/useNow";
import { cmToFtIn, formatVolume, formatWeight, ftInToCm } from "@/lib/units";
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
          <ProfileAvatar name={s.profileName} photo={s.profilePhoto} size={80} />
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold tracking-tight">{s.profileName.trim() || "Your profile"}</h2>
            <p className="text-sm text-text-muted">{since}</p>
            <PhotoControls photo={s.profilePhoto} onChange={(profilePhoto) => s.update({ profilePhoto })} />
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

        <BodyweightSection now={now} />

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
          <HeightField imperial={unit === "lbs"} heightCm={s.heightCm} onChange={(heightCm) => s.update({ heightCm })} />
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

const FIELD = "!px-3 !text-left !text-base";

/** Height in cm, or feet and inches for lbs users. Always stored in cm. */
function HeightField({
  imperial,
  heightCm,
  onChange,
}: {
  imperial: boolean;
  heightCm: number | null;
  onChange: (cm: number | null) => void;
}) {
  const [min, max] = PROFILE_LIMITS.heightCm;
  // Stored as typed and flagged when out of range: a check per keystroke would wipe "1" on the way to "170".
  const off = heightCm !== null && (heightCm < min || heightCm > max);
  const range = imperial
    ? `${cmToFtIn(min).ft} ft ${cmToFtIn(min).inch} in to ${cmToFtIn(max).ft} ft ${cmToFtIn(max).inch} in`
    : `${min} to ${max} cm`;
  const errorProps = { "aria-invalid": off || undefined, "aria-describedby": off ? "profile-height-error" : undefined };

  if (!imperial) {
    return (
      <div>
        <label htmlFor="profile-height" className="mb-1 block text-sm font-semibold">
          Height <span className="font-normal text-text-muted">(cm)</span>
        </label>
        <NumberField
          id="profile-height"
          aria-label="Height in cm"
          value={heightCm}
          onCommit={onChange}
          max={max}
          placeholder="–"
          className={FIELD}
          {...errorProps}
        />
        {off && <HeightError range={range} />}
      </div>
    );
  }

  const parts = heightCm === null ? null : cmToFtIn(heightCm);
  const set = (ft: number | null, inch: number | null) =>
    onChange(ft === null && inch === null ? null : ftInToCm(ft ?? 0, Math.min(11, inch ?? 0)));
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold">Height</legend>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <NumberField
            aria-label="Height, feet"
            value={parts?.ft ?? null}
            onCommit={(ft) => set(ft, parts?.inch ?? null)}
            max={8}
            placeholder="–"
            className={`${FIELD} !pr-9`}
            {...errorProps}
          />
          <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
            ft
          </span>
        </div>
        <div className="relative">
          <NumberField
            aria-label="Height, inches"
            value={parts?.inch ?? null}
            onCommit={(inch) => set(parts?.ft ?? null, inch)}
            max={11}
            placeholder="–"
            className={`${FIELD} !pr-9`}
            {...errorProps}
          />
          <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
            in
          </span>
        </div>
      </div>
      {off && <HeightError range={range} />}
    </fieldset>
  );
}

function HeightError({ range }: { range: string }) {
  return (
    <p id="profile-height-error" className="mt-1 text-xs text-failure">
      Enter {range}
    </p>
  );
}

/** Pick, replace or remove the profile photo. The file never leaves the phone. */
function PhotoControls({ photo, onChange }: { photo: string | null; onChange: (url: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await squareJpeg(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "This photo could not be used.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="mt-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        aria-label="Profile photo file"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/[0.12] px-3 text-sm font-semibold transition-colors hover:border-white/25 disabled:opacity-50"
        >
          <Camera aria-hidden="true" size={16} />
          {busy ? "Preparing photo" : photo ? "Change photo" : "Add photo"}
        </button>
        {photo && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="min-h-11 rounded-xl px-3 text-sm font-semibold text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text"
          >
            Remove photo
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-failure">
          {error}
        </p>
      )}
    </div>
  );
}
