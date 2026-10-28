"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { AppWindow, ArrowRight, Compass, Globe, House, Keyboard, Maximize2, MessageSquareShare, MessageSquareText, PanelLeft, PanelRight, RotateCcw, RotateCw, Rotate3d } from "lucide-react";
import { ONLY_OPEN, Phases, Rule, Segmented, TOUR, Tool, control, fit, group, hardware, rotate, sameView, type State, type Turn } from "./reexports";
import { CHANNEL, DUO_PORT, type Sync } from "./shared";

const HOLD = 2600; // a tour stop, the 3D hinge settling included
const SWAP = 450; // the interface turns upright this far into the device's turn

// Stand poses, the device on a table seen a little from above. Both are landscape with the hinge across: the
// interface turns with the hardware. Nightstand is a tent on the closed side, the cover display facing you;
// elevated is a laptop, one half flat and the other raised. duo tips the whole device by `pitch`.
type Stand = "flat" | "nightstand" | "elevated";
const ABOVE = 0.3; // radians the table is tipped toward you
const STANDS: Record<Exclude<Stand, "flat">, { posture: "open" | "closed"; deg: number }> = {
  nightstand: { posture: "closed", deg: 70 },
  elevated: { posture: "open", deg: 110 },
};
// Nightstand straddles the hinge, so it tips by half the fold; elevated lays the fixed half flat.
const pitch = (stand: Stand, deg: number) =>
  stand === "nightstand" ? (deg * Math.PI) / 360 + ABOVE : stand === "elevated" ? -Math.PI / 2 + ABOVE : 0;

