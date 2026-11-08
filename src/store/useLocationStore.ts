import { create } from "zustand";
import type { GymLocation } from "@/types/workout";
import { DEFAULT_PLATES_KG } from "@/data/normalize";
import { newId } from "@/lib/id";

interface LocationState {
  locations: GymLocation[];
  add: (name: string) => GymLocation;
  update: (id: string, patch: Partial<Omit<GymLocation, "id" | "isDefault">>) => void;
  remove: (id: string) => void;
  setDefault: (id: string) => void;
}

/** Exactly one location is the default whenever any exist. */
function withOneDefault(list: GymLocation[]): GymLocation[] {
  if (list.length === 0 || list.some((l) => l.isDefault)) return list;
  return list.map((l, i) => (i === 0 ? { ...l, isDefault: true } : l));
}

export const useLocationStore = create<LocationState>()((set, get) => ({
  locations: [],
  add: (name) => {
    const loc: GymLocation = {
      id: newId(),
      name,
      barWeightKg: 20,
      plateInventoryKg: [...DEFAULT_PLATES_KG],
      isDefault: false,
    };
    set((s) => ({ locations: withOneDefault([...s.locations, loc]) }));
    return get().locations.find((l) => l.id === loc.id) ?? loc;
  },
  update: (id, patch) => set((s) => ({ locations: s.locations.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
  remove: (id) => set((s) => ({ locations: withOneDefault(s.locations.filter((l) => l.id !== id)) })),
  setDefault: (id) => set((s) => ({ locations: s.locations.map((l) => ({ ...l, isDefault: l.id === id })) })),
}));
