/**
 * Full-screen moments that are not <dialog> elements (the streak screen, the PRO celebration)
 * register here, so Android's back button or edge swipe closes them instead of leaving the page
 * or sending ABOT to the background. The newest one closes first.
 */
const handlers: (() => void)[] = [];

/** Registers `close` for back; returns the unregister. */
export function onBack(close: () => void): () => void {
  handlers.push(close);
  return () => {
    const i = handlers.lastIndexOf(close);
    if (i >= 0) handlers.splice(i, 1);
  };
}

/** Runs the newest handler; false when none is registered. */
export function runBack(): boolean {
  const close = handlers[handlers.length - 1];
  if (!close) return false;
  close();
  return true;
}
