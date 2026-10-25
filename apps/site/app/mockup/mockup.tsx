"use client";

import { useEffect, useState, type CSSProperties } from "react";

// Inner screen in points, measured on the Duo Lab simulator (see docs/research-notes.md).
const OPEN = { w: 951, h: 669 };
// A Safari pane in split view: the page gets 385x571, Safari keeps an 84pt column and a 98pt URL bar.
const PANE = { w: 469, page: { w: 385, h: 571 } };
const GAP = OPEN.w - 2 * PANE.w;
// The unfolded body, measured from the simulator's device artwork (tools/media/frame.py): 13pt side and 14pt
// top/bottom bezel, continuous outer corners, the screen's own corner radius from its framebuffer mask.
const BEZEL = { x: 13, y: 14 };
const BODY = { w: OPEN.w + 2 * BEZEL.x, h: OPEN.h + 2 * BEZEL.y, r: 72 };
const SCREEN_R = 56.5;
// Buttons stick out 4pt, on the right half (the outer display's body): volume on top, power on the right edge.
const BUTTONS = [{ right: 271, top: -4, w: 66, h: 6 }, { right: 191, top: -4, w: 66, h: 6 }, { right: -3, top: 196, w: 5, h: 113 }];

const ease = "cubic-bezier(0.32, 0.72, 0, 1)";

export function Mockup({ pane: initial, src, caption, dark }: { pane: "left" | "right"; src: string; caption?: string; dark: boolean }) {
  const [pane, setPane] = useState(initial);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => setScale(Math.min((innerWidth - 48) / BODY.w, (innerHeight - (caption ? 120 : 48)) / BODY.h, 1.6));
    fit();
    addEventListener("resize", fit);
    // Recording scripts drive the scene through this.
    (window as unknown as { mockup: object }).mockup = { swap: () => setPane((p) => (p === "right" ? "left" : "right")), setPane };
    return () => removeEventListener("resize", fit);
  }, [caption]);

  const theme = dark
    ? { "--m-bg": "#0b0b0c", "--m-pane": "#1c1c1e", "--m-ink": "#fff", "--m-dim": "rgb(235 235 245 / 0.3)", "--m-glass": "rgb(255 255 255 / 0.12)" }
    : { "--m-bg": "#f2f2f7", "--m-pane": "#fff", "--m-ink": "#000", "--m-dim": "rgb(60 60 67 / 0.14)", "--m-glass": "rgb(255 255 255 / 0.9)" };

  const device = (
    <div style={{ position: "relative", width: BODY.w, height: BODY.h, flex: "none", transform: `scale(${scale})` }}>
      {BUTTONS.map((b, i) => (
        <div key={i} style={{ position: "absolute", right: b.right, top: b.top, width: b.w, height: b.h, borderRadius: 3, background: "linear-gradient(#5a5b60, #2a2b2e)" }} />
      ))}
      <div style={{
        position: "absolute", inset: 0, borderRadius: BODY.r, cornerShape: "squircle", background: "#0d0d0f",
        boxShadow: "inset 0 0 0 1.5px #4a4b50, inset 0 0 0 3px #1b1c1f, 0 40px 80px rgb(0 0 0 / 0.28)",
      } as CSSProperties} />
      <div style={{
        position: "absolute", left: BEZEL.x, top: BEZEL.y, width: OPEN.w, height: OPEN.h, borderRadius: SCREEN_R,
        overflow: "hidden", background: "var(--m-bg)", ...(theme as CSSProperties),
      }}>
        <Pane x={pane === "right" ? 0 : PANE.w + GAP}><OtherApp /></Pane>
        <Pane x={pane === "right" ? PANE.w + GAP : 0}><Safari src={src} /></Pane>
        <Crease />
      </div>
    </div>
  );

  return (
    <div style={{ height: "100dvh", display: "grid", placeItems: "center", background: dark ? "#000" : "linear-gradient(180deg, #fbfbfd, #e8e8ed)", overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 * scale }}>
        <div style={{ width: BODY.w * scale, height: BODY.h * scale, display: "grid", placeItems: "center" }}>{device}</div>
        {caption && <div style={{ font: "500 20px -apple-system, system-ui", color: dark ? "#f5f5f7" : "#1d1d1f", letterSpacing: -0.2 }}>{caption}</div>}
      </div>
    </div>
  );
}

