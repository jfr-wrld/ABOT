import type { ConflictEntry, Repository, SyncRecord, SyncState } from "@/data/repo/types";
import { syncKey, type RemoteAdapter, type RemoteRecord, type SyncResult } from "./types";

const PAGE = 500;
const MAX_CONFLICTS = 50;
const TOMBSTONE_KEEP_MS = 30 * 86_400_000;

export const SIGNED_OUT: SyncState = {
  userId: null,
  lastPulledCursor: null,
  lastSyncedAt: null,
  phase: "signed_out",
  lastError: null,
};

/**
 * One full two-way sync (master plan section 3.1):
 * 1. Pull everything the server wrote since the last cursor, in pages.
 * 2. Merge each remote record by last-write-wins on device time. A local edit not yet pushed
 *    keeps priority only if it is newer; when it loses, it is saved to `conflicts` first.
 * 3. Push every pending local change; the server refuses anything older than what it has.
 * 4. Mark pushed items synced, forget old synced tombstones, save the cursor.
 * Network calls happen outside storage transactions; each local write is its own transaction.
 */
export async function syncOnce(repo: Repository, remote: RemoteAdapter, now = Date.now()): Promise<SyncResult> {
  const state = (await repo.kv.get("syncState")) ?? SIGNED_OUT;
  let cursor = state.lastPulledCursor;
  let pulled = 0;
  const lost: ConflictEntry[] = [];

  for (;;) {
    const page = await remote.pull(cursor, PAGE);
    for (const r of page.records) {
      const outcome = await merge(repo, r, now);
      if (outcome === "applied") pulled++;
      if (typeof outcome === "object") {
        lost.push(outcome);
        pulled++;
      }
    }
    const advanced = page.cursor !== null && page.cursor !== cursor;
    if (advanced) cursor = page.cursor;
    if (!advanced || page.records.length < PAGE) break;
  }

  const pending = await repo.sync.pending();
  let pushed = 0;
  if (pending.length > 0) {
    const { accepted, rejected } = await remote.pushIfNewer(pending);
    const byKey = new Map(pending.map((p) => [syncKey(p), p]));
    for (const k of accepted) {
      const rec = byKey.get(k);
      if (!rec) continue;
      await repo.sync.markSynced(rec.kind, rec.id, rec.updatedAt, now);
      pushed++;
    }
    // The server holds something newer that this device has not seen (its cursor is past it).
    // Start the next pull from the beginning so those rows come down and win or conflict.
    if (rejected.length > 0) cursor = null;
  }

  if (lost.length > 0) {
    const previous = (await repo.kv.get("conflicts")) ?? [];
    await repo.kv.set("conflicts", [...lost.reverse(), ...previous].slice(0, MAX_CONFLICTS));
  }
  await repo.sync.purgeTombstones(now - TOMBSTONE_KEEP_MS);
  await repo.kv.set("syncState", { ...state, lastPulledCursor: cursor, lastSyncedAt: now, phase: "idle", lastError: null });

  return { pulled, pushed, conflicts: lost.length, changedLocal: pulled > 0 };
}

/** Applies one server record, or not. Returns the losing local version when there was a conflict. */
async function merge(repo: Repository, r: RemoteRecord, now: number): Promise<"applied" | "skipped" | ConflictEntry> {
  const remoteRec: SyncRecord = { kind: r.kind, id: r.id, payload: r.payload, updatedAt: r.updatedAt, deleted: r.deleted };
  const { record: local, status } = await repo.sync.get(r.kind, r.id);

  if (!status) {
    // Never tracked here. Nothing to protect: take the server's version (a tombstone for
    // something this device never had changes nothing but is recorded as synced).
    await repo.sync.applyRemote(remoteRec, now);
    return local || !r.deleted ? "applied" : "skipped";
  }

  if (status.status === "pending_sync") {
    if (status.localUpdatedAt > r.updatedAt) return "skipped"; // ours is newer; the push sends it
    const losing: SyncRecord = local ?? { kind: r.kind, id: r.id, payload: null, updatedAt: status.localUpdatedAt, deleted: true };
    await repo.sync.applyRemote(remoteRec, now);
    return { record: losing, replacedAt: now };
  }

  // Synced here: the server wins when newer. Equal means it is the version we already have
  // (usually our own push coming back), so nothing changes.
  if (r.updatedAt > status.localUpdatedAt) {
    await repo.sync.applyRemote(remoteRec, now);
    return "applied";
  }
  return "skipped";
}
