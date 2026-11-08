import { describe, expect, it } from "vitest";
import { distanceM, nearestGym } from "./gym-nearby";
import type { GymLocation } from "@/types/workout";

const gym = (id: string, lat?: number, lng?: number): GymLocation => ({
  id,
  name: id,
  barWeightKg: 20,
  plateInventoryKg: [20],
  isDefault: false,
  ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
});

describe("nearestGym", () => {
  it("measures metres on the ground", () => {
    // 0.001 degrees of latitude is about 111 m.
    expect(Math.round(distanceM({ lat: -6.2, lng: 106.8 }, { lat: -6.201, lng: 106.8 }))).toBe(111);
  });

  it("picks the closest pinned gym within reach and ignores unpinned ones", () => {
    const gyms = [gym("far", -6.21, 106.8), gym("near", -6.2005, 106.8), gym("unpinned")];
    expect(nearestGym(gyms, { lat: -6.2, lng: 106.8 })?.id).toBe("near");
  });

  it("returns nothing away from every gym", () => {
    expect(nearestGym([gym("a", -6.21, 106.8)], { lat: -6.2, lng: 106.8 })).toBeNull();
  });
});
