/**
 * `<time dateTime>` for a stored timestamp. A value Date cannot hold gives undefined instead of
 * the RangeError toISOString throws, so one bad row cannot take down the screen listing it.
 */
export function isoTime(t: number): string | undefined {
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
