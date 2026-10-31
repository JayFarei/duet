import { defineConfig, devices } from "@playwright/test";

// WebKit exercises the Safari engine; Chromium checks ordinary browser fallbacks.
// Desktop engines cannot certify the physical Duo or native Safari chrome.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  workers: 2,
  projects: [{ name: "webkit", use: { browserName: "webkit" } }, { name: "chromium", use: { browserName: "chromium" } }],
  snapshotPathTemplate: "{testDir}/baselines/{projectName}/{testFilePath}/{arg}{ext}",
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { ...devices["Desktop Safari"], baseURL: "http://localhost:3100", deviceScaleFactor: 1, colorScheme: "light", reducedMotion: "reduce", trace: "retain-on-failure", video: "on", screenshot: "only-on-failure" },
  webServer: {
    command: "pnpm build && pnpm --filter @duet/site dev",
    url: "http://localhost:3100/lab",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
