"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Image as ImageIcon, Pencil, Settings } from "lucide-react";
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
import { LiftsBoard } from "@/components/profile/LiftsBoard";
import { AccountChip, AccountSection } from "@/components/profile/AccountSection";
import { normalizeHandle, profileStats } from "@/lib/profile";
import { weeklyBuckets } from "@/lib/analytics";
import { squareJpeg } from "@/lib/photo";
import { useNow } from "@/lib/useNow";
import { cmToFtIn, formatVolume, ftInToCm } from "@/lib/units";
import { PROFILE_LIMITS } from "@/types/workout";
import { Sheet } from "@/components/ui/Sheet";
import { isNativeApp } from "@/lib/native/files";
import { openPhotoInput } from "@/lib/native/photo-input";
import { useT, type T } from "@/i18n";

export default function ProfilePage() {
  return (
    <HydrationGate>
      <ProfileScreen />
    </HydrationGate>
  );
}

type Tab = "progress" | "lifts" | "about";
const TABS: Tab[] = ["progress", "lifts", "about"];

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
  const t = useT();
  const tabLabel: Record<Tab, string> = { progress: t("Progress"), lifts: t("Lifts"), about: t("About") };

  const record = [
    t.n(stats.workouts, "{n} workout", "{n} workouts"),
    stats.weekStreak > 0 ? t("{n}-wk streak", { n: stats.weekStreak }) : null,
  ].filter(Boolean);

  function edit(target: "profile-name" | "account") {
    setTab("about");
    reveal(target, target === "profile-name");
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-xl font-bold">{t("Profile")}</h1>
        <Link
          href="/settings"
          aria-label={t("Settings")}
          className="-mr-2 flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface hover:text-text"
        >
          <Settings aria-hidden="true" size={22} />
        </Link>
      </header>

      <section aria-label={t("Identity")} className="px-4 pt-3">
        <Cover weeks={covers.map((b) => b.volumeKg)} />
        <div className="relative -mt-12 flex items-end justify-between gap-3 pl-3">
          {photo.input}
          <button
            type="button"
            onClick={photo.open}
            disabled={photo.busy}
            aria-label={s.profilePhoto ? t("Change photo") : t("Add photo")}
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
            {t("Edit profile")}
          </Button>
        </div>
        <div className="mt-2 flex flex-col items-start">
          {name ? (
            <h2 className="max-w-full truncate text-2xl font-bold tracking-tight">{name}</h2>
          ) : (
            <h2 className="text-2xl font-bold tracking-tight text-text-muted">{t("Your name")}</h2>
          )}
          {s.profileHandle && <p className="num text-sm text-text-muted">@{s.profileHandle}</p>}
          <p className="num mt-0.5 text-xs text-text-muted">{record.join(" · ")}</p>
          <AccountChip onOpen={() => edit("account")} />
        </div>
        {photo.error && (
          <p role="alert" className="text-xs text-failure">
            {t(photo.error)}
          </p>
        )}
      </section>

      <div
        role="tablist"
        aria-label={t("Profile sections")}
        className="sticky top-[env(safe-area-inset-top)] z-10 mt-2 flex border-b border-line bg-bg/95 px-4 backdrop-blur"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          const i = TABS.indexOf(tab);
          const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
          setTab(next);
          requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
        }}
      >
        {TABS.map((id) => (
          <button
            key={id}
            id={`tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            className={`relative min-h-12 flex-1 text-sm font-semibold transition-colors ${
              tab === id ? "text-text" : "text-text-muted hover:text-text"
            }`}
          >
            {tabLabel[id]}
            {tab === id && <span aria-hidden="true" className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-4 px-4 pb-8 pt-4">
        {tab === "progress" && (
          <>
            <section aria-labelledby="lifetime-heading" className="panel p-3">
              <h2 id="lifetime-heading" className="label-caps">
                {t("Lifetime")}
              </h2>
              <dl className="mt-2 grid grid-cols-2 gap-2">
                <Stat label={t("Workouts")} value={String(stats.workouts)} />
                <Stat label={t("Volume")} value={formatVolume(stats.volumeKg, unit)} />
                <Stat label={t("Time trained")} value={formatHours(stats.trainingSec, t)} />
                <Stat
                  label={t("Week streak")}
                  value={t.n(stats.weekStreak, "{n} week", "{n} weeks")}
                  accent={stats.weekStreak > 0}
                />
              </dl>
            </section>
            <ProgressPanel />
          </>
        )}

        {tab === "lifts" && <LiftsBoard sessions={sessions} byId={byId} unit={unit} bodyweightKg={s.bodyweightKg} now={now} />}

        {tab === "about" && (
          <>
            <section aria-labelledby="body-heading" className="panel flex flex-col gap-3 p-3">
              <h2 id="body-heading" className="label-caps">
                {t("About you")}
              </h2>
              <div>
                <label htmlFor="profile-name" className="mb-1 block text-sm font-semibold">
                  {t("Name")}
                </label>
                <input
                  id="profile-name"
                  value={s.profileName}
                  maxLength={PROFILE_LIMITS.nameMax}
                  autoComplete="name"
                  onChange={(e) => s.update({ profileName: e.target.value })}
                  placeholder={t("What should ABOT call you?")}
                  className="h-11 w-full rounded-ctl border border-zinc-800 bg-well px-3 text-base text-text placeholder:text-text-muted hover:border-zinc-700 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <label htmlFor="profile-handle" className="mb-1 block text-sm font-semibold">
                  {t("Username")} <span className="font-normal text-text-muted">{t("(on shared stories)")}</span>
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
                    placeholder={t("yourname")}
                    className="h-full min-w-0 flex-1 bg-transparent pl-0.5 pr-3 text-base text-text placeholder:text-text-muted focus:outline-none"
                  />
                </div>
              </div>
              <HeightField imperial={unit === "lbs"} heightCm={s.heightCm} onChange={(heightCm) => s.update({ heightCm })} />
              {s.profilePhoto && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{t("Photo")}</span>
                  <button
                    type="button"
                    onClick={() => s.update({ profilePhoto: null })}
                    className="min-h-11 rounded-xl px-3 text-sm font-semibold text-text-muted transition-colors hover:bg-ink/[0.05] hover:text-text"
                  >
                    {t("Remove photo")}
                  </button>
                </div>
              )}
            </section>
            <BodyweightSection now={now} />
            <AccountSection />
          </>
        )}
      </div>
    </main>
  );
}

function formatHours(sec: number, t: T): string {
  if (sec < 3600) return t("{n} min", { n: Math.round(sec / 60) });
  const h = (sec / 3600).toFixed(1);
  return t("{n} h", { n: t.lang === "id" ? h.replace(".", ",") : h });
}

/**
 * The cover is the lifter's last twelve weeks of volume as a skyline: real data in place of a
 * stock banner. With nothing logged it is a plain Carbon plate.
 */
function Cover({ weeks }: { weeks: number[] }) {
  const max = Math.max(...weeks, 0);
  const t = useT();
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
      <span className="label-caps absolute top-3 right-3">{t("12 wk volume")}</span>
    </div>
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
  const t = useT();
  const range = imperial
    ? t("{min} to {max}", { min: `${cmToFtIn(min).ft} ft ${cmToFtIn(min).inch} in`, max: `${cmToFtIn(max).ft} ft ${cmToFtIn(max).inch} in` })
    : t("{min} to {max}", { min, max: `${max} cm` });
  const errorProps = { "aria-invalid": off || undefined, "aria-describedby": off ? "profile-height-error" : undefined };

  if (!imperial) {
    return (
      <div>
        <label htmlFor="profile-height" className="mb-1 block text-sm font-semibold">
          {t("Height")} <span className="font-normal text-text-muted">(cm)</span>
        </label>
        <NumberField
          id="profile-height"
          aria-label={t("Height in cm")}
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
      <legend className="mb-1 text-sm font-semibold">{t("Height")}</legend>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <NumberField
            aria-label={t("Height, feet")}
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
            aria-label={t("Height, inches")}
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
  const t = useT();
  return (
    <p id="profile-height-error" className="mt-1 text-xs text-failure">
      {t("Enter {range}", { range })}
    </p>
  );
}

/** The hidden file input behind the avatar. The photo is resized on the phone and never uploaded. */
function usePhotoPicker(onChange: (url: string | null) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await squareJpeg(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("This photo could not be used."));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  // The app's WebView offers no camera in its file picker, so there the avatar asks first.
  const [choosing, setChoosing] = useState(false);
  const choose = (source: "gallery" | "camera") => {
    setChoosing(false);
    openPhotoInput(ref.current, source, "user");
  };
  const input = (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        aria-label={t("Profile photo file")}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <Sheet open={choosing} onClose={() => setChoosing(false)} title={t("Profile photo")}>
        <div className="grid grid-cols-2 gap-2 pb-2">
          <Button onClick={() => choose("camera")} className="min-h-14">
            <Camera aria-hidden="true" size={18} />
            {t("Take photo")}
          </Button>
          <Button onClick={() => choose("gallery")} className="min-h-14">
            <ImageIcon aria-hidden="true" size={18} />
            {t("Choose photo")}
          </Button>
        </div>
      </Sheet>
    </>
  );
  const open = () => (isNativeApp() ? setChoosing(true) : ref.current?.click());
  return { input, open, busy, error };
}
