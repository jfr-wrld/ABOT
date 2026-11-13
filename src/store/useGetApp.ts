import { create } from "zustand";

/** The "Get the app" sheet, opened from the banner, the intro, Settings or a contextual card. */
export const useGetApp = create<{ open: boolean; show: () => void; hide: () => void }>()((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
