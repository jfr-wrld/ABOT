"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Camera, Pencil, Settings } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { HydrationGate } from "@/components/ui/Loading";
import { ProgressPanel } from "@/components/analytics/ProgressPanel";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { LiftsBoard } from "@/components/profile/LiftsBoard";
import { AccountChip, EDIT_PROFILE } from "@/components/profile/AccountSection";
import { BodyChip } from "@/components/profile/BodyLink";
import { usePhotoPicker } from "@/components/profile/usePhotoPicker";
import { profileStats } from "@/lib/profile";
import { PlanBadge } from "@/components/paywall/PlanBadge";
import { motion } from "framer-motion";
import { PRESS_SPRING } from "@/components/ui/Button";
import { weeklyBuckets } from "@/lib/analytics";
import { useNow } from "@/lib/useNow";
import { formatVolume } from "@/lib/units";
import { useT } from "@/i18n";
import { ProfileCover } from "@/components/profile/ProfileCover";

export default function ProfilePage() {
  return (
    <HydrationGate>
      <ProfileScreen />
    </HydrationGate>
  );
}

type Tab = "progress" | "lifts";
const TABS: Tab[] = ["progress", "lifts"];

/** The open tab lives in the address (?tab=lifts), so Back and shared links keep it. */
function useTab(): [Tab, (t: Tab) => void] {
  const router = useRouter();
  const raw = useSearchParams().get("tab");
  const tab: Tab = raw === "lifts" ? raw : "progress";
  // About used to be a tab here; old links and sign-in returns land on Edit profile instead.
  useEffect(() => {
    if (raw === "about") router.replace(`${EDIT_PROFILE}${window.location.hash}`);
  }, [raw, router]);
  return [tab, (t) => router.replace(t === "progress" ? "/profile" : `/profile?tab=${t}`, { scroll: false })];
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
  const tabLabel: Record<Tab, string> = { progress: t("Progress"), lifts: t("Lifts") };

  const record = [
    t.n(stats.workouts, "{n} workout", "{n} workouts"),
    stats.volumeKg > 0 ? t("{volume} lifted", { volume: formatVolume(stats.volumeKg, unit) }) : null,
    stats.weekStreak > 0 ? t("{n}-wk streak", { n: stats.weekStreak }) : null,
  ].filter(Boolean);

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
        <ProfileCover weeks={covers.map((b) => b.volumeKg)} />
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
          <Link
            href={EDIT_PROFILE}
            className="tap mb-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-ink/[0.12] bg-surface-2 px-4 text-sm font-semibold text-text hover:border-ink/25 hover:bg-press active:bg-press-strong"
          >
            <Pencil aria-hidden="true" size={15} />
            {t("Edit profile")}
          </Link>
        </div>
        <div className="mt-2 flex flex-col items-start">
          <div className="flex max-w-full items-center gap-2">
            {name ? (
              <h2 className="min-w-0 truncate text-2xl font-bold tracking-tight">{name}</h2>
            ) : (
              <h2 className="text-2xl font-bold tracking-tight text-text-muted">{t("Your name")}</h2>
            )}
            <PlanBadge />
          </div>
          {s.profileHandle && <p className="num text-sm text-text-muted">@{s.profileHandle}</p>}
          <p className="num mt-0.5 text-xs text-text-muted">{record.join(" · ")}</p>
          <div className="flex flex-wrap items-center gap-x-2">
            <AccountChip />
            <BodyChip />
          </div>
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
            className={`tap relative min-h-12 flex-1 text-sm font-semibold ${tab === id ? "text-text" : "text-text-muted hover:text-text"}`}
          >
            {tabLabel[id]}
            {tab === id && (
              <motion.span layoutId="profile-tab" transition={PRESS_SPRING} aria-hidden="true" className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-4 px-4 pb-8 pt-4">
        {tab === "progress" && (
          <>
            <ProgressPanel />
          </>
        )}

        {tab === "lifts" && <LiftsBoard sessions={sessions} byId={byId} unit={unit} bodyweightKg={s.bodyweightKg} now={now} />}
      </div>
    </main>
  );
}

