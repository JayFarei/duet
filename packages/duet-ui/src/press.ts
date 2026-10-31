// The capsule under a finger (#251), measured from the native column: it swells at once, opens after a hold or a drag,
// and a lens follows the finger between items. Release runs the item under the lens. Driven from window events without
// a render, since Safari does not hit-test column touches to our elements and :active never shows there.
import { spring, TEMPLATE, type Rect } from "./template.ts";

/** Fitted to a 60fps recording of Safari's own column: rise overshoots about 15%, fall has no overshoot. */
export const PRESS = { rise: spring(286, 17.5), fall: spring(205, 29), hold: 230, slop: 8, width: 78, pitch: 57, pad: 16, up: 0.7, sideways: 24, reach: 24, overflow: 8, noRelease: 1200, stuck: 6000 } as const;

export type PressShape = { x: number; y: number; w: number; h: number; pitch: number };

/** The open capsule: wider, its items further apart, rising more than it falls as native does. It stays in `band`
 *  (a little of the gap to Safari's buttons may go), giving up pitch when the band is short, never below rest. */
export function pressShape(rest: Rect, n: number, band?: { top: number; bottom: number }): PressShape {
  const top = (band?.top ?? -Infinity) - PRESS.overflow, bottom = (band?.bottom ?? Infinity) + PRESS.overflow;
  const room = Math.max(rest.h, bottom - top);
  const h = Math.min(room, TEMPLATE.control + (n - 1) * PRESS.pitch + PRESS.pad);
  const y = Math.min(Math.max(top, rest.y - (h - rest.h) * PRESS.up), Math.max(top, bottom - h));
  return { x: rest.x + (rest.w - PRESS.width) / 2, y, w: PRESS.width, h, pitch: n > 1 ? (h - TEMPLATE.control - PRESS.pad) / (n - 1) : 0 };
}

/** The lens centre for a finger at `fy` (the capsule's coordinates), held to the first and last item, and that item. */
export function lensAt(fy: number, n: number, pitch: number) {
  const first = PRESS.pad / 2 + TEMPLATE.control / 2, y = Math.min(first + (n - 1) * pitch, Math.max(first, fy));
  return { y, index: Math.round((y - first) / (pitch || 1)) };
}

type Press = { id: number; touch: boolean; group: HTMLElement; buttons: HTMLButtonElement[]; rest: Rect; shape: PressShape; x0: number; y0: number; index: number; fx: number; fy: number; left: number; top: number; layers: HTMLElement[]; hold: number; dog: number; move: (e: TouchEvent) => void };

