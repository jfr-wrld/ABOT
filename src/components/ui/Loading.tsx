import { useHydration } from "@/store/hydration";

/** Shown while persisted stores load; also surfaces storage read and write errors inline. */
export function HydrationGate({ children }: { children: React.ReactNode }) {
  const { hydrated, error, writeError } = useHydration();
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
          {error}
        </p>
      )}
      {writeError && (
        <p role="alert" className="mx-4 mt-3 rounded-ctl border border-failure/60 px-3 py-2 text-sm text-failure">
          {writeError} ABOT keeps your changes in memory and retries when you come back to the app. Export a
          backup from Settings to keep a copy now.
        </p>
      )}
      {children}
    </>
  );
}
