import { beforeEach, describe, expect, it, vi } from "vitest";

const download = vi.fn(async () => ({ id: 7 }));
const install = vi.fn(async () => ({ needsPermission: false }));
vi.mock("@/lib/native/app-updater", () => ({
  AppUpdate: { download, install },
  errorText: (e: unknown) => String(e),
  // A download that never ends during the test.
  followDownload: () => new Promise(() => {}),
}));

const showUpdateNotification = vi.fn(async () => true);
const clearUpdateNotification = vi.fn(async () => {});
vi.mock("@/lib/native/notify", () => ({ showUpdateNotification, clearUpdateNotification }));

const release = (build: number) => ({ build, version: `1.0.${build}`, apkUrl: `https://x/apk-${build}.apk`, publishedAt: null, notes: "" });
vi.mock("@/lib/app-update", async (orig) => ({
  ...(await orig<typeof import("@/lib/app-update")>()),
  checkForUpdate: vi.fn(async () => ({ kind: "available", release: release(103), changes: [release(103), release(102), release(101)] })),
}));

const { useAppUpdate } = await import("./useAppUpdate");

describe("app update with more than one new release", () => {
  beforeEach(() => {
    download.mockClear();
    install.mockClear();
    showUpdateNotification.mockClear();
    clearUpdateNotification.mockClear();
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it("drops an older downloaded build and offers the newest one", async () => {
    useAppUpdate.setState({ installed: 100, phase: "ready", build: 101, modal: false, result: null, checking: false });
    await useAppUpdate.getState().check("launch");
    expect(useAppUpdate.getState()).toMatchObject({ phase: "idle", build: null, modal: true });

    // start() then follows the download, which never ends here: do not wait for it.
    void useAppUpdate.getState().start();
    await vi.waitFor(() => expect(useAppUpdate.getState().build).toBe(103));
    expect(install).not.toHaveBeenCalled();
    expect(download).toHaveBeenCalledWith(expect.objectContaining({ url: "https://x/apk-103.apk" }));
  });

  it("installs the file on the phone when it is the newest build", async () => {
    useAppUpdate.setState({ installed: 100, phase: "ready", build: 103, modal: false, result: null, checking: false });
    await useAppUpdate.getState().check("manual");
    await useAppUpdate.getState().start();
    expect(download).not.toHaveBeenCalled();
    expect(install).toHaveBeenCalled();
  });

  it("announces a new build in Android's shade once, on an automatic check only", async () => {
    useAppUpdate.setState({ installed: 100, phase: "idle", build: null, modal: false, result: null, checking: false });
    await useAppUpdate.getState().check("manual");
    expect(showUpdateNotification).not.toHaveBeenCalled();

    await useAppUpdate.getState().check("launch");
    await vi.waitFor(() => expect(showUpdateNotification).toHaveBeenCalledWith("1.0.103"));
    await vi.waitFor(() => expect(localStorage.getItem("abot.update-notified")).toBe("103"));
    await useAppUpdate.getState().check("launch");
    expect(showUpdateNotification).toHaveBeenCalledTimes(1);
  });

  it("asks again next time when notifications were off", async () => {
    showUpdateNotification.mockResolvedValueOnce(false);
    useAppUpdate.setState({ installed: 100, phase: "idle", build: null, modal: false, result: null, checking: false });
    await useAppUpdate.getState().check("launch");
    await vi.waitFor(() => expect(showUpdateNotification).toHaveBeenCalledTimes(1));
    await useAppUpdate.getState().check("launch");
    expect(showUpdateNotification).toHaveBeenCalledTimes(2);
  });

  it("takes the notification away once Update now starts the download", async () => {
    useAppUpdate.setState({ installed: 100, phase: "idle", build: null, modal: false, result: null, checking: false });
    await useAppUpdate.getState().check("manual");
    void useAppUpdate.getState().start();
    expect(clearUpdateNotification).toHaveBeenCalled();
  });
});
