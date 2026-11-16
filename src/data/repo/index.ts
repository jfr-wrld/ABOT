import { AbotDB, createDexieRepository } from "./dexie";
import { createMemoryRepository } from "./memory";
import type { Repository } from "./types";
import type { StorageIssue } from "@/store/hydration";

export type { Repository, RepoSnapshot, StoredSettings, KvKey, KvValues, RestTimerState } from "./types";
export { createMemoryRepository } from "./memory";
export { createDexieRepository } from "./dexie";

export interface OpenedRepository {
  repo: Repository;
  /** False when data only lives in memory for this tab. */
  durable: boolean;
  error: StorageIssue | null;
}

/** Opens IndexedDB; if the browser blocks it (private mode, storage disabled), falls back to memory. */
export async function getRepository(name = "abot"): Promise<OpenedRepository> {
  if (typeof indexedDB === "undefined") {
    return { repo: createMemoryRepository(), durable: false, error: { kind: "memory-only", detail: "IndexedDB is not available in this browser." } };
  }
  try {
    const db = new AbotDB(name);
    await db.open();
    return { repo: createDexieRepository(name, db), durable: true, error: null };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { repo: createMemoryRepository(), durable: false, error: { kind: "memory-only", detail: `IndexedDB could not be opened: ${reason}` } };
  }
}
