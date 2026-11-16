import { create } from "zustand";
import type { PersistStatus } from "@/lib/storagePersistence";

/**
 * A problem reading or keeping saved data. `kind` picks the message the lifter sees (translated
 * in StorageAlert); `detail` is the browser's own error text, shown folded for support.
 * unreadable: saved data exists but could not be read, so nothing new is saved.
 * memory-only: the browser blocks storage (private mode, storage off), data lasts this tab.
 */
export type StorageIssue = { kind: "unreadable" | "memory-only"; detail: string };
/** A change that could not be written: the device is full, or the write failed otherwise. */
export type WriteIssue = { kind: "full" | "failed"; detail: string };

/**
 * Stores start empty so server and first client render agree. `StoreHydrator` loads
 * them from the repository after mount and flips `hydrated`; pages show a loading state
 * until then. `durable` is false when data only lives in memory (IndexedDB blocked).
 */
interface HydrationState {
  hydrated: boolean;
  durable: boolean;
  error: StorageIssue | null;
  setHydrated: (r: { durable: boolean; error: StorageIssue | null }) => void;
  reportError: (issue: StorageIssue) => void;
  /** Set while some change could not be written; cleared when every retry has succeeded. */
  writeError: WriteIssue | null;
  setWriteError: (issue: WriteIssue | null) => void;
  /** Whether the browser promised not to clear IndexedDB on its own; null until asked. */
  persistStatus: PersistStatus | null;
  setPersistStatus: (s: PersistStatus) => void;
  /** Whether this tab is the one that reads and writes ABOT data (see lib/tabLock). */
  tab: "checking" | "owner" | "elsewhere";
  setTab: (tab: "checking" | "owner" | "elsewhere") => void;
}

export const useHydration = create<HydrationState>((set) => ({
  hydrated: false,
  durable: true,
  error: null,
  setHydrated: ({ durable, error }) => set({ hydrated: true, durable, error }),
  reportError: (issue) => set({ error: issue }),
  writeError: null,
  setWriteError: (writeError) => set({ writeError }),
  persistStatus: null,
  setPersistStatus: (persistStatus) => set({ persistStatus }),
  tab: "checking",
  setTab: (tab) => set({ tab }),
}));
