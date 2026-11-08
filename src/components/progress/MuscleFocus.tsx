"use client";

import { motion } from "framer-motion";
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from "@/types/workout";
import { MuscleMap } from "@/components/anatomy/MuscleMap";

/**
 * Where the work went: the body map lights the muscles that took at least half the sets of the
 * most-trained one, dims the rest, and the ranked bars beside it give the counts.
 */
export function MuscleFocus({ title, split }: { title: string; split: Partial<Record<MuscleGroup, number>> }) {
  const rows = (Object.entries(split) as [MuscleGroup, number][])
    .filter(([m, v]) => v > 0 && m !== "cardio")
    .sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] ?? 0;
  const primary = rows.filter(([, v]) => v >= max / 2).map(([m]) => m);
  const secondary = rows.filter(([, v]) => v < max / 2).map(([m]) => m);

  return (
    <figure className="panel p-4">
      <figcaption>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-text-muted">Working sets; secondary muscles count half.</span>
      </figcaption>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          No working sets in this range. Sets you tick during a workout are counted here by muscle.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-center gap-3">
          <MuscleMap primary={primary} secondary={secondary} width={220} />
          <ol className="flex flex-col gap-2">
            {rows.slice(0, 7).map(([m, v], i) => (
              <li key={m}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate">{MUSCLE_GROUP_LABELS[m]}</span>
                  <span className="num font-semibold">{Number.isInteger(v) ? v : v.toFixed(1)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: v / max }}
                    transition={{ type: "spring", stiffness: 220, damping: 30, delay: i * 0.04 }}
                    style={{ originX: 0 }}
                    className={`h-full rounded-full ${v >= max / 2 ? "bg-accent" : "bg-[#4d5c12]"}`}
                  />
                </div>
              </li>
            ))}
            {rows.length > 7 && (
              <li className="text-xs text-text-muted">
                +<span className="num">{rows.length - 7}</span> more
              </li>
            )}
          </ol>
        </div>
      )}
    </figure>
  );
}
