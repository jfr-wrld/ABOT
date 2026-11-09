"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { WorkoutSession } from "@/types/workout";
import { monthGrid, sessionsByDay, startOfDay } from "@/lib/analytics";
import { countSets, formatDuration, sessionDurationSec } from "@/lib/calc";
import { historyPath } from "@/lib/routes";
import { useLocationStore } from "@/store/useLocationStore";
import { useT } from "@/i18n";

/** Two-letter weekday heads; the English text is the translation key. */
const DOW_MON = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const DOW_SUN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function WorkoutCalendar({
  sessions,
  firstDay,
  now,
}: {
  sessions: WorkoutSession[];
  firstDay: 0 | 1;
  now: number;
}) {
  const [ym, setYm] = useState(() => ({ y: new Date(now).getFullYear(), m: new Date(now).getMonth() }));
  const [selected, setSelected] = useState<number>(() => startOfDay(now));
  const t = useT();
  const locations = useLocationStore((s) => s.locations);
  const gyms: Record<string, string> = Object.fromEntries(locations.map((l) => [l.id, l.name]));
  const byDay = sessionsByDay(sessions);
  const cells = monthGrid(ym.y, ym.m, firstDay, now);
  const monthLabel = new Date(ym.y, ym.m, 1).toLocaleDateString(t.locale, { month: "long", year: "numeric" });
  const inMonthWorkouts = cells.filter((c) => c.inMonth && byDay.has(c.date)).length;
  const daySessions = byDay.get(selected) ?? [];

  const shift = (d: number) => setYm(({ y, m }) => ({ y: new Date(y, m + d, 1).getFullYear(), m: new Date(y, m + d, 1).getMonth() }));

  return (
    <section aria-labelledby="cal-heading" className="panel p-3">
      <div className="flex items-center justify-between">
        <h2 id="cal-heading" className="text-sm font-semibold">
          {monthLabel}
          <span className="ml-2 font-normal text-text-muted">
            {t.n(inMonthWorkouts, "{n} workout", "{n} workouts")}
          </span>
        </h2>
        <div className="flex">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label={t("Previous month")}
            className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <ChevronLeft aria-hidden="true" size={20} />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label={t("Next month")}
            className="flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <ChevronRight aria-hidden="true" size={20} />
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-semibold text-text-muted" aria-hidden="true">
        {(firstDay === 1 ? DOW_MON : DOW_SUN).map((d) => (
          <span key={d} className="py-1">
            {t(d)}
          </span>
        ))}
      </div>
      <div role="grid" aria-label={t("Workout days in {month}", { month: monthLabel })} className="grid grid-cols-7 gap-y-1">
        {cells.map((c) => {
          const n = byDay.get(c.date)?.length ?? 0;
          const d = new Date(c.date);
          const isSel = c.date === selected;
          return (
            <button
              key={c.date}
              type="button"
              role="gridcell"
              aria-selected={isSel}
              aria-label={`${d.toLocaleDateString(t.locale, { weekday: "long", day: "numeric", month: "long" })}${
                n ? `, ${t.n(n, "{n} workout", "{n} workouts")}` : ""
              }`}
              onClick={() => setSelected(c.date)}
              className={`mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-ctl text-sm num hover:bg-surface-2 ${
                c.inMonth ? "text-text" : "text-text-muted"
              } ${isSel ? "border border-accent" : ""} ${n ? "bg-accent-tint font-semibold" : ""}`}
            >
              <span className={c.isToday ? "underline underline-offset-4 decoration-2" : ""}>{d.getDate()}</span>
              {n > 0 && <span className="mt-0.5 size-1.5 rounded-full bg-accent" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <h3 className="text-xs font-semibold uppercase text-text-muted">
          {new Date(selected).toLocaleDateString(t.locale, { weekday: "long", day: "numeric", month: "short" })}
        </h3>
        {daySessions.length === 0 ? (
          <p className="mt-1 text-sm text-text-muted">{t("No workout on this day.")}</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {daySessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={historyPath(s.id)}
                  className="flex min-h-11 items-center justify-between rounded-ctl px-2 hover:bg-surface-2"
                >
                  <span className="min-w-0 truncate text-sm font-semibold">{s.name}</span>
                  <span className="min-w-0 truncate pl-2 text-right text-xs text-text-muted">
                    {gyms[s.locationId ?? ""] ? `${gyms[s.locationId!]} · ` : ""}
                    {formatDuration(sessionDurationSec(s))} · {t("{n} sets", { n: countSets(s).completed })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
