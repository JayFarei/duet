"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { detect, type Mode, type Signals } from "duet-ui/geometry";
import { Island, SCREEN, fit, island, scene } from "../duo/web-duo";
import { CHANNEL, type Sync } from "./shared";

// One of the device's displays, as the 2D web Duo draws its screen: the inner one always in the open layout, the
// outer one always closed, both live through the fold the way iOS holds a session on both. Scaled to duo's panel.
export function Screen() {
  const display = useSyncExternalStore(() => () => {}, () => new URLSearchParams(location.search).get("display") === "outer" ? "outer" : "inner", () => "inner");
  const here = useSyncExternalStore(() => () => {}, () => location.host, () => "");
  // A page loaded through /duo3d/web says where it really is, for Safari's address bar.
  const [page, setPage] = useState<{ src: string; host: string } | null>(null);
  const [sync, setSync] = useState<Sync | null>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [seen, setSeen] = useState<{ signals: string; mode: Mode } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null), sent = useRef("");

  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (e) => { if (e.data?.s) setSync(e.data); };
    ch.postMessage({ hello: true });
    const size = () => setView({ w: innerWidth, h: innerHeight });
    size();
    addEventListener("resize", size);
    return () => { ch.close(); removeEventListener("resize", size); };
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

  // Duet off and on: the page swaps layouts itself, morphing each control (skeleton-app.tsx).
  useEffect(() => {
    const post = () => frame.current?.contentWindow?.postMessage({ type: "skeleton:duet", on: duet }, location.origin);
    const ready = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow && e.data?.type === "skeleton:ready") post(); };
    post();
    addEventListener("message", ready);
    return () => removeEventListener("message", ready);
  }, [duet, !!sc]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!sc || !st || !sync || !view.w) return <div style={{ position: "fixed", inset: 0, background: "#000" }} />;
  const scale = Math.min(view.w / n.w, view.h / n.h);
  const motion = (props: string[]) => cut ? "none" : props.map((x) => `${x} 520ms cubic-bezier(0.32, 0.72, 0, 1)`).join(", ");
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
              position: "absolute", left: sc.frame.x, top: sc.frame.y, width: sc.frame.w, height: sc.frame.h, border: 0, display: "block", background: "var(--bg)", transition: motion(["left", "top", "width", "height"]),
            }} />
          </div>
          <div key={`${st.app}-${upright}`} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{sc.chrome}</div>
        </div>
        {display === "outer" && <Island live={island(st)} />}
      </div>
    </div>
  );
}
