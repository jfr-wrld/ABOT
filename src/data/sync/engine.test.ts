import { describe, expect, it } from "vitest";
import { createMemoryRepository } from "@/data/repo";
import type { Repository } from "@/data/repo";
import type { Routine, WorkoutSession } from "@/types/workout";
import { syncOnce } from "./engine";
import { createFakeRemote } from "./fakeRemote";

const routine = (id: string, name = id): Routine => ({ id, name, exercises: [], createdAt: 1, updatedAt: 1 });
const session = (id: string): WorkoutSession => ({ id, name: id, startedAt: 1, finishedAt: 2, status: "completed", exercises: [] });
const pendingKeys = async (repo: Repository) => (await repo.sync.pending()).map((r) => `${r.kind}:${r.id}`).sort();
const T = 1_000_000_000_000; // the sync clock; only lastSyncedAt and tombstone purging read it

describe("syncOnce", () => {
  it("a fresh device pulls everything into an empty repository", async () => {
    const remote = createFakeRemote();
    remote.seed({ kind: "routine", id: "r", payload: routine("r"), updatedAt: 10, deleted: false });
    remote.seed({ kind: "session", id: "s", payload: session("s"), updatedAt: 11, deleted: false });
    const repo = createMemoryRepository();
    const res = await syncOnce(repo, remote, T);
    expect(res).toMatchObject({ pulled: 2, pushed: 0, conflicts: 0, changedLocal: true });
    expect((await repo.routines.all()).map((r) => r.id)).toEqual(["r"]);
    expect(await pendingKeys(repo)).toEqual([]);
  });

  it("guest data uploads on the first sync", async () => {
    const remote = createFakeRemote();
    const repo = createMemoryRepository();
    await repo.sessions.put(session("guest"));
    const res = await syncOnce(repo, remote, T);
    expect(res.pushed).toBe(1);
    expect(remote.get("session", "guest")?.payload).toEqual(session("guest"));
    expect(await pendingKeys(repo)).toEqual([]);
  });

  it("a newer remote edit replaces a synced local row", async () => {
    const remote = createFakeRemote();
    const repo = createMemoryRepository();
    remote.seed({ kind: "routine", id: "r", payload: routine("r", "Push"), updatedAt: 10, deleted: false });
    await syncOnce(repo, remote, T);
    remote.seed({ kind: "routine", id: "r", payload: routine("r", "Push day"), updatedAt: 20, deleted: false });
    await syncOnce(repo, remote, T + 1);
    expect((await repo.routines.all())[0]!.name).toBe("Push day");
  });

  it("a newer local pending edit wins and is pushed", async () => {
    const remote = createFakeRemote();
    const repo = createMemoryRepository();
    remote.seed({ kind: "routine", id: "r", payload: routine("r", "Old"), updatedAt: 10, deleted: false });
    await syncOnce(repo, remote, T);
    await repo.routines.put(routine("r", "Mine, later")); // stamped with the real clock, far after 10
    const res = await syncOnce(repo, remote, T + 1);
    expect(res.pushed).toBe(1);
    expect((remote.get("routine", "r")!.payload as Routine).name).toBe("Mine, later");
    expect((await repo.routines.all())[0]!.name).toBe("Mine, later");
  });

  it("a newer remote edit beats an older local pending one, and the local version is kept (review focus 6)", async () => {
    const remote = createFakeRemote();
    const repo = createMemoryRepository();
    await repo.routines.put(routine("r", "Offline on A"));
    const local = (await repo.sync.get("routine", "r")).status!.localUpdatedAt;
    remote.seed({ kind: "routine", id: "r", payload: routine("r", "Later on B"), updatedAt: local + 5000, deleted: false });
    const res = await syncOnce(repo, remote, T);
    expect(res.conflicts).toBe(1);
    expect((await repo.routines.all())[0]!.name).toBe("Later on B");
    const conflicts = await repo.kv.get("conflicts");
    expect((conflicts![0]!.record.payload as Routine).name).toBe("Offline on A");
    expect(await pendingKeys(repo)).toEqual([]);
  });

  it("a remote tombstone deletes a synced local row", async () => {
    const remote = createFakeRemote();
    const repo = createMemoryRepository();
    remote.seed({ kind: "routine", id: "r", payload: routine("r"), updatedAt: 10, deleted: false });
    await syncOnce(repo, remote, T);
    remote.seed({ kind: "routine", id: "r", payload: null, updatedAt: 20, deleted: true });
    await syncOnce(repo, remote, T + 1);
    expect(await repo.routines.all()).toEqual([]);
  });

  it("a stale remote row does not bring back a routine deleted here (review focus 7)", async () => {
    const remote = createFakeRemote();
    const repo = createMemoryRepository();
    remote.seed({ kind: "routine", id: "r", payload: routine("r"), updatedAt: 10, deleted: false });
    await syncOnce(repo, remote, T);
    await repo.routines.remove("r");
    // Another device pushes an old copy it still had.
    remote.seed({ kind: "routine", id: "r", payload: routine("r", "old copy"), updatedAt: 11, deleted: false });
    await syncOnce(repo, remote, T + 1);
    expect(await repo.routines.all()).toEqual([]);
    expect(remote.get("routine", "r")!.deleted).toBe(true);
  });

  it("a push the server rejects stays pending and forces a full pull next time", async () => {
    const remote = createFakeRemote();
    const repo = createMemoryRepository();
    await repo.routines.put(routine("r", "Mine"));
    remote.rejectNext(["routine:r"]);
    const res = await syncOnce(repo, remote, T);
    expect(res.pushed).toBe(0);
    expect(await pendingKeys(repo)).toEqual(["routine:r"]);
    expect((await repo.kv.get("syncState"))!.lastPulledCursor).toBeNull();
  });

  it("pages through 1200 rows in pulls of 500, advancing the cursor", async () => {
    const remote = createFakeRemote();
    for (let i = 0; i < 1200; i++) remote.seed({ kind: "session", id: `s${i}`, payload: session(`s${i}`), updatedAt: 10, deleted: false });
    const repo = createMemoryRepository();
    const res = await syncOnce(repo, remote, T);
    expect(res.pulled).toBe(1200);
    expect(remote.pullCalls).toEqual([null, expect.any(String), expect.any(String)]);
    expect((await repo.sessions.all()).length).toBe(1200);
  });

  it("a second sync with nothing new pulls and pushes nothing", async () => {
    const remote = createFakeRemote();
    const repo = createMemoryRepository();
    await repo.sessions.put(session("a"));
    remote.seed({ kind: "routine", id: "r", payload: routine("r"), updatedAt: 10, deleted: false });
    await syncOnce(repo, remote, T);
    const res = await syncOnce(repo, remote, T + 1);
    expect(res).toMatchObject({ pulled: 0, pushed: 0, conflicts: 0, changedLocal: false });
  });

  it("two devices converge through the server", async () => {
    const remote = createFakeRemote();
    const a = createMemoryRepository();
    const b = createMemoryRepository();
    await a.routines.put(routine("from-a"));
    await syncOnce(a, remote, T);
    await b.routines.put(routine("from-b"));
    await syncOnce(b, remote, T + 1);
    await syncOnce(a, remote, T + 2);
    expect((await a.routines.all()).map((r) => r.id).sort()).toEqual(["from-a", "from-b"]);
    expect((await b.routines.all()).map((r) => r.id).sort()).toEqual(["from-a", "from-b"]);
  });
});
