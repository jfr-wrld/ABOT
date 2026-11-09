/* One hue for single-series charts; text wears text tokens, never the series color. */
// Theme tokens, not fixed hexes, so a chart follows the light theme (and stays dark inside a
// force-dark panel). Chromium, and so Android's WebView, resolves var() in SVG attributes.
export const CHART = {
  series: "var(--color-accent)",
  seriesMuted: "var(--color-accent-dim)",
  grid: "var(--color-line)",
  axis: "var(--color-text-muted)",
  tooltipBg: "var(--color-surface)",
  tooltipBorder: "var(--color-line-hover)",
  text: "var(--color-text)",
  surface: "var(--color-surface)",
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
