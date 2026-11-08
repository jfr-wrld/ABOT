/**
 * Superset letters and colours for a workout, in the order the supersets first appear.
 * A superset needs two exercises; an id left on one exercise is ignored.
 */
export function supersetLabels(
  exercises: { id: string; supersetId?: string }[],
): Record<string, { letter: string; color: number }> {
  const counts = new Map<string, number>();
  for (const e of exercises) if (e.supersetId) counts.set(e.supersetId, (counts.get(e.supersetId) ?? 0) + 1);
  const order: string[] = [];
  const out: Record<string, { letter: string; color: number }> = {};
  for (const e of exercises) {
    if (!e.supersetId || (counts.get(e.supersetId) ?? 0) < 2) continue;
    let i = order.indexOf(e.supersetId);
    if (i < 0) i = order.push(e.supersetId) - 1;
    out[e.id] = { letter: String.fromCharCode(65 + (i % 26)), color: i % SUPERSET_COLORS.length };
  }
  return out;
}

/**
 * Four colours that differ from every other signal in the app (Volt = live, cyan = record,
 * yellow/purple/red = set types). Each is above 6:1 on the Carbon surface.
 */
export const SUPERSET_COLORS = ["#fb923c", "#60a5fa", "#f472b6", "#34d399"] as const;
