import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import Dexie from "dexie";
import sample from "../../e2e/fixtures/catalog-sample.json";
import { FEDB_IMAGE_BASE, mapCatalogEntry } from "./catalog";
import { SEED_EXERCISES } from "./exercises";
import { createDexieRepository, createMemoryRepository, type Repository } from "./repo";
import { AbotDB } from "./repo/dexie";

const seedSources = new Set(SEED_EXERCISES.map((e) => e.sourceId!));
const raw = (id: string) => sample.find((x) => x.id === id)!;

describe("mapCatalogEntry", () => {
  it("maps a barbell strength exercise", () => {
    const e = mapCatalogEntry(raw("Zercher_Squats"), seedSources)!;
    expect(e.id).toBe("fedb-Zercher_Squats");
    expect(e.name).toBe("Zercher Squats");
    expect(e.equipment).toBe("barbell");
    expect(e.primaryMuscles).toEqual(["quads"]);
    expect(e.category).toBe("compound");
    expect(e.isCatalog).toBe(true);
    expect(e.isCustom).toBeUndefined();
    // Photos come from the same pinned commit as the rows that ship with the app.
    expect(FEDB_IMAGE_BASE).toMatch(/^https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\/[0-9a-f]{40}\/exercises\/$/);
    expect(e.media.motionUrls).toEqual([`${FEDB_IMAGE_BASE}Zercher_Squats/0.jpg`, `${FEDB_IMAGE_BASE}Zercher_Squats/1.jpg`]);
    expect(e.instructions.length).toBeGreaterThan(0);
    expect(e.instructions.join(" ")).not.toMatch(/—/);
  });
  it("maps cardio, stretching and odd equipment", () => {
    expect(mapCatalogEntry(raw("Bicycling"), seedSources)!.category).toBe("cardio");
    const stretch = mapCatalogEntry(raw("Kneeling_Hip_Flexor"), seedSources)!;
    expect(stretch.category).toBe("mobility");
    expect(stretch.equipment).toBe("bodyweight");
    expect(stretch.isBodyweight).toBe(true);
    expect(mapCatalogEntry(raw("Medicine_Ball_Chest_Pass"), seedSources)!.equipment).toBe("other");
  });
  it("skips exercises already in the seed library", () => {
    expect(mapCatalogEntry(raw("Barbell_Bench_Press_-_Medium_Grip"), seedSources)).toBeNull();
    expect(mapCatalogEntry(raw("EZ-Bar_Curl"), seedSources)).toBeNull();
  });
  it("names the lift first and its tool in brackets", () => {
    const e = mapCatalogEntry({ ...raw("Zercher_Squats"), id: "X", name: "Barbell Rear Delt Row - Wide Grip" }, seedSources)!;
    expect(e.name).toBe("Rear Delt Row, Wide Grip (Barbell)");
  });
  it("rejects entries without a usable muscle or name", () => {
    expect(mapCatalogEntry({ ...raw("Zercher_Squats"), primaryMuscles: ["wings"] }, seedSources)).toBeNull();
    expect(mapCatalogEntry({ ...raw("Zercher_Squats"), name: "" }, seedSources)).toBeNull();
    expect(mapCatalogEntry("junk", seedSources)).toBeNull();
  });
});

describe.each([
  ["memory", () => createMemoryRepository()],
  ["dexie", () => createDexieRepository(`t-${crypto.randomUUID()}`)],
] as [string, () => Repository][])("%s repository catalog table", (_n, make) => {
  it("replaceAll swaps the catalog and snapshot/backup never includes it", async () => {
    const repo = make();
    const a = mapCatalogEntry(raw("Zercher_Squats"), seedSources)!;
    const b = mapCatalogEntry(raw("Bicycling"), seedSources)!;
    await repo.catalog.replaceAll([a, b]);
    await repo.catalog.replaceAll([a]);
    expect((await repo.catalog.all()).map((e) => e.id)).toEqual([a.id]);
    expect(Object.keys(await repo.snapshot())).not.toContain("catalog");
    await repo.catalog.clear();
    expect(await repo.catalog.all()).toEqual([]);
  });
});

describe("Dexie upgrade v1 -> v2", () => {
  it("keeps existing data and adds an empty catalog", async () => {
    const name = `t-${crypto.randomUUID()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ sessions: "id, startedAt, status", routines: "id", exercises: "id", locations: "id", kv: "key" });
    await v1.table("routines").put({ id: "r1", name: "Push", exercises: [], createdAt: 1, updatedAt: 1 });
    v1.close();
    const repo = createDexieRepository(name, new AbotDB(name));
    expect((await repo.routines.all()).map((r) => r.id)).toEqual(["r1"]);
    expect(await repo.catalog.all()).toEqual([]);
  });
});
