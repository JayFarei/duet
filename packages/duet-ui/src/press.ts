// The capsule under a finger (#251), measured from the native column: it swells at once, opens after a hold or a drag,
// and a lens follows the finger on springs, stretching as it speeds up and slows down. Release runs the item under the
// lens. Driven from window events without a render, since Safari does not hit-test column touches to our elements and
// :active never shows there.
import { spring, TEMPLATE, type Rect } from "./template.ts";

/** Fitted to a 60fps recording of Safari's own column: rise overshoots about 15%, fall about 3%, on one spring per phase. */
export const PRESS = { rise: spring(204, 14.6), fall: spring(204, 22.8), swell: 1.06, hold: 205, slop: 8, width: 78.8, pitch: 57, inset: 13.7, pad: 23.5, labelled: 44, up: 0.65, sideways: 24, reach: 24, overflow: 8, noRelease: 1200, stuck: 6000, tapHold: 150 } as const;

/** The lens in points, on [stiffness, damping] springs, fitted to the same recording: at a touch, open and let go. Native
 *  narrows as it speeds up and widens as it slows (area kept), ringing at about 0.6s, and runs a little past the ends. */
export const LENS = { down: { w: 64, h: 60 }, open: { w: 90, h: 68 }, gone: { w: 46, h: 49 }, centre: 14.5, rest: 24.5, radius: 40, band: 7, bend: 13, past: 24, pastOver: 24, travel: [1000, 63], grow: [286, 17.5], fall: [260, 30], stretch: [100, 6], kick: 0.0053, maxStretch: 0.12, ms: 200 } as const;

/** A tap on a capsule with a selected item, from a 60fps recording of Apple News: the lens leaves the old item at once on
 *  a critically damped spring, grown tall, and past `hold` shrinks into the new item's bubble over `ms`. The icon there
 *  dips and recovers (duet.css), in the same time for one item or three. */
export const HOP = { size: { w: 60, h: 80 }, end: { w: 44, h: 49 }, travel: [324, 36], grow: [900, 60], fall: [1600, 80], hold: 250, ms: 70, arrive: 433 } as const;

export type PressShape = { x: number; y: number; w: number; h: number; top: number; pitch: number; labels: boolean };

/** The capsule under a still finger: native scales it about its centre, the items spreading with it, so a tall capsule
 *  grows more than a short one. Geometry rather than `scale`, so it runs straight on into the open shape. */
export function swellShape(rest: Rect): PressShape {
  const k = PRESS.swell, w = rest.w * k, h = rest.h * k;
  return { x: rest.x - (w - rest.w) / 2, y: rest.y - (h - rest.h) / 2, w, h, top: (k - 1) * TEMPLATE.control / 2, pitch: TEMPLATE.item * k, labels: false };
}

/** The open capsule: wider, its items further apart, rising more than it falls as native does. It stays in `band`
 *  (a little of the gap to Safari's buttons may go), giving up pitch when the band is short, never below rest, and its
 *  labels when a label would touch the next icon. */
export function pressShape(rest: Rect, n: number, band?: { top: number; bottom: number }): PressShape {
  const top = (band?.top ?? -Infinity) - PRESS.overflow, bottom = (band?.bottom ?? Infinity) + PRESS.overflow;
  const room = Math.max(rest.h, bottom - top);
  const h = Math.min(room, TEMPLATE.control + (n - 1) * PRESS.pitch + PRESS.pad);
  const y = Math.min(Math.max(top, rest.y - (h - rest.h) * PRESS.up), Math.max(top, bottom - h));
  const pitch = n > 1 ? (h - TEMPLATE.control - PRESS.pad) / (n - 1) : 0;
  return { x: rest.x + (rest.w - PRESS.width) / 2, y, w: PRESS.width, h, top: PRESS.inset, pitch, labels: pitch >= PRESS.labelled };
}

/** The lens centre for a finger at `fy` (the capsule's coordinates) and the item it names. Past the first and last item
 *  it gives way, up to LENS.past, and still names that item. */
