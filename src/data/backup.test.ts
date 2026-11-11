import { describe, expect, it } from "vitest";
import { createMemoryRepository, type RepoSnapshot } from "./repo";
import { exportBackup, importBackup, parseBackup, photosForBackup } from "./backup";
import type { WorkoutSession } from "@/types/workout";

const session = (id: string, name = id): WorkoutSession => ({
  id,
  name,
  startedAt: 1000,
  finishedAt: 2000,
  status: "completed",
  exercises: [
    {
      id: `${id}-e`,
      exerciseId: "squat-barbell",
      restSeconds: 90,
      sets: [{ id: `${id}-s`, type: "normal", weightKg: 100, reps: 5, rpe: null, completed: true }],
    },
  ],
});
const live = (id: string): WorkoutSession => ({ ...session(id), status: "active", finishedAt: undefined });

async function seeded() {
  const repo = createMemoryRepository();
  await repo.sessions.put(session("a"));
  await repo.routines.put({ id: "r1", name: "Push", exercises: [], createdAt: 1, updatedAt: 1 });
  await repo.kv.set("activeWorkout", live("current"));
  return repo;
}

describe("export and parse", () => {
  it("round trips the snapshot", async () => {
    const repo = await seeded();
    const backup = await exportBackup(repo);
    expect(backup.app).toBe("ABOT");
    expect(backup.schemaVersion).toBe(1);
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.data).toEqual(await repo.snapshot());
    expect(parsed.counts).toEqual({ sessions: 1, routines: 1, exercises: 0, locations: 0, photos: 0, dropped: 0 });
  });

  it("keeps language and theme, and falls back for unknown values", async () => {
    const repo = await seeded();
    const backup = await exportBackup(repo);
    const settings = (lang: unknown, theme: unknown) => {
      const raw = JSON.parse(JSON.stringify(backup));
      raw.data.settings = { ...(raw.data.settings ?? {}), language: lang, theme };
      const parsed = parseBackup(JSON.stringify(raw));
      if (!parsed.ok) throw new Error(parsed.error);
      return parsed.backup.data.settings;
    };
    expect(settings("id", "light")).toMatchObject({ language: "id", theme: "light" });
    expect(settings("fr", 3)).toMatchObject({ language: "auto", theme: "system" });
  });

  it("never restores a paid tier from a file, only the founder pass", async () => {
    const repo = await seeded();
    const raw = JSON.parse(JSON.stringify(await exportBackup(repo)));
    raw.data.settings = {
      ...(raw.data.settings ?? {}),
      entitlement: { tier: "lifetime", licenseSource: "account", devOverrideMode: "FORCE_PRO", proExpiresAt: null, isFounder: true, founderUnitCode: "FOUNDER // #0042", founderJoinedAt: "2026-11-01T00:00:00Z" },
    };
    const parsed = parseBackup(JSON.stringify(raw));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.data.settings?.entitlement).toMatchObject({ tier: "free", licenseSource: null, devOverrideMode: "AUTO", isFounder: true, founderUnitCode: "FOUNDER // #0042" });
  });

  it("rejects text that is not JSON", () => {
    expect(parseBackup("not json")).toEqual({ ok: false, error: "This file is not valid JSON" });
  });

  it("rejects JSON from another app", () => {
    expect(parseBackup(JSON.stringify({ app: "Other" }))).toEqual({ ok: false, error: "This is not an ABOT backup" });
  });

  it("rejects a backup from a newer version", () => {
    expect(parseBackup(JSON.stringify({ app: "ABOT", schemaVersion: 2, data: {} }))).toEqual({
      ok: false,
      error: "This backup was made by a newer version of ABOT",
    });
  });

  it("drops malformed rows and counts them instead of failing", () => {
    const text = JSON.stringify({
      app: "ABOT",
      schemaVersion: 1,
      exportedAt: "2026-11-08T00:00:00.000Z",
      data: { sessions: [session("ok"), { name: "no id" }], routines: [], exercises: [], locations: [], settings: null, activeWorkout: null },
    });
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.counts.sessions).toBe(1);
    expect(parsed.counts.dropped).toBe(1);
  });
});

