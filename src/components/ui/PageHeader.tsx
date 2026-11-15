import { BackLink } from "@/components/navigation/BackLink";
import { ChevronLeft } from "@/components/icons";
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
          className="glass-icon rounded-full inline-flex min-h-11 items-center gap-1 pr-3 pl-1 text-sm text-text"
        >
          <ChevronLeft aria-hidden="true" size={18} />
          {back.label}
        </BackLink>
      )}
      {/* A clear step between the back pill and the page title, so the two never touch. */}
      <div className={`flex items-start justify-between gap-3 ${back ? "mt-4" : ""}`}>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
