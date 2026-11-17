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

  it("counts a section of the same page as its own entry, so Back from it does not loop", () => {
    visit("/profile", false);
    visit("/settings", false);
    visit("/settings?section=general", false);
    // Back from the General section reaches Settings itself...
    expect(previousIs("/settings")).toBe(true);
    visit("/settings", true);
    // ...and Back from Settings reaches Profile, not the section again.
    expect(previousIs("/profile")).toBe(true);
  });

  it("matches a bare parent path whatever its query, and a query exactly", () => {
    visit("/profile?tab=lifts", false);
    visit("/progress/trend", false);
    expect(previousIs("/profile")).toBe(true);
    expect(previousIs("/profile?tab=lifts")).toBe(true);
    expect(previousIs("/profile?tab=body")).toBe(false);
  });

  it("does not take one workout's page for another's", () => {
    visit("/history?id=a", false);
    visit("/history?id=b", false);
    visit("/history/edit?id=b", false);
    expect(previousIs("/history?id=b")).toBe(true);
    expect(previousIs("/history?id=a")).toBe(false);
  });
});
