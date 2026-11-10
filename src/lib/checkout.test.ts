import { afterEach, describe, expect, it } from "vitest";
import { isMidtransPage, startMidtransCheckout, waitForOrder, checkoutAvailable, whenForeground, type OrderStatus } from "./checkout";
import { DEFAULT_REMOTE_CONFIG, useRemoteConfig } from "./remote-config";

afterEach(() => useRemoteConfig.setState({ config: DEFAULT_REMOTE_CONFIG, source: "default" }));

describe("checkout", () => {
  it("is honest when payments are not set up: no Supabase in the build, or switched off", async () => {
    expect(checkoutAvailable()).toBe(false);
    useRemoteConfig.setState({ config: { ...DEFAULT_REMOTE_CONFIG, checkoutEnabled: true } });
    // This test build has no Supabase URL, so still nothing to pay through.
    expect(checkoutAvailable()).toBe(false);
    expect(await startMidtransCheckout("annual")).toEqual({ ok: false, reason: "not_connected" });
  });

  it("reads the order until it settles, and stops early once it does", async () => {
    const seen: OrderStatus[] = ["pending", "pending", "paid"];
    let calls = 0;
    const status = await waitForOrder("ABOT-ANNUAL-X-Y", { read: async () => seen[calls++] ?? "paid", sleep: async () => {} });
    expect(status).toBe("paid");
    expect(calls).toBe(3);
  });

  it("gives back pending when the buyer has not paid yet, and null when nothing can be read", async () => {
    expect(await waitForOrder("o", { tries: 3, read: async () => "pending", sleep: async () => {} })).toBe("pending");
    expect(await waitForOrder("o", { tries: 2, read: async () => null, sleep: async () => {} })).toBeNull();
  });

  it("waits for the tab to be visible before it resolves, and resolves at once when it already is", async () => {
    const listeners: (() => void)[] = [];
    const doc = {
      visibilityState: "hidden" as DocumentVisibilityState,
      addEventListener: (_: string, f: () => void) => listeners.push(f),
      removeEventListener: () => {},
    };
    let done = false;
    const p = whenForeground(false, doc as never).then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    doc.visibilityState = "visible";
    listeners.forEach((f) => f());
    await p;
    expect(done).toBe(true);
    await expect(whenForeground(false, { ...doc, visibilityState: "visible" } as never)).resolves.toBeUndefined();
  });
});

describe("isMidtransPage", () => {
  it("opens Midtrans' payment pages only", () => {
    expect(isMidtransPage("https://app.sandbox.midtrans.com/snap/v4/redirection/abc")).toBe(true);
    expect(isMidtransPage("https://app.midtrans.com/snap/v4/redirection/abc")).toBe(true);
    expect(isMidtransPage("http://app.midtrans.com/snap")).toBe(false);
    expect(isMidtransPage("https://app.midtrans.com.evil.com/snap")).toBe(false);
    expect(isMidtransPage("javascript:alert(1)")).toBe(false);
  });
});
