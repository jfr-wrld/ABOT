import { describe, expect, it, vi } from "vitest";
import { OVERPASS_URL, findNearbyGyms, overpassQuery, parseOverpass } from "./nearby-gyms";

const here = { lat: -6.26, lng: 106.81 };

describe("overpassQuery", () => {
  it("asks for fitness places around the point", () => {
    const q = overpassQuery(-6.26, 106.81, 1500);
    expect(q).toContain('nwr["leisure"="fitness_centre"](around:1500,-6.260000,106.810000);');
    expect(q).toContain('nwr["amenity"="gym"]');
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

describe("findNearbyGyms", () => {
  it("posts the query to Overpass and parses the answer", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ elements: [{ type: "node", id: 1, lat: -6.26, lon: 106.81, tags: { name: "A" } }] })));
    const gyms = await findNearbyGyms(here, { fetchFn: fetchFn as unknown as typeof fetch });
    expect(gyms.map((g) => g.name)).toEqual(["A"]);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OVERPASS_URL);
    expect(init.method).toBe("POST");
    expect(decodeURIComponent(String(init.body))).toContain("fitness_centre");
  });

  it("says the service is busy on an HTTP error, and unreachable when offline", async () => {
    await expect(findNearbyGyms(here, { fetchFn: (async () => new Response("", { status: 429 })) as unknown as typeof fetch })).rejects.toThrow(
      "The map service is busy. Try again in a minute.",
    );
    await expect(findNearbyGyms(here, { fetchFn: (async () => Promise.reject(new TypeError("offline"))) as unknown as typeof fetch })).rejects.toThrow(
      "Could not reach the map service. Check your connection and try again.",
    );
  });
});
