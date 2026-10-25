"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ArrowLeftRight, Highlighter, Pause, Play, RotateCw } from "lucide-react";
import type { Signals } from "duet-ui";

// A web iPhone Duo for desktop browsers: the site runs in an iframe shaped like the device's screen, and the
// iframe gets the signals the real device would give (duet-ui's `duet:signals` emulation), so Duet lays out
// exactly as it would on the phone. Every size is measured on the Duo simulator (docs/research-notes.md) or
// from its device artwork (tools/media/frame.py).

type Posture = "closed" | "open";
type App = "home" | "safari" | "split";
interface State { posture: Posture; rotated: boolean; app: App; pane: "left" | "right" }

// Natural orientation: closed is portrait (outer display), open is landscape (inner display). `rotated` turns
// the device a quarter turn clockwise, so the outer camera ends up bottom right.
const SCREEN = { closed: { w: 466, h: 678 }, open: { w: 951, h: 669 } };
// Closed: hinge spine on the left (26pt), free edge on the right. Open: 13pt sides, both free edges.
const BODY = {
  closed: { w: 514, h: 706, x: 26, y: 14, r: "22px 72px 72px 22px", screenR: "9px 56.5px 56.5px 9px" },
  open: { w: 977, h: 697, x: 13, y: 14, r: "72px", screenR: "56.5px" },
};
// Volume on top and power on the right, relative to the free edge (body right).
const BUTTONS = [{ right: 271, top: -4, w: 66, h: 6 }, { right: 191, top: -4, w: 66, h: 6 }, { right: -3, top: 196, w: 5, h: 113 }];
// Outer display camera, screen coordinates in natural portrait (seen in recordings at the top of the strip).
const CAMERA = { x: 418, y: 48, d: 38 };
const STRIP = 84; // iOS's strip and Safari's column
const URL_BAR = 98; // Safari's chrome below a closed page
const OPEN_BAR = 126; // Safari's chrome above the page, unfolded
const PANE = { w: 469, page: { w: 385, h: 571 } }; // a split-view pane

const ease = "cubic-bezier(0.32, 0.72, 0, 1)";
const TURN = 650; // rotation, ms
const FOLD = 900;
const MOVE = 520; // the page frame moving between apps

interface Box { x: number; y: number; w: number; h: number }
interface Scene { frame: Box; signals: Signals; frameR?: string; under?: ReactNode; chrome: ReactNode; mode: string; note: string }

// The slots a developer fills with <Duet> props, each in its own temporary colour for the call-out.
const SLOTS: [slot: string, color: string, label: string][] = [
  ["tabs", "#ff375f", "tabs"], ["actions", "#0a84ff", "actions"], ["leading", "#64d2ff", "leading"], ["back", "#30d158", "back"], ["close", "#ff453a", "close"],
  ["search", "#bf5af2", "searchButton"], ["more", "#ffd60a", "overflow"], ["accessory", "#ff9f0a", "accessory"],
];
const CALLOUT = "html[data-wd-slots] [data-duet-slot] { outline: 2.5px solid var(--wd-c); outline-offset: 2px; box-shadow: inset 0 0 0 999px color-mix(in srgb, var(--wd-c) 30%, transparent) !important; }\n"
  + SLOTS.map(([slot, c]) => `[data-duet-slot="${slot}"] { --wd-c: ${c}; }`).join("\n");

const sig = (inner: { w: number; h: number }, outer: { w: number; h: number }, o: Partial<Signals> = {}): Signals => ({
  innerWidth: inner.w, innerHeight: inner.h, outerWidth: outer.w, outerHeight: outer.h, visualHeight: inner.h,
  insetTop: 0, insetBottom: 0, insetRight: 0, insetLeft: 0, screenWidth: outer.w, screenHeight: outer.h,
  standalone: false, framed: true, ...o,
});

/** Where the page sits on the screen, the signals it gets and the system chrome around it. W x H is the
 *  screen as the user sees it (upright). */
