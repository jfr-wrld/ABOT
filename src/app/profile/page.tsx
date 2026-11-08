"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ChevronRight, Pencil, Settings, Trophy } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { HydrationGate } from "@/components/ui/Loading";
import { Button } from "@/components/ui/Button";
import { ProgressPanel } from "@/components/analytics/ProgressPanel";
import { NumberField } from "@/components/ui/NumberField";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { BodyweightSection } from "@/components/profile/BodyweightSection";
import { AccountChip, AccountSection } from "@/components/profile/AccountSection";
import { normalizeHandle, profileStats, type ProfileStats } from "@/lib/profile";
import { weeklyBuckets } from "@/lib/analytics";
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

type Tab = "progress" | "lifts" | "about";
const TABS: { id: Tab; label: string }[] = [
  { id: "progress", label: "Progress" },
  { id: "lifts", label: "Lifts" },
  { id: "about", label: "About" },
];

/** The open tab lives in the address (?tab=lifts), so Back and shared links keep it. */
function useTab(): [Tab, (t: Tab) => void] {
  const router = useRouter();
  const raw = useSearchParams().get("tab");
  const tab: Tab = raw === "lifts" || raw === "about" ? raw : "progress";
  return [tab, (t) => router.replace(t === "progress" ? "/profile" : `/profile?tab=${t}`, { scroll: false })];
}

/** Waits for a section to render (after a tab switch) and brings it into view. */
function reveal(id: string, focus = false) {
  let tries = 0;
  const look = () => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ block: "center" });
      if (focus) el.focus({ preventScroll: true });
    } else if (tries++ < 60) requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
}

/**
 * A profile laid out like a social profile: a cover, the plate overlapping it, the name and a
 * one-line record, then tabs. Progress (formerly its own tab) is the first of them.
 */
