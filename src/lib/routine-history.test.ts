import { describe, expect, it } from "vitest";
import { lastDoneByRoutine, lastDoneText } from "./routine-history";
import { makeT } from "@/i18n";
import type { WorkoutSession } from "@/types/workout";

const t = makeT("en");
const s = (routineId: string | undefined, at: number, status: WorkoutSession["status"] = "completed"): WorkoutSession => ({ id: String(at), name: "", routineId, startedAt: at, status, exercises: [] });

describe("routine history", () => {
  it("keeps the latest finished workout of each routine", () => {
    const map = lastDoneByRoutine([s("a", 100), s("a", 300), s("b", 200), s("a", 900, "active"), s(undefined, 50)]);
    expect(map).toEqual({ a: 300, b: 200 });
  });

  it("says when in calendar days", () => {
    const now = new Date(2026, 10, 12, 9).getTime();
    expect(lastDoneText(undefined, now, t)).toBe("Not done yet");
    expect(lastDoneText(new Date(2026, 10, 12, 7).getTime(), now, t)).toBe("Last done today");
    expect(lastDoneText(new Date(2026, 10, 11, 22).getTime(), now, t)).toBe("Last done yesterday");
    expect(lastDoneText(new Date(2026, 10, 9, 12).getTime(), now, t)).toBe("Last done 3 days ago");
  });
});