function scene(s: State, W: number, H: number, host: string): Scene {
  const full = { w: W, h: H };
  if (s.app === "home") {
    const strip = W < H ? s.posture === "closed" : s.posture === "open"; // natural orientation only
    return strip
      ? { frame: { x: 0, y: 0, w: W, h: H }, signals: sig(full, full, { insetRight: STRIP, standalone: true }), chrome: <Status x={W - 48.2} top={s.posture === "closed" ? 74 : 26} />,
          mode: "strip", note: "Added to the Home Screen, the app owns the display and iOS gives it the strip. Duet draws its controls there, like a native app." }
      : { frame: { x: 0, y: 0, w: W, h: H }, signals: sig(full, full, { standalone: true }), chrome: null,
          mode: "inline", note: "Turned sideways there is no strip, so Duet keeps an 84pt one inside the page. Drag it to the other edge; it remembers." };
  }
  if (s.app === "split") {
    const safariX = s.pane === "right" ? W - PANE.w : 0, otherX = s.pane === "right" ? 0 : W - PANE.w;
    return {
      frame: { x: safariX, y: 0, ...{ w: PANE.page.w, h: PANE.page.h } }, frameR: "30px 0 0 0",
      signals: sig(PANE.page, { w: PANE.w, h: H }),
      under: <div style={{ ...pane, left: safariX }} />,
      chrome: <>
        <div style={{ ...pane, left: otherX, animation: `wd-slide ${MOVE}ms ${ease} both`, "--from": s.pane === "right" ? "-100%" : "100%" } as CSSProperties}><OtherApp /></div>
        <div style={{ position: "absolute", left: safariX, top: 0, width: PANE.w, height: H, pointerEvents: "none", transition: `left 0.7s ${ease}` }}>
          <UrlBar left={18} top={PANE.page.h + 22} width={PANE.page.w - 36} host={host} />
          <SafariColumn x={PANE.page.w} h={H} top={74} />
        </div>
      </>,
      mode: "inline", note: "Split view: Safari's pane keeps its own column, so Duet stays inside the page. Swap the panes; Duet follows the page.",
    };
  }
  if (s.posture === "closed" && W < H) {
    const page = { w: W - STRIP, h: H - URL_BAR };
    // The frame is the whole screen: the page paints into Safari's column, between Safari's own buttons, down to
    // the bottom of the screen. Safari's bar covers the rest below the page.
    return {
      frame: { x: 0, y: 0, ...full }, signals: sig(page, full, { framed: false }),
      chrome: <>
        <div style={{ position: "absolute", left: 0, top: page.h, width: page.w, height: URL_BAR, background: "var(--card)" }} />
        <UrlBar left={18} top={page.h + 22} width={page.w - 36} host={host} /><SafariColumn x={page.w} h={H} top={74} over />
      </>,
      mode: "column", note: "In a closed Safari tab, Safari leaves its column empty between its own buttons. Duet paints its controls there, so the page keeps its full width.",
    };
  }
  if (s.posture === "closed") {
    const page = { w: W - STRIP, h: H - URL_BAR };
    return {
      frame: { x: 0, y: 0, ...page }, signals: sig(page, full),
      chrome: <><UrlBar left={18} top={page.h + 22} width={page.w - 36} host={host} /><SafariColumn x={page.w} h={H} top={24} /></>,
      mode: "inline", note: "Landscape Safari moves its buttons around the column, so Duet keeps its own strip inside the page.",
    };
  }
  const page = { w: W, h: H - OPEN_BAR };
  return {
    frame: { x: 0, y: OPEN_BAR, ...page }, signals: sig(page, full),
    chrome: <OpenSafari w={W} host={host} />,
    mode: "inline", note: "Unfolded, Safari runs full width with its toolbar on top. Duet reserves an 84pt strip inside the page.",
  };
}