describe("importBackup", () => {
  const incoming = (): RepoSnapshot => ({
    sessions: [session("a", "renamed"), session("b")],
    routines: [],
    exercises: [],
    locations: [],
    settings: null,
    activeWorkout: live("from-file"),
    exerciseMedia: {},
    bodyweightLog: [],
  });
  const backupOf = (data: RepoSnapshot) => ({ app: "ABOT" as const, schemaVersion: 1 as const, exportedAt: "x", data });

  it("merge keeps existing rows, lets the file win on id conflicts, and keeps the active workout", async () => {
    const repo = await seeded();
    await importBackup(repo, backupOf(incoming()), "merge");
    const snap = await repo.snapshot();
    expect(snap.sessions.map((s) => `${s.id}:${s.name}`).sort()).toEqual(["a:renamed", "b:b"]);
    expect(snap.routines.map((r) => r.id)).toEqual(["r1"]);
    expect(snap.activeWorkout?.id).toBe("current");
  });

  it("replace swaps everything, including the active workout", async () => {
    const repo = await seeded();
    await importBackup(repo, backupOf(incoming()), "replace");
    const snap = await repo.snapshot();
    expect(snap.sessions.map((s) => s.id).sort()).toEqual(["a", "b"]);
    expect(snap.routines).toEqual([]);
    expect(snap.activeWorkout?.id).toBe("from-file");
  });
});

describe("merge keeps a single default gym (final review #5)", () => {
  const gym = (id: string, isDefault: boolean) => ({
    id,
    name: id,
    barWeightKg: 20,
    plateInventoryKg: [20],
    isDefault,
  });
  const backupOf = (locations: ReturnType<typeof gym>[]) => ({
    app: "ABOT" as const,
    schemaVersion: 1 as const,
    exportedAt: "x",
    data: { sessions: [], routines: [], exercises: [], locations, settings: null, activeWorkout: null, exerciseMedia: {}, bodyweightLog: [] },
  });

  it("re-merging your own backup keeps the local default gym", async () => {
    const repo = createMemoryRepository();
    await repo.locations.put(gym("home", true));
    await repo.locations.put(gym("work", false));
    await importBackup(repo, backupOf([gym("home", true), gym("work", false)]), "merge");
    const locs = await repo.locations.all();
    expect(locs.filter((l) => l.isDefault).map((l) => l.id)).toEqual(["home"]);
  });

  it("a device with no gyms gets the file's default", async () => {
    const repo = createMemoryRepository();
    await importBackup(repo, backupOf([gym("a", false), gym("b", true)]), "merge");
    const locs = await repo.locations.all();
    expect(locs.filter((l) => l.isDefault).map((l) => l.id)).toEqual(["b"]);
  });

  it("new gyms from the file never take the default from a local one", async () => {
    const repo = createMemoryRepository();
    await repo.locations.put(gym("home", true));
    await importBackup(repo, backupOf([gym("other", true)]), "merge");
    const locs = await repo.locations.all();
    expect(locs.filter((l) => l.isDefault).map((l) => l.id)).toEqual(["home"]);
  });
});

describe("custom videos in backups", () => {
  it("keep valid links and drop anything that is not a supported video", () => {
    const text = JSON.stringify({
      app: "ABOT",
      schemaVersion: 1,
      exportedAt: "x",
      data: {
        sessions: [], routines: [], exercises: [], locations: [], settings: null, activeWorkout: null,
        exerciseMedia: {
          "bench-press-barbell": { customVideoUrl: "https://youtu.be/dQw4w9WgXcQ" },
          "squat-barbell": { customVideoUrl: "javascript:alert(1)" },
          "push-up": "nope",
        },
      },
    });
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.data.exerciseMedia).toEqual({ "bench-press-barbell": { customVideoUrl: "https://youtu.be/dQw4w9WgXcQ" } });
  });
  it("an older backup without the field parses to no custom videos", () => {
    const parsed = parseBackup(JSON.stringify({ app: "ABOT", schemaVersion: 1, exportedAt: "x", data: { sessions: [] } }));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.data.exerciseMedia).toEqual({});
  });
});

