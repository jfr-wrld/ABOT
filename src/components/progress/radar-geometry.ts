/** Six-axis radar geometry shared by the balance radar and the workout's muscle radar. */

/** Axis i of six at radius r, the first straight up, clockwise. */
export const point = (i: number, r: number) => {
  const a = ((i * 60 - 90) * Math.PI) / 180;
  return [Math.cos(a) * r, Math.sin(a) * r] as const;
};

/** An SVG polygon's points for one radius per axis. */
export const poly = (rs: number[]) => rs.map((r, i) => point(i, r).map((v) => v.toFixed(1)).join(",")).join(" ");
