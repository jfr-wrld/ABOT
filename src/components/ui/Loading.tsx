import { useHydration } from "@/store/hydration";

/** Shown while persisted stores load; also surfaces a storage read error inline. */
export function HydrationGate({ children }: { children: React.ReactNode }) {
  const { hydrated, error } = useHydration();
  if (!hydrated) {
    return (
      <p role="status" className="px-4 py-10 text-center text-sm text-text-muted">
        Loading saved workouts from this device
      </p>
    );
  }
  return (
    <>
      {error && (
        <p role="alert" className="mx-4 mt-3 rounded-ctl border border-failure/60 px-3 py-2 text-sm text-failure">
          {error} You can keep logging; export a backup from Settings to keep a copy.
        </p>
      )}
      {children}
    </>
  );
}