const TOUR: State[] = [
  { posture: "closed", rotated: false, app: "home", pane: "right" },
  { posture: "open", rotated: false, app: "home", pane: "right" },
  { posture: "open", rotated: true, app: "home", pane: "right" },
  { posture: "closed", rotated: true, app: "home", pane: "right" },
  { posture: "closed", rotated: false, app: "home", pane: "right" },
  { posture: "closed", rotated: false, app: "safari", pane: "right" },
  { posture: "open", rotated: false, app: "safari", pane: "right" },
  { posture: "open", rotated: false, app: "split", pane: "right" },
  { posture: "open", rotated: false, app: "split", pane: "left" },
];

export function WebDuo({ src }: { src: string }) {
  const [s, setS] = useState<State>(TOUR[0]);
  // The page inside turns upright only once the device has finished turning, like iOS.
  const [upright, setUpright] = useState(false);
  // A fold or turn is in flight: the page is faded out and its frame jumps instead of animating.
  const [instant, setInstant] = useState(false);
  const [folding, setFolding] = useState(false);
  const [tour, setTour] = useState(false);
  const [slots, setSlots] = useState(false);
  const [view, setView] = useState({ w: 1280, h: 800 });
  const frame = useRef<HTMLIFrameElement>(null);
  const page = useRef<HTMLDivElement>(null), hinge = useRef<HTMLDivElement>(null), flap = useRef<HTMLDivElement>(null);
  const cur = useRef(s), busy = useRef(false);
  cur.current = s;
  const host = useSyncExternalStore(() => () => {}, () => location.host, () => "");

  // Folding: the right half stays put and the left half swings round the hinge towards the viewer, like a book
  // closing, so the inner screens meet face to face and the outer display ends up in front. The
  // device recentres, so it unfolds from the middle. Web Animations, so timing never depends on React or timers.
  const swing = (open: boolean) => {
    const o = { duration: FOLD, easing: "cubic-bezier(0.45, 0, 0.2, 1)", fill: "forwards" as const }; // eased both ends, so the swing reads
    const [a, b] = open ? [0, 1] : [1, 0];
    const shift = (t: number) => `translateX(${-(1 - t) * BODY.open.w / 4}px)`;
    hinge.current?.animate([{ transform: shift(a) }, { transform: shift(b) }], o);
    return flap.current?.animate([{ transform: `rotateY(${180 * (1 - a)}deg)` }, { transform: `rotateY(${180 * (1 - b)}deg)` }], o).finished;
  };
  const go = async (next: Partial<State>, fromTour = false) => {
    if (!fromTour) setTour(false);
    if (busy.current) return;
    const p = cur.current, n = { ...p, ...next };
    if (n.app === "split") [n.posture, n.rotated] = ["open", false]; // split view needs the wide screen
    if (n.posture === p.posture && n.rotated === p.rotated) return setS(n);
    // The page fades out while the device moves and back in once it has settled, laid out for the new screen.
    busy.current = true;
    flushSync(() => setInstant(true));
    const fade = page.current?.animate([{ opacity: 1 }, { opacity: 0, offset: 0.12 }, { opacity: 0, offset: 0.78 }, { opacity: 1 }], { duration: FOLD + 450, easing: "ease" }).finished;
    if (n.posture !== p.posture) {
      const open = n.posture === "open";
      flushSync(() => { setFolding(true); if (open) setS(n); });
      await swing(open)?.catch(() => {});
      flushSync(() => { if (!open) setS(n); setFolding(false); });
      hinge.current?.getAnimations().forEach((a) => a.cancel());
    } else setS(n);
    busy.current = false;
    await fade?.catch(() => {});
    setInstant(false);
  };

  useEffect(() => {
    const t = setTimeout(() => setUpright(s.rotated), s.rotated === upright ? 0 : TURN);
    return () => clearTimeout(t);
  }, [s.rotated, upright]);

  useEffect(() => {
    if (!tour) return;
    let i = TOUR.findIndex((t) => JSON.stringify(t) === JSON.stringify(s));
    const t = setInterval(() => { i = (i + 1) % TOUR.length; go(TOUR[i], true); }, 3600);
    return () => clearInterval(t);
  }, [tour]); // eslint-disable-line react-hooks/exhaustive-deps -- the tour starts from the current state

  useEffect(() => {
    const fit = () => setView({ w: innerWidth, h: innerHeight });
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, []);

  const n = SCREEN[s.posture], b = BODY[s.posture];
  const [W, H] = upright ? [n.h, n.w] : [n.w, n.h];
  const sc = scene({ ...s, rotated: upright }, W, H, host);

  // Tell the page what the device would tell it: now, and whenever it (re)loads and says it is listening.
  const signals = JSON.stringify(sc.signals);
  useEffect(() => {
    const post = () => frame.current?.contentWindow?.postMessage({ type: "duet:signals", signals: JSON.parse(signals) }, location.origin);
    const ready = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow && e.origin === location.origin && e.data?.type === "duet:ready") post(); };
    post();
    addEventListener("message", ready);
    return () => removeEventListener("message", ready);
  }, [signals]);

  // The call-out: colours each slot Duet placed in the page, and outlines iOS's own chrome around it.
  useEffect(() => {
    const el = frame.current;
    const apply = () => {
      const d = el?.contentDocument;
      if (!d?.head) return;
      if (!d.getElementById("wd-callout")) d.head.append(Object.assign(d.createElement("style"), { id: "wd-callout", textContent: CALLOUT }));
      d.documentElement.toggleAttribute("data-wd-slots", slots);
    };
    apply();
    el?.addEventListener("load", apply);
    return () => el?.removeEventListener("load", apply);
  }, [slots]);

  // Fit the turned device and the controls in the window.
  const [bw, bh] = s.rotated ? [b.h, b.w] : [b.w, b.h];
  const scale = Math.min((view.w - 64) / bw, (view.h - 320) / bh, 1);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "28px 0", background: "linear-gradient(180deg, var(--bg), color-mix(in srgb, var(--bg), #888 12%))" }}>
      <header style={{ textAlign: "center" }}>
        <div style={{ font: "800 30px/1 -apple-system, system-ui", letterSpacing: -0.6 }}>Duet</div>
        <div style={{ color: "var(--dim)", font: "400 15px/1.4 -apple-system, system-ui", marginTop: 6 }}>
          This is the site on a web iPhone Duo. Fold it, turn it, split it. On a phone, the site opens directly.
        </div>
      </header>

      <div style={{ width: bw * scale, height: bh * scale, position: "relative", transition: `width ${TURN}ms ${ease}, height ${TURN}ms ${ease}` }}>
        <div style={{
          position: "absolute", left: "50%", top: "50%", width: b.w, height: b.h,
          transform: `translate(-50%, -50%) scale(${scale}) rotate(${s.rotated ? 90 : 0}deg)`,
          transition: `transform ${TURN}ms ${ease}`,
        }}>
        <div ref={hinge} style={{ position: "absolute", inset: 0, perspective: 2600 }}>
        <div style={{ position: "absolute", inset: 0, clipPath: folding ? "inset(-40px -40px -40px 50%)" : undefined }}>
          {BUTTONS.map((x, i) => <div key={i} style={{ position: "absolute", right: x.right, top: x.top, width: x.w, height: x.h, borderRadius: 3, background: "linear-gradient(#5a5b60, #2a2b2e)" }} />)}
          <div style={{
            position: "absolute", inset: 0, borderRadius: b.r, cornerShape: "squircle", background: "#0d0d0f",
            boxShadow: "inset 0 0 0 1.5px #4a4b50, inset 0 0 0 3px #1b1c1f, 0 40px 80px rgb(0 0 0 / 0.28)", transition: `border-radius ${TURN}ms ${ease}`,
          } as CSSProperties} />
          <div style={{ position: "absolute", left: b.x, top: b.y, width: n.w, height: n.h, borderRadius: b.screenR, overflow: "hidden", background: "var(--bg)", isolation: "isolate" }}>
            {/* The page, upright for the user: counter-turned when the device is turned. */}
            <div style={{
              position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0",
              transform: upright ? `translateY(${n.h}px) rotate(-90deg)` : undefined,
            }} ref={page}>
              {sc.under}
              <iframe ref={frame} src={src} title="Duet on the iPhone Duo" style={{
                position: "absolute", left: sc.frame.x, top: sc.frame.y, width: sc.frame.w, height: sc.frame.h,
                border: 0, display: "block", borderRadius: sc.frameR, background: "var(--bg)",
                transition: instant ? "none" : ["left", "top", "width", "height", "border-radius"].map((x) => `${x} ${MOVE}ms ${ease}`).join(", "),
              }} />
              {/* System chrome fades in with each new app or screen. */}
              <div key={`${s.app}-${s.posture}-${upright}`} data-wd-callout={slots || undefined} style={{ position: "absolute", inset: 0, pointerEvents: "none", animation: `wd-in ${MOVE}ms ${ease} both` }}>{sc.chrome}</div>
            </div>
            {s.posture === "closed" && <div style={{ position: "absolute", left: CAMERA.x - CAMERA.d / 2, top: CAMERA.y - CAMERA.d / 2, width: CAMERA.d, height: CAMERA.d, borderRadius: 99, background: "#000" }} />}
            {s.posture === "open" && <Crease />}
          </div>
        </div>
          {folding && <Flap ref={flap} />}
        </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", padding: "0 16px" }}>
        <Segmented value={s.posture} onChange={(posture) => go({ posture, app: posture === "closed" && s.app === "split" ? "safari" : s.app })}
          options={[["closed", "Closed"], ["open", "Open"]]} />
        <Button onClick={() => go({ rotated: !s.rotated, app: s.app === "split" ? "safari" : s.app })} label="Rotate"><RotateCw size={17} /></Button>
        <Segmented value={s.app} onChange={(app) => go({ app })} options={[["home", "Home Screen"], ["safari", "Safari"], ["split", "Split View"]]} />
        {s.app === "split" && <Button onClick={() => go({ pane: s.pane === "right" ? "left" : "right" })} label="Swap"><ArrowLeftRight size={17} /></Button>}
        <Button onClick={() => setSlots((v) => !v)} label="Slots" on={slots}><Highlighter size={17} /></Button>
        <Button onClick={() => setTour((t) => !t)} label={tour ? "Pause" : "Tour"} on={tour}>{tour ? <Pause size={17} /> : <Play size={17} />}</Button>
      </div>
      <p style={{ margin: 0, maxWidth: 560, minHeight: 44, textAlign: "center", color: "var(--dim)", font: "400 15px/1.45 -apple-system, system-ui", padding: "0 16px" }}>
        <b style={{ color: "var(--ink)", textTransform: "capitalize" }}>{sc.mode} mode.</b> {sc.note}
      </p>
      {slots && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", maxWidth: 640, padding: "0 16px", font: "500 13px -apple-system, system-ui", color: "var(--dim)" }}>
          {SLOTS.map(([slot, c, label]) => <span key={slot} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: c }} /><code>{label}</code></span>)}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, outline: "1.5px dashed currentColor" }} />iOS, not yours</span>
          <span style={{ flexBasis: "100%", textAlign: "center" }}>Your controls, by <code>&lt;Duet&gt;</code> prop. Fold or turn the device to see where each one goes.</span>
        </div>
      )}
    </div>
  );
}

