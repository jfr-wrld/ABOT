"use client";

import { useHydration } from "@/store/hydration";
import { useT } from "@/i18n";

/** The route-level fallback in the root layout. */
export function LoadingStatus() {
  const t = useT();
  return (
    <p role="status" className="px-4 py-10 text-center text-sm text-text-muted">
      {t("Loading")}
    </p>
  );
}

/** Shown while persisted stores load. Storage errors show on every page (layout/StorageAlert). */
export function HydrationGate({ children }: { children: React.ReactNode }) {
  const hydrated = useHydration((s) => s.hydrated);
  const t = useT();
  if (!hydrated) {
    return (
      <p role="status" className="px-4 py-10 text-center text-sm text-text-muted">
        {t("Loading saved workouts from this device")}
      </p>
    );
  }
  return <>{children}</>;
}
