import { defineConfig, devices } from "@playwright/test";

// Layout tests run in WebKit, the engine every iPhone browser uses. The site's dev server hosts the lab.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { ...devices["Desktop Safari"], baseURL: "http://localhost:3100", deviceScaleFactor: 2 },
  webServer: {
    command: "pnpm --filter @duet/site dev",
    url: "http://localhost:3100/lab",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
