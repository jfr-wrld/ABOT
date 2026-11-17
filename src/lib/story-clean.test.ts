import { describe, expect, it } from "vitest";
import { STORY_HEIGHT, STORY_PRESETS, STORY_WIDTH, TEXT_POSITIONS, cleanBlockOrigin } from "./story-exporter";

/** Instagram's top bar and reply box; the founder badge ends above the top one (y 206). */
const SAFE_TOP = 230;
const SAFE_BOTTOM = STORY_HEIGHT - 250;

describe("Clean story layout", () => {
  it("comes first, so it is the default and always free", () => {
    expect(STORY_PRESETS[0]!.id).toBe("clean");
  });

  it("keeps every one of the nine text spots inside the safe area", () => {
    for (const { id } of TEXT_POSITIONS) {
      for (const h of [200, 420]) {
        const o = cleanBlockOrigin(id, h);
        expect(o.top).toBeGreaterThanOrEqual(SAFE_TOP);
        expect(o.top + h).toBeLessThanOrEqual(SAFE_BOTTOM);
        expect(o.x).toBeGreaterThan(0);
        expect(o.x).toBeLessThan(STORY_WIDTH);
      }
    }
  });

  it("aligns by column and places by row", () => {
    expect(cleanBlockOrigin("top-right", 300)).toEqual({ x: STORY_WIDTH - 72, top: SAFE_TOP, align: "right" });
    expect(cleanBlockOrigin("bottom-left", 300)).toEqual({ x: 72, top: SAFE_BOTTOM - 300, align: "left" });
    expect(cleanBlockOrigin("center", 300)).toEqual({ x: STORY_WIDTH / 2, top: (STORY_HEIGHT - 300) / 2, align: "center" });
  });
});
