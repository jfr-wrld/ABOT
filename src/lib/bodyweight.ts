import type { BodyweightEntry } from "@/types/workout";

const DAY = 86_400_000;

/** Local calendar day as "YYYY-MM-DD": the id of that day's weigh-in. */
export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Adds or replaces that day's entry; the result is sorted oldest first. */
export function upsertEntry(list: BodyweightEntry[], entry: BodyweightEntry): BodyweightEntry[] {
  return [...list.filter((e) => e.id !== entry.id), entry].sort((a, b) => a.date - b.date);
}

/**
 * Latest minus earliest weigh-in within the last `days`; null with fewer than two. Only old
 * entries are cut: a weigh-in just after `now` is real (callers' clocks tick coarsely).
 */
export function changeOver(list: BodyweightEntry[], days: number, now: number): number | null {
  const inWindow = list.filter((e) => e.date >= now - days * DAY).sort((a, b) => a.date - b.date);
  if (inWindow.length < 2) return null;
  return inWindow[inWindow.length - 1]!.weightKg - inWindow[0]!.weightKg;
}
