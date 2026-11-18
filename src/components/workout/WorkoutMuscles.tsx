"use client";

import { useMemo, useState } from "react";
import type { Exercise, WorkoutSession } from "@/types/workout";
import { MUSCLE_GROUP_LABELS } from "@/types/workout";
import { MuscleMap } from "@/components/anatomy/MuscleMap";
import { Sheet } from "@/components/ui/Sheet";
import { muscleWork, workedMuscles } from "@/lib/session-insights";
import { RangeTabs } from "@/components/progress/RangeTabs";
import { MuscleBars, MuscleRadar } from "./MuscleWorkChart";
import { muscleText } from "@/lib/home";
import { useT } from "@/i18n";

type View = "map" | "radar" | "bar";
const VIEW_KEY = "abot.muscleView";

/** The last view chosen on this phone, so it need not be picked again every workout. */
function useView(): [View, (v: View) => void] {
  // Read on first render: the sheet only draws in the browser, after a tap.
  const [view, setView] = useState<View>(() => {
    try {
      const v = typeof window === "undefined" ? null : localStorage.getItem(VIEW_KEY);
      return v === "radar" || v === "bar" ? v : "map";
    } catch {
      return "map";
    }
  });
  return [
    view,
    (v) => {
      setView(v);
      try {
        localStorage.setItem(VIEW_KEY, v);
      } catch {
        // Kept for this visit only.
      }
    },
  ];
}

/**
 * The fourth stat in the workout header, right of Sets: a small map of the muscles this workout
 * has worked so far, which fills in each time a set is ticked. A tap opens it full size with the
 * muscles named, or as a radar or bars of sets per muscle, to see which got the most work. It
 * redraws only when a set changes, never on a timer.
 */
export function WorkoutMuscles({ session, byId }: { session: WorkoutSession; byId: Record<string, Exercise> }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const muscles = useMemo(() => workedMuscles(session, byId), [session, byId]);
  const work = useMemo(() => (open ? muscleWork(session, byId) : null), [open, session, byId]);
  const [view, setView] = useView();
  const names = muscles.primary.map((m) => muscleText(MUSCLE_GROUP_LABELS[m], t));

  return (
    <div className="tile rounded-xl border border-ink/10 bg-surface px-1 py-2.5">
      <dt className="sr-only">{t("Muscles worked")}</dt>
      <dd>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={names.length ? t("Muscles worked: {muscles}. Show map", { muscles: names.join(", ") }) : t("Muscles worked: none yet. Show map")}
          className="-m-1 flex h-[calc(100%+8px)] w-[calc(100%+8px)] items-center justify-center rounded-ctl p-1 hover:bg-surface-2 [&_figcaption]:hidden"
        >
          <span className="w-11" aria-hidden="true">
            <MuscleMap primary={muscles.primary} secondary={muscles.secondary} width={44} />
          </span>
        </button>
      </dd>

      <Sheet open={open} onClose={() => setOpen(false)} title={t("Muscles worked")}>
        <div className="mb-4">
          <RangeTabs
            id="muscle-view"
            label={t("Show muscles as")}
            options={[
              { value: "map" as const, label: t("Map") },
              { value: "radar" as const, label: t("Radar") },
              { value: "bar" as const, label: t("Bar") },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
        {view === "map" && <MuscleMap primary={muscles.primary} secondary={muscles.secondary} width={300} />}
        {muscles.primary.length > 0 && work && view === "radar" && <MuscleRadar work={work} />}
        {muscles.primary.length > 0 && work && view === "bar" && <MuscleBars work={work} />}
        {muscles.primary.length > 0 ? (
          view === "map" && (
          <ul className="mt-3 flex flex-wrap justify-center gap-1">
            {muscles.primary.map((m) => (
              <li key={m} className="rounded-full border border-accent/40 bg-accent-tint px-2 py-0.5 text-xs font-semibold">
                {muscleText(MUSCLE_GROUP_LABELS[m], t)}
              </li>
            ))}
            {muscles.secondary.map((m) => (
              <li key={m} className="rounded-full border border-ink/10 px-2 py-0.5 text-xs text-text-muted">
                {muscleText(MUSCLE_GROUP_LABELS[m], t)}
              </li>
            ))}
          </ul>
          )
        ) : (
          <p className="mt-3 text-center text-sm text-text-muted">{t("Tick a set and the muscles it worked light up here.")}</p>
        )}
      </Sheet>
    </div>
  );
}
