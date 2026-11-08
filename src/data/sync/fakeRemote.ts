import type { SyncKind, SyncRecord } from "@/data/repo/types";
import { syncKey, type RemoteAdapter, type RemoteRecord } from "./types";

/**
 * An in-memory server with the same rules as supabase/migrations: a write gets the next server
 * time; pushIfNewer rejects anything not newer than what the server has. For tests.
 */
export function createFakeRemote() {
  const rows = new Map<string, RemoteRecord>();
  let seq = 0;
  let reject = new Set<string>();
  const stamp = () => String(++seq).padStart(12, "0");
  const pullCalls: (string | null)[] = [];

  const remote: RemoteAdapter & {
    rows: Map<string, RemoteRecord>;
    pullCalls: (string | null)[];
    seed(rec: SyncRecord): void;
    get(kind: SyncKind, id: string): RemoteRecord | undefined;
    rejectNext(keys: string[]): void;
  } = {
    rows,
    pullCalls,
    /** Another device writing directly, no newer-wins check. */
    seed(rec) {
      rows.set(syncKey(rec), { ...structuredClone(rec), serverUpdatedAt: stamp() });
    },
    get: (kind, id) => rows.get(`${kind}:${id}`),
    rejectNext(keys) {
      reject = new Set(keys);
    },
    async pull(cursor, limit) {
      pullCalls.push(cursor);
      const page = [...rows.values()]
        .filter((r) => cursor === null || r.serverUpdatedAt > cursor)
        .sort((a, b) => a.serverUpdatedAt.localeCompare(b.serverUpdatedAt))
        .slice(0, limit)
        .map((r) => structuredClone(r));
      return { records: page, cursor: page.length ? page[page.length - 1]!.serverUpdatedAt : cursor };
    },
    async pushIfNewer(records) {
      const accepted: string[] = [];
      const rejected: string[] = [];
      for (const rec of records) {
        const k = syncKey(rec);
        const current = rows.get(k);
        if (reject.has(k) || (current && current.updatedAt >= rec.updatedAt)) {
          rejected.push(k);
          continue;
        }
        rows.set(k, { ...structuredClone(rec), serverUpdatedAt: stamp() });
        accepted.push(k);
      }
      reject = new Set();
      return { accepted, rejected };
    },
  };
  return remote;
}
