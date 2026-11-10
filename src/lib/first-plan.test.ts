import { describe, expect, it } from "vitest";
import { firstTemplate } from "./first-plan";

describe("first workout from three answers", () => {
  it("picks full body for few days, upper/lower for four, push/pull/legs for five", () => {
    expect(firstTemplate({ goal: "muscle", level: "some", days: 3 }).id).toBe("tpl-fb-1");
    expect(firstTemplate({ goal: "strength", level: "experienced", days: 4 }).id).toBe("tpl-upper");
    expect(firstTemplate({ goal: "muscle", level: "experienced", days: 5 }).id).toBe("tpl-push-a");
  });

  it("keeps new lifters on simpler splits", () => {
    expect(firstTemplate({ goal: "muscle", level: "new", days: 5 }).id).toBe("tpl-upper");
    expect(firstTemplate({ goal: "fat_loss", level: "new", days: 5 }).id).toBe("tpl-fb-1");
  });
});
