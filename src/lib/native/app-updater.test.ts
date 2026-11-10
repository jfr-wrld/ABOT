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
    expect(await result).toBe("done");
    expect(seen).toEqual([null, 0.5, 1]);
  });

  it("says failed when Android gives up or the download is gone", async () => {
    expect(await run([{ status: "failed", bytes: 0, total: 8 }]).result).toBe("failed");
    expect(await run([{ status: "missing", bytes: 0, total: -1 }]).result).toBe("failed");
  });

  it("says stalled when no byte arrives for too long", async () => {
    expect(await run([{ status: "running", bytes: 8, total: 8 }], 2_000).result).toBe("stalled");
  });
});
