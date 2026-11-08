import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Pixel 7"],
    baseURL: "http://localhost:3100",
    trace: "off",
  },
  webServer: {
    command: "npm run dev -- -p 3100",
    url: "http://localhost:3100",
    // A server left running from an earlier build silently tests old code; reuse only on request
    // (E2E_REUSE_SERVER=1, e.g. to run the suite against `next start`).
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 120_000,
  },
});