/** The left half of the open body, for the fold: its inner face is the inner display's left half, its outer face
 *  the outer display (hinge on the left once it lies over the right half, as on the closed device). */
function Flap({ ref }: { ref: React.Ref<HTMLDivElement> }) {
  const half = BODY.open.w / 2, face: CSSProperties = { position: "absolute", inset: 0, backfaceVisibility: "hidden", background: "#0d0d0f", boxShadow: "inset 0 0 0 1.5px #4a4b50, inset 0 0 0 3px #1b1c1f" };
  // A soft sheen across each face, so the swinging half reads against a dark page.
  const sheen = <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", background: "linear-gradient(90deg, rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.02) 70%)", pointerEvents: "none" }} />;
  return (
    <div ref={ref} style={{ position: "absolute", left: 0, top: 0, width: half, height: BODY.open.h, transformOrigin: "100% 50%", transformStyle: "preserve-3d", transform: "rotateY(180deg)" }}>
      <div style={{ ...face, borderRadius: "72px 0 0 72px" }}>
        <div style={{ position: "absolute", left: BODY.open.x, top: BODY.open.y, right: 0, bottom: BODY.open.y, borderRadius: "56.5px 0 0 56.5px", background: "var(--bg)" }} />
        {sheen}
      </div>
      <div style={{ ...face, transform: "rotateY(180deg)", borderRadius: BODY.closed.r }}>
        <div style={{ position: "absolute", left: BODY.closed.x, top: BODY.open.y, right: BODY.open.y, bottom: BODY.open.y, borderRadius: BODY.closed.screenR, background: "var(--bg)" }} />
        {sheen}
      </div>
    </div>
  );
}

