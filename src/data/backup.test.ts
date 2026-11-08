import { describe, expect, it } from "vitest";
import { createMemoryRepository, type RepoSnapshot } from "./repo";
import { exportBackup, importBackup, parseBackup } from "./backup";
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
    expect(parsed.counts).toEqual({ sessions: 1, routines: 1, exercises: 0, locations: 0, dropped: 0 });
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
