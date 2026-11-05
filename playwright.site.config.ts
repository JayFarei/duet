import { defineConfig, devices } from "@playwright/test";

// The site suite (e2e/site): the production build on 127.0.0.1:3510, built into apps/site/.next-test so it never
// replaces the files under a review server running from .next. WebKit (every iPhone browser) and Chromium, each at a
// phone (390x844) and a laptop (1440x900). Specs set light or dark themselves (test.use({ colorScheme })).
// SITE_REUSE=1 reuses a server already on 3510 (start it with `pnpm --filter @duet/site start:test`). SITE_PORT moves
// the test server off 3510 (a second checkout running the suite at the same time).
const PORT = Number(process.env.SITE_PORT) || 3510;
const phone = { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 } };
const laptop = { viewport: { width: 1440, height: 900 }, screen: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

export default defineConfig({
  testDir: "e2e/site",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "test-results/site",
  timeout: 60_000,
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "webkit-390", use: { ...devices["iPhone 14"], ...phone } },
    { name: "webkit-1440", use: { ...devices["Desktop Safari"], ...laptop } },
    { name: "chromium-390", use: { ...devices["Pixel 7"], ...phone, deviceScaleFactor: 3 } },
    { name: "chromium-1440", use: { ...devices["Desktop Chrome"], ...laptop } },
  ],
  webServer: {
    command: PORT === 3510 ? "pnpm --filter duet-ui build && pnpm --filter @duet/site build:test && pnpm --filter @duet/site start:test"
      : `pnpm --filter duet-ui build && pnpm --filter @duet/site build:test && cd apps/site && NEXT_DIST_DIR=.next-test pnpm exec next start -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !!process.env.SITE_REUSE,
    timeout: 300_000,
  },
});
