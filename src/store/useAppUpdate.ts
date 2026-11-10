import { create } from "zustand";
import { checkDue, checkForUpdate, LATER_MS, putOff, type UpdateCheck } from "@/lib/app-update";
import { AppUpdate, errorText, followDownload } from "@/lib/native/app-updater";

/**
 * The Android app's update, shared by the pop-up, the ready banner and Settings > About: what
 * GitHub offers, and where the download stands. The download itself runs in Android's
 * DownloadManager, so it carries on with ABOT in the background; its id is kept so a restart
 * picks it up again.
 */

export type UpdatePhase = "idle" | "downloading" | "ready" | "permission" | "opened" | "failed";

const CHECKED_KEY = "abot.update-checked-at";
const LATER_KEY = "abot.update-later";
const DOWNLOAD_KEY = "abot.update-download";

function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the app only asks again sooner.
  }
}

interface State {
  installed: number | null;
  result: UpdateCheck | null;
  checking: boolean;
  phase: UpdatePhase;
  fraction: number | null;
  /** Why the last download or install failed, shown small under the error. */
  detail: string | null;
  /** The build being downloaded or ready to install. */
  build: number | null;
  /** The "new version" pop-up. */
  modal: boolean;
  /** The "ready to install" banner was closed for this download. */
  bannerClosed: boolean;
  /** Learns the installed build and picks up a download from before a restart. */
  init: (installed: number) => void;
  /**
   * "launch": the app just started, always asks. "resume": back from the background, asks only
   * when due. Both may open the pop-up. "manual": the button in Settings.
   */
  check: (from?: "launch" | "resume" | "manual") => Promise<void>;
  openModal: () => void;
  later: () => void;
  start: () => Promise<void>;
  install: () => Promise<void>;
  closeBanner: () => void;
}

export const useAppUpdate = create<State>()((set, get) => {
  async function follow(id: number, build: number) {
    set({ phase: "downloading", fraction: null, bannerClosed: false, build, detail: null });
    const { end, detail } = await followDownload(id, (fraction) => {
      if (get().build === build) set({ fraction });
    });
    // A newer build may have replaced this download meanwhile: then its end is not news.
    if (get().build !== build) return;
    set({ phase: end === "done" ? "ready" : "failed", detail: detail ?? null });
  }

  /**
   * GitHub has a newer build than the one downloaded (or downloading): that file is dropped, so
   * the pop-up and Install offer the newest build, not a step in between.
   */
  function dropStale(latest: number) {
    const { build, phase } = get();
    if (build === null || build >= latest || phase === "idle") return;
    write(DOWNLOAD_KEY, null);
    set({ phase: "idle", build: null, fraction: null, detail: null, bannerClosed: false });
  }

  return {
    installed: null,
    result: null,
    checking: false,
    phase: "idle",
    fraction: null,
    build: null,
    detail: null,
    modal: false,
    bannerClosed: false,

    init: (installed) => {
      if (get().installed !== null) return;
      set({ installed });
      const saved = read<{ id: number; build: number }>(DOWNLOAD_KEY);
      if (!saved) return;
      // Installed already (or older than what runs): nothing left to do with that file.
      if (saved.build <= installed) write(DOWNLOAD_KEY, null);
      else void follow(saved.id, saved.build);
    },

    check: async (from = "manual") => {
      const { installed, checking } = get();
      if (installed === null || checking) return;
      const now = Date.now();
      if (from === "resume" && !checkDue(read<number>(CHECKED_KEY), now)) return;
      const auto = from !== "manual";
      set({ checking: true });
      const result = await checkForUpdate(installed);
      if (result.kind !== "error") write(CHECKED_KEY, now);
      if (result.kind === "available") dropStale(result.release.build);
      set({ result, checking: false });
      if (
        auto &&
        result.kind === "available" &&
        get().phase === "idle" &&
        !putOff(read<{ build: number; until: number }>(LATER_KEY), result.release.build, now)
      )
        set({ modal: true });
    },

    openModal: () => set({ modal: true }),

    later: () => {
      const r = get().result;
      if (r?.kind === "available") write(LATER_KEY, { build: r.release.build, until: Date.now() + LATER_MS });
      set({ modal: false });
    },

    start: async () => {
      const r = get().result;
      if (r?.kind !== "available") return;
      set({ modal: false });
      dropStale(r.release.build);
      // The file on the phone is this very build: install it instead of downloading it again.
      if (get().phase === "ready" && get().build === r.release.build) return get().install();
      try {
        const { id } = await AppUpdate.download({ url: r.release.apkUrl, title: `ABOT ${r.release.version}` });
        write(DOWNLOAD_KEY, { id, build: r.release.build });
        await follow(id, r.release.build);
      } catch (e) {
        set({ phase: "failed", detail: errorText(e) });
      }
    },

    install: async () => {
      try {
        const { needsPermission } = await AppUpdate.install();
        // Without the permission the banner stays, so Install is one tap away on the way back.
        set({ phase: needsPermission ? "permission" : "opened", bannerClosed: !needsPermission });
      } catch (e) {
        write(DOWNLOAD_KEY, null);
        set({ phase: "failed", detail: errorText(e) });
      }
    },

    closeBanner: () => set({ bannerClosed: true }),
  };
});
