import { beforeEach, describe, expect, it, vi } from "vitest";

const download = vi.fn(async () => ({ id: 7 }));
const install = vi.fn(async () => ({ needsPermission: false }));
vi.mock("@/lib/native/app-updater", () => ({
  AppUpdate: { download, install },
  errorText: (e: unknown) => String(e),
  // A download that never ends during the test.
  followDownload: () => new Promise(() => {}),
}));

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
});
