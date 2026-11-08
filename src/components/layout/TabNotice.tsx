"use client";

import { useEffect, useRef, useState } from "react";
import { AbotMark } from "@/components/brand/AbotMark";
import { useHydration } from "@/store/hydration";
import { takeOverHere } from "@/store/appSession";

/**
 * Shown in every tab except the one that writes. A modal dialog, so nothing behind it can be
 * edited from here; Escape does not close it because there is nothing safe to go back to.
 */
export function TabNotice() {
  const tab = useHydration((s) => s.tab);
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const open = tab === "elsewhere";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="tab-notice-title"
      onCancel={(e) => e.preventDefault()}
      className="m-auto w-[calc(100%-32px)] max-w-sm rounded-card border border-white/[0.08] bg-surface p-5 text-text backdrop:bg-black/80"
    >
      <span className="text-accent" aria-hidden="true">
        <AbotMark size={36} />
      </span>
      <h2 id="tab-notice-title" className="mt-3 text-xl font-bold tracking-tight">
        ABOT is open in another tab
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        One tab saves your training at a time, so two tabs never overwrite each other. Switch to the
        other tab, or move ABOT here. The other tab saves what it has first.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await takeOverHere();
          } finally {
            setBusy(false);
          }
        }}
        className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-accent text-base font-bold text-on-accent transition-[filter] hover:brightness-110 disabled:opacity-60"
      >
        {busy ? "Moving ABOT here" : "Use ABOT here"}
      </button>
    </dialog>
  );
}
