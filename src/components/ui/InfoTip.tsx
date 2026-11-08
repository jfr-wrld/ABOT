"use client";

import { useId, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { useT } from "@/i18n";

/**
 * A title with an (i) beside it: the explanation stays hidden until asked for, so a settings
 * screen reads as a list of controls rather than paragraphs. `title` is the label or heading
 * element itself; `name` is what the button says it explains, for screen readers.
 */
export function InfoTip({
  title,
  name,
  children,
  className = "",
}: {
  title: ReactNode;
  name: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const t = useT();
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex items-center">
        {title}
        <button
          type="button"
          aria-label={t("About {name}", { name })}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className={`-my-2 ml-0.5 flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-ink/[0.05] ${
            open ? "text-accent" : "text-text-muted hover:text-text"
          }`}
        >
          <Info aria-hidden="true" size={15} />
        </button>
      </div>
      <p id={id} hidden={!open} className="max-w-[46ch] text-xs leading-relaxed text-text-muted">
        {children}
      </p>
    </div>
  );
}