// --- system chrome --------------------------------------------------------------------------------

const glass: CSSProperties = { background: "var(--wd-glass)", boxShadow: "0 0 0 0.5px rgb(0 0 0 / 0.12), 0 4px 14px rgb(0 0 0 / 0.08)", backdropFilter: "blur(12px)" };
const pane: CSSProperties = { position: "absolute", top: 0, width: PANE.w, height: "100%", borderRadius: 30, overflow: "hidden", background: "var(--card)", transition: `left 0.7s ${ease}` };
const circle: CSSProperties = { ...glass, width: 49, height: 49, borderRadius: 99, display: "grid", placeItems: "center" };

/** The strip's clock and status, under the camera. */
function Status({ x, top }: { x: number; top: number }) {
  return (
    <div data-wd-system style={{ position: "absolute", left: x - 40, top, width: 80, textAlign: "center", color: "var(--ink)", pointerEvents: "none" }}>
      <div style={{ font: "600 17px -apple-system, system-ui" }}>9:41</div>
      <Glyph d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" style={{ marginTop: 6 }} />
    </div>
  );
}

/** Safari's own column: clock, back and reader at the top, the +/tabs pill at the bottom. `over`: drawn over a
 *  frame that includes the column (closed portrait), where the page paints the rest. */
function SafariColumn({ x, h, top, over }: { x: number; h: number; top: number; over?: boolean }) {
  return (
    <div style={{ position: "absolute", left: x, top: 0, width: STRIP, height: h, display: "flex", flexDirection: "column", alignItems: "center", color: "var(--ink)", pointerEvents: "none", background: over ? undefined : "var(--card)" }}>
      <div style={{ font: "600 17px -apple-system, system-ui", marginTop: top }}>9:41</div>
      <div data-wd-system style={{ ...circle, marginTop: top > 50 ? 72 : 16 }}><Glyph d="m15 18-6-6 6-6" /></div>
      <div data-wd-system style={{ ...circle, marginTop: 11 }}><Glyph d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></div>
      <div style={{ flex: 1 }} />
      <div data-wd-system style={{ ...glass, width: 49, height: 113, borderRadius: 99, display: "flex", flexDirection: "column", justifyContent: "space-around", alignItems: "center", marginBottom: 24 }}>
        <Glyph d="M5 12h14M12 5v14" /><Glyph d="M8 8h12v12H8zM4 16V4h12" />
      </div>
    </div>
  );
}

