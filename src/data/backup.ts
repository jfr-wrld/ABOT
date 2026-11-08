import { normalizeHandle } from "@/lib/profile";
import type { GymLocation } from "@/types/workout";
import { DEFAULT_SETTINGS, PROFILE_LIMITS, type BodyweightEntry } from "@/types/workout";
import { normalizeRoutine, normalizeSession, normalizeStoredExercise } from "./normalize";
import type { Repository, RepoSnapshot, StoredSettings } from "./repo";
import { mergeLog } from "./repo/types";
import { parseVideoUrl } from "@/lib/videoUrl";

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
  return backupFromSnapshot(await repo.snapshot(), now);
}

/** The app exports what it holds in memory, which includes changes that could not be saved yet. */
export function backupFromSnapshot(data: RepoSnapshot, now = new Date()): AbotBackup {
  return { app: "ABOT", schemaVersion: 1, exportedAt: now.toISOString(), data };
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
    ...(isCoord(raw.lat, 90) && isCoord(raw.lng, 180) ? { lat: raw.lat, lng: raw.lng } : {}),
  };
}

const isCoord = (v: unknown, max: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max;

function normalizeSettings(raw: unknown): StoredSettings | null {
  if (!isObj(raw)) return null;
  return {
    weightUnit: raw.weightUnit === "lbs" ? "lbs" : "kg",
    defaultRestSeconds: typeof raw.defaultRestSeconds === "number" ? raw.defaultRestSeconds : DEFAULT_SETTINGS.defaultRestSeconds,
    restTimerAlert: typeof raw.restTimerAlert === "boolean" ? raw.restTimerAlert : DEFAULT_SETTINGS.restTimerAlert,
    firstDayOfWeek: raw.firstDayOfWeek === 0 ? 0 : 1,
    activeLocationId: typeof raw.activeLocationId === "string" ? raw.activeLocationId : null,
    showRpe: typeof raw.showRpe === "boolean" ? raw.showRpe : true,
    profileName: typeof raw.profileName === "string" ? raw.profileName.trim().slice(0, PROFILE_LIMITS.nameMax) : "",
    profileHandle: typeof raw.profileHandle === "string" ? normalizeHandle(raw.profileHandle) : "",
    bodyweightKg: inRange(raw.bodyweightKg, PROFILE_LIMITS.bodyweightKg),
    heightCm: inRange(raw.heightCm, PROFILE_LIMITS.heightCm),
    profilePhoto: normalizePhoto(raw.profilePhoto),
  };
}

/** Only a base64 JPEG/PNG/WebP data URL of photo size; never a link or another media type. */
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
function normalizePhoto(v: unknown): string | null {
  return typeof v === "string" && v.length <= PROFILE_LIMITS.photoMax && PHOTO.test(v) ? v : null;
}

const DAY_ID = /^\d{4}-\d{2}-\d{2}$/;
function normalizeBodyweightLog(raw: unknown): BodyweightEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: BodyweightEntry[] = [];
  for (const e of raw) {
    if (!isObj(e) || typeof e.id !== "string" || !DAY_ID.test(e.id) || typeof e.date !== "number") continue;
    const weightKg = inRange(e.weightKg, PROFILE_LIMITS.bodyweightKg);
    if (weightKg !== null) out.push({ id: e.id, date: e.date, weightKg });
  }
  return mergeLog([], out);
}

function inRange(v: unknown, [min, max]: readonly [number, number]): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

/** Only links ABOT can actually play survive; anything else (or a script URL) is dropped. */
function normalizeExerciseMedia(raw: unknown): RepoSnapshot["exerciseMedia"] {
  if (!isObj(raw)) return {};
  const out: RepoSnapshot["exerciseMedia"] = {};
  for (const [id, v] of Object.entries(raw)) {
    if (isObj(v) && typeof v.customVideoUrl === "string" && parseVideoUrl(v.customVideoUrl)) {
      out[id] = { customVideoUrl: v.customVideoUrl.trim() };
    }
  }
  return out;
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
      exerciseMedia: normalizeExerciseMedia(data.exerciseMedia),
      bodyweightLog: normalizeBodyweightLog(data.bodyweightLog),
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
 * removed; the current settings and in-progress workout are kept. Gyms keep the device's own
 * default; the file's default is used only when the device has none. One transaction.
 * replace: the device ends up exactly as the file, in-progress workout included.
 */
export async function importBackup(repo: Repository, backup: AbotBackup, mode: "replace" | "merge"): Promise<void> {
  if (mode === "replace") {
    await repo.replaceAll(backup.data);
    return;
  }
  const { sessions, routines, exercises, locations, exerciseMedia, bodyweightLog } = backup.data;
  const local = await repo.locations.all();
  const localDefault = local.find((l) => l.isDefault)?.id;
  const fileDefault = locations.find((l) => l.isDefault)?.id;
  const defaultId = localDefault ?? fileDefault ?? local[0]?.id ?? locations[0]?.id;
  const incomingIds = new Set(locations.map((l) => l.id));
  const merged = [
    ...locations.map((l) => ({ ...l, isDefault: l.id === defaultId })),
    // Local gyms not in the file are rewritten only if their default flag has to change.
    ...local.filter((l) => !incomingIds.has(l.id) && l.isDefault !== (l.id === defaultId)).map((l) => ({ ...l, isDefault: l.id === defaultId })),
  ];
  await repo.mergeAll({ sessions, routines, exercises, locations: merged, exerciseMedia, bodyweightLog });
}
