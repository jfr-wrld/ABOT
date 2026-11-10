"use client";

import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { normalizePath } from "@/components/layout/usePagePath";
import { rememberedScroll, rememberScroll, restoreScroll, urlKey, visit } from "@/lib/nav-memory";

/** The address as the memory keys it: no trailing slash (the Android export adds one). */
const here = () => urlKey(normalizePath(window.location.pathname), window.location.search);

/**
 * Remembers each page's scroll offset and, on Back (the browser's, Android's, or a "‹ Parent"
 * link that goes back), puts the page where it was. A new page still opens at the top.
 */
export function ScrollMemory() {
  return (
    <Suspense fallback={null}>
      <Memory />
    </Suspense>
  );
}

function Memory() {
  const pathname = normalizePath(usePathname());
  const search = useSearchParams().toString();
  const popped = useRef(false);
  // The page React has rendered, not window.location: while a new page mounts, the browser clamps
  // the old page's offset (the document is short for a moment) before the address changes, and
  // that clamp must not overwrite what the old page remembered.
  const shown = useRef("");
  // From a link tap until the next page is in: the page may show its loading state for a moment
  // first, and that short page clamps the offset, so saving waits.
  const leaving = useRef(false);
  useLayoutEffect(() => {
    shown.current = urlKey(pathname, search ? `?${search}` : "");
    leaving.current = false;
  }, [pathname, search]);

  useEffect(() => {
    // ABOT restores the offset itself, after the page transition (see nav-memory).
    window.history.scrollRestoration = "manual";
    let restoring = false;
    let cancel: (() => void) | null = null;
    let frame = 0;
    let unfreeze = 0;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || a.origin !== window.location.origin) return;
      rememberScroll(shown.current, window.scrollY);
      leaving.current = true;
      // A link that goes nowhere new (the same page) must not stop saving for good.
      window.clearTimeout(unfreeze);
      unfreeze = window.setTimeout(() => (leaving.current = false), 3000);
    };
    const onScroll = () => {
      if (restoring || leaving.current || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        rememberScroll(shown.current, window.scrollY);
      });
    };
    const onPop = () => {
      popped.current = true;
      cancel?.();
      const y = rememberedScroll(here());
      if (!y) return;
      restoring = true;
      cancel = restoreScroll(y, {
        onDone: () => {
          restoring = false;
          cancel = null;
        },
      });
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPop);
    return () => {
      cancel?.();
      cancelAnimationFrame(frame);
      window.clearTimeout(unfreeze);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    visit(pathname, popped.current);
    popped.current = false;
  }, [pathname, search]);

  return null;
}