export function lensAt(fy: number, n: number, pitch: number) {
  const first = PRESS.inset + LENS.centre, y = Math.min(first + (n - 1) * pitch, Math.max(first, fy)), over = fy - y;
  return { y: y + Math.sign(over) * LENS.past * (1 - Math.exp(-Math.abs(over) / LENS.pastOver)), index: Math.round((y - first) / (pitch || 1)) };
}

export type LensState = { y: number; vy: number; w: number; vw: number; h: number; vh: number; q: number; vq: number };

/** One frame of the lens towards `goal`: the size on `size`, the position on the travel spring, and a stretch `q` kicked
 *  by each change in speed (speeding up narrows it). Stepped in pieces so a long frame stays stable. */
export function lensStep(s: LensState, goal: { y: number; w: number; h: number }, size: readonly [number, number], dt: number, travel: readonly [number, number] = LENS.travel): LensState {
  const out = { ...s };
  for (let i = 0; i < 4; i++) {
    const t = dt / 4, speed = Math.abs(out.vy);
    out.vy += (travel[0] * (goal.y - out.y) - travel[1] * out.vy) * t; out.y += out.vy * t;
    out.vw += (size[0] * (goal.w - out.w) - size[1] * out.vw) * t; out.w += out.vw * t;
    out.vh += (size[0] * (goal.h - out.h) - size[1] * out.vh) * t; out.h += out.vh * t;
    out.vq += (-LENS.stretch[0] * out.q - LENS.stretch[1] * out.vq) * t - LENS.kick * (Math.abs(out.vy) - speed); out.q += out.vq * t;
    out.q = Math.max(-LENS.maxStretch, Math.min(LENS.maxStretch, out.q));
  }
  return out;
}

/** The displacement map for the lens's rim, RGBA, 128 neutral: inside `band` of the edge of a rounded rectangle, red and
 *  green point inward along the edge's normal, so the rim shows what is further in, stretched as native's does. */
export function refractMap(w: number, h: number, radius: number, band: number) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = i + 0.5 - w / 2, y = j + 0.5 - h / 2, qx = Math.abs(x) - w / 2 + radius, qy = Math.abs(y) - h / 2 + radius;
    const corner = qx > 0 && qy > 0, l = Math.hypot(qx, qy) || 1, edge = corner ? radius - l : radius - Math.max(qx, qy);
    const nx = corner ? qx / l : qx > qy ? 1 : 0, ny = corner ? qy / l : qx > qy ? 0 : 1, k = Math.max(0, 1 - edge / band) ** 1.5, o = (i + j * w) * 4;
    px[o] = 128 - 127 * k * nx * Math.sign(x); px[o + 1] = 128 - 127 * k * ny * Math.sign(y); px[o + 2] = 128; px[o + 3] = 255;
  }
  return px;
}

/** Bends the lens's accent copy at its rim, over tinted copies bent a little more and less for native's colour fringes: WebKit cannot displace a
 *  backdrop, but it can displace this, its own content. Used only once the map has loaded, since a filter whose image
 *  is missing (a CSP without data: images) would blank the copy. */
let refract = "";
function loadRefraction() {
  if (refract || document.getElementById("duet-refract")) return;
  const c = document.createElement("canvas"), { w, h } = LENS.open; c.width = w * 3; c.height = h * 3;
  const data = c.getContext("2d")?.createImageData(c.width, c.height);
  if (!data) return;
  data.data.set(refractMap(c.width, c.height, LENS.radius * 3, LENS.band * 3));
  c.getContext("2d")!.putImageData(data, 0, 0);
  const url = c.toDataURL(), img = new Image();
  img.onload = () => {
    const bend = (scale: number, name: string, tint?: number[]) => `<feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G"${tint ? "" : ` result="${name}"`}/>${tint ? `<feColorMatrix values="0 0 0 0 ${tint[0]} 0 0 0 0 ${tint[1]} 0 0 0 0 ${tint[2]} 0 0 0 0.7 0" result="${name}"/>` : ""}`;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("aria-hidden", ""); svg.setAttribute("style", "position:absolute;width:0;height:0");
    svg.innerHTML = `<filter id="duet-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage href="${url}" preserveAspectRatio="none" result="map"/>${bend(LENS.bend * 1.14, "a", [1, 0.3, 0.9])}${bend(LENS.bend * 0.86, "b", [0.2, 1, 0.8])}${bend(LENS.bend, "c")}<feMerge><feMergeNode in="a"/><feMergeNode in="b"/><feMergeNode in="c"/></feMerge></filter>`;
    document.body.appendChild(svg);
    refract = "url(#duet-refract)";
  };
  img.src = url;
}

