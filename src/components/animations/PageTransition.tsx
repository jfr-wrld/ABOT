"use client";

import { useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
// Internal to Next, but the only way to keep the outgoing page's tree on screen while it animates
// out: without it the App Router swaps the content before the exit runs. If an upgrade moves this
// module, the build fails here, and the fix is to drop exit animations (enter-only still works).
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { EASE_OUT_EXPO } from "./SplashScreen";

/** Holds the router context a page was rendered with, so its exit renders the old page. */
function FrozenRouter({ children }: { children: React.ReactNode }) {
  const context = useContext(LayoutRouterContext);
  // The first value seen, kept for this page's lifetime (state, not a ref, so render stays pure).
  const [frozen] = useState(context);
  return <LayoutRouterContext.Provider value={frozen}>{children}</LayoutRouterContext.Provider>;
}

/**
 * Route changes: the old page settles back (98%) as it fades, then the new one comes forward.
 * Only opacity and transform animate, which the compositor handles, so it holds 60fps on a phone.
 * Kept short (about 0.3s for both halves) so a tab switch never feels like it waits.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className="flex flex-1 flex-col"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 0.2, ease: EASE_OUT_EXPO } }}
        exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12, ease: "easeIn" } }}
      >
        <FrozenRouter>{children}</FrozenRouter>
      </motion.div>
    </AnimatePresence>
  );
}
