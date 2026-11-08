import type { SyncRecord } from "@/data/repo/types";

/** A record as the server returns it: the device's record plus the server's write time (the pull cursor). */
export type RemoteRecord = SyncRecord & { serverUpdatedAt: string };

/** What the sync engine needs from a server. Keys are "kind:id". */
export interface RemoteAdapter {
  /** Records written after `cursor` (all when null), oldest first, at most `limit`. */
  pull(cursor: string | null, limit: number): Promise<{ records: RemoteRecord[]; cursor: string | null }>;
  /** Upserts each record unless the server already has the same or a newer `updatedAt`. */
  pushIfNewer(records: SyncRecord[]): Promise<{ accepted: string[]; rejected: string[] }>;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: number;
  /** Something from the server was written locally: the stores need reloading. */
  changedLocal: boolean;
}

export const syncKey = (r: { kind: string; id: string }) => `${r.kind}:${r.id}`;
