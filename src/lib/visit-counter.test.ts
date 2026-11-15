import { describe, expect, it, vi } from "vitest";
import { firstVisitToday, jakartaDay, reportVisit } from "./visit-counter";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };

describe("visit counter", () => {
  it("counts a browser once per day", () => {
    const s = memory();
    expect(firstVisitToday(s, "2026-11-15")).toBe(true);
    expect(firstVisitToday(s, "2026-11-15")).toBe(false);
    expect(firstVisitToday(s, "2026-11-16")).toBe(true);
  });

  it("treats blocked or missing storage as a first visit without throwing", () => {
    expect(firstVisitToday(broken, "2026-11-15")).toBe(true);
    expect(firstVisitToday(null, "2026-11-15")).toBe(true);
  });

  it("uses the Jakarta date", () => {
    expect(jakartaDay(new Date("2026-11-15T18:00:00Z"))).toBe("2026-11-16");
    expect(jakartaDay(new Date("2026-11-15T16:59:00Z"))).toBe("2026-11-15");
  });

  it("sends the page and whether it is the first today, never for /admin, and swallows errors", async () => {
    const rpc = vi.fn(async () => ({}));
    const s = memory();
    const now = new Date("2026-11-15T03:00:00Z");
    await reportVisit("/workout", rpc, s, now);
    await reportVisit("/progress", rpc, s, now);
    expect(rpc).toHaveBeenNthCalledWith(1, "track_visit", { p_path: "/workout", p_first_today: true });
    expect(rpc).toHaveBeenNthCalledWith(2, "track_visit", { p_path: "/progress", p_first_today: false });
    await reportVisit("/admin", rpc, s, now);
    await reportVisit("/admin/x", rpc, s, now);
    expect(rpc).toHaveBeenCalledTimes(2);
    await expect(reportVisit("/", async () => { throw new Error("offline"); }, s, now)).resolves.toBeUndefined();
  });
});
