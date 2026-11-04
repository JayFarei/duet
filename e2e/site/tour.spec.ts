// T4: the home tour, one step per glossary noun, driven by scroll, the stage's Duet in the state each caption names
// (PLAN 3). Red until step 6.
import { expect, test, type Page } from "@playwright/test";
import { GPU, TOUR, duetState, stageReady } from "./site";

test.use(GPU);

/** Scrolls to the middle of a tour step's span. */
async function toStep(page: Page, slug: string) {
  await page.evaluate((id) => {
    const el = document.getElementById(`tour-${id}`)!;
    const r = el.getBoundingClientRect();
    scrollTo(0, scrollY + r.top + r.height / 2 - innerHeight / 2);
  }, slug);
  await page.waitForTimeout(1200); // Duet's own animation plays the change
}

test("each step's caption, tick and stage state", async ({ page }) => {
  await page.goto("/");
  await stageReady(page);
  for (const step of TOUR) {
    await toStep(page, step.slug);
    await expect(page.getByTestId("tour-caption")).toHaveText(step.caption);
    await expect(page.locator(`[data-testid="tour-tick"][aria-current="step"]`)).toHaveText(step.caption);
    const states = await duetState(page);
    expect(states.length, `${step.caption}: Duet runs on the stage`).toBeGreaterThan(0);
    if ("fit" in step) expect(states.map((s) => s.fit), `${step.caption}: fit`).toContain(step.fit);
    if ("only" in step) expect(states.map((s) => s.controls), `${step.caption}: controls`).toContainEqual([...step.only]);
  }
});

test("scrolling back restores a step", async ({ page }) => {
  await page.goto("/");
  await stageReady(page);
  await toStep(page, "actions");
  await toStep(page, "navigation");
  await expect(page.getByTestId("tour-caption")).toHaveText("Navigation");
  expect((await duetState(page)).map((s) => s.fit)).toContain("tabs-more");
});

test("a tick jumps to its step", async ({ page }) => {
  await page.goto("/");
  await stageReady(page);
  await page.locator('[data-testid="tour-tick"]', { hasText: "Primary" }).click();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("tour-caption")).toHaveText("Primary");
});

test("live counters read the stage", async ({ page }) => {
  await page.goto("/");
  await stageReady(page);
  await toStep(page, "free-space");
  await expect(page.getByTestId("tour-free")).toHaveText(/^free \d+ px$/);
  await toStep(page, "actions");
  await expect(page.getByTestId("tour-fit")).toHaveText("fit sidebar");
});
