"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Bottom sheet on phones, centred dialog from 640px up. Native <dialog> gives us
 * Escape-to-close, focus containment and the backdrop for free.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Click on the backdrop (outside the panel) closes.
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-0 h-dvh max-h-dvh w-full max-w-none bg-transparent p-0 open:flex open:flex-col open:justify-end sm:open:justify-center"
    >
      <div className="mx-auto flex max-h-[88dvh] w-full max-w-[640px] flex-col rounded-t-card bg-surface sm:max-h-[80dvh] sm:rounded-card">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && (
          <footer className="border-t border-line px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:pb-3">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
