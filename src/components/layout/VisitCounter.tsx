"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isCloudSyncConfigured } from "@/data/sync/supabase";
import { getSupabase } from "@/data/sync/client";
import { reportVisit } from "@/lib/visit-counter";

// When the browser blocks storage, remember the day for this tab only, so each navigation does not
// count as a new visitor.
const tabMemory = new Map<string, string>();
const tabStore = { getItem: (k: string) => tabMemory.get(k) ?? null, setItem: (k: string, v: string) => void tabMemory.set(k, v) };

function dayStore(): Pick<Storage, "getItem" | "setItem"> {
  try {
    window.localStorage.getItem("abot.visit-day");
    return window.localStorage;
  } catch {
    return tabStore;
  }
}

/** Reports each page view to ABOT's own counter (src/lib/visit-counter.ts). Web build only. */
export function VisitCounter() {
  const pathname = usePathname();
  const enabled = process.env.ABOT_WEB_ANALYTICS === "1" && process.env.NODE_ENV === "production" && isCloudSyncConfigured();
  useEffect(() => {
    if (!enabled || !pathname) return;
    void reportVisit(pathname, async (fn, args) => (await getSupabase()).rpc(fn, args), dayStore());
  }, [enabled, pathname]);
  return null;
}
