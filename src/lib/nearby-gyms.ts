import { distanceM } from "./gym-nearby";

/**
 * Gyms around a point, from OpenStreetMap: free, no key. Owner decision 2026-11-09: the one
 * network call outside sync, sent only when the lifter taps "Find gyms near me", carrying the
 * position and nothing else. Data © OpenStreetMap contributors (ODbL), credited where shown.
 *
 * Overpass answers "what is around this point" exactly, but its public server often refuses or
 * stalls under load, so it gets a short timeout. When it does not answer, Nominatim (OSM's own
 * search, fast and reliable) is asked for "gym" and "fitness" in a box around the point instead.
 */
// The community mirrors were tried too; they stalled or answered 429 as often as not.
export const OVERPASS_URLS = ["https://overpass-api.de/api/interpreter"];
export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
/** Overpass radius. Nominatim's box is a little wider, as OSM coverage is thin in many cities. */
export const NEARBY_SEARCH_M = 3000;
const NOMINATIM_BOX_M = 5000;
const SOURCE_TIMEOUT_MS = 6000;
/** Nominatim's usage policy: at most one request per second. */
const NOMINATIM_GAP_MS = 1100;
const MAX_RESULTS = 15;

const BUSY = "The map service is busy. Try again in a minute.";
const UNREACHABLE = "Could not reach the map service. Check your connection and try again.";

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

const GYM_WORDS = "gym|fitness|crossfit|weightlifting|bodybuilding";

/**
 * Fitness centres and gyms, plus sports centres that are gyms by their sport or their name: many
 * are mapped as a plain sports centre ("Gold's Gym"), with no sport tag.
 */
export function overpassQuery(lat: number, lng: number, radiusM = NEARBY_SEARCH_M): string {
  const around = `(around:${Math.round(radiusM)},${lat.toFixed(6)},${lng.toFixed(6)})`;
  return [
    "[out:json][timeout:10];",
    "(",
    `nwr["leisure"="fitness_centre"]${around};`,
    `nwr["amenity"="gym"]${around};`,
    `nwr["leisure"="sports_centre"]["sport"~"${GYM_WORDS}"]${around};`,
    `nwr["leisure"="sports_centre"]["name"~"${GYM_WORDS}",i]${around};`,
    ");",
    "out center tags 60;",
  ].join("\n");
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Nearest first, one per name and spot (a gym drawn as a point and a building shows twice), at most 15. */
function tidy(found: NearbyGym[]): NearbyGym[] {
  const seen = new Set<string>();
  return found
    .sort((a, b) => a.distanceM - b.distanceM)
    .filter((g) => {
      const key = `${g.name.toLowerCase()}@${Math.round(g.lat * 2000)},${Math.round(g.lng * 2000)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_RESULTS);
}

function gym(id: string, name: string, at: { lat: number; lng: number }, from: { lat: number; lng: number }, street: string, number: string): NearbyGym {
  return { id, name: name.slice(0, 80), ...at, distanceM: Math.round(distanceM(from, at)), address: street ? (number ? `${street} ${number}` : street) : null };
}

/** Overpass JSON: named places only. */
export function parseOverpass(json: unknown, from: { lat: number; lng: number }): NearbyGym[] {
  const elements = isObj(json) && Array.isArray(json.elements) ? json.elements : [];
  const out: NearbyGym[] = [];
  for (const el of elements) {
    if (!isObj(el) || !isObj(el.tags)) continue;
    const name = str(el.tags.name);
    const pos = typeof el.lat === "number" ? el : isObj(el.center) ? el.center : null;
    if (!name || !pos || typeof pos.lat !== "number" || typeof pos.lon !== "number") continue;
    out.push(gym(`${String(el.type)}/${String(el.id)}`, name, { lat: pos.lat, lng: pos.lon }, from, str(el.tags["addr:street"]), str(el.tags["addr:housenumber"])));
  }
  return tidy(out);
}

const FITNESS_TYPES = new Set(["fitness_centre", "gym", "sports_centre", "fitness_station"]);
const GYM_NAME = new RegExp(GYM_WORDS, "i");

/** Nominatim jsonv2 results: fitness places, or anything named like a gym. */
export function parseNominatim(json: unknown, from: { lat: number; lng: number }): NearbyGym[] {
  const rows = Array.isArray(json) ? json : [];
  const out: NearbyGym[] = [];
  for (const r of rows) {
    if (!isObj(r)) continue;
    const name = str(r.name);
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!FITNESS_TYPES.has(str(r.type)) && !GYM_NAME.test(name)) continue;
    const a = isObj(r.address) ? r.address : {};
    out.push(gym(`${str(r.osm_type) || "osm"}/${String(r.osm_id)}`, name, { lat, lng }, from, str(a.road), str(a.house_number)));
  }
  return tidy(out);
}

/** Left, top, right, bottom of a square `halfM` metres either side of the point. */
export function viewbox(lat: number, lng: number, halfM = NOMINATIM_BOX_M): string {
  const dLat = halfM / 111_320;
  const dLng = halfM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat + dLat, lng + dLng, lat - dLat].map((n) => n.toFixed(5)).join(",");
}

type Fetch = typeof fetch;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One GET with its own timeout. Resolves to the parsed JSON, or to why it failed. */
async function getJson(fetchFn: Fetch, url: string, timeoutMs: number): Promise<{ ok: true; json: unknown } | { ok: false; busy: boolean; why: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return { ok: false, busy: res.status === 429 || res.status >= 500, why: `HTTP ${res.status}` };
    return { ok: true, json: await res.json() };
  } catch (e) {
    return { ok: false, busy: false, why: ctrl.signal.aborted ? "timeout" : e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Gyms near `from`: Overpass servers in turn, then Nominatim. Throws a readable Error (a message
 * key) when no source answers; "busy" only when every source said it was overloaded.
 */
export async function findNearbyGyms(
  from: { lat: number; lng: number },
  { fetchFn = (...a: Parameters<Fetch>) => fetch(...a), timeoutMs = SOURCE_TIMEOUT_MS, gapMs = NOMINATIM_GAP_MS }: { fetchFn?: Fetch; timeoutMs?: number; gapMs?: number } = {},
): Promise<NearbyGym[]> {
  const failures: { host: string; busy: boolean; why: string }[] = [];
  const query = encodeURIComponent(overpassQuery(from.lat, from.lng));
  for (const base of OVERPASS_URLS) {
    const r = await getJson(fetchFn, `${base}?data=${query}`, timeoutMs);
    if (r.ok) return parseOverpass(r.json, from);
    failures.push({ host: new URL(base).host, busy: r.busy, why: r.why });
  }

  const box = viewbox(from.lat, from.lng);
  const found: NearbyGym[] = [];
  let answered = false;
  for (const [i, q] of ["gym", "fitness"].entries()) {
    if (i > 0) await sleep(gapMs);
    const params = new URLSearchParams({ q, format: "jsonv2", bounded: "1", viewbox: box, limit: "20", addressdetails: "1" });
    const r = await getJson(fetchFn, `${NOMINATIM_URL}?${params}`, timeoutMs);
    if (r.ok) {
      answered = true;
      found.push(...parseNominatim(r.json, from));
    } else failures.push({ host: "nominatim.openstreetmap.org", busy: r.busy, why: r.why });
  }
  if (failures.length > 0) console.warn("ABOT nearby gyms:", failures.map((f) => `${f.host} ${f.why}`).join("; "));
  if (answered) return tidy(found);
  throw new Error(failures.every((f) => f.busy) ? BUSY : UNREACHABLE);
}
