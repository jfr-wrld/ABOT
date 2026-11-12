import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// E2E_DEV=1 runs against `next dev` (hot reload, slow first visit to each page) for debugging a
// test while editing. The default is a production build: every page is compiled once, up front.
const dev = process.env.E2E_DEV === "1";

export default defineConfig({
  testDir: "e2e",
  // Every test opens its own browser context, so its IndexedDB and storage start empty and no
  // two tests share state: they can run side by side.
  fullyParallel: true,
  // One core stays free for the app server: at 100% the busiest tests missed their timeouts.
  workers: dev ? 1 : "75%",
  retries: 0,
  // Four tests load pages at once, so a page can take longer than alone; 10 s, not 5.
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    // A phone first: the app is built for one.
    ...devices["Pixel 7"],
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    // Entrances and sheet slides finish at once; tests about motion opt back in (battery).
    reducedMotion: "reduce",
    // The reminder worker is the only service worker; its tests allow it (reminders.spec).
    serviceWorkers: "block",
  },
  webServer: {
    // `next start`, not a static export of `out/`: the web build keeps its server headers
    // (the CSP the security tests check). The static export is the Android build.
    // NEXT_PUBLIC_ABOT_DEV=1 keeps the developer tools a dev server has (the admin Device module,
    // the PRO simulator in Settings), which the admin and pro specs drive.
    command: dev ? `npm run dev -- -p ${PORT}` : `NEXT_PUBLIC_ABOT_DEV=1 npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // A server left running from an earlier build silently tests old code; reuse only on request
    // (E2E_REUSE_SERVER=1, e.g. after building once and running a few specs repeatedly).
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 600_000,
  },
});
