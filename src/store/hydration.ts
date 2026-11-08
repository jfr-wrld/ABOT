import { create } from "zustand";

/**
 * All persisted stores use `skipHydration` so server and first client render agree.
 * `StoreHydrator` rehydrates them after mount and flips this flag; pages show a
 * loading state until then instead of flashing empty data.
 */
interface HydrationState {
  hydrated: boolean;
  error: string | null;
  setHydrated: (error?: string | null) => void;
}

export const useHydration = create<HydrationState>((set) => ({
  hydrated: false,
  error: null,
  setHydrated: (error = null) => set({ hydrated: true, error }),
}));
