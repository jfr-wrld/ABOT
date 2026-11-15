"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { SUPABASE_ENV, isCloudSyncConfigured } from "@/data/sync/supabase";
import { pickDayStore, reportVisit, restRpc } from "@/lib/visit-counter";

/** Reports each page view to ABOT's own counter (src/lib/visit-counter.ts). Web build only. */
export function VisitCounter() {
  const pathname = usePathname();
  const enabled = process.env.ABOT_WEB_ANALYTICS === "1" && process.env.NODE_ENV === "production" && isCloudSyncConfigured();
  useEffect(() => {
    if (!enabled || !pathname) return;
    void reportVisit(pathname, restRpc(SUPABASE_ENV.url!, SUPABASE_ENV.anonKey!), pickDayStore(() => window.localStorage));
  }, [enabled, pathname]);
  return null;
}
