"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { detect, type Mode, type Signals } from "duet-ui/geometry";
import { Island, SCREEN, fit, island, scene } from "../duo/web-duo";
import { channel, type Sync } from "./shared";
import { useTheme } from "../theme";

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
// Opening: a touch past full and back, over about the time the 3D hinge takes to lay flat.
const SPRING = "cubic-bezier(0.3, 1.22, 0.45, 1)";

// One of the device's displays, as the 2D web Duo draws its screen: the inner one always in the open layout, the
// outer one always closed, both live through the fold the way iOS holds a session on both. Scaled to duo's panel.
export function Screen() {
  // The host page's light or dark pick reaches this display through localStorage's storage event.
  useTheme();
  const display = useSyncExternalStore(() => () => {}, () => new URLSearchParams(location.search).get("display") === "outer" ? "outer" : "inner", () => "inner");
  const here = useSyncExternalStore(() => () => {}, () => location.host, () => "");
  // A page loaded through /duo3d/web says where it really is, for Safari's address bar.
  const [page, setPage] = useState<{ src: string; host: string } | null>(null);
  const [sync, setSync] = useState<Sync | null>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [seen, setSeen] = useState<{ signals: string; mode: Mode } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null), sent = useRef("");

  useEffect(() => {
    const ch = new BroadcastChannel(channel(new URLSearchParams(location.search).get("id") ?? ""));
    ch.onmessage = (e) => { if (e.data?.s) setSync(e.data); else if (e.data?.press) press(frame.current, e.data.press); };
    ch.postMessage({ hello: true });
    // What Duet drew, for the host's captions (free room, fit) and the recorder (rects): only on a change.
    let last = "";
    const measure = setInterval(() => {
      const m = measures(frame.current);
      const j = JSON.stringify(m);
      if (m && j !== last) { last = j; ch.postMessage({ measure: { display: new URLSearchParams(location.search).get("display") ?? "inner", ...m } }); }
    }, 400);
    const size = () => setView({ w: innerWidth, h: innerHeight });
    size();
    addEventListener("resize", size);
    return () => { ch.close(); clearInterval(measure); removeEventListener("resize", size); };
  }, []);

  const posture = display === "inner" ? "open" : "closed";
  const st = sync && fit({ ...sync.s, posture });
  const upright = sync?.upright ?? 0;
  const n = SCREEN[posture], [W, H] = upright ? [n.h, n.w] : [n.w, n.h];
  // Without Duet nothing paints in Safari's column, so the page is framed as an inline one: just the page.
  const duet = sync?.duet ?? true;
  const modeOf = (x: Signals): Mode => { if (!duet) return "inline"; const j = JSON.stringify(x); return seen?.signals === j ? seen.mode : detect(x).mode; };
  const host = page && page.src === sync?.src ? page.host : here;
  const sc = st && scene({ ...st, turn: upright }, W, H, host, modeOf);

  const signals = sc ? JSON.stringify(sc.signals) : "";
  useEffect(() => {
    if (!signals) return;
    const post = () => { sent.current = signals; frame.current?.contentWindow?.postMessage({ type: "duet:signals", signals: JSON.parse(signals) }, location.origin); };
    const ready = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow && e.data?.type === "duet:ready") post(); };
    post();
    addEventListener("message", ready);
    return () => removeEventListener("message", ready);
  }, [signals]);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.data?.type === "duo3d:url") setPage({ src: sync?.src ?? "", host: new URL(e.data.url).host.replace(/^www\./, "") });
    };
    addEventListener("message", on);
    return () => removeEventListener("message", on);
  }, [sync?.src]);

  // Duet off and on: the page swaps layouts itself, morphing each control (examples/inbox/app.tsx). A Moment's selected
  // place rides along, and whether to open the More list.
  const selected = sync?.selected;
  useEffect(() => {
    const post = () => frame.current?.contentWindow?.postMessage({ type: "skeleton:duet", on: duet, selected }, location.origin);
    const ready = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow && e.data?.type === "skeleton:ready") post(); };
    post();
    addEventListener("message", ready);
    return () => removeEventListener("message", ready);
  }, [duet, !!sc, selected?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  // The mode Duet actually laid out in, so the frame follows it, flip damper included.
  useEffect(() => {
    const el = frame.current;
    let mo: MutationObserver | undefined;
    const attach = () => {
      const root = el?.contentDocument?.documentElement;
      if (!root) return;
      const read = () => { const m = root.dataset.duetMode as Mode | undefined; if (m) setSeen({ signals: sent.current, mode: m }); };
      mo?.disconnect();
      mo = new MutationObserver(read);
      mo.observe(root, { attributes: true, attributeFilter: ["data-duet-mode"] });
      read();
    };
    attach();
    el?.addEventListener("load", attach);
    return () => { mo?.disconnect(); el?.removeEventListener("load", attach); };
  }, [!!sc]); // eslint-disable-line react-hooks/exhaustive-deps

  // The interface turning upright is a cut, as on iOS under the device's own turn: the page lands in its new frame
  // at once instead of sliding there from the old orientation's, which showed black where it had not reached yet.
  const was = useRef(upright), cut = was.current !== upright;
  useEffect(() => { was.current = upright; });

  // The page takes its new size at once and a transform eases it there from the old box, the way iOS moves a
  // window's snapshot: resizing the frame every animation frame made the page, and Duet in it, lay out again on each,
  // which jittered. The page lays out once, under the motion.
  const box = sc?.frame, last = useRef(box);
  useLayoutEffect(() => {
    const was = last.current, el = frame.current;
    last.current = box;
    if (!box || !was || !el || cut || (was.x === box.x && was.y === box.y && was.w === box.w && was.h === box.h)) return;
    el.animate([
      { transform: `translate(${was.x - box.x}px, ${was.y - box.y}px) scale(${was.w / box.w}, ${was.h / box.h})` },
      { transform: "none" },
    ], { duration: 520, easing: EASE });
  }, [box?.x, box?.y, box?.w, box?.h]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unfolding, the page on the inner display grows out of the half the cover stood over, the way it stretches with
  // Safari's mode changes, instead of sitting there whole while the hinge opens and the far half fills in late.
  const posture0 = sync?.s.posture, shut = useRef(posture0);
  useLayoutEffect(() => {
    const was = shut.current, el = frame.current;
    shut.current = posture0;
    if (display !== "inner" || was !== "closed" || !posture0 || posture0 === "closed" || !box || !el || cut) return;
    // The cover's share of the display, along the hinge's normal: on the right as drawn, at the bottom or top turned.
    const k = SCREEN.closed.w / SCREEN.open.w;
    const from = upright > 0 ? `translate(0, ${box.h * (1 - k)}px) scale(1, ${k})` : upright < 0 ? `scale(1, ${k})` : `translate(${box.w * (1 - k)}px, 0) scale(${k}, 1)`;
    el.animate([{ transform: from }, { transform: "none" }], { duration: 900, easing: SPRING });
  }, [posture0]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sc || !st || !sync) return <div style={{ position: "fixed", inset: 0, background: "#000" }} />;
  // A display the 3D view hides has no size; its page still loads, so it is there the moment the display shows.
  const scale = view.w ? Math.min(view.w / n.w, view.h / n.h) : 1;
  const motion = (props: string[]) => cut ? "none" : props.map((x) => `${x} 520ms ${EASE}`).join(", ");
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "var(--bg)" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: n.w, height: n.h, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0",
          transform: upright > 0 ? `translateY(${n.h}px) rotate(-90deg)` : upright < 0 ? `translateX(${n.w}px) rotate(90deg)` : undefined,
        }}>
          {sc.under}
          <div style={{ position: "absolute", left: sc.clip.x, top: sc.clip.y, width: sc.clip.w, height: sc.clip.h, overflow: "hidden", borderRadius: sc.clipR, transition: motion(["left", "top", "width", "height", "border-radius"]) }}>
            <iframe ref={frame} src={sync.src} title={`Duet on the ${display} display`} style={{
              position: "absolute", left: sc.frame.x, top: sc.frame.y, width: sc.frame.w, height: sc.frame.h, border: 0, display: "block", background: "var(--bg)", transformOrigin: "0 0",
            }} />
          </div>
          <div key={`${st.app}-${upright}`} data-chrome style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{sc.chrome}</div>
          {/* Safari's own bars and buttons glide to where the new layout puts them, with the page. */}
          {!cut && <style>{`[data-chrome] * { transition: ${motion(["left", "top", "width", "height", "opacity"])} }`}</style>}
        </div>
        {display === "outer" && <Island live={island(st)} />}
      </div>
    </div>
  );
}

