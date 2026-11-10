/**
 * Where the lifter was on each page, so Back lands on the same spot. The browser's own
 * restoration cannot do it here: the outgoing page fades out first (PageTransition) and the
 * incoming one starts short (loading), so the remembered offset is clamped to the top before
 * the content is there. ABOT keeps the offsets itself and puts them back once the page is tall
 * enough. It also keeps the in-app trail, so a "‹ Parent" link can go back instead of opening
 * the parent fresh at its top.
 */

const positions = new Map<string, number>();
/** Pathnames visited in this tab, oldest first; a search-only change replaces the top. */
const trail: string[] = [];

export const urlKey = (path: string, search: string) => path + search;

export function rememberScroll(key: string, y: number): void {
  positions.set(key, y);
}

export function rememberedScroll(key: string): number | undefined {
  return positions.get(key);
}

/** Records a visit. `pop`: it came from the browser's back or forward. */
export function visit(pathname: string, pop: boolean): void {
  const top = trail[trail.length - 1];
  if (top === pathname) return;
  if (pop && trail[trail.length - 2] === pathname) trail.pop();
  else trail.push(pathname);
}

/** The page before this one in the trail is `pathname`, so history.back() reaches it. */
export function previousIs(pathname: string): boolean {
  return trail.length >= 2 && trail[trail.length - 2] === pathname;
}

/** For tests. */
export function resetNavMemory(): void {
  positions.clear();
  trail.length = 0;
}

/**
 * Puts the page back at `y` once it is tall enough: waits out the page transition, applies the
 * offset, and holds it briefly while late content (photos, charts) settles. Stops at once if the
 * lifter scrolls or touches, and gives up after `maxMs` at the deepest point it can reach.
 */
export function restoreScroll(
  y: number,
  {
    waitMs = 150,
    holdMs = 350,
    maxMs = 2500,
    onDone = () => {},
  }: { waitMs?: number; holdMs?: number; maxMs?: number; onDone?: () => void } = {},
): () => void {
  const start = performance.now();
  let reachedAt: number | null = null;
  let frame = 0;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    for (const e of ["wheel", "touchstart", "keydown"] as const) window.removeEventListener(e, stop);
    onDone();
  };
  for (const e of ["wheel", "touchstart", "keydown"] as const) window.addEventListener(e, stop, { passive: true });

  const step = () => {
    const now = performance.now();
    const room = document.documentElement.scrollHeight - window.innerHeight;
    if (now - start >= waitMs) {
      if (room >= y - 1) {
        if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
        reachedAt ??= now;
        if (now - reachedAt >= holdMs) return stop();
      } else if (now - start >= maxMs) {
        window.scrollTo(0, Math.max(0, room));
        return stop();
      }
    }
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return stop;
}
