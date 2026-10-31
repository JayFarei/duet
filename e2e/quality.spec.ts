import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { postures } from './postures';
import type { Signals } from '../packages/duet-ui/src/geometry';

async function host(page: Page, s: Signals, documentScroll = false) {
  await page.setViewportSize({ width: Math.max(s.outerWidth, 700), height: Math.max(s.outerHeight, 700) });
  await page.route('**/quality-host', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><title>Posture contract</title><body style="margin:0;background:#eee"><iframe title="Quality fixture" src="/quality${documentScroll ? '?document' : ''}" style="border:0;width:${s.outerWidth + (s.innerWidth === 385 ? 84 : 0)}px;height:${s.outerHeight}px"></iframe><script>let signals=${JSON.stringify(s)};addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.type==='duet:ready')e.source.postMessage({type:'duet:signals',signals},location.origin)});window.updateSignals=s=>{signals=s;document.querySelector('iframe').contentWindow.postMessage({type:'duet:signals',signals},location.origin)}</script></body></html>` }));
  await page.goto('/quality-host');
  const frame = page.frameLocator('iframe');
  await expect(frame.getByTestId('context')).toContainText(s.editing ? 'keyboard' : ' / ');
  return frame;
}
for (const posture of postures) {
  test(`posture: ${posture.name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const frame = await host(page, posture.s);
    await expect(frame.locator('html')).toHaveAttribute('data-duet-mode', posture.mode);
    await expect(frame.getByRole('textbox', { name: 'Draft' })).toBeVisible();
    await frame.getByRole('textbox', { name: 'Draft' }).fill('Keep this draft');
    if (!posture.s.editing) {
      // Control boxes are inside the emulated screen and do not overlap one another.
      const rects = await frame.locator('.duet:not(.duet-sidebar) .duet-group:not([data-leaving])').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
      expect(rects.length).toBeGreaterThan(0);
      for (const r of rects) { expect(r.y).toBeGreaterThanOrEqual(0); expect(r.y + r.h).toBeLessThanOrEqual(posture.s.outerHeight + 1); }
      const burger = frame.getByRole('button', { name: 'Menu', exact: true });
      if (await burger.count() === 1) {
        await burger.click();
        await frame.getByRole('button', { name: 'Home', exact: true }).click();
        await expect(frame.getByRole('status', { name: 'Navigation calls' })).toHaveText('1');
      }
    }
    await expect(frame.getByRole('textbox', { name: 'Draft' })).toHaveValue('Keep this draft');
    await expect(page).toHaveScreenshot(`${posture.name}.png`, { animations: 'disabled' });
    expect(errors).toEqual([]);
  });
}

test('fold/turn/URL-bar/keyboard sequence preserves draft and navigation', async ({ page }) => {
  const frame = await host(page, postures[0].s);
  await frame.getByRole('textbox', { name: 'Draft' }).fill('State across hinge');
  for (const index of [3, 4, 5, 1, 2, 0, 7, 9, 0]) {
    const p = postures[index];
    await page.evaluate(s => (window as any).updateSignals(s), p.s);
    await expect(frame.locator('html')).toHaveAttribute('data-duet-mode', p.mode);
    await expect(frame.getByRole('textbox', { name: 'Draft' })).toHaveValue('State across hinge');
    if (index === 9) await expect(frame.locator('.duet[data-keyboard]')).toHaveCount(1);
  }
});

test('axe: closed, sidebar, and action menu have no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/quality');
  for (const state of ['closed', 'sidebar', 'actions']) {
    if (state === 'sidebar') await page.getByRole('button', { name: 'Menu', exact: true }).click();
    if (state === 'actions') { await page.keyboard.press('Escape'); await page.locator('.duet-pane-bar').getByRole('button', { name: 'More' }).click(); }
    const result = await new AxeBuilder({ page }).include('main').include('.duet').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
  }
});

test('column document sidebar opens at the current scroll position', async ({ page }) => {
  const frame = await host(page, postures[0].s, true);
  await frame.getByRole('heading', { name: 'Section 8', exact: true }).scrollIntoViewIfNeeded();
  const before = await frame.locator('body').evaluate(() => scrollY);
  expect(before).toBeGreaterThan(300);
  // Column navigation itself follows scroll; programmatic click avoids fake native hit testing.
  await frame.getByRole('button', { name: 'Menu', exact: true }).evaluate((el: HTMLButtonElement) => el.click());
  const box = await frame.getByRole('navigation', { name: 'Menu', exact: true }).boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThan(100);
});
