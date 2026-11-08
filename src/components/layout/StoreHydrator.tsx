"use client";

import { useEffect } from "react";
import { useHydration } from "@/store/hydration";
import { getRepository } from "@/data/repo";
import { attachPersistence, hydrateStores, setActiveRepository } from "@/store/persistence";

export function StoreHydrator() {
  const setHydrated = useHydration((s) => s.setHydrated);
  useEffect(() => {
    let detach: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { repo, durable, error } = await getRepository();
      try {
        await hydrateStores(repo);
      } catch (e) {
        if (!cancelled) {
          setHydrated({ durable, error: `Saved data could not be read (${e instanceof Error ? e.message : String(e)}).` });
        }
      }
      if (cancelled) return;
      setActiveRepository(repo);
      detach = attachPersistence(repo).detach;
      if (!useHydration.getState().hydrated) setHydrated({ durable, error });
    })();
    return () => {
      cancelled = true;
      detach?.();
    };
  }, [setHydrated]);
  return null;
}
