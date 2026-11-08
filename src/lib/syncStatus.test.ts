import { describe, expect, it } from "vitest";
import { friendlyError, syncStatus } from "./syncStatus";

const NOW = 1_800_000_000_000;

describe("syncStatus", () => {
  it("reports a failed sync even when an earlier one succeeded", () => {
    expect(syncStatus({ phase: "error", pendingCount: 0, lastSyncedAt: NOW - 1000 }, NOW).tone).toBe("error");
  });

  it("counts changes not yet backed up before claiming a backup", () => {
    expect(syncStatus({ phase: "idle", pendingCount: 2, lastSyncedAt: NOW }, NOW)).toEqual({
      tone: "pending",
      text: "2 changes waiting to back up",
    });
  });

  it("says when the last backup happened", () => {
    expect(syncStatus({ phase: "idle", pendingCount: 0, lastSyncedAt: NOW - 5_000 }, NOW)).toEqual({
      tone: "ok",
      text: "Backed up just now",
    });
    expect(syncStatus({ phase: "idle", pendingCount: 0, lastSyncedAt: null }, NOW).tone).toBe("never");
  });
});

describe("friendlyError", () => {
  it("turns database errors into a plain sentence", () => {
    expect(friendlyError("sync", 'relation "abot_records" does not exist')).toMatch(/isn't set up yet/);
  });

  it("recognises a cancelled Google sign-in", () => {
    expect(friendlyError("sign_in", "The user denied access")).toMatch(/cancelled/);
  });

  it("falls back to a reassuring default", () => {
    expect(friendlyError("sync", "something odd")).toMatch(/safe on this phone/);
    expect(friendlyError("sign_in", "something odd")).toMatch(/didn't finish/);
  });
});
