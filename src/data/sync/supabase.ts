import type { SyncRecord } from "@/data/repo/types";
import type { RemoteAdapter, RemoteRecord } from "./types";

/**
 * The project URL and anon key are public by design (the anon key only reaches what row level
 * security allows: the signed-in user's own rows). Without both, cloud sync is simply off.
 */
export const SUPABASE_ENV = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

export function isCloudSyncConfigured(env: { url?: string; anonKey?: string } = SUPABASE_ENV): boolean {
  return Boolean(env.url && env.anonKey);
}

type Result<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
interface RecordsQuery {
  gt(column: string, value: string): RecordsQuery;
  order(column: string, options: { ascending: boolean }): RecordsQuery;
  limit(n: number): Result<RowOut[]>;
}

/** The part of the supabase-js client this adapter uses, so tests can pass a fake. */
export interface SupabaseLike {
  from(table: "abot_records"): { select(columns: string): RecordsQuery };
  rpc(fn: "upsert_if_newer", args: { rows: RowIn[] }): Result<unknown>;
}

interface RowOut {
  kind: SyncRecord["kind"];
  id: string;
  payload: unknown;
  updated_at: number | string;
  deleted: boolean;
  server_updated_at: string;
}
interface RowIn {
  kind: SyncRecord["kind"];
  id: string;
  payload: unknown;
  updated_at: number;
  deleted: boolean;
}

/** Rows per RPC call: keeps each request well under the API's body size limit. */
const PUSH_BATCH = 200;

export function createSupabaseRemote(client: SupabaseLike): RemoteAdapter {
  return {
    async pull(cursor, limit) {
      let q = client.from("abot_records").select("kind,id,payload,updated_at,deleted,server_updated_at");
      if (cursor) q = q.gt("server_updated_at", cursor);
      const { data, error } = await q.order("server_updated_at", { ascending: true }).limit(limit);
      if (error) throw new Error(error.message);
      const records: RemoteRecord[] = (data ?? []).map((r) => ({
        kind: r.kind,
        id: r.id,
        payload: r.deleted ? null : r.payload,
        updatedAt: Number(r.updated_at),
        deleted: r.deleted,
        serverUpdatedAt: r.server_updated_at,
      }));
      return { records, cursor: records.length ? records[records.length - 1]!.serverUpdatedAt : cursor };
    },
    async pushIfNewer(records) {
      const accepted: string[] = [];
      const rejected: string[] = [];
      for (let i = 0; i < records.length; i += PUSH_BATCH) {
        const rows: RowIn[] = records.slice(i, i + PUSH_BATCH).map((r) => ({
          kind: r.kind,
          id: r.id,
          payload: r.deleted ? {} : r.payload,
          updated_at: r.updatedAt,
          deleted: r.deleted,
        }));
        const { data, error } = await client.rpc("upsert_if_newer", { rows });
        if (error) throw new Error(error.message);
        const result = (Array.isArray(data) ? data[0] : data) as { accepted?: string[]; rejected?: string[] } | null;
        accepted.push(...(result?.accepted ?? []));
        rejected.push(...(result?.rejected ?? []));
      }
      return { accepted, rejected };
    },
  };
}