function UrlBar({ left, top, width, host }: { left: number; top: number; width: number; host: string }) {
  return <div data-wd-system style={{ position: "absolute", left, top, width, height: 46, borderRadius: 99, ...glass, display: "flex", alignItems: "center", justifyContent: "center", font: "500 17px -apple-system, system-ui", color: "var(--ink)", pointerEvents: "none" }}>{host}</div>;
}

/** Safari unfolded: status row, then the toolbar with the address field. */
function OpenSafari({ w, host }: { w: number; host: string }) {
  return (
    <div data-wd-system style={{ position: "absolute", left: 0, top: 0, width: w, height: OPEN_BAR, background: "var(--card)", borderBottom: "0.5px solid var(--line)", color: "var(--ink)", pointerEvents: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 40px 0", font: "600 15px -apple-system, system-ui" }}><span>9:41</span><span>100%</span></div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 28px 0" }}>
        <Glyph d="m15 18-6-6 6-6" /><Glyph d="m9 18 6-6-6-6" style={{ opacity: 0.35 }} />
        <div style={{ flex: 1, height: 40, borderRadius: 12, background: "var(--bg)", display: "grid", placeItems: "center", font: "500 16px -apple-system, system-ui" }}>{host}</div>
        <Glyph d="M5 12h14M12 5v14" /><Glyph d="M8 8h12v12H8zM4 16V4h12" />
      </div>
    </div>
  );
}