/** A host's `duet:press`: the control pressed as a finger would, pointer down and up, then one click. */
function press(el: HTMLIFrameElement | null, p: { id?: string; selector?: string; retry?: boolean }, tries = p.retry ? 20 : 0) {
  const doc = el?.contentDocument, win = el?.contentWindow as (Window & typeof globalThis) | null;
  if (!doc || !win) { if (tries > 0) setTimeout(() => press(el, p, tries - 1), 200); return; }
  const sel = p.selector ?? `.duet-group:not([data-leaving]) [data-duet-control="${p.id}"]`;
  const t = doc.querySelector<HTMLElement>(sel);
  // Not drawn yet (the page still loading, Duet laying out a new posture): try again for a few seconds.
  if (!t) { if (tries > 0) setTimeout(() => press(el, p, tries - 1), 200); return; }
  const r = t.getBoundingClientRect(), at = { bubbles: true, cancelable: true, composed: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerId: 1, pointerType: "touch", isPrimary: true };
  t.dispatchEvent(new win.PointerEvent("pointerdown", at));
  // Duet's own press runs the button's click itself, 40 ms after a touch's release; anything else (a page row) gets the
  // click here. Both would toggle a list open and shut again.
  setTimeout(() => {
    let clicked = false;
    const saw = () => { clicked = true; };
    doc.addEventListener("click", saw, true);
    t.dispatchEvent(new win.PointerEvent("pointerup", at));
    setTimeout(() => { doc.removeEventListener("click", saw, true); if (!clicked) t.click(); }, 150);
  }, 90);
}

/** Duet's column in the page: its fit, the room its groups leave free along it, and each group's box. */
function measures(el: HTMLIFrameElement | null) {
  const nav = el?.contentDocument?.querySelector<HTMLElement>("nav.duet:not(.duet-sidebar)");
  if (!nav) return null;
  const box = (e: Element) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const rects = [...nav.querySelectorAll(".duet-group:not([data-leaving])")].map(box).filter((r) => r.w && r.h);
  const n = box(nav), down = n.h >= n.w;
  const free = Math.max(0, Math.round((down ? n.h : n.w) - rects.reduce((a, r) => a + (down ? r.h : r.w), 0)));
  return { fit: nav.dataset.duetFit ?? null, free, rects };
}
