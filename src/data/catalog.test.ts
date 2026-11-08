import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import Dexie from "dexie";
import sample from "../../e2e/fixtures/catalog-sample.json";
import { CATALOG_URL, loadCatalog, mapCatalogEntry } from "./catalog";
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
    expect(e.media.motionUrls).toEqual([
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Zercher_Squats/0.jpg",
      "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Zercher_Squats/1.jpg",
    ]);
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
  it("rejects entries without a usable muscle or name", () => {
    expect(mapCatalogEntry({ ...raw("Zercher_Squats"), primaryMuscles: ["wings"] }, seedSources)).toBeNull();
    expect(mapCatalogEntry({ ...raw("Zercher_Squats"), name: "" }, seedSources)).toBeNull();
    expect(mapCatalogEntry("junk", seedSources)).toBeNull();
  });
});

describe("loadCatalog", () => {
  const ok = (body: unknown) => async (url: string) => {
    expect(url).toBe(CATALOG_URL);
    return new Response(JSON.stringify(body), { status: 200 });
  };
  it("stores the mapped entries and returns how many", async () => {
    const repo = createMemoryRepository();
    const rows = await loadCatalog(ok(sample), repo);
    expect(rows.map((r) => r.id).sort()).toEqual([
      "fedb-Bicycling",
      "fedb-Kneeling_Hip_Flexor",
      "fedb-Medicine_Ball_Chest_Pass",
      "fedb-Zercher_Squats",
    ]);
    expect(await repo.catalog.all()).toHaveLength(4);
  });
  it("explains a failed download and leaves the stored catalog alone", async () => {
    const repo = createMemoryRepository();
    await loadCatalog(ok(sample), repo);
    await expect(loadCatalog(async () => new Response("", { status: 503 }), repo)).rejects.toThrow(
      "Could not download the catalog (HTTP 503). Check your connection and try again.",
    );
    await expect(
      loadCatalog(async () => {
        throw new TypeError("Failed to fetch");
      }, repo),
    ).rejects.toThrow("Could not download the catalog. Check your connection and try again.");
    await expect(loadCatalog(ok({ not: "a list" }), repo)).rejects.toThrow("The catalog file was not in the expected format.");
    expect(await repo.catalog.all()).toHaveLength(4);
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
