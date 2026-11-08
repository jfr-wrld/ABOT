import { getRepository, type OpenedRepository } from "@/data/repo";
import { requestPersistentStorage } from "@/lib/storagePersistence";
import { createTabLock, type TabLock } from "@/lib/tabLock";
import { bootstrapStores } from "./persistence";
import { useHydration } from "./hydration";

/**
 * Starts ABOT in this tab: claim the writer lock, open storage, load the stores, attach
 * persistence. Module state, so React StrictMode's double effects start it once.
 */
let started: Promise<void> | null = null;
let lock: TabLock | null = null;
let opened: OpenedRepository | null = null;
let detach: (() => void) | null = null;
const startedHooks: (() => void)[] = [];

/** Runs `fn` each time this tab becomes the writer (first start and every take-over). */
export function onTabStarted(fn: () => void): void {
  startedHooks.push(fn);
}

export function startApp(): Promise<void> {
  started ??= (async () => {
    lock = createTabLock();
    const claim = await lock.claim();
    if (claim === "busy") {
      useHydration.getState().setTab("elsewhere");
      return;
    }
    await attach();
  })();
  return started;
}

/** "Use ABOT here": the other tab saves and steps aside, then this one loads fresh data. */
export async function takeOverHere(): Promise<void> {
  if (!lock) return;
  useHydration.getState().setTab("checking");
  await lock.takeOver();
  await attach();
}

async function attach(): Promise<void> {
  opened ??= await getRepository();
  const { persistence } = await bootstrapStores(opened, window.localStorage);
  useHydration.getState().setTab("owner");
  if (!persistence) return;

  // Failed writes are retried when the app comes back to the foreground or online, and
  // queued writes get a chance to finish before the page is hidden or closed.
  const retry = () => void persistence.retryFailed();
  const onVisibility = () => (document.visibilityState === "visible" ? retry() : void persistence.flush());
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", retry);
  window.addEventListener("pagehide", onVisibility);
  detach = () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("online", retry);
    window.removeEventListener("pagehide", onVisibility);
    persistence.detach();
  };

  lock!.onHandover(
    // Everything already logged here reaches storage before the other tab reads it.
    () => persistence.flush(),
    () => {
      detach?.();
      detach = null;
      useHydration.getState().setTab("elsewhere");
    },
  );

  // Not awaited by anything: logging never waits on the browser's answer.
  if (opened.durable) {
    void requestPersistentStorage().then((s) => useHydration.getState().setPersistStatus(s));
  }
  for (const fn of startedHooks) fn();
}
