import { describe, expect, it } from "vitest";
import { followDownload, type DownloadProgress } from "./app-updater";

function run(steps: DownloadProgress[], stallMs = 60_000) {
  let i = 0;
  let clock = 0;
  const seen: (number | null)[] = [];
  const result = followDownload(1, (f) => seen.push(f), {
    read: async () => steps[Math.min(i++, steps.length - 1)]!,
    everyMs: 500,
    stallMs,
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
  });
  return { result, seen };
}

describe("followDownload", () => {
  it("reports progress and ends when the file lands", async () => {
    const { result, seen } = run([
      { status: "running", bytes: 0, total: -1 },
      { status: "running", bytes: 4, total: 8 },
      { status: "done", bytes: 8, total: 8 },
    ]);
    expect((await result).end).toBe("done");
    expect(seen).toEqual([null, 0.5, 1]);
  });

  it("says failed, and why, when Android gives up, the download is gone or the bridge refuses", async () => {
    const refused = followDownload(1, () => {}, {
      read: async () => {
        throw Object.assign(new Error("No download id."), { code: "BAD_ID" });
      },
    });
    expect(await refused).toEqual({ end: "failed", detail: "BAD_ID: No download id." });
    expect(await run([{ status: "failed", bytes: 0, total: 8, reason: 404 }]).result).toEqual({ end: "failed", detail: "Android download error 404" });
    expect((await run([{ status: "missing", bytes: 0, total: -1 }]).result).end).toBe("failed");
  });

  it("says stalled when no byte arrives for too long", async () => {
    expect((await run([{ status: "paused", bytes: 8, total: 8, reason: 2 }], 2_000).result)).toMatchObject({ end: "stalled", detail: expect.stringContaining("paused, reason 2") });
  });
});
