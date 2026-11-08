import type { GymLocation } from "@/types/workout";
import { DEFAULT_SETTINGS } from "@/types/workout";
import { normalizeRoutine, normalizeSession, normalizeStoredExercise } from "./normalize";
import type { Repository, RepoSnapshot, StoredSettings } from "./repo";

export interface AbotBackup {
  app: "ABOT";
  schemaVersion: 1;
  exportedAt: string;
  data: RepoSnapshot;
}

export interface BackupCounts {
  sessions: number;
  routines: number;
  exercises: number;
  locations: number;
  /** Rows in the file that were malformed and skipped. */
  dropped: number;
}

export async function exportBackup(repo: Repository, now = new Date()): Promise<AbotBackup> {
  return { app: "ABOT", schemaVersion: 1, exportedAt: now.toISOString(), data: await repo.snapshot() };
}

export function backupFileName(now = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `abot-backup-${d}.json`;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function normalizeLocation(raw: unknown): GymLocation | null {
  if (!isObj(raw) || typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  const plates = Array.isArray(raw.plateInventoryKg)
    ? raw.plateInventoryKg.filter((p): p is number => typeof p === "number" && p > 0)
    : [];
  return {
    id: raw.id,
    name: raw.name,
    barWeightKg: typeof raw.barWeightKg === "number" && raw.barWeightKg >= 0 ? raw.barWeightKg : 20,
    plateInventoryKg: plates,
    isDefault: raw.isDefault === true,
  };
}

function normalizeSettings(raw: unknown): StoredSettings | null {
  if (!isObj(raw)) return null;
  return {
    weightUnit: raw.weightUnit === "lbs" ? "lbs" : "kg",
    defaultRestSeconds: typeof raw.defaultRestSeconds === "number" ? raw.defaultRestSeconds : DEFAULT_SETTINGS.defaultRestSeconds,
    restTimerAlert: typeof raw.restTimerAlert === "boolean" ? raw.restTimerAlert : DEFAULT_SETTINGS.restTimerAlert,
    firstDayOfWeek: raw.firstDayOfWeek === 0 ? 0 : 1,
    activeLocationId: typeof raw.activeLocationId === "string" ? raw.activeLocationId : null,
    showRpe: typeof raw.showRpe === "boolean" ? raw.showRpe : true,
  };
}

function cleanList<T>(raw: unknown, fn: (x: unknown) => T | null): { rows: T[]; dropped: number } {
  const input = Array.isArray(raw) ? raw : [];
  const rows = input.map(fn).filter((x): x is T => x !== null);
  return { rows, dropped: input.length - rows.length };
}

export function parseBackup(
  text: string,
): { ok: true; backup: AbotBackup; counts: BackupCounts } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON" };
  }
  if (!isObj(raw) || raw.app !== "ABOT") return { ok: false, error: "This is not an ABOT backup" };
  if (typeof raw.schemaVersion !== "number" || raw.schemaVersion > 1) {
    return { ok: false, error: "This backup was made by a newer version of ABOT" };
  }
  const data = isObj(raw.data) ? raw.data : {};
  const sessions = cleanList(data.sessions, normalizeSession);
  const routines = cleanList(data.routines, normalizeRoutine);
  const exercises = cleanList(data.exercises, normalizeStoredExercise);
  const locations = cleanList(data.locations, normalizeLocation);
  const active = data.activeWorkout ? normalizeSession(data.activeWorkout) : null;
  const backup: AbotBackup = {
    app: "ABOT",
    schemaVersion: 1,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "",
    data: {
      sessions: sessions.rows,
      routines: routines.rows,
      exercises: exercises.rows,
      locations: locations.rows,
      settings: normalizeSettings(data.settings),
      activeWorkout: active ? { ...active, status: "active" } : null,
    },
  };
  return {
    ok: true,
    backup,
    counts: {
      sessions: sessions.rows.length,
      routines: routines.rows.length,
      exercises: exercises.rows.length,
      locations: locations.rows.length,
      dropped: sessions.dropped + routines.dropped + exercises.dropped + locations.dropped,
    },
  };
}

/**
 * merge: rows from the file are added, and win when the same id exists; nothing local is
 * removed; the current settings and in-progress workout are kept.
 * replace: the device ends up exactly as the file, in-progress workout included.
 */
export async function importBackup(repo: Repository, backup: AbotBackup, mode: "replace" | "merge"): Promise<void> {
  if (mode === "replace") {
    await repo.replaceAll(backup.data);
    return;
  }
  const { sessions, routines, exercises, locations } = backup.data;
  for (const s of sessions) await repo.sessions.put(s);
  for (const r of routines) await repo.routines.put(r);
  for (const e of exercises) await repo.exercises.put(e);
  for (const l of locations) await repo.locations.put({ ...l, isDefault: false });
}