/** Listens on the window for presses on the capsules in `roots`. Returns the cleanup. */
export function listenPress(roots: () => (HTMLElement | null)[], band: (nav: HTMLElement) => { top: number; bottom: number } | undefined) {
  let p: Press | null = null, hovered: HTMLElement | null = null, muted = 0, released = false;
  const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  const hit = (x: number, y: number) => {
    for (const nav of roots()) {
      if (!nav || nav.dataset.hidden) continue;
      for (const group of nav.querySelectorAll<HTMLElement>(".duet-group:not([data-morphing], [data-leaving])")) {
        const buttons = [...group.querySelectorAll<HTMLButtonElement>(":scope > button")];
        const index = buttons.findIndex((b) => { const r = b.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
        if (index >= 0) return { nav, group, buttons, index };
      }
    }
    return null;
  };
  const vars = (el: HTMLElement, s: PressShape) => {
    for (const [k, v] of Object.entries({ x: s.x, y: s.y, w: s.w, h: s.h, pitch: s.pitch })) el.style.setProperty(`--duet-p-${k}`, `${v}px`);
  };
  const lens = (e: { clientY: number }) => {
    if (!p) return;
    const { y, index } = lensAt(e.clientY - p.top, p.buttons.length, p.shape.pitch);
    p.index = index;
    p.group.style.setProperty("--duet-lens-y", `${y}px`);
  };
  /** Open: the capsule takes its shape, the lens and its accent copy of the contents go in. */
  const open = (e: { clientY: number }) => {
    if (!p || p.group.dataset.press === "open" || p.buttons.length < 2) return;
    const q = p, r = q.group.getBoundingClientRect();
    q.left = r.left; q.top = r.top + q.shape.y - parseFloat(q.group.style.getPropertyValue("--duet-p-swell-y") || `${q.rest.y}`);
    vars(q.group, q.shape);
    q.buttons.forEach((b, i) => b.style.setProperty("--duet-j", `${i}`));
    const glass = document.createElement("i"); glass.className = "duet-lens"; glass.setAttribute("aria-hidden", "");
    const ink = document.createElement("div"); ink.className = "duet-lens-ink"; ink.setAttribute("aria-hidden", ""); ink.inert = true;
    for (const b of q.buttons) { const c = b.cloneNode(true) as HTMLElement; c.removeAttribute("aria-label"); c.tabIndex = -1; ink.appendChild(c); }
    q.group.append(glass, ink);
    q.layers = [glass, ink];
    q.group.dataset.press = "open";
    lens(e);
  };
  /** Back to rest, on the fall spring, and running the item if there is one. */
  const end = (fire: boolean) => {
    if (!p) return;
    const q = p; p = null;
    clearTimeout(q.hold); clearTimeout(q.dog);
    removeEventListener("touchmove", q.move);
    muted = performance.now() + 400;
    const wasOpen = q.group.dataset.press === "open";
    for (const l of q.layers) l.remove();
    if (!q.group.isConnected) return;
    q.group.dataset.press = "fall";
    const group = q.group;
    setTimeout(() => { if (group.dataset.press === "fall") delete group.dataset.press; }, still() ? 0 : PRESS.fall.ms);
    if (!fire) return;
    const inside = wasOpen
      ? q.fx >= q.left - PRESS.reach && q.fx <= q.left + q.shape.w + PRESS.reach && q.fy >= q.top - PRESS.reach && q.fy <= q.top + q.shape.h + PRESS.reach
      : true;
    if (inside) q.buttons[q.index]?.click();
  };
  /** No release seen on this page yet: real devices may keep it, so a still finger still runs its item (late, and a
   *  held finger too), as column taps always have. Once one has been seen, a lost finger only lets go. */
  const watch = () => {
    if (!p) return;
    clearTimeout(p.dog);
    p.dog = window.setTimeout(() => end(!released), released ? PRESS.stuck : PRESS.noRelease);
  };

  const down = (e: PointerEvent) => {
    if (p || (e.pointerType === "mouse" && e.button)) return;
    const h = hit(e.clientX, e.clientY);
    if (!h) return;
    const g = h.group, rest = { x: g.offsetLeft, y: g.offsetTop, w: g.offsetWidth, h: g.offsetHeight };
    const n = h.buttons.length;
    const move = (t: TouchEvent) => { if (t.cancelable) t.preventDefault(); }; // the column must not scroll the page
    addEventListener("touchmove", move, { passive: false });
    p = { id: e.pointerId, touch: e.pointerType === "touch", group: g, buttons: h.buttons, rest, shape: pressShape(rest, n, band(h.nav)), x0: e.clientX, y0: e.clientY, index: h.index, fx: e.clientX, fy: e.clientY, left: 0, top: 0, layers: [], hold: 0, dog: 0, move };
    muted = Infinity;
    if (n > 1) { vars(g, { x: rest.x - 2, y: rest.y - 4.5, w: rest.w + 4, h: rest.h + 9, pitch: TEMPLATE.item }); g.style.setProperty("--duet-p-swell-y", `${rest.y}`); }
    g.dataset.press = "down";
    if (n > 1) p.hold = window.setTimeout(() => open({ clientY: p ? p.fy : e.clientY }), PRESS.hold);
    watch();
  };
  const move = (e: PointerEvent) => {
    if (!p) {
      if (e.pointerType !== "mouse") return;
      const h = hit(e.clientX, e.clientY), b = h ? h.buttons[h.index] : null;
      if (b !== hovered) { if (hovered) delete hovered.dataset.hover; if (b) b.dataset.hover = ""; hovered = b; }
      return;
    }
    if (e.pointerId !== p.id) return;
    p.fx = e.clientX; p.fy = e.clientY;
    watch();
    const dx = Math.abs(e.clientX - p.x0), dy = Math.abs(e.clientY - p.y0);
    if (p.group.dataset.press !== "open" && dx > PRESS.sideways && dx > 2 * dy) return end(false); // the strip's own drag (useSideDrag)
    if (p.group.dataset.press === "open") lens(e);
    else if (dy > PRESS.slop) open(e);
  };
  const up = (e: PointerEvent) => {
    if (!p || e.pointerId !== p.id) return;
    released = true;
    // Touch ends on touchend, which unlike pointerup lets the item open a window or play sound.
    if (p.touch) { const q = p; setTimeout(() => { if (p === q) end(true); }, 40); } else end(true);
  };
  const cancel = (e: PointerEvent) => {
    if (!p || e.pointerId !== p.id) return;
    // A cancelled tap that never moved was still a tap, as the column has always treated it.
    end(p.group.dataset.press !== "open" && Math.abs(p.fy - p.y0) <= PRESS.slop);
  };
  // The column's touches land on the page beneath, so a held finger there would start iOS's text selection and its
  // loupe, which takes the touch away from this press. pointerdown runs first, so `p` is set by now.
  const touchstart = (e: TouchEvent) => { if (p?.touch && e.cancelable) e.preventDefault(); };
  const selectstart = (e: Event) => { if (p) e.preventDefault(); };
  const touchend = () => { if (p?.touch) { released = true; end(true); } };
  const touchcancel = () => { if (p?.touch) end(false); };
  // This press runs the item itself: the browser's own click, where it sends one, would run it twice.
  const click = (e: MouseEvent) => {
    if (!e.isTrusted || performance.now() > muted) return;
    if ((e.target as Element | null)?.closest?.(".duet-group")) { e.stopPropagation(); e.preventDefault(); }
  };

  addEventListener("pointerdown", down);
  addEventListener("pointermove", move);
  addEventListener("pointerup", up);
  addEventListener("pointercancel", cancel);
  addEventListener("touchstart", touchstart, { passive: false });
  addEventListener("selectstart", selectstart);
  addEventListener("touchend", touchend);
  addEventListener("touchcancel", touchcancel);
  addEventListener("click", click, true);
  return () => {
    end(false);
    removeEventListener("pointerdown", down);
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", up);
    removeEventListener("pointercancel", cancel);
    removeEventListener("touchstart", touchstart);
    removeEventListener("selectstart", selectstart);
    removeEventListener("touchend", touchend);
    removeEventListener("touchcancel", touchcancel);
    removeEventListener("click", click, true);
  };
}
