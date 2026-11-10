import { create } from "zustand";

/** The Progress range (4, 8 or 12 weeks), shared by the Profile tab and its detail pages. */
export const useProgressRange = create<{ weeks: number; setWeeks: (weeks: number) => void }>()((set) => ({
  weeks: 8,
  setWeeks: (weeks) => set({ weeks }),
}));

export const RANGES = [4, 8, 12] as const;
