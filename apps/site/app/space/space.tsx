"use client";

import { useEffect, useRef, useState } from "react";
import { detect } from "duet-ui/geometry";
import { SCREEN, scene, type State } from "../duo/web-duo";

// The web Duo's scene() at 1:1 in screen points, page and stage chrome only (no body, no motion), so a spec reads
// the mock's rects straight off the DOM: the page's slots through the iframe, the native buttons as [data-wd-native],
// and the signals the mock posts as [data-space-signals].
const BASE: State = { posture: "closed", turn: 0, upside: false, app: "safari", pane: "right", live: false };

export function Space() {
  const [s, setS] = useState<State | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setS({ ...BASE, ...JSON.parse(q.get("s") ?? "{}") });
  }, []);
  const n = s && SCREEN[s.posture], [W, H] = !s || !n ? [0, 0] : s.turn ? [n.h, n.w] : [n.w, n.h];
  const sc = s && scene(s, W, H, "duet.example", (x) => detect(x).mode);
  const signals = sc ? JSON.stringify(sc.signals) : "";
  useEffect(() => {
    if (!signals) return;
    const post = () => frame.current?.contentWindow?.postMessage({ type: "duet:signals", signals: JSON.parse(signals) }, location.origin);
    const ready = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow && e.data?.type === "duet:ready") post(); };
    post();
    addEventListener("message", ready);
    return () => removeEventListener("message", ready);
  }, [signals]);
  if (!sc) return null;
  return (
    <div data-space-screen data-space-signals={signals} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden", background: "var(--bg)" }}>
      {sc.under}
      <div data-space-clip style={{ position: "absolute", left: sc.clip.x, top: sc.clip.y, width: sc.clip.w, height: sc.clip.h, overflow: "hidden", borderRadius: sc.clipR }}>
        <iframe ref={frame} src="/examples/inbox?plain" title="Duet on the iPhone Duo" style={{ position: "absolute", left: sc.frame.x, top: sc.frame.y, width: sc.frame.w, height: sc.frame.h, border: 0, display: "block" }} />
      </div>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{sc.chrome}</div>
    </div>
  );
}