function Pane({ x, children }: { x: number; children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", top: 0, left: x, width: PANE.w, height: OPEN.h, borderRadius: 30, overflow: "hidden", background: "var(--m-pane)", transition: `left 0.7s ${ease}` }}>
      {children}
    </div>
  );
}

/** Safari in a split-view pane: the page, Safari's URL bar below it and Safari's own column beside it. */
function Safari({ src }: { src: string }) {
  const circle: CSSProperties = { width: 49, height: 49, borderRadius: 99, background: "var(--m-glass)", boxShadow: "0 0 0 0.5px rgb(0 0 0 / 0.12), 0 4px 14px rgb(0 0 0 / 0.08)", display: "grid", placeItems: "center", color: "var(--m-ink)" };
  return (
    <>
      <iframe src={src} title="Safari page" style={{ position: "absolute", top: 0, left: 0, width: PANE.page.w, height: PANE.page.h, border: 0, display: "block" }} />
      <div style={{ position: "absolute", left: 18, top: PANE.page.h + 22, width: PANE.page.w - 36, height: 46, borderRadius: 99, ...pill, display: "flex", alignItems: "center", justifyContent: "center", font: "500 17px -apple-system, system-ui", color: "var(--m-ink)" }}>localhost</div>
      <div style={{ position: "absolute", left: PANE.page.w, top: 0, width: PANE.w - PANE.page.w, height: OPEN.h, display: "flex", flexDirection: "column", alignItems: "center", color: "var(--m-ink)" }}>
        <div style={{ font: "600 17px -apple-system, system-ui", marginTop: 74 }}>9:41</div>
        <div style={{ ...circle, marginTop: 72 }}><Glyph d="m15 18-6-6 6-6" /></div>
        <div style={{ ...circle, marginTop: 11 }}><Glyph d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></div>
        <div style={{ flex: 1 }} />
        <div style={{ width: 49, height: 113, borderRadius: 99, ...pill, display: "flex", flexDirection: "column", justifyContent: "space-around", alignItems: "center", marginBottom: 24 }}>
          <Glyph d="M5 12h14M12 5v14" /><Glyph d="M8 8h12v12H8zM4 16V4h12" />
        </div>
      </div>
    </>
  );
}
const pill: CSSProperties = { background: "var(--m-glass)", boxShadow: "0 0 0 0.5px rgb(0 0 0 / 0.12), 0 4px 14px rgb(0 0 0 / 0.08)" };

function Glyph({ d }: { d: string }) {
  return <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

/** The other app in the split: quiet placeholder content, so the eye stays on the Safari pane. */
function OtherApp() {
  const bar = (w: number | string, o = 1): CSSProperties => ({ height: 12, width: w, borderRadius: 6, background: "var(--m-dim)", opacity: o });
  return (
    <div style={{ padding: "64px 22px 0" }}>
      <div style={{ ...bar(150), height: 26, borderRadius: 8, marginBottom: 26 }} />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 0", borderBottom: "0.5px solid var(--m-dim)" }}>
          <div style={{ width: 44, height: 44, borderRadius: 99, background: "var(--m-dim)", flex: "none" }} />
          <div style={{ flex: 1, display: "grid", gap: 8 }}><div style={bar(`${50 + ((i * 17) % 35)}%`)} /><div style={bar(`${70 + ((i * 11) % 25)}%`, 0.6)} /></div>
        </div>
      ))}
    </div>
  );
}

/** The fold: a soft vertical crease down the middle of the open screen. */
function Crease() {
  return <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 18, marginLeft: -9, pointerEvents: "none", background: "linear-gradient(90deg, transparent, rgb(0 0 0 / 0.05) 40%, rgb(255 255 255 / 0.06) 55%, transparent)" }} />;
}
