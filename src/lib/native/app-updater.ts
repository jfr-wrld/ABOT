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

export type FollowResult = { end: "done" | "failed" | "stalled"; detail?: string };

/** What went wrong, short enough to show under the error, for a bug report. */
export function errorText(e: unknown): string {
  const code = (e as { code?: unknown })?.code;
  const msg = e instanceof Error ? e.message : String(e);
  return typeof code === "string" && code ? `${code}: ${msg}` : msg;
}

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
    } catch (e) {
      return { end: "failed", detail: errorText(e) };
    }
    if (p.status === "done") {
      onProgress(1);
      return { end: "done" };
    }
    if (p.status === "failed") return { end: "failed", detail: `Android download error ${p.reason ?? "?"}` };
    if (p.status === "missing") return { end: "failed", detail: "The download was removed" };
    onProgress(p.total > 0 ? Math.min(1, p.bytes / p.total) : null);
    if (p.bytes !== lastBytes) {
      lastBytes = p.bytes;
      lastChange = now();
    } else if (now() - lastChange > stallMs)
      return { end: "stalled", detail: `No data for ${Math.round(stallMs / 1000)} s (${p.status}, reason ${p.reason ?? "?"})` };
    await sleep(everyMs);
  }
}
