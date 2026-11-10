import { registerPlugin } from "@capacitor/core";

/**
 * The Android side of Check for updates (android/app/src/main/java/app/abot/gym/AppUpdatePlugin.java):
 * Android's DownloadManager fetches the APK into ABOT's own folder, then the package installer
 * opens on it. The browser is only the fallback when this fails.
 */

export type DownloadStatus = "running" | "paused" | "done" | "failed" | "missing";
export interface DownloadProgress {
  status: DownloadStatus;
  bytes: number;
  /** -1 until the server has said how big the file is. */
  total: number;
  reason?: number;
}

interface AppUpdatePlugin {
  download(opts: { url: string; title: string }): Promise<{ id: number }>;
  progress(opts: { id: number }): Promise<DownloadProgress>;
  install(): Promise<{ needsPermission: boolean }>;
}

export const AppUpdate = registerPlugin<AppUpdatePlugin>("AppUpdate");

export type FollowResult = "done" | "failed" | "stalled";

/**
 * Reads the download every `everyMs` until it lands or fails, reporting the share done (0..1, or
 * null while the size is unknown). It gives up as "stalled" when no byte has arrived for
 * `stallMs`, so a stuck download offers the browser instead of spinning forever.
 */
export async function followDownload(
  id: number,
  onProgress: (fraction: number | null) => void,
  {
    read = (n: number) => AppUpdate.progress({ id: n }),
    everyMs = 500,
    stallMs = 60_000,
    sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    now = () => Date.now(),
  } = {},
): Promise<FollowResult> {
  let lastBytes = -1;
  let lastChange = now();
  for (;;) {
    let p: DownloadProgress;
    try {
      p = await read(id);
    } catch {
      return "failed";
    }
    if (p.status === "done") {
      onProgress(1);
      return "done";
    }
    if (p.status === "failed" || p.status === "missing") return "failed";
    onProgress(p.total > 0 ? Math.min(1, p.bytes / p.total) : null);
    if (p.bytes !== lastBytes) {
      lastBytes = p.bytes;
      lastChange = now();
    } else if (now() - lastChange > stallMs) return "stalled";
    await sleep(everyMs);
  }
}
