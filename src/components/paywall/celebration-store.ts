import { create } from "zustand";
import type { Unlocked } from "@/lib/celebration";

/** Which purchase to celebrate. Kept apart from ProCelebration so the screen loads only when shown. */
export const useCelebrationStore = create<{ unlocked: Unlocked | null; show: (u: Unlocked) => void; close: () => void }>()((set) => ({
  unlocked: null,
  show: (unlocked) => set({ unlocked }),
  close: () => set({ unlocked: null }),
}));
