"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, tooltipStyle } from "./chartTheme";

export interface WeekPoint {
  label: string;
  value: number;
  display: string;
}

/**
 * Single-series weekly bars. The title asks the question, the bars answer it;
 * the current week is the only direct label so the eye lands on "where am I now".
 */
export function WeeklyBars({
  title,
  points,
  unitLabel,
}: {
  title: string;
  points: WeekPoint[];
  unitLabel: string;
}) {
  const hasData = points.some((p) => p.value > 0);
  return (
    <figure className="rounded-card bg-surface p-3">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      {!hasData ? (
        <p className="py-8 text-center text-sm text-text-muted">
          Nothing in the last {points.length} weeks yet. Finish a workout and this fills in.
        </p>
      ) : (
        <>
          <div className="mt-2 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 16, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: CHART.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  allowDecimals={false}
                  tickFormatter={compactTick}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(_v, _n, item) => [(item.payload as WeekPoint).display, unitLabel]}
                />
                <Bar dataKey="value" fill={CHART.series} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  <LabelList
                    dataKey="display"
                    position="top"
                    content={(p) => {
                      const { x, y, width, index, value } = p as {
                        x: number; y: number; width: number; index: number; value: string;
                      };
                      if (index !== points.length - 1 || points[index]!.value === 0) return null;
                      return (
                        <text x={x + width / 2} y={y - 4} textAnchor="middle" fill={CHART.text} fontSize={11} fontWeight={600}>
                          {value}
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-1">
            <summary className="text-xs text-text-muted hover:text-text">Show as table</summary>
            <table className="mt-2 w-full text-xs">
              <thead className="text-left text-text-muted">
                <tr>
                  <th className="py-1 font-medium">Week of</th>
                  <th className="py-1 text-right font-medium">{unitLabel}</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.label} className="border-t border-line">
                    <td className="py-1">{p.label}</td>
                    <td className="py-1 text-right tabular-nums">{p.display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </figure>
  );
}

/** 1200 -> "1.2k" so axis labels fit the 40px gutter at phone width. */
function compactTick(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return String(v);
}
