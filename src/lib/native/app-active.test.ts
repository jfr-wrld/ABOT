import { describe, expect, it, vi } from "vitest";
import { isAppActive, onAppPause, setAppActiveForTest, subscribeAppActive } from "./app-active";

describe("app-active", () => {
  it("tells listeners when the app goes to the background and back, and runs pause hooks once", () => {
    const changed = vi.fn();
    const paused = vi.fn();
    const off = subscribeAppActive(changed);
    const offPause = onAppPause(paused);

    setAppActiveForTest(false);
    expect(isAppActive()).toBe(false);
    setAppActiveForTest(false);
    expect(paused).toHaveBeenCalledTimes(1);

    setAppActiveForTest(true);
    expect(isAppActive()).toBe(true);
    expect(changed).toHaveBeenCalledTimes(2);
    expect(paused).toHaveBeenCalledTimes(1);

    off();
    offPause();
    setAppActiveForTest(false);
    expect(changed).toHaveBeenCalledTimes(2);
    setAppActiveForTest(true);
  });
});
