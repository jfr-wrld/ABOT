import { describe, expect, it } from "vitest";
import { REST_ALARM_GRACE_MS, pageRingsRestOver } from "./rest-alert";

const base = { alert: true, native: false, visible: true, overdueMs: 0 };

describe("pageRingsRestOver", () => {
  it("rings in the browser, on screen or not", () => {
    expect(pageRingsRestOver(base)).toBe(true);
    expect(pageRingsRestOver({ ...base, visible: false })).toBe(true);
  });

  it("rings in the app only while it is on screen, whatever the notification permission", () => {
    expect(pageRingsRestOver({ ...base, native: true })).toBe(true);
    expect(pageRingsRestOver({ ...base, native: true, visible: false })).toBe(false);
  });

  it("stays quiet with Rest alert off, or when rest ended while the app was asleep", () => {
    expect(pageRingsRestOver({ ...base, alert: false })).toBe(false);
    expect(pageRingsRestOver({ ...base, overdueMs: REST_ALARM_GRACE_MS + 1 })).toBe(false);
  });
});
