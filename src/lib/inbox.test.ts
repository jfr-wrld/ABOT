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
  schedule: { ...DEFAULT_SCHEDULE, enabled: true, days: { ...DEFAULT_SCHEDULE.days, 1: { on: true, routineId: "push" }, 0: { on: true, routineId: null } } },
  announcement: null,
  sync: { phase: "unconfigured", pendingCount: 0 },
};
const session = (id: string, at: number): WorkoutSession => ({ id, name: "Push Day", status: "completed", startedAt: at, finishedAt: at + 3_600_000, exercises: [] }) as never;

describe("buildInbox", () => {
  it("lists yesterday's planned day when it was missed, to log it on its own day, and not today's plan", () => {
    const items = buildInbox(base);
    expect(items.some((i) => i.id.startsWith("plan:"))).toBe(false);
    const missed = items.find((i) => i.id.startsWith("missed:"));
    expect(missed).toMatchObject({ params: { name: "Free session" } });
    expect(missed?.href).toMatch(/^\/history\/edit\?at=\d+$/);
  });
  it("leaves records and the streak to their own screens", () => {
    const sessions = [1, 2, 3].map((d) => session(`s${d}`, now - d * 2 * DAY));
    expect(buildInbox({ ...base, sessions }).some((i) => (i.kind as string) === "record")).toBe(false);
  });
  it("adds the announcement and a backup nudge after three workouts without an account", () => {
    const sessions = [1, 2, 3].map((d) => session(`s${d}`, now - d * 2 * DAY));
    const items = buildInbox({ ...base, sessions, announcement: "New: gold records", sync: { phase: "signed_out", pendingCount: 0 } });
    expect(items.find((i) => i.kind === "update")?.title).toBe("New: gold records");
    expect(items.find((i) => i.kind === "backup")).toMatchObject({ params: { n: 3 }, href: "/settings?section=data" });
  });
  it("shows the announcement as written and a newer app build as a translatable item to Settings > About", () => {
    const items = buildInbox({ ...base, announcement: "Gym closed Friday", appUpdate: { build: 293, version: "1.0.293", publishedAt: new Date(now - DAY).toISOString() } });
    expect(items.find((i) => i.id.startsWith("ann:"))).toMatchObject({ plain: true });
    expect(items.find((i) => i.id === "app-update:293")).toMatchObject({
      kind: "update",
      at: now - DAY,
      title: "ABOT {version} is out. Tap to update.",
      params: { version: "1.0.293" },
      href: "/settings?section=about",
    });
    expect(buildInbox({ ...base, appUpdate: null }).some((i) => i.id.startsWith("app-update:"))).toBe(false);
  });
  it("keeps ids stable, so a seen item stays seen", () => {
    const a = buildInbox({ ...base, announcement: "Hi" });
    const b = buildInbox({ ...base, announcement: "Hi", now: now + 1000 });
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
    expect(unread(a, new Set(a.map((i) => i.id)))).toBe(0);
  });
});
