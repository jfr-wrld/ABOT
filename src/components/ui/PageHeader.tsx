import { BackLink } from "@/components/navigation/BackLink";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  back,
  action,
  subtitle,
}: {
  title: string;
  /** Href of the parent page; renders a labelled back link. */
  back?: { href: string; label: string };
  action?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <header className="px-4 pt-4">
      {back && (
        <BackLink
          href={back.href}
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-ctl pr-3 pl-1 text-sm text-text-muted hover:bg-surface hover:text-text"
        >
          <ChevronLeft aria-hidden="true" size={18} />
          {back.label}
        </BackLink>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
