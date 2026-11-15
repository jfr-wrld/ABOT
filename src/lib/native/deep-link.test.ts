import { describe, expect, it, vi } from "vitest";
import { DEEP_LINK_KEY, DEEP_LINK_SCRIPT, takeDeepLink } from "./deep-link";

function run(pathname: string, search = "", hash = "", storageThrows = false) {
  const stored = new Map<string, string>();
  const replaceState = vi.fn();
  const env = {
    location: { pathname, search, hash },
    history: { state: { keep: 1 }, replaceState },
    sessionStorage: {
      setItem: (k: string, v: string) => {
        if (storageThrows) throw new Error("blocked");
        stored.set(k, v);
      },
    },
  };
  new Function("location", "history", "sessionStorage", DEEP_LINK_SCRIPT)(env.location, env.history, env.sessionStorage);
  return { stored, replaceState };
}

describe("deep link on a full load in the Android app", () => {
  it("parks a deep route and puts the address back on /, where the served page belongs", () => {
    const { stored, replaceState } = run("/permissions/", "?next=%2F", "#x");
    expect(stored.get(DEEP_LINK_KEY)).toBe("/permissions/?next=%2F#x");
    expect(replaceState).toHaveBeenCalledWith({ keep: 1 }, "", "/");
  });

  it("leaves the home page alone", () => {
    const { stored, replaceState } = run("/");
    expect(stored.size).toBe(0);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("does not move the address when it cannot remember where to go", () => {
    const { replaceState } = run("/workout/", "", "", true);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("hands the parked route over once, and only an in-app path", () => {
    const m = new Map([[DEEP_LINK_KEY, "/permissions/?next=%2F"]]);
    const s = { getItem: (k: string) => m.get(k) ?? null, removeItem: (k: string) => void m.delete(k) };
    expect(takeDeepLink(s)).toBe("/permissions/?next=%2F");
    expect(takeDeepLink(s)).toBeNull();
    m.set(DEEP_LINK_KEY, "//evil.example/x");
    expect(takeDeepLink(s)).toBeNull();
    m.set(DEEP_LINK_KEY, "https://evil.example/");
    expect(takeDeepLink(s)).toBeNull();
    expect(takeDeepLink(null)).toBeNull();
  });
});
