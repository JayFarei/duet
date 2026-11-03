import { expect, test } from "@playwright/test";

// The home page's "Less room, smaller controls": three devices, one per form, and a slider that steps through them.
test("the room slider steps through the three forms", async ({ page }) => {
  await page.goto("/");
  const slider = page.locator("#room");
  await slider.scrollIntoViewIfNeeded();
  const form = page.getByTestId("room-form");
  await expect(form).toHaveText("Tabs and More");
  await page.getByRole("button", { name: "Unfolded Safari" }).click();
  await expect(form).toHaveText("Every place is a tab");
  await expect(page.getByTestId("room-value")).toHaveText("470 pt, 11 taps");
  await slider.fill("150");
  await expect(form).toHaveText("A menu");
  await slider.fill("300");
  await expect(page.getByTestId("room-value")).toHaveText("300 pt, 6 taps");
  await expect(page.locator(".room .dev-cap [role=img]")).toHaveCount(6); // five tabs and More
});

test("each form card draws its device", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator(".rule");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0).locator(".dev-cap [role=img]")).toHaveCount(10); // nine tabs and More
  await expect(cards.nth(1).locator(".dev-more")).toBeVisible();
  await expect(cards.nth(2).locator(".dev-side")).toBeVisible();
});