function ProfileScreen() {
  const s = useSettingsStore();
  const sessions = useWorkoutStore((st) => st.sessions);
  const { byId } = useAllExercises();
  const now = useNow(60_000);
  const [tab, setTab] = useTab();
  const stats = useMemo(() => profileStats(sessions, byId, now, s.firstDayOfWeek), [sessions, byId, now, s.firstDayOfWeek]);
  const covers = useMemo(() => weeklyBuckets(sessions, 12, now, s.firstDayOfWeek, byId), [sessions, now, s.firstDayOfWeek, byId]);
  const unit = s.weightUnit;
  const photo = usePhotoPicker((profilePhoto) => s.update({ profilePhoto }));
  const name = s.profileName.trim();

  const record = [
    `${stats.workouts} ${stats.workouts === 1 ? "workout" : "workouts"}`,
    stats.weekStreak > 0 ? `${stats.weekStreak}-wk streak` : null,
  ].filter(Boolean);

  function edit(target: "profile-name" | "account") {
    setTab("about");
    reveal(target, target === "profile-name");
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-xl font-bold">Profile</h1>
        <Link
          href="/settings"
          aria-label="Settings"
          className="-mr-2 flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface hover:text-text"
        >
          <Settings aria-hidden="true" size={22} />
        </Link>
      </header>

      <section aria-label="Identity" className="px-4 pt-3">
        <Cover weeks={covers.map((b) => b.volumeKg)} />
        <div className="relative -mt-12 flex items-end justify-between gap-3 pl-3">
          {photo.input}
          <button
            type="button"
            onClick={photo.open}
            disabled={photo.busy}
            aria-label={s.profilePhoto ? "Change photo" : "Add photo"}
            className="relative shrink-0 rounded-full transition-transform active:scale-95 disabled:opacity-50"
          >
            <ProfileAvatar name={s.profileName} photo={s.profilePhoto} size={96} ringed />
            <span
              aria-hidden="true"
              className="absolute right-0 bottom-1 flex size-8 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-text"
            >
              <Camera size={15} />
            </span>
          </button>
          <Button onClick={() => edit("profile-name")} className="mb-1">
            <Pencil aria-hidden="true" size={15} />
            Edit profile
          </Button>
        </div>
        <div className="mt-2 flex flex-col items-start">
          {name ? (
            <h2 className="max-w-full truncate text-2xl font-bold tracking-tight">{name}</h2>
          ) : (
            <h2 className="text-2xl font-bold tracking-tight text-text-muted">Your name</h2>
          )}
          {s.profileHandle && <p className="num text-sm text-text-muted">@{s.profileHandle}</p>}
          <p className="num mt-0.5 text-xs text-text-muted">{record.join(" · ")}</p>
          <AccountChip onOpen={() => edit("account")} />
        </div>
        {photo.error && (
          <p role="alert" className="text-xs text-failure">
            {photo.error}
          </p>
        )}
      </section>

      <div
        role="tablist"
        aria-label="Profile sections"
        className="sticky top-0 z-10 mt-2 flex border-b border-line bg-bg/95 px-4 backdrop-blur"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          const i = TABS.findIndex((t) => t.id === tab);
          const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].id;
          setTab(next);
          requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={`relative min-h-12 flex-1 text-sm font-semibold transition-colors ${
              tab === t.id ? "text-text" : "text-text-muted hover:text-text"
            }`}
          >
            {t.label}
            {tab === t.id && <span aria-hidden="true" className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-4 px-4 pb-8 pt-4">
        {tab === "progress" && (
          <>
            <section aria-labelledby="lifetime-heading" className="panel p-3">
              <h2 id="lifetime-heading" className="label-caps">
                Lifetime
              </h2>
              <dl className="mt-2 grid grid-cols-2 gap-2">
                <Stat label="Workouts" value={String(stats.workouts)} />
                <Stat label="Volume" value={formatVolume(stats.volumeKg, unit)} />
                <Stat label="Time trained" value={formatHours(stats.trainingSec)} />
                <Stat
                  label="Week streak"
                  value={`${stats.weekStreak} ${stats.weekStreak === 1 ? "week" : "weeks"}`}
                  accent={stats.weekStreak > 0}
                />
              </dl>
            </section>
            <ProgressPanel />
          </>
        )}

        {tab === "lifts" && <TopLifts lifts={stats.topLifts} unit={unit} />}

        {tab === "about" && (
          <>
            <BodyweightSection now={now} />
            <section aria-labelledby="body-heading" className="panel flex flex-col gap-3 p-3">
              <h2 id="body-heading" className="label-caps">
                About you
              </h2>
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
              <div>
                <label htmlFor="profile-handle" className="mb-1 block text-sm font-semibold">
                  Username <span className="font-normal text-text-muted">(on shared stories)</span>
                </label>
                <div className="flex h-11 items-center rounded-ctl border border-zinc-800 bg-well focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 hover:border-zinc-700">
                  <span aria-hidden="true" className="num pl-3 text-base text-text-muted">
                    @
                  </span>
                  <input
                    id="profile-handle"
                    value={s.profileHandle}
                    maxLength={PROFILE_LIMITS.handleMax}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(e) => s.update({ profileHandle: normalizeHandle(e.target.value) })}
                    placeholder="yourname"
                    className="h-full min-w-0 flex-1 bg-transparent pl-0.5 pr-3 text-base text-text placeholder:text-text-muted focus:outline-none"
                  />
                </div>
              </div>
              <HeightField imperial={unit === "lbs"} heightCm={s.heightCm} onChange={(heightCm) => s.update({ heightCm })} />
              {s.profilePhoto && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">Photo</span>
                  <button
                    type="button"
                    onClick={() => s.update({ profilePhoto: null })}
                    className="min-h-11 rounded-xl px-3 text-sm font-semibold text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text"
                  >
                    Remove photo
                  </button>
                </div>
              )}
            </section>
            <AccountSection />
            <Link
              href="/settings"
              className="panel flex min-h-14 items-center gap-3 px-4 text-sm font-semibold transition-colors hover:bg-surface-2"
            >
              <Settings aria-hidden="true" size={18} className="text-text-muted" />
              <span className="flex-1">All settings</span>
              <ChevronRight aria-hidden="true" size={16} className="text-text-muted" />
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

const formatHours = (sec: number) => (sec >= 3600 ? `${(sec / 3600).toFixed(1)} h` : `${Math.round(sec / 60)} min`);

/**
 * The cover is the lifter's last twelve weeks of volume as a skyline: real data in place of a
 * stock banner. With nothing logged it is a plain Carbon plate.
 */
function Cover({ weeks }: { weeks: number[] }) {
  const max = Math.max(...weeks, 0);
  return (
    <div aria-hidden="true" className="relative h-32 overflow-hidden rounded-card border border-line bg-surface">
      {max > 0 && (
        <svg viewBox={`0 0 ${weeks.length * 10} 100`} preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-24 w-full">
          {weeks.map((v, i) => {
            const h = Math.max(2, (v / max) * 92);
            return (
              <rect
                key={i}
                x={i * 10 + 1.5}
                y={100 - h}
                width={7}
                height={h}
                rx={1.5}
                fill="var(--color-accent)"
                opacity={i === weeks.length - 1 ? 0.55 : 0.16}
              />
            );
          })}
        </svg>
      )}
      <span className="label-caps absolute top-3 right-3">12 wk volume</span>
    </div>
  );
}

function TopLifts({ lifts, unit }: { lifts: ProfileStats["topLifts"]; unit: "kg" | "lbs" }) {
  if (lifts.length === 0) {
    return <p className="panel px-4 py-6 text-center text-sm text-text-muted">Finish a workout to rank your lifts.</p>;
  }
  return (
    <section aria-labelledby="lifts-heading" className="panel p-3">
      <div className="flex items-baseline justify-between">
        <h2 id="lifts-heading" className="label-caps flex items-center gap-1.5">
          <Trophy aria-hidden="true" size={12} className="text-pr" />
          Top lifts
        </h2>
        <span className="label-caps" title="Estimated one-rep max from your best set">
          e1RM
        </span>
      </div>
      <ol className="mt-1 flex flex-col">
        {lifts.map(({ exercise, record }, i) => (
          <li key={exercise.id}>
            <Link
              href={`/exercises/${exercise.id}`}
              className="-mx-1 flex min-h-14 items-center gap-3 rounded-xl px-1 transition-colors hover:bg-white/[0.04]"
            >
              <span className="num w-4 text-sm text-text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{exercise.name}</span>
                <span className="num block text-xs text-text-muted">
                  {formatWeight(record.weightKg, unit)} × {record.reps}
                </span>
              </span>
              <span className="num text-base font-bold text-pr">{formatWeight(record.value, unit)}</span>
              <ChevronRight aria-hidden="true" size={16} className="text-text-muted" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl bg-bg px-3 py-2.5">
      <dt className="label-caps">{label}</dt>
      <dd className={`num truncate text-xl font-bold tracking-tight ${accent ? "text-accent" : ""}`}>{value}</dd>
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

/** The hidden file input behind the avatar. The photo is resized on the phone and never uploaded. */
function usePhotoPicker(onChange: (url: string | null) => void) {
  const ref = useRef<HTMLInputElement>(null);
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
      if (ref.current) ref.current.value = "";
    }
  }

  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      aria-label="Profile photo file"
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => pick(e.target.files?.[0])}
    />
  );
  return { input, open: () => ref.current?.click(), busy, error };
}
