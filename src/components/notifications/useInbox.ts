"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { buildInbox, unread, type InboxItem } from "@/lib/inbox";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useReminderStore } from "@/store/useReminderStore";
import { useSyncStore } from "@/store/useSyncStore";
import { useRemoteConfig } from "@/lib/remote-config";
import { useAppUpdate } from "@/store/useAppUpdate";
import { useNow } from "@/lib/useNow";

const KEY = "abot.inbox.seen";
/** Enough to cover every item the inbox can hold at once, with room. */
const KEEP = 300;

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Which notifications this phone has shown: per device, like the rest of the inbox. */
const useSeen = create<{ ids: string[] | null; load: () => void; markAll: (ids: string[]) => void }>()((set, get) => ({
  ids: null,
  load: () => {
    if (get().ids === null) set({ ids: read() });
  },
  markAll: (ids) => {
    const next = [...new Set([...ids, ...(get().ids ?? read())])].slice(0, KEEP);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Without storage they count as seen until the page closes.
    }
    set({ ids: next });
  },
}));

/** The notifications and how many are new. */
export function useInbox(): { items: InboxItem[]; unreadCount: number; seen: ReadonlySet<string>; markAllSeen: () => void } {
  const sessions = useWorkoutStore((s) => s.sessions);
  const routines = useRoutineStore((s) => s.routines);
  const schedule = useReminderStore((s) => s.schedule);
  const phase = useSyncStore((s) => s.phase);
  const pendingCount = useSyncStore((s) => s.pendingCount ?? 0);
  const announcement = useRemoteConfig((s) => s.config.announcement);
  const update = useAppUpdate((s) => s.result);
  const release = update?.kind === "available" ? update.release : null;
  const now = useNow(60_000);
  const { ids, load, markAll } = useSeen();
  if (ids === null && typeof window !== "undefined") queueMicrotask(load);

  const items = useMemo(
    () =>
      buildInbox({
        now,
        sessions,
        routines,
        schedule,
        announcement,
        sync: { phase, pendingCount },
        appUpdate: release,
      }),
    [now, sessions, routines, schedule, announcement, phase, pendingCount, release],
  );
  const seen = useMemo(() => new Set(ids ?? []), [ids]);
  return { items, unreadCount: ids === null ? 0 : unread(items, seen), seen, markAllSeen: () => markAll(items.map((i) => i.id)) };
}
