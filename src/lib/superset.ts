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

type Linkable = { id: string; supersetId?: string };

/** Puts two items in one superset, joining (or merging) any superset either is already in. */
export function linkSupersetIn<T extends Linkable>(list: T[], id: string, withId: string, newId: () => string): T[] {
  const x = list.find((e) => e.id === id);
  const y = list.find((e) => e.id === withId);
  if (!x || !y || x === y) return list;
  const group = y.supersetId ?? x.supersetId ?? newId();
  const old = new Set([x.supersetId, y.supersetId].filter(Boolean));
  return list.map((e) =>
    e.id === id || e.id === withId || (e.supersetId && old.has(e.supersetId)) ? { ...e, supersetId: group } : e,
  );
}

/** Takes one item out of its superset; a superset left with one item dissolves. */
export function unlinkSupersetIn<T extends Linkable>(list: T[], id: string): T[] {
  const group = list.find((e) => e.id === id)?.supersetId;
  if (!group) return list;
  const remaining = list.filter((e) => e.supersetId === group && e.id !== id).length;
  return list.map((e) => (e.id === id || (remaining < 2 && e.supersetId === group) ? { ...e, supersetId: undefined } : e));
}

/** Removes an item, unlinking it first so no superset is left with a single member. */
export function removeFromList<T extends Linkable>(list: T[], id: string): T[] {
  return unlinkSupersetIn(list, id).filter((e) => e.id !== id);
}
