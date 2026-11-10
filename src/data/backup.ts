import { normalizePhase } from "@/lib/phase-engine";
import { normalizeHandle } from "@/lib/profile";
import type { GymLocation } from "@/types/workout";
import { DEFAULT_SETTINGS, PROFILE_LIMITS, type BodyweightEntry } from "@/types/workout";
import { normalizeRoutine, normalizeSession, normalizeStoredExercise } from "./normalize";
import type { Repository, RepoSnapshot, StoredSettings } from "./repo";
import { mergeLog, type WorkoutPhoto } from "./repo/types";
import { WORKOUT_PHOTO_MAX_BYTES } from "@/lib/photo";
import { parseVideoUrl } from "@/lib/videoUrl";
import { DEFAULT_ENTITLEMENT, type EntitlementState } from "@/lib/entitlements";

export interface AbotBackup {
  app: "ABOT";
  schemaVersion: 1;
  exportedAt: string;
  data: RepoSnapshot;
  /**
   * Workout photos as JPEG data URLs. Optional, so a backup made without them (or by an older
   * ABOT) still reads, and an older ABOT reading this file simply skips them.
   */
  photos?: BackupPhoto[];
}

export interface BackupPhoto {
  id: string;
  sessionId: string;
  createdAt: number;
  width: number;
  height: number;
  /** data:image/jpeg;base64,... */
  data: string;
}

/** Photos per workout, the same limit as the app (components/workout/WorkoutPhotos). */
const PHOTOS_PER_WORKOUT = 6;

