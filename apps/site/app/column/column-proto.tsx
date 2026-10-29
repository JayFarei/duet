"use client";
// The templated column (#169). One template on every layout: the burger always, then the developer's key buttons
// while they fit, and a "…" at the foot that grows into the full list with a liquid morph. On the Duo it draws into
// Safari's column for real (an absolute layer wider than the viewport, taps routed by coordinates, as duet-ui's
// useColumnLayer does); anywhere else it draws the Duo's screen to scale, so it can be tuned in a desktop browser.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { columnBand, useDuet, type Context } from "duet-ui";
import { HapticsProvider, useHaptics } from "@haptics/react";
import {
  Archive, Bookmark, Check, Clock, Ellipsis, FolderPlus, Heart, House, Menu, MessageCircle, Paperclip, Pin, Search,
  Settings, Share, ShoppingBag, SquarePen, Star,
} from "lucide-react";

/** Duo metrics (duet-ui geometry.ts DUO, MORPH): button, stacked item pitch, gap, strip centre from the edge. */
const C = 49, ITEM = 51.7, GAP = 11, EDGE = 48.2, ROW = 44, PAD = 6, HEAD = 26, MENU_W = 232;
/** A group of n buttons in one capsule. */
const groupH = (n: number) => C + (n - 1) * ITEM;

/** A damped spring as a CSS linear() easing (Safari 17.2+), with the time it takes to settle. */
function spring(stiffness: number, damping: number, n = 40) {
  const w0 = Math.sqrt(stiffness), z = damping / (2 * w0), wd = w0 * Math.sqrt(1 - z * z);
  const x = (t: number) => 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
  const T = -Math.log(0.002) / (z * w0);
  return { easing: `linear(${Array.from({ length: n + 1 }, (_, i) => +x((i / n) * T).toFixed(4)).join(",")})`, ms: Math.round(T * 1000) };
}
const SLIDE = spring(210, 25), SETTLE = spring(260, 20), GROUP = spring(240, 26);

type Item = { id: string; label: string; icon: ReactNode };
const ic = (I: typeof Share) => <I size={21} strokeWidth={2} />;
const CATALOG: Item[] = [
  { id: "share", label: "Share", icon: ic(Share) },
  { id: "search", label: "Find in page", icon: ic(Search) },
  { id: "pin", label: "Pin", icon: ic(Pin) },
  { id: "bookmark", label: "Bookmark", icon: ic(Bookmark) },
  { id: "project", label: "Add to project", icon: ic(FolderPlus) },
  { id: "files", label: "Uploaded files", icon: ic(Paperclip) },
  { id: "like", label: "Favorite", icon: ic(Heart) },
  { id: "archive", label: "Archive", icon: ic(Archive) },
];
const CHECKOUT: Item = { id: "checkout", label: "Checkout", icon: ic(ShoppingBag) };
const COMPOSE: Item = { id: "compose", label: "New chat", icon: ic(SquarePen) };

type Slot = { kind: "burger" } | { kind: "more" } | { kind: "primary" } | { kind: "item"; item: Item };
type Group = Slot[];

/** The roomiest arrangement that fits the band: every item shown with the burger alone, then fewer items with
 *  "…" closing the item group, then the burger sharing that group. The checkout keeps its own group while any
 *  arrangement leaves room for it, else it joins the "…" list. Most items shown wins; a lone burger breaks ties. */
function allocate(h: number, items: Item[], primary: boolean): { groups: Group[]; hidden: boolean } {
  const B: Slot = { kind: "burger" }, M: Slot = { kind: "more" }, P: Group[] = primary ? [[{ kind: "primary" }]] : [];
  const it = (k: number): Slot[] => items.slice(0, k).map((item) => ({ kind: "item", item }));
  const height = (gs: Group[]) => gs.reduce((s, g) => s + groupH(g.length), 0) + (gs.length - 1) * GAP;
  const tries: { groups: Group[]; shown: number; score: number }[] = [];
  for (const p of primary ? [P, []] : [[]]) {
    const bonus = p.length ? 1000 : 0, n = items.length;
    tries.push({ groups: [[B], ...(n ? [it(n)] : []), ...p], shown: n, score: bonus + n * 10 + 1 });
    tries.push({ groups: [[B, ...it(n)], ...p], shown: n, score: bonus + n * 10 });
    for (let k = n - 1; k >= 0; k--) {
      tries.push({ groups: [[B], [...it(k), M], ...p], shown: k, score: bonus + k * 10 + 1 });
      tries.push({ groups: [[B, ...it(k), M], ...p], shown: k, score: bonus + k * 10 });
    }
  }
  const fit = tries.filter((t) => height(t.groups) <= h).sort((a, b) => b.score - a.score)[0];
  const groups = fit?.groups ?? [[B, M]];
  return { groups, hidden: !groups.some((g) => g.some((s) => s.kind === "more")) ? false : true };
}

