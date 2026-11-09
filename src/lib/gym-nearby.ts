import type { GymLocation } from "@/types/workout";
import { tunables } from "./tunables";

/** A workout counts as "at" a gym within this distance of its pin (default; see tunables().gyms). */
export const NEARBY_M = 300;

/** Great-circle distance in metres. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The pinned gym closest to `here`, if one is within NEARBY_M (plus the fix's own accuracy). */
export function nearestGym(gyms: GymLocation[], here: { lat: number; lng: number; accuracy?: number }): GymLocation | null {
  const slack = Math.min(here.accuracy ?? 0, 200);
  let best: { gym: GymLocation; d: number } | null = null;
  for (const gym of gyms) {
    if (gym.lat === undefined || gym.lng === undefined) continue;
    const d = distanceM(here, { lat: gym.lat, lng: gym.lng });
    if (d <= tunables().gyms.nearbyM + slack && (!best || d < best.d)) best = { gym, d };
  }
  return best?.gym ?? null;
}
