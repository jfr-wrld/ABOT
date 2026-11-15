import { describe, expect, it } from "vitest";
import { buildInbox, unread, type InboxInput } from "./inbox";
import { DEFAULT_SCHEDULE } from "./notifications/schedule";
import type { WorkoutSession } from "@/types/workout";

// Monday 2026-11-16, 08:00 local.
const now = new Date(2026, 10, 16, 8, 0).getTime();
const DAY = 86_400_000;
const base: InboxInput = {
  now,
  sessions: [],
  routines: [{ id: "push", name: "Push Day", folder: "", exercises: [] } as never],
  byId: {},
  schedule: { ...DEFAULT_SCHEDULE, enabled: true, days: { ...DEFAULT_SCHEDULE.days, 1: { on: true, routineId: "push" }, 0: { on: true, routineId: null } } },
  streak: 0,
  announcement: null,
  sync: { phase: "unconfigured", pendingCount: 0 },
};
const session = (id: string, at: number): WorkoutSession => ({ id, name: "Push Day", status: "completed", startedAt: at, finishedAt: at + 3_600_000, exercises: [] }) as never;

describe("buildInbox", () => {
  it("lists today's plan with its time, and yesterday's planned day when it was missed", () => {
    const items = buildInbox(base);
    expect(items.find((i) => i.kind === "schedule" && i.id.startsWith("plan:"))).toMatchObject({ title: "Today: {name} at {time}", params: { name: "Push Day", time: "17:30" } });
    expect(items.find((i) => i.id.startsWith("missed:"))).toMatchObject({ params: { name: "Free session" } });
  });
  it("drops today's plan once today is trained", () => {
    const items = buildInbox({ ...base, sessions: [session("a", now + 60_000)] });
    expect(items.some((i) => i.id.startsWith("plan:"))).toBe(false);
  });
  it("adds the streak, the announcement and a backup nudge after three workouts without an account", () => {
    const sessions = [1, 2, 3].map((d) => session(`s${d}`, now - d * 2 * DAY));
    const items = buildInbox({ ...base, sessions, streak: 3, announcement: "New: gold records", sync: { phase: "signed_out", pendingCount: 0 } });
    expect(items.find((i) => i.kind === "record")).toMatchObject({ title: "{n}-week streak", params: { n: 3 } });
    expect(items.find((i) => i.kind === "update")?.title).toBe("New: gold records");
    expect(items.find((i) => i.kind === "backup")).toMatchObject({ params: { n: 3 }, href: "/settings?section=data" });
  });
  it("keeps ids stable, so a seen item stays seen", () => {
    const a = buildInbox({ ...base, announcement: "Hi" });
    const b = buildInbox({ ...base, announcement: "Hi", now: now + 1000 });
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
    expect(unread(a, new Set(a.map((i) => i.id)))).toBe(0);
  });
});
