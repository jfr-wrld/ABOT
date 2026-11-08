/* One hue for single-series charts; text wears text tokens, never the series color. */
export const CHART = {
  series: "#ccff00",
  seriesMuted: "#4d5c12",
  grid: "rgb(255 255 255 / 0.06)",
  axis: "#a1a1aa",
  tooltipBg: "#121215",
  tooltipBorder: "rgb(255 255 255 / 0.15)",
  text: "#f4f4f5",
  surface: "#121215",
} as const;

/** Axis ticks are figures and dates: monospaced like every other number in the app. */
export const numTick = { fill: CHART.axis, fontSize: 11, fontFamily: "var(--font-mono)" } as const;

export const tooltipStyle = {
  contentStyle: {
    background: CHART.tooltipBg,
    border: `1px solid ${CHART.tooltipBorder}`,
    borderRadius: 10,
    color: CHART.text,
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    padding: "6px 8px",
  },
  itemStyle: { color: CHART.text },
  labelStyle: { color: CHART.axis, marginBottom: 2 },
  cursor: { fill: "rgb(255 255 255 / 0.06)" },
};
