/** The drawn Profile covers (components/profile/coverPresets renders them), by id and name. */
export const COVER_PRESETS = [
  { id: "volt-glow", name: "Volt Glow" },
  { id: "inferno", name: "Inferno" },
  { id: "neon-grid", name: "Neon Grid" },
  { id: "plate-honeycomb", name: "Plate Honeycomb" },
  { id: "brushed-steel", name: "Brushed Steel" },
  { id: "gold-rush", name: "Gold Rush" },
  { id: "sunset-lift", name: "Sunset Lift" },
  { id: "terminal", name: "Terminal" },
  { id: "topography", name: "Topography" },
  { id: "deep-ocean", name: "Deep Ocean" },
] as const;

export type CoverPresetId = (typeof COVER_PRESETS)[number]["id"];
export const COVER_PRESET_IDS: string[] = COVER_PRESETS.map((p) => p.id);

/** What a stored profileCover value is. */
export function coverKind(v: string | null): { kind: "skyline" } | { kind: "preset"; id: CoverPresetId } | { kind: "image"; url: string } {
  if (!v) return { kind: "skyline" };
  if (v.startsWith("preset:")) {
    const id = v.slice(7);
    return COVER_PRESET_IDS.includes(id) ? { kind: "preset", id: id as CoverPresetId } : { kind: "skyline" };
  }
  return v.startsWith("data:image/") ? { kind: "image", url: v } : { kind: "skyline" };
}