describe("profile fields in backups", () => {
  const withSettings = (settings: Record<string, unknown>) =>
    JSON.stringify({
      app: "ABOT",
      schemaVersion: 1,
      exportedAt: "2026-11-08T00:00:00.000Z",
      data: { sessions: [], routines: [], exercises: [], locations: [], settings, activeWorkout: null },
    });

  it("keeps a valid name, bodyweight and height", () => {
    const parsed = parseBackup(withSettings({ profileName: "  Jafar  ", bodyweightKg: 72.5, heightCm: 170 }));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.data.settings).toMatchObject({ profileName: "Jafar", bodyweightKg: 72.5, heightCm: 170 });
  });

  it("drops impossible values and defaults missing ones (older backups)", () => {
    const parsed = parseBackup(withSettings({ profileName: 5, bodyweightKg: -3, heightCm: 900 }));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.data.settings).toMatchObject({ profileName: "", bodyweightKg: null, heightCm: null });
  });
});

describe("bodyweight log and photo in backups", () => {
  const file = (data: Record<string, unknown>) =>
    JSON.stringify({
      app: "ABOT",
      schemaVersion: 1,
      exportedAt: "2026-11-08T00:00:00.000Z",
      data: { sessions: [], routines: [], exercises: [], locations: [], settings: null, activeWorkout: null, ...data },
    });

  it("keeps valid entries and drops broken ones", () => {
    const parsed = parseBackup(
      file({
        bodyweightLog: [
          { id: "2026-11-01", date: 1, weightKg: 80 },
          { id: "2026-11-02", date: 2, weightKg: -5 },
          { id: "not a day", date: 3, weightKg: 80 },
          "junk",
        ],
      }),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.data.bodyweightLog).toEqual([{ id: "2026-11-01", date: 1, weightKg: 80 }]);
  });

  it("an older backup without a log gets an empty one", () => {
    const parsed = parseBackup(file({}));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.data.bodyweightLog).toEqual([]);
  });

  it("keeps a small image photo and drops anything that is not one", () => {
    const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    const ok = parseBackup(file({ settings: { profilePhoto: jpeg } }));
    if (!ok.ok) throw new Error(ok.error);
    expect(ok.backup.data.settings?.profilePhoto).toBe(jpeg);
    for (const bad of ["javascript:alert(1)", "data:text/html;base64,PGI+", "https://x.test/a.jpg", `data:image/jpeg;base64,${"A".repeat(500_000)}`]) {
      const p = parseBackup(file({ settings: { profilePhoto: bad } }));
      if (!p.ok) throw new Error(p.error);
      expect(p.backup.data.settings?.profilePhoto).toBeNull();
    }
  });
});

