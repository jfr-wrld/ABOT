import { describe, expect, it, vi } from "vitest";
import { requestPersistentStorage } from "./storagePersistence";

const nav = (storage: unknown) => ({ storage }) as Pick<Navigator, "storage">;

describe("requestPersistentStorage", () => {
  it("is unsupported without the Storage API", async () => {
    expect(await requestPersistentStorage(nav(undefined))).toBe("unsupported");
    expect(await requestPersistentStorage(nav({}))).toBe("unsupported");
  });
  it("does not ask again when already persisted", async () => {
    const persist = vi.fn();
    expect(await requestPersistentStorage(nav({ persisted: async () => true, persist }))).toBe("persisted");
    expect(persist).not.toHaveBeenCalled();
  });
  it("returns what the browser grants", async () => {
    expect(await requestPersistentStorage(nav({ persisted: async () => false, persist: async () => true }))).toBe("persisted");
    expect(await requestPersistentStorage(nav({ persisted: async () => false, persist: async () => false }))).toBe("not_persisted");
  });
  it("treats a rejection as not persisted", async () => {
    const s = { persisted: async () => false, persist: async () => Promise.reject(new Error("denied")) };
    expect(await requestPersistentStorage(nav(s))).toBe("not_persisted");
  });
});
