/* One hue for single-series charts; text wears text tokens, never the series color. */
export const CHART = {
  series: "#3b82f6",
  seriesMuted: "#1e3a8a",
  grid: "#27272a",
  axis: "#a1a1aa",
  tooltipBg: "#27272a",
  tooltipBorder: "#71717a",
  text: "#fafafa",
} as const;

export const tooltipStyle = {
  contentStyle: {
    background: CHART.tooltipBg,
    border: `1px solid ${CHART.tooltipBorder}`,
    borderRadius: 6,
    color: CHART.text,
    fontSize: 12,
    padding: "6px 8px",
  },
  itemStyle: { color: CHART.text },
  labelStyle: { color: CHART.axis, marginBottom: 2 },
  cursor: { fill: "rgb(255 255 255 / 0.06)" },
};
