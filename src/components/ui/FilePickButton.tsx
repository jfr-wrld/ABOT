"use client";

import { useRef, useState, type RefObject } from "react";
import { FileDown } from "@/components/icons";
import { useT } from "@/i18n";

/**
 * A file field in the app's own material: a raised "Choose file" button and the chosen file's
 * name, both translated, instead of the browser's grey button and its English "No file chosen".
 * The real input stays (visually hidden, named by the caller's <label htmlFor={id}>) so screen
 * readers, tests and the picker itself work as before; the button only opens it.
 */
export function FilePickButton({
  id,
  accept,
  onFile,
  inputRef,
}: {
  id: string;
  accept: string;
  onFile: (file: File | undefined) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const t = useT();
  const [name, setName] = useState<string | null>(null);
  const own = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? own;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <input
        ref={ref}
        id={id}
        type="file"
        accept={accept}
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          setName(f?.name ?? null);
          onFile(f);
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="raised flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-text"
      >
        <FileDown aria-hidden="true" size={18} />
        {t("Choose file")}
      </button>
      <span className="min-w-0 truncate text-sm text-text-muted">{name ?? t("No file chosen")}</span>
    </div>
  );
}