/** Where things go, in stage coordinates (the stage is the screen; the page is its left `pw` points). */
type Frame = {
  kind: "column" | "inline";
  sw: number; ph: number; pw: number; insetTop: number;
  cx: number; top: number; bottom: number;
  /** The page-side edge the menu buds past: the column's inner edge, or the strip's. */
  edge: number;
  safari?: { back: number; island: number };
};

const OUTER = { mode: "column", duo: true, browser: "safari", device: "duo", standalone: false, layout: "narrow", side: "right", width: 382, height: 580, stableHeight: 580, offsetTop: 0, screenWidth: 466, screenHeight: 678, insetTop: 0, insetBottom: 0 } as Context;
const INNER = { mode: "inline", duo: true, browser: "safari", device: "duo", standalone: false, layout: "wide", side: "right", width: 951, height: 669, stableHeight: 669, offsetTop: 0, screenWidth: 951, screenHeight: 669, insetTop: 0, insetBottom: 0 } as Context;

/** `la`: Live Activities assumed. The worst case (one or two) pushes Safari's column 90.3pt down. */
function frameOf(c: Context, la: boolean): Frame {
  const band = columnBand(c);
  if (band) {
    const cx = c.screenWidth - EDGE, top = band.top - (la ? 0 : band.reach);
    return { kind: "column", sw: c.screenWidth, ph: c.height, pw: c.width, insetTop: c.insetTop, cx, top, bottom: band.bottom, edge: c.width,
      safari: { back: la ? 264.3 : 174, island: la ? 146.3 : 62 } };
  }
  const cx = c.width - 8 - C / 2;
  return { kind: "inline", sw: c.width, ph: c.height, pw: c.width, insetTop: c.insetTop, cx, top: c.insetTop + 20, bottom: c.height - (c.insetBottom ?? 0) - 20, edge: cx - C / 2 - 4 };
}

type Rect = { x: number; y: number; w: number; h: number };
type Placed = { group: Group; rect: Rect; primary: boolean };

function place(f: Frame, groups: Group[]): Placed[] {
  const heights = groups.map((g) => groupH(g.length));
  const total = heights.reduce((s, h) => s + h, 0) + (groups.length - 1) * GAP;
  const x = f.cx - C / 2;
  // In the column the stack centres in the band (the band is the whole budget); inline the burger heads the strip and
  // the checkout sits at its foot, under the thumb.
  let y = f.kind === "column" ? f.top + (f.bottom - f.top - total) / 2 : f.top;
  return groups.map((group, i) => {
    const primary = group[0].kind === "primary";
    const top = primary && f.kind === "inline" ? f.bottom - C : y;
    y += heights[i] + GAP;
    return { group, rect: { x, y: top, w: C, h: heights[i] }, primary };
  });
}

function menuBox(f: Frame, from: Rect, n: number): Rect {
  const h = Math.min(2 * PAD + HEAD + n * ROW, f.ph - 24), w = MENU_W, x = f.edge - 10 - w;
  const below = from.y + from.h / 2 > f.ph / 2;
  const y = below ? from.y + from.h - h : from.y;
  return { x, y: Math.min(Math.max(y, Math.max(f.insetTop, 12)), f.ph - 12 - h), w, h };
}

/** The liquid morph (ChatGPT's "…", frame by frame): the pill swells and brightens, then is gone as a droplet buds
 *  off its page side, swells into a blob with the list blurred inside, and settles into the menu with a slight
 *  overshoot. Closing plays it back. */
