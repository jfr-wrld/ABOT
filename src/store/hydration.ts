import { create } from "zustand";
import type { PersistStatus } from "@/lib/storagePersistence";

/**
 * Stores start empty so server and first client render agree. `StoreHydrator` loads
 * them from the repository after mount and flips `hydrated`; pages show a loading state
 * until then. `durable` is false when data only lives in memory (IndexedDB blocked).
 */
interface HydrationState {
  hydrated: boolean;
  durable: boolean;
  error: string | null;
  setHydrated: (r: { durable: boolean; error: string | null }) => void;
  reportError: (message: string) => void;
  /** Set while some change could not be written; cleared when every retry has succeeded. */
  writeError: string | null;
  setWriteError: (message: string | null) => void;
  /** Whether the browser promised not to clear IndexedDB on its own; null until asked. */
  persistStatus: PersistStatus | null;
  setPersistStatus: (s: PersistStatus) => void;
}

export const useHydration = create<HydrationState>((set) => ({
  hydrated: false,
  durable: true,
  error: null,
  setHydrated: ({ durable, error }) => set({ hydrated: true, durable, error }),
  reportError: (message) => set({ error: message }),
  writeError: null,
  setWriteError: (writeError) => set({ writeError }),
  persistStatus: null,
  setPersistStatus: (persistStatus) => set({ persistStatus }),
}));
