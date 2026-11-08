import { create } from "zustand";

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
}

export const useHydration = create<HydrationState>((set) => ({
  hydrated: false,
  durable: true,
  error: null,
  setHydrated: ({ durable, error }) => set({ hydrated: true, durable, error }),
  reportError: (message) => set({ error: message }),
}));
