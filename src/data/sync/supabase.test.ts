import { describe, expect, it } from "vitest";
import { createSupabaseRemote, isCloudSyncConfigured, type SupabaseLike } from "./supabase";

/** Records the query the adapter builds and answers with canned rows. */
function fakeClient(rows: unknown[], rpcResult: unknown = [{ accepted: [], rejected: [] }]) {
  const calls: string[] = [];
  const rpcCalls: unknown[] = [];
  const query = {
    gt(col: string, v: string) {
      calls.push(`gt ${col} ${v}`);
      return query;
    },
    order(col: string, o: { ascending: boolean }) {
      calls.push(`order ${col} ${o.ascending ? "asc" : "desc"}`);
      return query;
    },
    limit(n: number) {
      calls.push(`limit ${n}`);
      return Promise.resolve({ data: rows as never, error: null });
    },
  };
  const client: SupabaseLike = {
    from(table) {
      calls.push(`from ${table}`);
      return {
        select(cols: string) {
          calls.push(`select ${cols}`);
          return query;
        },
      };
    },
    rpc(fn, args) {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: rpcResult, error: null });
    },
  };
  return { client, calls, rpcCalls };
}

describe("createSupabaseRemote", () => {
  it("pull asks for rows after the cursor, oldest first, and returns the last server time", async () => {
    const { client, calls } = fakeClient([
      { kind: "routine", id: "r", payload: { id: "r" }, updated_at: 10, deleted: false, server_updated_at: "2026-11-08T10:00:00.1+00:00" },
      { kind: "routine", id: "x", payload: {}, updated_at: 11, deleted: true, server_updated_at: "2026-11-08T10:00:00.2+00:00" },
    ]);
    const page = await createSupabaseRemote(client).pull("2026-11-08T09:00:00+00:00", 500);
    expect(calls).toEqual([
      "from abot_records",
      "select kind,id,payload,updated_at,deleted,server_updated_at",
      "gt server_updated_at 2026-11-08T09:00:00+00:00",
      "order server_updated_at asc",
      "limit 500",
    ]);
    expect(page.cursor).toBe("2026-11-08T10:00:00.2+00:00");
    expect(page.records[0]).toEqual({
      kind: "routine",
      id: "r",
      payload: { id: "r" },
      updatedAt: 10,
      deleted: false,
      serverUpdatedAt: "2026-11-08T10:00:00.1+00:00",
    });
    // A tombstone carries no payload locally, whatever the server stored.
    expect(page.records[1]).toMatchObject({ deleted: true, payload: null });
  });

  it("the first pull has no cursor filter, and an empty page keeps the cursor", async () => {
    const { client, calls } = fakeClient([]);
    const page = await createSupabaseRemote(client).pull(null, 500);
    expect(calls.some((c) => c.startsWith("gt"))).toBe(false);
    expect(page).toEqual({ records: [], cursor: null });
  });

  it("push sends one RPC per 200 records and maps accepted and rejected keys", async () => {
    const { client, rpcCalls } = fakeClient([], [{ accepted: ["routine:r"], rejected: ["session:s"] }]);
    const res = await createSupabaseRemote(client).pushIfNewer([
      { kind: "routine", id: "r", payload: { id: "r" }, updatedAt: 10, deleted: false },
      { kind: "session", id: "s", payload: null, updatedAt: 11, deleted: true },
    ]);
    expect(rpcCalls).toEqual([
      {
        fn: "upsert_if_newer",
        args: {
          rows: [
            { kind: "routine", id: "r", payload: { id: "r" }, updated_at: 10, deleted: false },
            // The column is NOT NULL: a tombstone travels with an empty object.
            { kind: "session", id: "s", payload: {}, updated_at: 11, deleted: true },
          ],
        },
      },
    ]);
    expect(res).toEqual({ accepted: ["routine:r"], rejected: ["session:s"] });

    const big = fakeClient([], [{ accepted: [], rejected: [] }]);
    const many = Array.from({ length: 450 }, (_, i) => ({ kind: "session" as const, id: `s${i}`, payload: {}, updatedAt: 1, deleted: false }));
    await createSupabaseRemote(big.client).pushIfNewer(many);
    expect(big.rpcCalls).toHaveLength(3);
  });

  it("a server error becomes a thrown Error with its message", async () => {
    const client: SupabaseLike = {
      from: () => ({ select: () => ({ gt: () => ({}) as never, order: () => ({ limit: () => Promise.resolve({ data: null, error: { message: "JWT expired" } }) }) as never }) }) as never,
      rpc: () => Promise.resolve({ data: null, error: { message: "permission denied" } }),
    };
    await expect(createSupabaseRemote(client).pull(null, 10)).rejects.toThrow("JWT expired");
    await expect(createSupabaseRemote(client).pushIfNewer([{ kind: "routine", id: "r", payload: {}, updatedAt: 1, deleted: false }])).rejects.toThrow(
      "permission denied",
    );
  });
});

describe("isCloudSyncConfigured", () => {
  it("needs both the project URL and the anon key", () => {
    expect(isCloudSyncConfigured({})).toBe(false);
    expect(isCloudSyncConfigured({ url: "https://x.supabase.co" })).toBe(false);
    expect(isCloudSyncConfigured({ url: "https://x.supabase.co", anonKey: "k" })).toBe(true);
  });
});
