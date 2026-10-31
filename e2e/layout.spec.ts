import { expect, test, type Page } from "@playwright/test";

// Inline mode's layout invariant: page text lines up beside the strip, never under it, at every window size
// the Duo produces and on both sides. Backgrounds may run under the strip (bleed); text and images may not.
const LAB = "/lab?tabs=5,searchTab=1,back=1,actions=2,title=1,feed=1";
const SIZES = [
  { name: "split-view pane", width: 385, height: 571 },
  { name: "open, portrait", width: 951, height: 543 },
  { name: "closed, landscape", width: 594, height: 368 },
];

async function open(page: Page, side: "left" | "right", url = LAB) {
  // Seed the side once per test; a reload must keep what the user chose.
  await page.addInitScript((s) => { try { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("duet-side", s); sessionStorage.setItem("seeded", "1"); } } catch {} }, side);
  await page.goto(url);
  await page.locator(".duet:not(.duet-sidebar) .duet-group").first().waitFor();
  await page.waitForTimeout(600); // let the detector settle (it re-reads on a short timer after load)
}

/** The strip's inner edge, and every text node in the page that crosses it. */
function probe(page: Page) {
  return page.evaluate(() => {
    const glass = [...document.querySelectorAll(".duet:not(.duet-sidebar) .duet-group")].map((e) => e.getBoundingClientRect()).filter((r) => r.width);
    const right = glass[0].left > innerWidth / 2;
    const edge = right ? Math.min(...glass.map((r) => r.left)) : Math.max(...glass.map((r) => r.right));
    const root = document.querySelector(".duet-scroller") ?? document.body;
    const bad: string[] = [];
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n: Node | null; (n = walk.nextNode());) {
      const parent = n.parentElement!;
      if (!n.textContent!.trim() || parent.closest(".duet")) continue;
      // Only the visible part counts: clip to scrolling ancestors (carousel cards scrolled off are fine).
      let [cl, cr] = [-Infinity, Infinity];
      for (let e: Element | null = parent; e && e !== root; e = e.parentElement) {
        if (getComputedStyle(e).overflowX === "visible") continue;
        const b = e.getBoundingClientRect(); cl = Math.max(cl, b.left); cr = Math.min(cr, b.right);
      }
      const range = document.createRange(); range.selectNodeContents(n);
      for (const q of range.getClientRects()) {
        const l = Math.max(q.left, cl), r = Math.min(q.right, cr);
        if (r - l < 1) continue;
        const over = right ? r - edge : edge - l;
        if (over > 1) { bad.push(`${JSON.stringify(n.textContent!.trim().slice(0, 30))} ${over.toFixed(0)}px under the strip`); break; }
      }
    }
    // The sticky title bar must span the strip too, or scrolled content shows between them.
    const title = [...root.querySelectorAll("div")].find((d) => getComputedStyle(d).position === "sticky" && !d.closest(".duet-pane-bar"));
    if (title) {
      const t = title.getBoundingClientRect(), gap = right ? innerWidth - t.right : t.left;
      if (gap > 1) bad.push(`sticky title stops ${gap.toFixed(0)}px short of the edge`);
    }
    return { mode: document.documentElement.dataset.duetMode, side: right ? "right" : "left", bad };
  });
}

for (const size of SIZES) {
  for (const side of ["right", "left"] as const) {
    test(`text stays beside the strip: ${size.name} ${size.width}x${size.height}, ${side}`, async ({ page }) => {
      await page.setViewportSize(size);
      await open(page, side);
      const r = await probe(page);
      expect(r.mode).toBe("inline");
      expect(r.side).toBe(side);
      expect(r.bad).toEqual([]);
    });
  }
}

test("dragging a control across the middle moves the strip, and the side is remembered", async ({ page }) => {
  await page.setViewportSize({ width: 951, height: 543 });
  await open(page, "right");
  const pill = page.locator(".duet:not(.duet-sidebar) .duet-group").last();
  const box = (await pill.boundingBox())!;
  const y = box.y + box.height / 2;
  const selected = () => page.locator(".duet-sidebar [aria-current=page]").textContent();
  const before = await selected();
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  for (let x = box.x; x > 120; x -= 40) await page.mouse.move(x, y);
  await page.mouse.up();
  await expect.poll(() => probe(page).then((r) => r.side)).toBe("left");
  expect(await page.evaluate(() => localStorage.getItem("duet-side"))).toBe("left");
  expect(await selected(), "a drag must not select the tab it started on").toBe(before);
  await page.reload();
  await page.waitForTimeout(600);
  expect((await probe(page)).side).toBe("left");
});

test("a page in an iframe never claims Safari's column", async ({ page }) => {
  // 382x580 is exactly the closed-Safari page size, but framed content can't paint outside its frame.
  await page.setViewportSize({ width: 466, height: 678 });
  await page.goto("/mockup?scene=split");
  const frame = page.frameLocator("iframe");
  await frame.locator(".duet:not(.duet-sidebar) .duet-group").first().waitFor();
  expect(await frame.locator("html").getAttribute("data-duet-mode")).toBe("inline");
});

test("a reading column centres on the whole window, not the space beside the strip", async ({ page }) => {
  // Keep the library layout contract independent of the home page's videos: a minimal
  // <video src=...> crashes this Linux WebKit media backend before any app JS runs.
  // Open portrait has room to centre 680px clear of the 84pt strip, so the column sits mid-screen on either side.
  await page.setViewportSize({ width: 951, height: 543 });
  for (const side of ["right", "left"] as const) {
    await page.evaluate((s) => localStorage.setItem("duet-side", s), side).catch(() => {});
    await open(page, side, "/quality");
    expect((await probe(page)).side).toBe(side);
    const mid = await page.evaluate(() => { const r = document.querySelector("main")!.getBoundingClientRect(); return (r.left + r.right) / 2 - innerWidth / 2; });
    expect(Math.abs(mid), `${side}: column off centre by ${mid}px`).toBeLessThan(2);
  }
  // A split-view pane has no such room: the column moves aside and its text stays clear of the strip.
  await page.setViewportSize({ width: 385, height: 571 });
  await page.reload(); await page.waitForTimeout(600);
  expect((await probe(page)).bad).toEqual([]);
});

test('home page consumer smoke (Chromium media backend)', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Linux WebKit crashes on a minimal video element; library layout is tested on /quality in both engines. Real Safari media check pending.');
  await page.goto('/?plain');
  await expect(page.getByRole('heading', { name: /Native-feeling controls/ })).toBeVisible();
});
