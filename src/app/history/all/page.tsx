"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Dumbbell } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { ViewToggle, useViewMode } from "@/components/ui/ViewToggle";
import { RecentCard } from "@/components/home/HomeDashboard";
import { byMonth, filterHistory, focusesIn } from "@/lib/history-search";
import { prCounts } from "@/lib/home";
import { feedback } from "@/lib/feedback";
import { useNow } from "@/lib/useNow";
import type { FocusLabel } from "@/lib/training-focus";
import { useT } from "@/i18n";

/** Rows drawn at first and per "Show more": a long log stays quick to open. */
const PAGE = 30;

export default function AllWorkoutsPage() {
  return (
    <HydrationGate>
      <AllWorkouts />
    </HydrationGate>
  );
}

/**
 * Every finished workout, searchable by workout or exercise name and filtered by the day's focus
 * and gym. Home lists the last ten; the whole log lives on the phone, free and without a limit.
 */
function AllWorkouts() {
  const t = useT();
  const sessions = useWorkoutStore((s) => s.sessions);
  const unit = useSettingsStore((s) => s.weightUnit);
  const locations = useLocationStore((s) => s.locations);
  const { byId } = useAllExercises();
  const now = useNow(60_000);
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query);
  const [focus, setFocus] = useState<FocusLabel | "">("");
  const [gym, setGym] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [view, setView] = useViewMode("history-all");

  const focuses = useMemo(() => focusesIn(sessions, byId), [sessions, byId]);
  const gyms = useMemo(() => {
    const used = new Set(sessions.map((s) => s.locationId).filter(Boolean));
    return locations.filter((l) => used.has(l.id));
  }, [sessions, locations]);
  const found = useMemo(() => filterHistory(sessions, byId, { query: search, focus, gym }), [sessions, byId, search, focus, gym]);
  const page = useMemo(() => found.slice(0, shown), [found, shown]);
  const prs = useMemo(() => prCounts(page, sessions, byId), [page, sessions, byId]);
  const total = sessions.filter((s) => s.status === "completed").length;
  const filtered = !!(search.trim() || focus || gym);

  return (
    <main className="flex flex-1 flex-col pb-6">
      <PageHeader title={t("All workouts")} back={{ href: "/", label: t("Home") }} />

      <div className="flex flex-col gap-2 px-4 pt-4">
        <label htmlFor="history-search" className="sr-only">
          {t("Search workouts")}
        </label>
        <div className="flex items-center gap-2">
          <input
            id="history-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            placeholder={t("Workout or exercise name")}
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted"
          />
          <ViewToggle value={view} onChange={setView} />
        </div>

        {focuses.length > 1 && (
          <div role="group" aria-label={t("Filter by focus")} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
            {(["", ...focuses] as const).map((f) => (
              <button
                key={f || "all"}
                type="button"
                aria-pressed={focus === f}
                onClick={() => {
                  if (focus !== f) feedback.tick();
                  setFocus(f);
                  setShown(PAGE);
                }}
                className={`tap h-11 shrink-0 rounded-full border px-4 text-xs font-semibold ${
                  focus === f ? "border-accent bg-accent text-on-accent" : "border-ink/[0.12] text-text-muted hover:border-ink/25 hover:text-text"
                }`}
              >
                {f ? t(f) : t("All")}
              </button>
            ))}
          </div>
        )}

        {gyms.length > 1 && (
          <>
            <label htmlFor="history-gym" className="sr-only">
              {t("Gym")}
            </label>
            <Select
              id="history-gym"
              value={gym}
              onChange={(v) => {
                setGym(v);
                setShown(PAGE);
              }}
              options={[{ value: "", label: t("All gyms") }, ...gyms.map((g) => ({ value: g.id, label: g.name }))]}
            />
          </>
        )}

        <p className="text-xs text-text-muted" role="status">
          {filtered ? t("{n} of {total} workouts", { n: found.length, total }) : t.n(total, "{n} workout", "{n} workouts")}
        </p>
      </div>

      {found.length === 0 ? (
        <div className="mx-4 mt-3 flex flex-col items-center gap-2 rounded-xl border border-line bg-surface p-6 text-center">
          <Dumbbell aria-hidden="true" size={22} className="text-text-muted" />
          <p className="text-sm text-text-muted">{total === 0 ? t("No workouts yet.") : t("No workout matches. Try another name, or clear the filters.")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4 pt-3">
          {byMonth(page).map((g) => (
            <section key={g.month} aria-labelledby={`m-${g.month}`} className="flex flex-col gap-2">
              <h2 id={`m-${g.month}`} className="label-caps">
                {new Date(g.month).toLocaleDateString(t.locale, { month: "long", year: "numeric" })}
              </h2>
              <ul className={view === "grid" ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "flex flex-col gap-2"}>
                {g.sessions.map((s, i) => (
                  <RecentCard key={s.id} session={s} pr={prs[s.id] ?? 0} unit={unit} byId={byId} now={now} order={i} grid={view === "grid"} />
                ))}
              </ul>
            </section>
          ))}
          {found.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE)}
              className="min-h-11 rounded-xl border border-ink/[0.12] text-sm font-semibold text-text-muted transition-colors hover:border-ink/25 hover:text-text"
            >
              {t("Show {n} more", { n: Math.min(PAGE, found.length - shown) })}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