type Lens = { goal: { y: number; w: number; h: number }; follow: boolean; fall: () => void; stop: () => void };

/** The lens on `group`, starting at the item's size and growing to `goal`, until fall() or stop(). */
function mountLens(group: HTMLElement, buttons: HTMLButtonElement[], index: number, still: boolean, from = index): Lens {
  const glass = document.createElement("i"); glass.className = "duet-lens"; glass.setAttribute("aria-hidden", "");
  const ink = document.createElement("div"); ink.className = "duet-lens-ink"; ink.setAttribute("aria-hidden", ""); ink.inert = true; ink.style.filter = refract;
  const rail = document.createElement("div"); rail.className = "duet-lens-rail"; ink.appendChild(rail);
  for (const b of buttons) { const c = b.cloneNode(true) as HTMLElement; c.removeAttribute("aria-label"); c.removeAttribute("aria-current"); c.tabIndex = -1; rail.appendChild(c); }
  // In the capsule's parent's coordinates: native holds the lens still in the page while the capsule swells and opens around it.
  const at = (i: number) => buttons[i].offsetTop + group.offsetTop + LENS.rest;
  // With a selection the lens is the bubble, lifted off the selected item and sent to the tapped one.
  const hop = buttons.some((b) => b.hasAttribute("aria-current")), home = at(hop ? index : from), born = performance.now();
  let s: LensState = { y: at(from), vy: 0, w: hop ? HOP.end.w : LENS.gone.w, vw: 0, h: hop ? HOP.end.h : LENS.gone.h, vh: 0, q: 0, vq: 0 }, raf = 0, last = 0, falling = false, hole = 1, done = false;
  const lens: Lens = {
    goal: { y: home, ...(hop ? HOP.size : LENS.down) }, follow: false,
    fall() {
      if (still) return lens.stop();
      const ms = hop ? HOP.ms : LENS.ms, land = () => {
        if (done) return;
        lens.follow = false; falling = true; lens.goal = { y: lens.goal.y, ...(hop ? HOP.end : LENS.gone) };
        // A hop ends in one swap to the bubble: fading first would show the plain item through the hole.
        if (!hop) setTimeout(() => { hole = 0; glass.style.opacity = ink.style.opacity = "0"; }, ms * 2 / 3);
        setTimeout(() => {
          if (done) return;
          const moved = hop && Math.abs(lens.goal.y - at(from)) > 1;
          lens.stop();
          const b = moved ? group.querySelector<HTMLElement>(":scope > .duet-btn[aria-current]") : null;
          if (b) { b.dataset.arrive = ""; setTimeout(() => { delete b.dataset.arrive; }, HOP.arrive); }
        }, ms);
      };
      if (hop) setTimeout(land, Math.max(0, HOP.hold - (performance.now() - born))); else land();
    },
    stop() {
      if (done) return;
      done = true; cancelAnimationFrame(raf); glass.remove(); ink.remove();
      for (const b of buttons) b.style.removeProperty("--duet-lens-dy");
    },
  };
  const write = () => {
    const q = hop ? 0 : s.q, w = s.w * (1 + q), h = s.h / (1 + q), y = s.y - group.offsetTop;
    group.style.setProperty("--duet-lens-y", `${y}px`); group.style.setProperty("--duet-lens-w", `${w}px`); group.style.setProperty("--duet-lens-h", `${h}px`);
    group.style.setProperty("--duet-hole-w", `${w * hole}px`); group.style.setProperty("--duet-hole-h", `${h * hole}px`);
    for (const b of buttons) b.style.setProperty("--duet-lens-dy", `${y - (h * hole) / 2 - b.offsetTop}px`);
  };
  const tick = (now: number) => {
    if (!lens.follow && group.isConnected) lens.goal.y = home;
    s = still ? { ...s, y: lens.goal.y, w: lens.goal.w, h: lens.goal.h } : lensStep(s, lens.goal, hop ? (falling ? HOP.fall : HOP.grow) : falling ? LENS.fall : LENS.grow, Math.min(0.033, last ? (now - last) / 1000 : 1 / 60), hop && !lens.follow ? HOP.travel : LENS.travel);
    last = now;
    write();
    raf = requestAnimationFrame(tick);
  };
  write();
  group.append(glass, ink);
  raf = requestAnimationFrame(tick);
  return lens;
}

