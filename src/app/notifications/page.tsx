"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, ChevronRight, CloudOff, LayoutGrid, Megaphone, type IconComponent } from "@/components/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { HydrationGate } from "@/components/ui/Loading";
import { EmptyArt } from "@/components/ui/EmptyArt";
import { useInbox } from "@/components/notifications/useInbox";
import { relativeDay } from "@/lib/home";
import { useNow } from "@/lib/useNow";
import { useT } from "@/i18n";
import type { InboxItem, InboxKind } from "@/lib/inbox";

/** The filter row: every kind, each with its icon, and how many it holds. */
const FILTERS: { value: InboxKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "schedule", label: "Schedule" },
  { value: "update", label: "Updates" },
  { value: "backup", label: "Backup" },
];

const ICON: Record<InboxKind, { Icon: IconComponent; tone: string }> = {
  schedule: { Icon: CalendarDays, tone: "text-accent" },
  update: { Icon: Megaphone, tone: "text-text" },
  backup: { Icon: CloudOff, tone: "text-failure" },
};

export default function NotificationsPage() {
  return (
    <HydrationGate>
      <Inbox />
    </HydrationGate>
  );
}

/**
 * Notifications, newest first: a missed workout, announcements, app updates and backup
 * trouble, all worked out on this phone. Opening the page marks them seen, after this visit
 * shows which were new.
 */
function Inbox() {
  const t = useT();
  const { items, seen, markAllSeen } = useInbox();
  const now = useNow(60_000);
  const mark = useRef(markAllSeen);
  useEffect(() => {
    mark.current = markAllSeen;
  });
  useEffect(() => {
    // Leave the "new" marks for this visit; the next one starts clean.
    const id = setTimeout(() => mark.current(), 1500);
    return () => clearTimeout(id);
  }, []);
  const [kind, setKind] = useState<InboxKind | "all">("all");
  const shown = kind === "all" ? items : items.filter((i) => i.kind === kind);
  const fresh = shown.filter((i) => !seen.has(i.id));
  const older = shown.filter((i) => seen.has(i.id));
  return (
    <main className="flex flex-1 flex-col pb-10">
      <PageHeader title={t("Notifications")} back={{ href: "/", label: t("Home") }} />
      <div className="flex flex-col gap-4 px-4 pt-4">
        <div className="-mx-4 overflow-x-auto px-4" role="group" aria-label={t("Filter notifications")}>
          <div className="flex w-max gap-1.5 pb-1">
            {FILTERS.map((f) => {
              const n = f.value === "all" ? items.length : items.filter((i) => i.kind === f.value).length;
              const Icon = f.value === "all" ? LayoutGrid : ICON[f.value].Icon;
              const on = kind === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setKind(f.value)}
                  className={`chip flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${on ? "border-accent bg-accent-tint text-text" : "text-text-muted"}`}
                >
                  <Icon aria-hidden="true" size={16} className={f.value === "all" ? "" : ICON[f.value].tone} />
                  {t(f.label)}
                  <span className="num text-xs text-text-muted">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
        {shown.length === 0 ? (
          <div className="panel flex flex-col items-center gap-3 px-4 py-8 text-center">
            <EmptyArt icon={Bell} />
            <p className="text-sm text-text-muted">{t("You're all caught up.")}</p>
          </div>
        ) : (
          <>
            {fresh.length > 0 && <Group title={t("New")} items={fresh} now={now} unread />}
            {older.length > 0 && <Group title={t("Earlier")} items={older} now={now} />}
          </>
        )}
      </div>
    </main>
  );
}

function Group({ title, items, now, unread = false }: { title: string; items: InboxItem[]; now: number; unread?: boolean }) {
  const t = useT();
  return (
    <section aria-label={title}>
      <h2 className="section-title mb-2">{title}</h2>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border bg-surface">
        {items.map((i) => {
          const { Icon, tone } = ICON[i.kind];
          const text = i.plain ? i.title : t(i.title, i.params);
          const body = (
            <>
              <span aria-hidden="true" className={`tile flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 ${tone}`}>
                <Icon size={20} variant="bold" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${unread ? "font-semibold text-text" : "text-text-muted"}`}>{text}</span>
                <span className="num mt-0.5 block text-xs text-text-muted">{relativeDay(i.at, now, t)}</span>
              </span>
              {unread && <span aria-label={t("New")} className="size-2 shrink-0 rounded-full bg-accent" />}
              {i.href && <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-text-muted" />}
            </>
          );
          return (
            <li key={i.id}>
              {i.href ? (
                <Link href={i.href} className="flex min-h-14 items-center gap-3 px-3 py-2.5 hover:bg-ink/[0.03]">
                  {body}
                </Link>
              ) : (
                <div className="flex min-h-14 items-center gap-3 px-3 py-2.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
