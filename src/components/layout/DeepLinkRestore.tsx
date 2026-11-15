"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { takeDeepLink } from "@/lib/native/deep-link";

/** Android build only: opens the route a full load parked (src/lib/native/deep-link.ts). */
export function DeepLinkRestore() {
  const router = useRouter();
  useEffect(() => {
    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      // No storage: nothing was parked.
    }
    const to = takeDeepLink(storage);
    if (to) router.replace(to);
  }, [router]);
  return null;
}
