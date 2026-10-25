import { expect, test } from "@playwright/test";

// The web Duo's fold scrubber: the hinge follows the slider, and letting go finishes the fold towards the nearer end.
test("the fold scrubber opens and closes the web Duo", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/panes");
  const fold = page.getByRole("slider", { name: "Fold" });
  // The page inside the device: one pane closed, two open.
  const panes = () => page.frameLocator("iframe").locator("section.duet-pane:not([inert])");
  await expect(panes()).toHaveCount(1, { timeout: 10_000 }); // the device starts closed
  await fold.focus();
  await page.keyboard.press("End");
  await expect(panes()).toHaveCount(2, { timeout: 10_000 });
  await expect(fold).toHaveValue("1");
  await page.keyboard.press("Home");
  await expect(panes()).toHaveCount(1, { timeout: 10_000 });
  await expect(fold).toHaveValue("0");
});
