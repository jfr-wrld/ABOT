export interface SupersetLabel {
  /** A, B, C... in the order the supersets first appear. */
  letter: string;
  /** Index into SUPERSET_COLORS. */
  color: number;
  /** 1-based place in the group, top to bottom: the 2 of A2. */
  order: number;
  /** Exercises in the group; three or more is a giant set. */
  size: number;
}

/**
 * Superset letters, colours and A1/A2 places for a workout. The order inside a group is the
 * list order, so moving a card renumbers it. A superset needs two exercises; an id left on one
 * exercise is ignored.
 */
export function supersetLabels(exercises: { id: string; supersetId?: string }[]): Record<string, SupersetLabel> {
  const counts = new Map<string, number>();
  for (const e of exercises) if (e.supersetId) counts.set(e.supersetId, (counts.get(e.supersetId) ?? 0) + 1);
  const order: string[] = [];
  const seen = new Map<string, number>();
  const out: Record<string, SupersetLabel> = {};
  for (const e of exercises) {
    const size = e.supersetId ? (counts.get(e.supersetId) ?? 0) : 0;
    if (!e.supersetId || size < 2) continue;
    let i = order.indexOf(e.supersetId);
    if (i < 0) i = order.push(e.supersetId) - 1;
    const place = (seen.get(e.supersetId) ?? 0) + 1;
    seen.set(e.supersetId, place);
    out[e.id] = { letter: String.fromCharCode(65 + (i % 26)), color: i % SUPERSET_COLORS.length, order: place, size };
  }
  return out;
}

/** Where the lifter goes after ticking a set in a superset, with no rest in between. */
export interface SupersetHandoff {
  sessionExerciseId: string;
  /** Index in that exercise's sets of the first set still to do. */
  setIndex: number;
}

/**
 * The next exercise below this one in its superset that still has a set to do, or null when
 * this was the last one with work left: that is when rest starts.
 */
export function supersetNext(
  exercises: { id: string; supersetId?: string; sets: { completed: boolean }[] }[],
  id: string,
): SupersetHandoff | null {
  const idx = exercises.findIndex((e) => e.id === id);
  const group = exercises[idx]?.supersetId;
  if (!group || exercises.filter((e) => e.supersetId === group).length < 2) return null;
  for (const e of exercises.slice(idx + 1)) {
    if (e.supersetId !== group) continue;
    const setIndex = e.sets.findIndex((st) => !st.completed);
    if (setIndex >= 0) return { sessionExerciseId: e.id, setIndex };
  }
  return null;
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