type Press = { id: number; touch: boolean; group: HTMLElement; buttons: HTMLButtonElement[]; rest: Rect; shape: PressShape; x0: number; y0: number; index: number; fx: number; fy: number; left: number; top: number; lens: Lens | null; hold: number; dog: number; born: number; hop: boolean; move: (e: TouchEvent) => void };

/** Listens on the window for presses on the capsules in `roots`. Returns the cleanup. */
export function listenPress(roots: () => (HTMLElement | null)[], band: (nav: HTMLElement) => { top: number; bottom: number } | undefined) {
  let p: Press | null = null, hovered: HTMLElement | null = null, muted = 0, released = false, fading: Lens | null = null, lifting = 0;
  loadRefraction(); // now, since it loads asynchronously and the first press should have it
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
    for (const [k, v] of Object.entries({ x: s.x, y: s.y, w: s.w, h: s.h, top: s.top, pitch: s.pitch })) el.style.setProperty(`--duet-p-${k}`, `${v}px`);
  };
  const lens = (e: { clientY: number }) => {
    if (!p?.lens) return;
    const { y, index } = lensAt(e.clientY - p.top, p.buttons.length, p.shape.pitch);
    p.index = index;
    p.lens.goal = { y: y + p.shape.y, ...LENS.open };
  };
  /** Open: the capsule takes its shape, the lens its size, and it follows the finger from here. */
  const open = (e: { clientY: number }) => {
    if (!p?.lens || p.group.dataset.press === "open") return;
    const q = p, r = q.group.getBoundingClientRect();
    q.left = r.left; q.top = r.top - q.group.offsetTop + q.shape.y;
    vars(q.group, q.shape);
    q.group.toggleAttribute("data-press-tight", !q.shape.labels);
    q.lens!.follow = true;
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
    if (!q.group.isConnected) { q.lens?.stop(); return; }
    if (q.lens) { fading = q.lens; q.lens.fall(); }
    const group = q.group;
    group.removeAttribute("data-press-tight");
    // A quick tap still swells in full before it falls, as native's does.
    const fall = () => {
      group.dataset.press = "fall";
      setTimeout(() => { if (group.dataset.press === "fall") delete group.dataset.press; }, still() ? 0 : PRESS.fall.ms);
    };
    const wait = q.hop && !wasOpen && !still() ? PRESS.tapHold - (performance.now() - q.born) : 0;
    if (wait > 0) lifting = window.setTimeout(fall, wait); else fall();
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
    const selected = h.buttons.findIndex((b) => b.hasAttribute("aria-current"));
    p = { id: e.pointerId, touch: e.pointerType === "touch", group: g, buttons: h.buttons, rest, shape: pressShape(rest, n, band(h.nav)), x0: e.clientX, y0: e.clientY, index: h.index, fx: e.clientX, fy: e.clientY, left: 0, top: 0, lens: null, hold: 0, dog: 0, born: performance.now(), hop: selected >= 0, move };
    muted = Infinity;
    clearTimeout(lifting);
    fading?.stop(); fading = null;
    if (n > 1) {
      vars(g, swellShape(rest));
      h.buttons.forEach((b, i) => b.style.setProperty("--duet-j", `${i}`));
      p.lens = mountLens(g, h.buttons, h.index, still(), selected >= 0 ? selected : h.index);
    }
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
    fading?.stop();
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