export interface BackupCounts {
  sessions: number;
  photos: number;
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

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** The device's workout photos, ready to go into a backup file. */
export async function photosForBackup(rows: WorkoutPhoto[]): Promise<BackupPhoto[]> {
  const out: BackupPhoto[] = [];
  for (const r of rows) {
    const bytes = new Uint8Array(await r.blob.arrayBuffer());
    out.push({ id: r.id, sessionId: r.sessionId, createdAt: r.createdAt, width: r.width, height: r.height, data: `data:image/jpeg;base64,${toBase64(bytes)}` });
  }
  return out;
}

function photoFromBackup(p: BackupPhoto): WorkoutPhoto {
  const bin = atob(p.data.slice(p.data.indexOf(",") + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { id: p.id, sessionId: p.sessionId, createdAt: p.createdAt, width: p.width, height: p.height, blob: new Blob([bytes], { type: "image/jpeg" }) };
}

export function backupFileName(now = new Date()): string {
  const d = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}`;
  return `ABOT_BACKUP_${d}.json`;
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
    language: raw.language === "en" || raw.language === "id" ? raw.language : "auto",
    theme: raw.theme === "dark" || raw.theme === "light" ? raw.theme : "system",
    visualEffects: raw.visualEffects === "full" || raw.visualEffects === "lite" ? raw.visualEffects : "auto",
    tapFeedback: raw.tapFeedback !== false,
    healthAutoSync: raw.healthAutoSync === true,
    lastSleep: normalizeSleep(raw.lastSleep),
    entitlement: normalizeEntitlement(raw.entitlement),
    bodyPhase: normalizePhase(raw.bodyPhase),
    bodyweightKg: inRange(raw.bodyweightKg, PROFILE_LIMITS.bodyweightKg),
    heightCm: inRange(raw.heightCm, PROFILE_LIMITS.heightCm),
    profilePhoto: normalizePhoto(raw.profilePhoto),
  };
}

const TIERS = ["free", "pro", "lifetime"] as const;
const OVERRIDES = ["AUTO", "FORCE_FREE", "FORCE_PRO", "FORCE_BETA"] as const;
const FOUNDER_CODE = /^FOUNDER \/\/ #\d{4}$/;
const isoOrNull = (v: unknown) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null);

/** A file can carry the founder pass across devices; anything malformed falls back to free. */
function normalizeEntitlement(raw: unknown): EntitlementState {
  if (!isObj(raw)) return DEFAULT_ENTITLEMENT;
  const code = typeof raw.founderUnitCode === "string" && FOUNDER_CODE.test(raw.founderUnitCode) ? raw.founderUnitCode : null;
  return {
    tier: TIERS.includes(raw.tier as never) ? (raw.tier as EntitlementState["tier"]) : "free",
    isFounder: raw.isFounder === true && code !== null,
    founderUnitCode: code,
    founderJoinedAt: isoOrNull(raw.founderJoinedAt),
    proExpiresAt: isoOrNull(raw.proExpiresAt),
    licenseSource: raw.licenseSource === "account" || raw.licenseSource === "device" ? raw.licenseSource : null,
    devOverrideMode: OVERRIDES.includes(raw.devOverrideMode as never) ? (raw.devOverrideMode as EntitlementState["devOverrideMode"]) : "AUTO",
  };
}

function normalizeSleep(v: unknown): StoredSettings["lastSleep"] {
  if (!isObj(v) || typeof v.minutes !== "number" || typeof v.endAt !== "number") return null;
  if (!Number.isFinite(v.minutes) || v.minutes <= 0 || v.minutes > 24 * 60 || !Number.isFinite(v.endAt)) return null;
  return { minutes: v.minutes, endAt: v.endAt };
}

/** Only a base64 JPEG/PNG/WebP data URL of photo size; never a link or another media type. */
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
function normalizePhoto(v: unknown): string | null {
  return typeof v === "string" && v.length <= PROFILE_LIMITS.photoMax && PHOTO.test(v) ? v : null;
}

const DAY_ID = /^\d{4}-\d{2}-\d{2}$/;
const BODY_FAT_RANGE = [2, 70] as const;
const WAIST_RANGE = [40, 250] as const;
function normalizeBodyweightLog(raw: unknown): BodyweightEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: BodyweightEntry[] = [];
  for (const e of raw) {
    if (!isObj(e) || typeof e.id !== "string" || !DAY_ID.test(e.id) || typeof e.date !== "number") continue;
    const weightKg = inRange(e.weightKg, PROFILE_LIMITS.bodyweightKg);
    if (weightKg === null) continue;
    const bodyFatPercent = inRange(e.bodyFatPercent, BODY_FAT_RANGE);
    const waistCm = inRange(e.waistCm, WAIST_RANGE);
    out.push({ id: e.id, date: e.date, weightKg, ...(bodyFatPercent !== null ? { bodyFatPercent } : {}), ...(waistCm !== null ? { waistCm } : {}) });
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

const JPEG = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/;
// Base64 is 4/3 the size of the bytes; a little room for photos kept by an earlier limit.
const PHOTO_DATA_MAX = Math.ceil((WORKOUT_PHOTO_MAX_BYTES * 4) / 3) + 64_000;

function normalizeBackupPhoto(raw: unknown): BackupPhoto | null {
  if (!isObj(raw)) return null;
  const { id, sessionId, createdAt, width, height, data } = raw;
  if (typeof id !== "string" || !id || typeof sessionId !== "string" || !sessionId) return null;
  if (typeof data !== "string" || data.length > PHOTO_DATA_MAX || !JPEG.test(data)) return null;
  const dim = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 10_000 ? v : null);
  const w = dim(width);
  const h = dim(height);
  if (w === null || h === null) return null;
  return { id, sessionId, createdAt: typeof createdAt === "number" && Number.isFinite(createdAt) ? createdAt : 0, width: w, height: h, data };
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
  // Only photos of workouts in the file: a photo without its workout has nowhere to show.
  const ids = new Set(sessions.rows.map((x) => x.id));
  const photos = Array.isArray(raw.photos) ? cleanList(raw.photos, (p) => {
    const ok = normalizeBackupPhoto(p);
    return ok && ids.has(ok.sessionId) ? ok : null;
  }) : null;
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
    ...(photos ? { photos: photos.rows } : {}),
  };
  return {
    ok: true,
    backup,
    counts: {
      sessions: sessions.rows.length,
      routines: routines.rows.length,
      exercises: exercises.rows.length,
      locations: locations.rows.length,
      photos: photos?.rows.length ?? 0,
      dropped: sessions.dropped + routines.dropped + exercises.dropped + locations.dropped + (photos?.dropped ?? 0),
    },
  };
}

/**
 * merge: rows from the file are added, and win when the same id exists; nothing local is
 * removed; the current settings and in-progress workout are kept. Gyms keep the device's own
 * default; the file's default is used only when the device has none. One transaction.
 * replace: the device ends up exactly as the file, in-progress workout included.
 * Photos: replace keeps exactly the file's photos when it has any field for them, else the
 * device's photos of workouts that are still there; merge adds the file's photos that are new,
 * up to 6 per workout. Photos are written after the rest, outside its transaction.
 */
export async function importBackup(repo: Repository, backup: AbotBackup, mode: "replace" | "merge"): Promise<void> {
  if (mode === "replace") {
    await repo.replaceAll(backup.data);
    if (backup.photos) {
      await repo.photos.clear();
      for (const p of backup.photos) await repo.photos.add(photoFromBackup(p));
    }
    return;
  }
  await mergeData(repo, backup);
  if (!backup.photos?.length) return;
  const have = await repo.photos.all();
  const known = new Set(have.map((p) => p.id));
  const perSession = new Map<string, number>();
  for (const p of have) perSession.set(p.sessionId, (perSession.get(p.sessionId) ?? 0) + 1);
  for (const p of backup.photos) {
    const n = perSession.get(p.sessionId) ?? 0;
    if (known.has(p.id) || n >= PHOTOS_PER_WORKOUT) continue;
    await repo.photos.add(photoFromBackup(p));
    perSession.set(p.sessionId, n + 1);
  }
}

async function mergeData(repo: Repository, backup: AbotBackup): Promise<void> {
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
