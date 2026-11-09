import { create } from "zustand";
import type { Exercise, WorkoutSession } from "@/types/workout";
import { HealthSyncService } from "@/lib/health-sync";
import { isNativeApp } from "@/lib/native/files";
import { useSettingsStore } from "./useSettingsStore";

export type HealthSyncState = { state: "sending" } | { state: "sent"; kcal: number } | { state: "failed"; reason: string };

interface HealthSyncStore {
  /** Per workout id, for this app session only: what happened when it was sent. */
  bySession: Record<string, HealthSyncState>;
  send: (session: WorkoutSession, byId: Record<string, Exercise>) => Promise<void>;
}

export const useHealthSyncStore = create<HealthSyncStore>()((set) => ({
  bySession: {},
  send: async (session, byId) => {
    const put = (s: HealthSyncState) => set((st) => ({ bySession: { ...st.bySession, [session.id]: s } }));
    put({ state: "sending" });
    const r = await HealthSyncService.syncWorkoutToHealthApps(session, { byId });
    put(r.ok ? { state: "sent", kcal: r.kcal } : { state: "failed", reason: r.reason });
  },
}));

/**
 * Called on Finish: with Auto-sync on, in the Android app, the workout goes to Health Connect
 * in the background while the summary opens. The summary shows how it went.
 */
export function autoSyncFinished(session: WorkoutSession, byId: Record<string, Exercise>): void {
  if (!isNativeApp() || !useSettingsStore.getState().healthAutoSync) return;
  void useHealthSyncStore.getState().send(session, byId);
}