/** The other app in the split: quiet placeholder content, so the eye stays on the Safari pane. */
function OtherApp() {
  const bar = (w: number | string, o = 1): CSSProperties => ({ height: 12, width: w, borderRadius: 6, background: "var(--line)", opacity: o });
  return (
    <div style={{ padding: "64px 22px 0" }}>
      <div style={{ ...bar(150), height: 26, borderRadius: 8, marginBottom: 26 }} />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 0", borderBottom: "0.5px solid var(--line)" }}>
          <div style={{ width: 44, height: 44, borderRadius: 99, background: "var(--line)", flex: "none" }} />
          <div style={{ flex: 1, display: "grid", gap: 8 }}><div style={bar(`${50 + ((i * 17) % 35)}%`)} /><div style={bar(`${70 + ((i * 11) % 25)}%`, 0.6)} /></div>
        </div>
      ))}
    </div>
  );
}

function Crease() {
  return <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 18, marginLeft: -9, pointerEvents: "none", zIndex: 1, background: "linear-gradient(90deg, transparent, rgb(0 0 0 / 0.05) 40%, rgb(255 255 255 / 0.06) 55%, transparent)" }} />;
}

function Glyph({ d, style }: { d: string; style?: CSSProperties }) {
  return <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto", ...style }}><path d={d} /></svg>;
}

// --- controls -------------------------------------------------------------------------------------

const control: CSSProperties = { height: 40, borderRadius: 99, border: 0, font: "500 15px -apple-system, system-ui", color: "var(--ink)", cursor: "pointer" };

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div role="radiogroup" style={{ display: "flex", padding: 3, gap: 2, borderRadius: 99, background: "var(--card)", boxShadow: "0 0 0 0.5px var(--line)" }}>
      {options.map(([v, label]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          style={{ ...control, height: 34, padding: "0 14px", background: value === v ? "var(--accent)" : "transparent", color: value === v ? "#fff" : "var(--ink)" }}>{label}</button>
      ))}
    </div>
  );
}

function Button({ onClick, label, on, children }: { onClick: () => void; label: string; on?: boolean; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{ ...control, display: "flex", alignItems: "center", gap: 7, padding: "0 16px", background: on ? "var(--accent)" : "var(--card)", color: on ? "#fff" : "var(--ink)", boxShadow: "0 0 0 0.5px var(--line)" }}>
      {children}{label}
    </button>
  );
}

// --- host -----------------------------------------------------------------------------------------

const DESKTOP = "(hover: hover) and (pointer: fine) and (min-width: 900px)";
/** true on a desktop browser, where the site shows on the web Duo; false on phones (the iPhone Duo included,
 *  where Duet reads the real device) and inside the web Duo itself; null before hydration. `?plain` opts out. */
export function useDesktop(): boolean | null {
  return useSyncExternalStore(
    (cb) => { const m = matchMedia(DESKTOP); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.top === window && !new URLSearchParams(location.search).has("plain") && matchMedia(DESKTOP).matches,
    () => null,
  );
}