describe("workout photos in backups", () => {
  const jpeg = (text: string) => new Blob([text], { type: "image/jpeg" });
  const photo = (id: string, sessionId: string, createdAt = 1) => ({ id, sessionId, createdAt, width: 4, height: 3, blob: jpeg(`bytes-${id}`) });

  async function withPhotos() {
    const repo = await seeded();
    await repo.photos.add(photo("p1", "a", 1));
    await repo.photos.add(photo("p2", "a", 2));
    return repo;
  }

  it("round trips photos with their bytes, and counts them", async () => {
    const src = await withPhotos();
    const backup = { ...(await exportBackup(src)), photos: await photosForBackup(await src.photos.all()) };
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.counts.photos).toBe(2);

    const dest = createMemoryRepository();
    await importBackup(dest, parsed.backup, "replace");
    const got = await dest.photos.list("a");
    expect(got.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(await got[0]!.blob.text()).toBe("bytes-p1");
    expect(got[0]!.blob.type).toBe("image/jpeg");
  });

  it("skips photos of workouts not in the file, and malformed ones", async () => {
    const backup = { ...(await exportBackup(await seeded())), photos: [] as unknown[] };
    const good = (await photosForBackup([photo("ok", "a")]))[0]!;
    backup.photos.push(good, { ...good, id: "orphan", sessionId: "missing" }, { ...good, id: "bad", data: "data:text/html;base64,PGI+" }, { ...good, id: "big", width: -1 });
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.photos!.map((p) => p.id)).toEqual(["ok"]);
    expect(parsed.counts.photos).toBe(1);
    expect(parsed.counts.dropped).toBe(3);
  });

  it("merge adds new photos up to 6 per workout and keeps the ones here", async () => {
    const dest = await withPhotos();
    const src = await seeded();
    for (let i = 0; i < 6; i++) await src.photos.add(photo(`n${i}`, "a", 10 + i));
    await src.photos.add(photo("p1", "a", 1));
    const backup = { ...(await exportBackup(src)), photos: await photosForBackup(await src.photos.all()) };
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.error);
    await importBackup(dest, parsed.backup, "merge");
    const ids = (await dest.photos.list("a")).map((p) => p.id);
    expect(ids).toHaveLength(6);
    expect(ids.slice(0, 2)).toEqual(["p1", "p2"]);
  });

  it("a backup without photos replaces the data but keeps photos of workouts still here", async () => {
    const dest = await withPhotos();
    const parsed = parseBackup(JSON.stringify(await exportBackup(await seeded())));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.backup.photos).toBeUndefined();
    await importBackup(dest, parsed.backup, "replace");
    expect((await dest.photos.list("a")).map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("a backup with photos replaces the photos too", async () => {
    const dest = await withPhotos();
    const src = await seeded();
    await src.photos.add(photo("only", "a"));
    const backup = { ...(await exportBackup(src)), photos: await photosForBackup(await src.photos.all()) };
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.error);
    await importBackup(dest, parsed.backup, "replace");
    expect((await dest.photos.list("a")).map((p) => p.id)).toEqual(["only"]);
  });
});

describe("devicePrefs (reminders and live notification)", () => {
  const schedule = {
    enabled: true,
    time: "06:15",
    leadMinutes: 15 as const,
    days: { 0: { on: false, routineId: null }, 1: { on: true, routineId: "r1" }, 2: { on: false, routineId: null }, 3: { on: true, routineId: null }, 4: { on: false, routineId: null }, 5: { on: true, routineId: "r2" }, 6: { on: false, routineId: null } },
  };
  const file = (devicePrefs: unknown) => JSON.stringify({ app: "ABOT", schemaVersion: 1, exportedAt: "", data: {}, devicePrefs });

  it("round-trips the reminder week, the live status switch and the capsule look", () => {
    const prefs = { reminders: schedule, liveStatus: false, capsule: { mode: "rest", detail: "volume" } };
    const parsed = parseBackup(file(prefs));
    expect(parsed.ok && parsed.backup.devicePrefs).toEqual(prefs);
  });

  it("keeps the valid parts and drops an unreadable one", () => {
    const parsed = parseBackup(file({ reminders: { ...schedule, time: "25:00" }, liveStatus: true, capsule: { mode: "loud", detail: "set" } }));
    expect(parsed.ok && parsed.backup.devicePrefs).toEqual({ liveStatus: true });
  });

  it("an older file without them reads as before", () => {
    const parsed = parseBackup(JSON.stringify({ app: "ABOT", schemaVersion: 1, exportedAt: "", data: {} }));
    expect(parsed.ok && parsed.backup.devicePrefs).toBeUndefined();
  });
});
