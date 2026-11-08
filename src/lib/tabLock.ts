/**
 * One tab writes at a time. Two tabs each holding their own copy of the data would overwrite
 * each other's changes, so the first tab takes a Web Lock and later tabs wait. Taking over is a
 * handover: the new tab asks over a BroadcastChannel, the current tab finishes its pending writes
 * and lets go, and only then does the new tab load. If the old tab does not answer (frozen, or
 * closing), the new tab takes the lock anyway after a short wait.
 *
 * Browsers without Web Locks get no coordination and behave as before.
 */
const LOCK = "abot-active-tab";
const CHANNEL = "abot-tabs";
const HANDOVER_WAIT_MS = 1500;

export type TabClaim = "owner" | "busy";

export interface TabLock {
  /** Tries to become the writing tab without disturbing another one. */
  claim(): Promise<TabClaim>;
  /** Asks the current writing tab to hand over, then becomes the writing tab. */
  takeOver(): Promise<void>;
  /**
   * Called while this tab is the writer. `beforeRelease` runs when another tab asks to take
   * over (flush pending writes there); `onLost` runs once the lock is gone either way.
   */
  onHandover(beforeRelease: () => Promise<void>, onLost: () => void): void;
}

export function createTabLock(): TabLock {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
  let release: (() => void) | null = null;
  let beforeRelease: () => Promise<void> = async () => {};
  let onLost: () => void = () => {};

  /** Holds the lock until `release` is called or another tab steals it. */
  function hold(options: LockOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      locks!
        .request(LOCK, options, (lock) => {
          if (!lock) {
            resolve(false);
            return undefined;
          }
          resolve(true);
          return new Promise<void>((done) => {
            release = done;
          });
        })
        .then(
          () => undefined,
          // Stolen by another tab: the request rejects with AbortError.
          () => {
            release = null;
            onLost();
          },
        );
    });
  }

  channel?.addEventListener("message", (e: MessageEvent<{ type: string }>) => {
    if (e.data?.type !== "takeover" || !release) return;
    void (async () => {
      try {
        await beforeRelease();
      } finally {
        const r = release;
        release = null;
        r?.();
        onLost();
        channel.postMessage({ type: "released" });
      }
    })();
  });

  return {
    async claim() {
      if (!locks) return "owner";
      return (await hold({ mode: "exclusive", ifAvailable: true })) ? "owner" : "busy";
    },
    async takeOver() {
      if (!locks) return;
      if (channel) {
        const released = new Promise<void>((resolve) => {
          const onMessage = (e: MessageEvent<{ type: string }>) => {
            if (e.data?.type === "released") {
              channel.removeEventListener("message", onMessage);
              resolve();
            }
          };
          channel.addEventListener("message", onMessage);
        });
        channel.postMessage({ type: "takeover" });
        await Promise.race([released, new Promise((r) => setTimeout(r, HANDOVER_WAIT_MS))]);
      }
      await hold({ mode: "exclusive", steal: true });
    },
    onHandover(before, lost) {
      beforeRelease = before;
      onLost = lost;
    },
  };
}
