import { beforeEach, describe, expect, it } from "vitest";
import { previousIs, rememberScroll, rememberedScroll, resetNavMemory, visit } from "./nav-memory";

describe("nav memory", () => {
  beforeEach(resetNavMemory);

  it("remembers the offset per address", () => {
    rememberScroll("/exercises", 1200);
    rememberScroll("/profile?tab=lifts", 300);
    expect(rememberedScroll("/exercises")).toBe(1200);
    expect(rememberedScroll("/profile?tab=lifts")).toBe(300);
    expect(rememberedScroll("/history")).toBeUndefined();
  });

  it("knows when the parent is the page before, so Back can go back", () => {
    visit("/", false);
    visit("/exercises", false);
    visit("/exercises/detail", false);
    expect(previousIs("/exercises")).toBe(true);
    expect(previousIs("/")).toBe(false);

    // Browser back: the trail drops the detail page.
    visit("/exercises", true);
    expect(previousIs("/")).toBe(true);

    // Opened straight from elsewhere: the parent is not behind it.
    visit("/progress/trend", false);
    expect(previousIs("/profile")).toBe(false);
  });

  it("does not count a search-only change as a new page", () => {
    visit("/profile", false);
    visit("/profile", false);
    visit("/progress/trend", false);
    expect(previousIs("/profile")).toBe(true);
  });
});
