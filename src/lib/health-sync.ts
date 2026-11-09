import { registerPlugin } from "@capacitor/core";
import type { Exercise, WeightUnit, WorkoutSession } from "@/types/workout";
import { isNativeApp, saveFile, shareFile } from "@/lib/native/files";
import { estimateCalories } from "./calorie-estimator";
import { tcxFileName, workoutToTcx } from "./tcx";
import { useBodyStore } from "@/store/useBodyStore";
import { useSettingsStore } from "@/store/useSettingsStore";

/**
 * Health apps on the phone, through Android Health Connect: the shared store that Google Fit,
 * Samsung Health and Huawei Health (when sharing is on in those apps) read and write. Native
 * side: android/app/src/main/java/app/abot/gym/HealthConnectPlugin.kt. Nothing goes over the
 * network. In a browser there is no Health Connect; the .tcx export works everywhere.
 */

interface HealthConnectNative {
  availability(): Promise<{ status: "available" | "needs_update" | "unavailable" }>;
  checkHealthPermissions(): Promise<{ granted: string[]; all: boolean }>;
  requestHealthPermissions(): Promise<{ granted: string[]; all: boolean }>;
  writeWorkout(opts: { id: string; startMs: number; endMs: number; title: string; notes?: string; kcal: number; version: number }): Promise<{ written: number }>;
  readLatestWeight(): Promise<{ kg?: number; at?: number; source?: string }>;
  readLastSleep(): Promise<{ minutes?: number; startMs?: number; endMs?: number; source?: string }>;
  openHealthConnect(): Promise<void>;
}

// Never resolve a Promise to this object: Capacitor plugin proxies answer `then`.
const HealthConnect = registerPlugin<HealthConnectNative>("HealthConnect");

/**
 * web: a browser, no Health Connect at all. unavailable / needs_update: the phone lacks it or
 * has an old version. disconnected: no access granted yet. partial: some permissions only.
 */
export type HealthStatus = "web" | "unavailable" | "needs_update" | "disconnected" | "partial" | "connected";

/** Every permission granted, or one of the five missing. */
function fromGrant(g: { granted: string[]; all: boolean }): HealthStatus {
  return g.all ? "connected" : g.granted.length > 0 ? "partial" : "disconnected";
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type SyncResult = { ok: true; kcal: number } | { ok: false; reason: string };

export interface PullResult {
  weight: { kg: number; at: number; source?: string } | null;
  sleep: { minutes: number; endAt: number; source?: string } | null;
}

export const HealthSyncService = {
  async status(): Promise<HealthStatus> {
    if (!isNativeApp()) return "web";
    const { status } = await HealthConnect.availability();
    if (status !== "available") return status;
    return fromGrant(await HealthConnect.checkHealthPermissions());
  },

  /** Shows Health Connect's permission screen; returns where things stand afterwards. */
  async requestHealthPermissions(): Promise<HealthStatus> {
    if (!isNativeApp()) return "web";
    const { status } = await HealthConnect.availability();
    if (status !== "available") return status;
    return fromGrant(await HealthConnect.requestHealthPermissions());
  },

  /** Health Connect's settings, or its Play Store page when it is missing or outdated. */
  openHealthConnect(): Promise<void> {
    return HealthConnect.openHealthConnect();
  },

  /**
   * Writes one finished workout as a weightlifting session with its estimated active calories.
   * Safe to repeat: the record is keyed on the workout id, so it is updated, not duplicated.
   */
  async syncWorkoutToHealthApps(workout: WorkoutSession, ctx: { byId: Record<string, Exercise> }): Promise<SyncResult> {
    if (!isNativeApp()) return { ok: false, reason: "Health Connect is only in the Android app" };
    if (workout.status !== "completed" || !workout.finishedAt) return { ok: false, reason: "Only finished workouts are synced" };
    const bodyweightKg = useSettingsStore.getState().bodyweightKg;
    const { kcal } = estimateCalories(workout, { bodyweightKg, byId: ctx.byId });
    try {
      await HealthConnect.writeWorkout({
        id: workout.id,
        startMs: workout.startedAt,
        endMs: Math.max(workout.finishedAt, workout.startedAt + 60_000),
        title: workout.name,
        kcal,
        version: workout.finishedAt,
      });
      return { ok: true, kcal };
    } catch (e) {
      return { ok: false, reason: message(e) };
    }
  },

  /**
   * The latest weigh-in (a smart scale, Huawei or Xiaomi, or any app writing to Health Connect)
   * goes into the body weight log when it is newer than ABOT's own; last night's sleep is kept
   * for the recovery map.
   */
  async pullBodyWeightAndSleep(): Promise<PullResult> {
    if (!isNativeApp()) return { weight: null, sleep: null };
    const [w, s] = await Promise.allSettled([HealthConnect.readLatestWeight(), HealthConnect.readLastSleep()]);
    const out: PullResult = { weight: null, sleep: null };
    if (w.status === "fulfilled" && w.value.kg && w.value.at) {
      out.weight = { kg: Math.round(w.value.kg * 10) / 10, at: w.value.at, source: w.value.source };
      const log = useBodyStore.getState();
      const latest = log.entries[log.entries.length - 1];
      if (!latest || out.weight.at > latest.date) log.logWeight(out.weight.kg, out.weight.at);
    }
    if (s.status === "fulfilled" && s.value.minutes && s.value.endMs) {
      out.sleep = { minutes: s.value.minutes, endAt: s.value.endMs, source: s.value.source };
      useSettingsStore.getState().update({ lastSleep: { minutes: out.sleep.minutes, endAt: out.sleep.endAt } });
    }
    return out;
  },

  exportWorkoutAsTCX(workout: WorkoutSession, ctx: { byId: Record<string, Exercise>; unit: WeightUnit }): { xml: string; fileName: string } {
    const { kcal } = estimateCalories(workout, { bodyweightKg: useSettingsStore.getState().bodyweightKg, byId: ctx.byId });
    return { xml: workoutToTcx(workout, { kcal, byId: ctx.byId, unit: ctx.unit }), fileName: tcxFileName(workout) };
  },

  /** Opens the share sheet with the .tcx (Strava, Huawei Health, Garmin...), or saves it. */
  async shareWorkoutTCX(workout: WorkoutSession, ctx: { byId: Record<string, Exercise>; unit: WeightUnit }): Promise<"shared" | "saved" | "cancelled"> {
    const { xml, fileName } = this.exportWorkoutAsTCX(workout, ctx);
    const file = new File([xml], fileName, { type: "application/vnd.garmin.tcx+xml" });
    const shared = await shareFile(file, { title: fileName, text: workout.name });
    if (shared === "shared" || shared === "cancelled") return shared;
    await saveFile(file, fileName);
    return "saved";
  },
};
