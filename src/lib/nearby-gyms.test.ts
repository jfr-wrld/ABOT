import { describe, expect, it, vi } from "vitest";
import { NOMINATIM_URL, OVERPASS_URLS, findNearbyGyms, overpassQuery, parseNominatim, parseOverpass, viewbox } from "./nearby-gyms";

const here = { lat: -6.26, lng: 106.81 };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("overpassQuery", () => {
  it("asks for fitness places, and sports centres named or tagged as gyms", () => {
    const q = overpassQuery(-6.26, 106.81, 1500);
    expect(q).toContain('nwr["leisure"="fitness_centre"](around:1500,-6.260000,106.810000);');
    expect(q).toContain('nwr["amenity"="gym"]');
    expect(q).toContain('nwr["leisure"="sports_centre"]["name"~"gym|fitness|crossfit|weightlifting|bodybuilding",i]');
    expect(q).toMatch(/^\[out:json\]/);
  });
});

describe("parseOverpass", () => {
  it("keeps named places, nearest first, with an address when present, and drops duplicates", () => {
    const gyms = parseOverpass(
      {
        elements: [
          { type: "way", id: 2, center: { lat: -6.27, lon: 106.81 }, tags: { name: "Far Gym" } },
          { type: "node", id: 1, lat: -6.2601, lon: 106.8101, tags: { name: "Iron Temple", "addr:street": "Jl. Kemang Raya", "addr:housenumber": "12" } },
          { type: "way", id: 3, center: { lat: -6.26012, lon: 106.81008 }, tags: { name: "Iron Temple" } },
          { type: "node", id: 4, lat: -6.2602, lon: 106.81, tags: {} },
          { type: "node", id: 5, tags: { name: "No position" } },
        ],
      },
      here,
    );
    expect(gyms.map((g) => g.name)).toEqual(["Iron Temple", "Far Gym"]);
    expect(gyms[0]).toMatchObject({ id: "node/1", address: "Jl. Kemang Raya 12" });
    expect(gyms[0]!.distanceM).toBeLessThan(30);
    expect(gyms[1]!.distanceM).toBeGreaterThan(1000);
  });

  it("returns nothing for an unexpected answer", () => {
    expect(parseOverpass(null, here)).toEqual([]);
    expect(parseOverpass({ elements: "x" }, here)).toEqual([]);
  });
});

describe("parseNominatim", () => {
  it("keeps fitness places and gym-named places, with the road as address", () => {
    const gyms = parseNominatim(
      [
        { osm_type: "node", osm_id: 9, name: "Celebrity Fitness", type: "fitness_centre", lat: "-6.2654", lon: "106.7829", address: { road: "Jalan Metro Pondok Indah" } },
        { osm_type: "way", osm_id: 8, name: "Ruang Fitness", type: "yes", lat: "-6.30", lon: "106.84", address: {} },
        { osm_type: "node", osm_id: 7, name: "Gymnasium Park", type: "park", lat: "-6.26", lon: "106.81" },
        { osm_type: "node", osm_id: 6, name: "Toko Buku", type: "books", lat: "-6.26", lon: "106.81" },
        { osm_type: "node", osm_id: 5, name: "", type: "fitness_centre", lat: "-6.26", lon: "106.81" },
      ],
      here,
    );
    // A park named "Gymnasium" matches by name; that is the price of catching gyms mapped as plain buildings.
    expect(gyms.map((g) => g.name)).toEqual(["Gymnasium Park", "Celebrity Fitness", "Ruang Fitness"]);
    expect(gyms[1]).toMatchObject({ id: "node/9", address: "Jalan Metro Pondok Indah" });
    expect(gyms[2]!.address).toBeNull();
  });
});

describe("viewbox", () => {
  it("is left,top,right,bottom about 5 km either side", () => {
    const [l, t, r, b] = viewbox(-6.26, 106.81).split(",").map(Number);
    expect(l).toBeLessThan(106.81);
    expect(r).toBeGreaterThan(106.81);
    expect(t).toBeGreaterThan(-6.26);
    expect(b).toBeLessThan(-6.26);
    expect(r! - l!).toBeCloseTo(0.0905, 2);
  });
});

describe("findNearbyGyms", () => {
  it("asks Overpass with a GET and parses its answer", async () => {
    const fetchFn = vi.fn(async () => json({ elements: [{ type: "node", id: 1, lat: -6.26, lon: 106.81, tags: { name: "A" } }] }));
    const gyms = await findNearbyGyms(here, { fetchFn: fetchFn as unknown as typeof fetch, gapMs: 0 });
    expect(gyms.map((g) => g.name)).toEqual(["A"]);
    const [url] = fetchFn.mock.calls[0] as unknown as [string];
    expect(url.startsWith(`${OVERPASS_URLS[0]}?data=`)).toBe(true);
    expect(decodeURIComponent(url)).toContain("fitness_centre");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("falls back to Nominatim when Overpass does not answer, merging both searches", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchFn = vi.fn(async (url: string) => {
      if (url.startsWith(OVERPASS_URLS[0]!)) throw new TypeError("Failed to fetch");
      const q = new URL(url).searchParams.get("q");
      expect(new URL(url).searchParams.get("bounded")).toBe("1");
      return json(
        q === "gym"
          ? [{ osm_type: "node", osm_id: 1, name: "Gold's Gym", type: "sports_centre", lat: "-6.2916", lon: "106.8009" }]
          : [{ osm_type: "node", osm_id: 2, name: "Fitness First", type: "fitness_centre", lat: "-6.2201", lon: "106.8142" }],
      );
    });
    const gyms = await findNearbyGyms(here, { fetchFn: fetchFn as unknown as typeof fetch, gapMs: 0 });
    expect(gyms.map((g) => g.name).sort()).toEqual(["Fitness First", "Gold's Gym"]);
    expect(fetchFn.mock.calls.filter(([u]) => String(u).startsWith(NOMINATIM_URL))).toHaveLength(2);
    expect(warn).toHaveBeenCalledWith("ABOT nearby gyms:", expect.stringContaining("overpass-api.de Failed to fetch"));
    warn.mockRestore();
  });

  it("says the service is busy only when every source said so, and unreachable otherwise", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(findNearbyGyms(here, { fetchFn: (async () => json({}, 429)) as unknown as typeof fetch, gapMs: 0 })).rejects.toThrow(
      "The map service is busy. Try again in a minute.",
    );
    const mixed = (async (url: string) => (url.startsWith(NOMINATIM_URL) ? json({}, 503) : Promise.reject(new TypeError("offline")))) as unknown as typeof fetch;
    await expect(findNearbyGyms(here, { fetchFn: mixed, gapMs: 0 })).rejects.toThrow(
      "Could not reach the map service. Check your connection and try again.",
    );
    warn.mockRestore();
  });
});
