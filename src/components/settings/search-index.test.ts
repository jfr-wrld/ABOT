import { describe, expect, it } from "vitest";
import { SETTINGS_INDEX, searchSettings } from "./search-index";

const titles = (q: string, label = (e: { title: string }) => e.title) => searchSettings(q, SETTINGS_INDEX, label).map((e) => e.title);

describe("settings search", () => {
  it("finds a setting by its name, ignoring case", () => {
    expect(titles("week")[0]).toBe("Week starts on");
    expect(titles("REST")).toEqual(expect.arrayContaining(["Default rest", "Rest alert"]));
  });

  it("finds by other words people use", () => {
    expect(titles("dark")).toContain("Theme");
    expect(titles("pounds")).toContain("Weight unit");
  });

  it("matches the shown language, accents aside", () => {
    const id: Record<string, string> = { Theme: "Tema", "Week starts on": "Minggu dimulai hari" };
    expect(titles("tema", (e) => id[e.title] ?? e.title)).toEqual(["Theme"]);
  });

  it("every typed word must match; nothing typed finds nothing", () => {
    expect(titles("rest alarm")).toEqual(["Rest alert"]);
    expect(titles("   ")).toEqual([]);
    expect(titles("zzz")).toEqual([]);
  });
});