function Morph({ open, from, box, button, onClosed, children }: { open: boolean; from: Rect; box: Rect; button: HTMLElement | null; onClosed: () => void; children: ReactNode }) {
  const blob = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = blob.current, b = body.current;
    if (!el || !b) return;
    const cx = from.x + from.w / 2, cy = from.y + from.h / 2, dir = box.x + box.w / 2 < cx ? -1 : 1;
    const bx = cx + dir * (from.w / 2 + 4), by = cy + 2; // the bud, just past the button's page-side edge
    const mx = box.x + box.w / 2, my = box.y + box.h / 2, d = Math.min(box.w, box.h) * 0.62;
    const sx = bx + (mx - bx) * 0.5, sy = by + (my - by) * 0.5;
    const r = (x: number, y: number, w: number, h: number) => ({ left: `${x - w / 2}px`, top: `${y - h / 2}px`, width: `${w}px`, height: `${h}px` });
    const frames: Keyframe[] = [
      { ...r(cx, cy, 24, 24), borderRadius: "50%", opacity: 0, easing: "cubic-bezier(.3,.7,.4,1)" },
      { ...r(bx, by, 40, 34), borderRadius: dir < 0 ? "62% 38% 42% 58% / 52% 48% 52% 48%" : "38% 62% 58% 42% / 48% 52% 48% 52%", opacity: 1, offset: 0.2, easing: "cubic-bezier(.45,0,.55,1)" },
      { ...r(sx, sy, d, d * 1.04), borderRadius: "50%", opacity: 1, offset: 0.46, easing: SETTLE.easing },
      { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px`, borderRadius: "26px", opacity: 1 },
    ];
    const content: Keyframe[] = [
      { opacity: 0, scale: 0.3, filter: "blur(12px)" },
      { opacity: 0, scale: 0.35, filter: "blur(12px)", offset: 0.2 },
      { opacity: 0.55, scale: 0.62, filter: "blur(7px)", offset: 0.46, easing: SETTLE.easing },
      { opacity: 1, scale: 1, filter: "blur(0px)" },
    ];
    const press: Keyframe[] = [
      { scale: 1, filter: "brightness(1)", opacity: 1 },
      { scale: 1.18, filter: "brightness(1.4)", opacity: 1, offset: 0.5 },
      { scale: 0.55, filter: "brightness(1)", opacity: 0 },
    ];
    const anims: Animation[] = [];
    if (open) {
      if (button) anims.push(button.animate(press, { duration: 300, easing: "ease-out", fill: "forwards" }));
      // Backwards only: the last frame is the resting style, and a held transform keeps WebKit's blurry raster.
      const t = { duration: 720, delay: 120, fill: "backwards" as const };
      anims.push(el.animate(frames, t), b.animate(content, t));
    } else {
      const t = { duration: 480, fill: "both" as const, direction: "reverse" as const };
      const a = el.animate(frames, t);
      anims.push(a, b.animate(content, t));
      if (button) anims.push(button.animate(press, { duration: 260, delay: 400, easing: "ease-in", fill: "both", direction: "reverse" }));
      a.finished.then(() => setTimeout(onClosed, 260), () => {});
    }
    return () => { if (open) for (const a of anims) a.cancel(); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- geometry is fixed while the menu is shown
  return (
    <div ref={blob} className="cp-blob" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
      <div ref={body} className="cp-menu" style={{ width: box.w, height: box.h }}>{children}</div>
    </div>
  );
}

const btnLabel = (s: Slot) => s.kind === "burger" ? "Menu" : s.kind === "more" ? "More" : s.kind === "primary" ? "Checkout" : s.item.label;
const btnIcon = (s: Slot) => s.kind === "burger" ? ic(Menu) : s.kind === "more" ? ic(Ellipsis) : s.kind === "primary" ? ic(ShoppingBag) : s.item.icon;
const btnHaptic = (s: Slot) => s.kind === "burger" ? "impact-medium" : s.kind === "primary" ? "impact-medium" : "impact-light";
const slotKey = (s: Slot) => s.kind === "item" ? s.item.id : s.kind;

type Knobs = { screen: "outer" | "inner"; n: number; la: boolean; checkout: boolean };
const DEFAULTS: Knobs = { screen: "outer", n: 4, la: true, checkout: false };

function Proto() {
  const ctx = useDuet();
  const { trigger } = useHaptics();
  const [k, setK] = useState<Knobs>(DEFAULTS);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setK({ screen: q.get("screen") === "inner" ? "inner" : "outer", n: Math.min(8, Math.max(1, Number(q.get("n") ?? 4) || 4)), la: q.get("la") !== "0", checkout: q.get("checkout") === "1" });
  }, []);
  const set = (p: Partial<Knobs>) => setK((o) => {
    const v = { ...o, ...p };
    history.replaceState(null, "", `?screen=${v.screen}&n=${v.n}&la=${v.la ? 1 : 0}&checkout=${v.checkout ? 1 : 0}`);
    return v;
  });

  // On the Duo the template draws into the real screen; anywhere else, onto a drawn Duo screen.
  const real = ctx.duo && ctx.browser === "safari";
  const c = real ? ctx : k.screen === "inner" ? INNER : OUTER;
  const f = useMemo(() => frameOf(c, k.la), [c, k.la]);

  const [sidebar, setSidebar] = useState(false);
  const [menu, setMenu] = useState<"closed" | "open" | "closing">("closed");
  const [armed, setArmed] = useState<"idle" | "armed" | "done">("idle");
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const say = (text: string) => setToast({ text, id: Date.now() });
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 1600); return () => clearTimeout(t); }, [toast]);

  const items = CATALOG.slice(0, k.n);
  const room = f.bottom - f.top + (f.kind === "column" ? 2 * GAP - 2 * 5 : 0); // a lone group may take the gaps, 5pt clear (RAIL.gap)
  const { groups } = sidebar ? { groups: [[{ kind: "burger" } as Slot], [{ kind: "item", item: COMPOSE } as Slot]] } : allocate(room, items, k.checkout);
  const placed = place(f, groups);
  const primaryShown = placed.some((p) => p.primary);
  const list = [...items, ...(k.checkout && !primaryShown ? [CHECKOUT] : [])];
  const moreAt = placed.flatMap((p) => p.group.map((s, i) => ({ s, rect: { x: p.rect.x, y: p.rect.y + i * ITEM, w: C, h: C } }))).find((e) => e.s.kind === "more");
  const moreBtn = useRef<HTMLButtonElement | null>(null);

  const closeMenu = () => setMenu((m) => (m === "open" ? "closing" : m));
  const press = (s: Slot) => {
    if (s.kind === "burger") { closeMenu(); setArmed("idle"); setSidebar((v) => !v); }
    else if (s.kind === "more") setMenu((m) => (m === "closed" ? "open" : m === "open" ? "closing" : m));
    else if (s.kind === "primary") {
      closeMenu();
      if (armed === "idle") setArmed("armed");
      else if (armed === "armed") { setArmed("done"); trigger("success"); setTimeout(() => setArmed("idle"), 1400); }
    } else { closeMenu(); say(s.item.label); }
  };

  // Safari's column is not hit-tested: route a touch there by coordinates, as useColumnLayer does, and give it the
  // haptic the switch overlay can't (best effort: iOS ticks only inside a gesture).
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    if (!real || f.kind !== "column") return;
    const html = document.documentElement.style, prev = html.touchAction;
    html.touchAction = "pan-y";
    const pin = () => { if (Math.round(scrollX) !== 0) scrollTo({ left: 0, top: scrollY, behavior: "instant" }); };
    const down = (e: PointerEvent) => {
      if (e.clientX < innerWidth) return;
      for (const b of document.querySelectorAll<HTMLButtonElement>("[data-cp-col] button")) {
        const r = b.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          if (b.dataset.haptic) trigger(b.dataset.haptic as Parameters<typeof trigger>[0]);
          b.click();
          return;
        }
      }
    };
    pin();
    addEventListener("pointerdown", down);
    addEventListener("scroll", pin, { passive: true });
    return () => { html.touchAction = prev; removeEventListener("pointerdown", down); removeEventListener("scroll", pin); };
  }, [real, f.kind, trigger]);

  // Emulated: fit the drawn screen to the window.
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (real) return;
    const fit = () => setZoom(Math.min(1, (innerWidth - 48) / f.sw, (innerHeight - 48) / c.screenHeight));
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, [real, f.sw, c.screenHeight]);

  const slide = f.kind === "column" ? f.sw : Math.min(340, f.pw * 0.4);
  const vars = { "--cp-slide": SLIDE.easing, "--cp-slide-ms": `${SLIDE.ms}ms`, "--cp-group": GROUP.easing, "--cp-group-ms": `${GROUP.ms}ms` } as CSSProperties;

  const stage = (
    <div className="cp-stage" data-kind={f.kind} data-real={real ? "" : undefined} style={{ ...vars, width: f.sw, height: real ? f.ph : c.screenHeight }}>
      {!real && f.safari && <SafariColumn f={f} />}
      {!real && c.screenHeight > f.ph && <div className="cp-bar" style={{ top: f.ph, width: f.pw }} aria-hidden />}
      <Sidebar width={f.kind === "column" ? f.pw : slide} height={f.ph} open={sidebar} onPick={(t) => { setSidebar(false); say(t); }} />
      <div className="cp-card" data-open={sidebar ? "" : undefined} style={{ width: f.pw, height: f.ph, translate: sidebar ? `${slide}px 0` : "0 0" }}>
        <Page k={k} set={set} real={real} f={f} armed={armed} />
      </div>
      {(menu !== "closed" || armed === "armed") && <div className="cp-scrim" onPointerDown={() => { closeMenu(); if (armed === "armed") setArmed("idle"); }} />}
      <div data-cp-col="">
        {placed.map((p, gi) => {
          const pill = p.primary && armed !== "idle", W = 214;
          const rect = pill ? { ...p.rect, x: p.rect.x + C - W, w: W } : p.rect;
          return (
            <div key={gi} className="cp-group" data-primary={p.primary ? "" : undefined} data-armed={pill ? armed : undefined}
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
              {p.group.map((s, i) => (
                <button key={slotKey(s)} ref={s.kind === "more" ? moreBtn : undefined} className="cp-btn" aria-label={btnLabel(s)}
                  data-haptic={s.kind === "primary" && armed === "armed" ? "success" : btnHaptic(s)}
                  aria-expanded={s.kind === "more" ? menu === "open" : s.kind === "burger" ? sidebar : undefined}
                  style={{ top: i * ITEM, width: rect.w }} onClick={() => press(s)}>
                  {s.kind === "primary" ? <Checkout state={armed} /> : btnIcon(s)}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {menu !== "closed" && moreAt && (
        <Morph open={menu === "open"} from={moreAt.rect} box={menuBox(f, moreAt.rect, list.length)} button={moreBtn.current} onClosed={() => setMenu("closed")}>
          <div className="cp-menu-head">{f.kind === "column" ? "This page" : "More"}</div>
          {list.map((it) => (
            <button key={it.id} className="cp-row" data-haptic="selection" onClick={() => { closeMenu(); say(it.label); }}>
              {it.icon}<span>{it.label}</span>
            </button>
          ))}
        </Morph>
      )}
      {toast && <div key={toast.id} className="cp-toast" style={{ left: f.pw / 2, top: f.ph - 80 }}>{toast.text}</div>}
    </div>
  );

  if (real) return stage;
  return (
    <div className="cp-desk">
      <div className="cp-device" style={{ zoom }}>{stage}</div>
    </div>
  );
}

/** The checkout's face: a bag, then (armed) the island's confirm, then the result. */
function Checkout({ state }: { state: "idle" | "armed" | "done" }) {
  return (
    <span className="cp-checkout" data-state={state}>
      <span className="cp-checkout-icon">{state === "done" ? ic(Check) : ic(ShoppingBag)}</span>
      <span className="cp-checkout-label">{state === "done" ? "Paid" : "Pay $48.00"}</span>
    </span>
  );
}

/** Safari's own column buttons, drawn (outer screen, emulated): back, forward and bookmarks under the island, the
 *  new tab and tabs pill at the foot (Duo Lab simulator, worst case and bare, space map). */
function SafariColumn({ f }: { f: Frame }) {
  const s = f.safari!, x = f.cx - C / 2;
  return (
    <div className="cp-safari" style={{ left: f.pw, width: f.sw - f.pw }} aria-hidden>
      <div className="cp-island" style={{ left: 399.7 - f.pw, top: 25.7, height: s.island - 25.7 }} />
      {[0, 54, 108].map((dy) => <div key={dy} className="cp-native" style={{ left: x - f.pw, top: s.back + dy }} />)}
      <div className="cp-native" style={{ left: x - f.pw, top: 542, height: 112.7 }} />
      <div className="cp-band" style={{ left: x - f.pw - 6, top: f.top, height: f.bottom - f.top }} />
    </div>
  );
}

function Sidebar({ width, height, open, onPick }: { width: number; height: number; open: boolean; onPick: (t: string) => void }) {
  const nav: [ReactNode, string][] = [[ic(House), "Home"], [ic(MessageCircle), "Chats"], [ic(Star), "Starred"], [ic(Clock), "Scheduled"], [ic(Settings), "Settings"]];
  const recents = ["Duo column template", "Liquid morph timings", "Checkout confirm island", "Space map, hinge corners", "Haptics on iOS 27", "Release notes 0.5.0"];
  return (
    <nav className="cp-sidebar" data-open={open ? "" : undefined} style={{ width, height }} aria-hidden={!open}>
      <div className="cp-side-title">Duet</div>
      {nav.map(([icon, t]) => <button key={t} className="cp-side-row" data-haptic="selection" tabIndex={open ? 0 : -1} onClick={() => onPick(t)}>{icon}<span>{t}</span></button>)}
      <div className="cp-side-head">Recents</div>
      {recents.map((t, i) => <button key={t} className="cp-side-row" data-current={i === 0 ? "" : undefined} data-haptic="selection" tabIndex={open ? 0 : -1} onClick={() => onPick(t)}><span>{t}</span></button>)}
    </nav>
  );
}

function Seg<T extends string | number | boolean>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="cp-knob">
      <span>{label}</span>
      <div className="cp-seg">
        {options.map(([v, t]) => <button key={String(v)} data-on={v === value ? "" : undefined} data-haptic="selection" onClick={() => onChange(v)}>{t}</button>)}
      </div>
    </div>
  );
}

function Page({ k, set, real, f, armed }: { k: Knobs; set: (p: Partial<Knobs>) => void; real: boolean; f: Frame; armed: string }) {
  return (
    <div className="cp-scroll" style={{ paddingRight: f.kind === "inline" ? C + 24 : 0 }}>
      <header className="cp-head">
        <div className="cp-eyebrow">Prototype · #169</div>
        <h1>Templated column</h1>
        <p>Burger always. Key buttons while they fit, then “…” grows the full list. Burger slides this page away.</p>
      </header>
      <section className="cp-card-box">
        {real ? <div className="cp-knob"><span>Screen</span><b>{f.kind === "column" ? "Safari column (real)" : "Inline (real)"}</b></div>
          : <Seg label="Screen" value={k.screen} options={[["outer", "Outer"], ["inner", "Inner"]]} onChange={(v) => set({ screen: v })} />}
        <Seg label="Key buttons" value={k.n} options={[1, 2, 3, 4, 6, 8].map((n) => [n, String(n)] as [number, string])} onChange={(v) => set({ n: v })} />
        <Seg label="Live Activities" value={k.la} options={[[false, "None"], [true, "Worst case"]]} onChange={(v) => set({ la: v })} />
        <Seg label="Checkout" value={k.checkout} options={[[false, "Off"], [true, "On"]]} onChange={(v) => set({ checkout: v })} />
      </section>
      <section className="cp-product">
        <div className="cp-product-img" />
        <div>
          <div className="cp-product-name">Field Jacket</div>
          <div className="cp-dim">Olive · M · $48.00</div>
          <div className="cp-dim">{armed === "armed" ? "Tap Pay to confirm" : armed === "done" ? "Order placed" : k.checkout ? "Checkout sits in the column" : "Turn Checkout on to try the confirm"}</div>
        </div>
      </section>
      {Array.from({ length: 6 }, (_, i) => (
        <p key={i} className="cp-text">
          The column holds what the page needs on every screen: a burger for the app’s sections, then the few actions
          the developer marked as key. Where Safari’s column leaves room for only two, the second becomes “…”, and the
          rest live in the list it grows into, over the page, beside the column.
        </p>
      ))}
    </div>
  );
}

export function ColumnProto() {
  return <HapticsProvider audioFallback><Proto /></HapticsProvider>;
}
