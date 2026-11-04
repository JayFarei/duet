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
  // Eight steps, each waiting out Duet's animation, after the stage boots: past 60 s when four workers share the GPU.
  test.slow();
  await page.goto("/");
  await stageReady(page);
  for (const step of TOUR) {
    await toStep(page, step.slug);
    await expect(page.getByTestId("tour-caption")).toHaveText(step.caption);
    await expect(page.locator(`[data-testid="tour-tick"][aria-current="step"]`)).toHaveText(step.caption);
    const states = await duetState(page);
    expect(states.length, `${step.caption}: Duet runs on the stage`).toBeGreaterThan(0);
    if ("fit" in step) expect(states.map((s) => s.fit), `${step.caption}: fit`).toContain(step.fit);
    if ("mode" in step) await expect(page.getByTestId("tour-mode")).toHaveText(`Mode ${step.mode[0].toUpperCase()}${step.mode.slice(1)}`);
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
  await expect(page.getByTestId("tour-free")).toHaveText(/^Free space \d+ px$/);
  await expect(page.getByTestId("tour-left")).toHaveText(/^Left over -?\d+ px$/);
  await toStep(page, "actions");
  await expect(page.getByTestId("tour-fit")).toHaveText("Navigation Sidebar");
});

test("the fold follows the scroll through Free space", async ({ page }) => {
  await page.goto("/");
  await stageReady(page);
  const at = async (f: number) => {
    await page.evaluate((f) => {
      const el = document.getElementById("tour-free-space")!;
      const r = el.getBoundingClientRect();
      scrollTo(0, scrollY + r.top + r.height * f - innerHeight / 2);
    }, f);
    await page.waitForTimeout(900);
    return page.getByTestId("tour-stage").evaluate((e) => getComputedStyle(e).getPropertyValue("--p").trim());
  };
  const a = await at(0.2), b = await at(0.6);
  expect(Number(b), "--p grows with the scroll").toBeGreaterThan(Number(a));
});
