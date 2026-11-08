import { friendlyError, type ErrorStage } from "@/lib/syncStatus";

/** A sign-in or backup error in plain words, with the server's own message behind Details. */
export function SyncError({ stage, raw, className = "" }: { stage: ErrorStage; raw: string; className?: string }) {
  return (
    <div role="alert" className={className}>
      <p className="text-sm text-failure">{friendlyError(stage, raw)}</p>
      <details className="text-xs text-text-muted">
        <summary className="inline-flex min-h-11 items-center rounded-ctl hover:text-text">Details</summary>
        <p className="break-words font-mono">{raw}</p>
      </details>
    </div>
  );
}
