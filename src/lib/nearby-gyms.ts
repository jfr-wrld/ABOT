import { distanceM } from "./gym-nearby";

/**
 * Gyms around a point, from OpenStreetMap through the public Overpass API: free, no key.
 * Owner decision 2026-11-09: the one network call outside sync, sent only when the lifter taps
 * "Find gyms near me", and it carries the position and nothing else. Data © OpenStreetMap
 * contributors (ODbL), credited where the list is shown.
 */
export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
export const NEARBY_SEARCH_M = 2000;
const MAX_RESULTS = 15;

export interface NearbyGym {
  /** OSM element, e.g. "node/123". */
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceM: number;
  /** "Jl. Kemang Raya 12", when the map has it. */
  address: string | null;
}

/** Fitness centres, gyms and sports centres with a fitness sport, within `radiusM`. */
export function overpassQuery(lat: number, lng: number, radiusM = NEARBY_SEARCH_M): string {
  const around = `(around:${Math.round(radiusM)},${lat.toFixed(6)},${lng.toFixed(6)})`;
  return [
    "[out:json][timeout:15];",
    "(",
    `nwr["leisure"="fitness_centre"]${around};`,
    `nwr["amenity"="gym"]${around};`,
    `nwr["leisure"="sports_centre"]["sport"~"fitness|weightlifting|crossfit|bodybuilding"]${around};`,
    ");",
    "out center tags 60;",
  ].join("\n");
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Named places only, nearest first, one per name and spot, at most 15. */
export function parseOverpass(json: unknown, from: { lat: number; lng: number }): NearbyGym[] {
  const elements = isObj(json) && Array.isArray(json.elements) ? json.elements : [];
  const out: NearbyGym[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    if (!isObj(el) || !isObj(el.tags)) continue;
    const name = typeof el.tags.name === "string" ? el.tags.name.trim().slice(0, 80) : "";
    const pos = typeof el.lat === "number" ? el : isObj(el.center) ? el.center : null;
    if (!name || !pos || typeof pos.lat !== "number" || typeof pos.lon !== "number") continue;
    const at = { lat: pos.lat, lng: pos.lon };
    const d = distanceM(from, at);
    // A gym drawn as both a point and a building shows up twice; keep one.
    const key = `${name.toLowerCase()}@${Math.round(at.lat * 2000)},${Math.round(at.lng * 2000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const street = typeof el.tags["addr:street"] === "string" ? el.tags["addr:street"] : null;
    const number = typeof el.tags["addr:housenumber"] === "string" ? el.tags["addr:housenumber"] : null;
    out.push({ id: `${String(el.type)}/${String(el.id)}`, name, ...at, distanceM: Math.round(d), address: street ? (number ? `${street} ${number}` : street) : null });
  }
  return out.sort((a, b) => a.distanceM - b.distanceM).slice(0, MAX_RESULTS);
}

/** Throws a readable Error (a message key) when the map service cannot be reached. */
export async function findNearbyGyms(
  from: { lat: number; lng: number },
  { radiusM = NEARBY_SEARCH_M, fetchFn = fetch, timeoutMs = 20_000 }: { radiusM?: number; fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<NearbyGym[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(overpassQuery(from.lat, from.lng, radiusM))}`,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error("The map service is busy. Try again in a minute.");
    return parseOverpass(await res.json(), from);
  } catch (e) {
    if (e instanceof Error && e.message === "The map service is busy. Try again in a minute.") throw e;
    throw new Error("Could not reach the map service. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}
