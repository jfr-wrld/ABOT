"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MuscleGroup } from "@/types/workout";
import { MUSCLE_GROUP_LABELS } from "@/types/workout";
import { CHART, tooltipStyle } from "./chartTheme";

/**
 * Horizontal bars, sorted by sets, one hue: the reader's question is
 * "which muscles did I train most, and which did I skip", and a ranked
 * bar answers that faster than a radar's area does.
 */
export function MuscleSplit({ title, split }: { title: string; split: Partial<Record<MuscleGroup, number>> }) {
  const rows = (Object.entries(split) as [MuscleGroup, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([m, v]) => ({ label: MUSCLE_GROUP_LABELS[m], sets: Math.round(v * 2) / 2, display: formatSets(v) }));

  return (
    <figure className="panel p-3">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      <p className="text-xs text-text-muted">Working sets; secondary muscles count half.</p>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          No working sets in this range. Sets you tick during a workout are counted here by muscle.
        </p>
      ) : (
        <div className="mt-2" style={{ height: 28 * rows.length + 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }} barCategoryGap={4}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                width={88}
                tick={{ fill: CHART.text, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip {...tooltipStyle} formatter={(_v, _n, item) => [(item.payload as { display: string }).display, "sets"]} />
              <Bar dataKey="sets" fill={CHART.series} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                <LabelList
                  dataKey="display"
                  position="right"
                  style={{ fill: CHART.text, fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}

function formatSets(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