// The device side-on or face-on, drawn for the posture picker: closed is the narrow D, flat on the hinge side, with
// the camera top right; open is wide with the hinge down the middle; tent and laptop stand on a table line.
type Posture = "closed" | "open" | "tent" | "laptop";
const glyph = (d: ReactNode) => () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);
const POSTURES: [Posture, string, () => ReactNode][] = [
  ["closed", "Closed", glyph(<><path d="M7 3h7a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><circle cx="15.5" cy="6.5" r="0.9" fill="currentColor" /></>)],
  ["open", "Open", glyph(<><rect x="2.5" y="5" width="19" height="14" rx="3.5" /><path d="M12 5v14" strokeDasharray="1.5 2" /><circle cx="18.5" cy="8" r="0.9" fill="currentColor" /></>)],
  ["tent", "Tent", glyph(<><path d="M5 19L12 6l7 13" /><path d="M2.5 19.5h19" strokeWidth={1} /></>)],
  ["laptop", "Laptop", glyph(<><path d="M3 18h13l3-12" /><path d="M2 19.5h20" strokeWidth={1} /></>)],
];

// The web Duo's controls on doan-labs/duo's 3D device. duo renders Apple's model and bends its hinge; both of its
// displays frame /duo3d/screen, which draws what the 2D web Duo draws on its screen. The fold is duo's: an angle,
// 0 closed to 180 open, eased there by duo itself.
export function Duo3D() {
  const [s, setS] = useState<State>(TOUR[0]);
  const [deg, setDeg] = useState(0);
  const [stand, setStand] = useState<Stand>("flat");
  const [upright, setUpright] = useState<Turn>(0);
  const [tour, setTour] = useState(false);
  const [duet, setDuet] = useState(true);
  const [at, setAt] = useState(0);
  // The page in Safari: the skeleton site, or any URL through /duo3d/web, which adds Duet to it.
  const [page, setPage] = useState("");
  const src = page ? `/duo3d/web?url=${encodeURIComponent(page)}` : "/skeleton";
  const duo = useRef<HTMLIFrameElement>(null), spin = useRef(0);
  const url = useSyncExternalStore(() => () => {}, () => {
    const screens = `${location.origin}/duo3d/screen`;
    return `${location.protocol}//${location.hostname}:${DUO_PORT}/?hud=0&deg=0&screens=${encodeURIComponent(screens)}`;
  }, () => "");

  // The device turns the short way round, so its roll keeps counting past a full turn.
  const hw = hardware(s);
  spin.current += ((((hw - spin.current) % 360) + 540) % 360) - 180;
  const pose = { deg, roll: (-spin.current * Math.PI) / 180, pitch: pitch(stand, deg) };
  const send = () => duo.current?.contentWindow?.postMessage(pose, "*");
  useEffect(send, [deg, pose.roll, pose.pitch]); // eslint-disable-line react-hooks/exhaustive-deps
  // The camera eases back in front of the device, after a drag has orbited it.
  const front = () => duo.current?.contentWindow?.postMessage({ reset: true }, "*");
  useEffect(() => {
    const hi = (e: MessageEvent) => { if (e.source === duo.current?.contentWindow && (e.data?.live || e.data?.ready)) send(); };
    addEventListener("message", hi);
    return () => removeEventListener("message", hi);
  });

  // Both displays follow the state; a display that loads late asks for it.
  const sync: Sync = { s: { ...s, laptop: stand === "elevated" }, upright, src, duet };
  const ch = useRef<BroadcastChannel | null>(null), last = useRef(sync);
  last.current = sync;
  useEffect(() => {
    const c = ch.current = new BroadcastChannel(CHANNEL);
    c.onmessage = (e) => { if (e.data?.hello) c.postMessage(last.current); };
    return () => c.close();
  }, []);
  useEffect(() => { ch.current?.postMessage(sync); }, [JSON.stringify(sync)]); // eslint-disable-line react-hooks/exhaustive-deps

  // The interface turns upright once the device is most of the way round, like iOS.
  useEffect(() => {
    const t = setTimeout(() => setUpright(s.upside ? upright : s.turn), s.turn === upright ? 0 : SWAP);
    return () => clearTimeout(t);
  }, [s.turn, s.upside]); // eslint-disable-line react-hooks/exhaustive-deps

  // An app keeps the stand; a fold, a turn, a tour stop or an app that only runs upright leaves it.
  const go = (next: Partial<State>, fromTour = false, to: Stand = stand) => {
    if (!fromTour) setTour(false);
    const n = { ...s, ...next };
    if (next.app && ONLY_OPEN(n.app)) { Object.assign(n, { posture: "open", turn: 0, upside: false }); to = "flat"; }
    setStand(to);
    const f = fit(n);
    if (!fromTour) setAt(TOUR.findIndex((t) => sameView(t, f)));
    setS(f);
    setDeg(to !== "flat" ? STANDS[to].deg : f.posture === "open" ? 180 : 0);
  };
  // The posture picker. A stand is landscape with the hardware turned clockwise, and puts the camera back in front
  // to be seen as posed; closed or open lays the device flat, upright again when it leaves a stand.
  const now: Posture = stand === "nightstand" ? "tent" : stand === "elevated" ? "laptop" : s.posture;
  const posture = (to: Posture) => {
    if (to === "tent" || to === "laptop") {
      const st = to === "tent" ? "nightstand" : "elevated";
      front();
      return go({ posture: STANDS[st].posture, turn: 90, upside: false }, false, st);
    }
    go({ posture: to, ...(stand !== "flat" && { turn: 0 as Turn, upside: false }) }, false, "flat");
  };

  useEffect(() => {
    if (!tour) return;
    let i = at;
    const t = setInterval(() => { i = (i + 1) % TOUR.length; setAt(i); go({ ...TOUR[i] }, true, "flat"); }, HOLD);
    return () => clearInterval(t);
  }, [tour]); // eslint-disable-line react-hooks/exhaustive-deps

  // The fold slider: the hinge follows the thumb, and the posture flips at half way.
  const scrub = (t: number) => {
    setTour(false);
    const d = t * 180, posture = d >= 90 ? "open" : "closed";
    setDeg(d);
    if (posture !== s.posture) setS(fit({ ...s, posture }));
  };

  const safari = s.app === "safari" || s.app === "split" || s.app === "window";
  const split = s.app === "split", Pane = s.pane === "left" ? PanelLeft : PanelRight;
  const row: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", alignItems: "center", padding: "0 16px" };
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "20px 0", background: "linear-gradient(180deg, var(--bg), color-mix(in srgb, var(--bg), #888 12%))" }}>
      <header style={{ textAlign: "center", padding: "0 16px" }}>
        <div style={{ font: "800 26px/1 -apple-system, system-ui", letterSpacing: -0.5 }}>Duo 3D, local</div>
        <div style={{ color: "var(--dim)", font: "400 14px/1.4 -apple-system, system-ui", marginTop: 6 }}>doan-labs/duo renders Apple&apos;s model on this machine only; Duet runs live on both displays.</div>
      </header>
      {url && <iframe ref={duo} src={url} title="iPhone Duo, 3D" onLoad={send} style={{ width: "100%", height: "min(64vh, 720px)", border: 0, display: "block", background: "transparent" }} />}
      {/* Three questions, one row each: how the device is held, what is on its screen, which page and with or without Duet. */}
      <div style={row}>
        <div role="toolbar" aria-label="Device" style={{ ...group, alignItems: "center" }}>
          {POSTURES.map(([to, label, Icon]) => (
            <Tool key={to} label={label} on={now === to} onClick={() => posture(to)}><Icon /></Tool>
          ))}
          <Rule />
          {([[-90, "Rotate left", RotateCcw], [90, "Rotate right", RotateCw]] as const).map(([by, label, Icon]) => (
            <Tool key={by} label={label} onClick={() => go(rotate(s, by), false, "flat")}><Icon size={18} /></Tool>
          ))}
          <Rule />
          <input type="range" aria-label="Fold" title="Fold" min={0} max={1} step={0.001} value={deg / 180} onChange={(e) => scrub(+e.currentTarget.value)} style={{ width: 110, margin: "0 8px", accentColor: "var(--accent)" }} />
          <Tool label="Reset view" onClick={front}><Rotate3d size={18} /></Tool>
        </div>
      </div>
      <div style={row}>
        {/* Every app view in one picker; Split again swaps its sides. */}
        <div role="toolbar" aria-label="App" style={{ ...group, alignItems: "center" }}>
          <Tool label="Home Screen web app" on={s.app === "home"} onClick={() => go({ app: "home" })}><House size={18} /></Tool>
          <Rule />
          <Tool label="Safari" on={s.app === "safari"} onClick={() => go({ app: "safari" })}><Compass size={18} /></Tool>
          <Tool label={split ? "Swap Split View sides" : "Safari in Split View"} on={split} onClick={() => go(split ? { pane: s.pane === "left" ? "right" : "left" } : { app: "split" })}><Pane size={18} /></Tool>
          <Tool label="Safari window" on={s.app === "window"} onClick={() => go({ app: "window" })}><AppWindow size={18} /></Tool>
          <Rule />
          <Tool label="Messages link, page sheet" on={s.app === "sheet"} onClick={() => go({ app: "sheet" })}><MessageSquareText size={18} /></Tool>
          <Tool label="Messages link, full screen" on={s.app === "preview"} onClick={() => go({ app: "preview" })}><Maximize2 size={18} /></Tool>
        </div>
        {/* What can sit over any of them; Safari's own bars only exist in Safari. */}
        <div role="toolbar" aria-label="Overlays" style={{ ...group, alignItems: "center" }}>
          <Tool label="Keyboard" on={!!s.keyboard} onClick={() => go({ keyboard: !s.keyboard })}><Keyboard size={18} /></Tool>
          <Tool label="Shared with You bar (Safari)" on={!!s.shared} off={!safari} onClick={() => go({ shared: !s.shared })}><MessageSquareShare size={18} /></Tool>
          <Tool label="Forward history (Safari)" on={!!s.forward} off={!safari} onClick={() => go({ forward: !s.forward })}><ArrowRight size={18} /></Tool>
        </div>
      </div>
      <div style={row}>
        {/* Before and after: the same site as a plain mobile site, then with Duet. */}
        <form onSubmit={(e) => { e.preventDefault(); setPage(String(new FormData(e.currentTarget).get("url") ?? "").trim()); }} style={{ ...group, alignItems: "center", gap: 6, padding: "0 6px 0 14px" }}>
          <Globe size={16} style={{ color: "var(--dim)", flexShrink: 0 }} />
          <input name="url" type="text" inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="Any URL, or empty for the skeleton" defaultValue={page}
            style={{ width: 240, height: 36, border: 0, background: "transparent", color: "var(--ink)", font: "400 15px -apple-system, system-ui", outline: "none" }} />
          <button type="submit" aria-label="Load in Safari" style={{ ...control, width: 36, height: 36, display: "grid", placeItems: "center" }}><ArrowRight size={16} /></button>
        </form>
        <Segmented value={duet ? "on" : "off"} onChange={(v) => setDuet(v === "on")} options={[["off", "Without Duet"], ["on", "With Duet"]]} />
      </div>
      <Phases app={s.app} at={at} tour={tour} onPick={(i) => go({ ...TOUR[i], live: s.live }, false, "flat")} onTour={() => setTour((t) => !t)} live={s.live} onLive={() => go({ live: !s.live })} row />
    </div>
  );
}
