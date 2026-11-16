"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { m as motion } from "framer-motion";
import { FirstVisitProvider } from "@/components/motion/Entrance";

/** Pages opened so far this session, so a page's entrance plays only the first time. */
const visited = new Set<string>();

/**
 * Route changes: the new page is on screen at once and fades in over 0.15 s (opacity only, which
 * the compositor handles). No exit: waiting for the old page to leave first held every tab switch
 * back by about 0.3 s with two full-screen layers on the phone (owner, 2026-11-15: "terasa berat").
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <Page key={pathname} path={pathname}>
      {children}
    </Page>
  );
}

function Page({ path, children }: { path: string; children: React.ReactNode }) {
  // Read before the effect below marks the page, so both renders in development agree.
  const [first] = useState(() => !visited.has(path));
  useEffect(() => {
    visited.add(path);
  }, [path]);
  return (
    <FirstVisitProvider value={first}>
      <motion.div className="flex flex-1 flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, ease: "easeOut" }}>
        {children}
      </motion.div>
    </FirstVisitProvider>
  );
}
