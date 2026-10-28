"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppWindow, Compass, House, PanelLeft, PanelRight, RotateCcw, RotateCw, Smartphone, Tablet } from "lucide-react";
import { ONLY_OPEN, Phases, Rule, TOUR, Tool, control, fit, group, hardware, rotate, sameView, type State, type Turn } from "./reexports";
import { CHANNEL, DUO_PORT, type Sync } from "./shared";

const HOLD = 2600; // a tour stop, the 3D hinge settling included
const SWAP = 450; // the interface turns upright this far into the device's turn

// The web Duo's controls on doan-labs/duo's 3D device. duo renders Apple's model and bends its hinge; both of its
// displays frame /duo3d/screen, which draws what the 2D web Duo draws on its screen. The fold is duo's: an angle,
// 0 closed to 180 open, eased there by duo itself.
export function Duo3D() {
  const [s, setS] = useState<State>(TOUR[0]);
  const [deg, setDeg] = useState(0);
  const [upright, setUpright] = useState<Turn>(0);
  const [tour, setTour] = useState(false);
  const [at, setAt] = useState(0);
  const src = "/skeleton";
  const duo = useRef<HTMLIFrameElement>(null), spin = useRef(0);
  const url = useSyncExternalStore(() => () => {}, () => {
    const screens = `${location.origin}/duo3d/screen`;
    return `${location.protocol}//${location.hostname}:${DUO_PORT}/?hud=0&deg=0&screens=${encodeURIComponent(screens)}`;
  }, () => "");

  // The device turns the short way round, so its roll keeps counting past a full turn.
  const hw = hardware(s);
  spin.current += ((((hw - spin.current) % 360) + 540) % 360) - 180;
  const pose = { deg, roll: (-spin.current * Math.PI) / 180 };
  const send = () => duo.current?.contentWindow?.postMessage(pose, "*");
  useEffect(send, [deg, pose.roll]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const hi = (e: MessageEvent) => { if (e.source === duo.current?.contentWindow && (e.data?.live || e.data?.ready)) send(); };
    addEventListener("message", hi);
    return () => removeEventListener("message", hi);
  });

  // Both displays follow the state; a display that loads late asks for it.
  const sync: Sync = { s, upright, src };
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

  const go = (next: Partial<State>, fromTour = false) => {
    if (!fromTour) setTour(false);
    const n = { ...s, ...next };
    if (next.app && ONLY_OPEN(n.app)) Object.assign(n, { posture: "open", turn: 0, upside: false });
    const f = fit(n);
    if (!fromTour) setAt(TOUR.findIndex((t) => sameView(t, f)));
    setS(f);
    setDeg(f.posture === "open" ? 180 : 0);
  };

  useEffect(() => {
    if (!tour) return;
    let i = at;
    const t = setInterval(() => { i = (i + 1) % TOUR.length; setAt(i); go({ ...TOUR[i] }, true); }, HOLD);
    return () => clearInterval(t);
  }, [tour]); // eslint-disable-line react-hooks/exhaustive-deps

  // The fold slider: the hinge follows the thumb, and the posture flips at half way.
  const scrub = (t: number) => {
    setTour(false);
    const d = t * 180, posture = d >= 90 ? "open" : "closed";
    setDeg(d);
    if (posture !== s.posture) setS(fit({ ...s, posture }));
  };

  const split = s.app === "split", Pane = s.pane === "left" ? PanelLeft : PanelRight;
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "20px 0", background: "linear-gradient(180deg, var(--bg), color-mix(in srgb, var(--bg), #888 12%))" }}>
      <header style={{ textAlign: "center", padding: "0 16px" }}>
        <div style={{ font: "800 26px/1 -apple-system, system-ui", letterSpacing: -0.5 }}>Duo 3D, local</div>
        <div style={{ color: "var(--dim)", font: "400 14px/1.4 -apple-system, system-ui", marginTop: 6 }}>doan-labs/duo renders Apple&apos;s model on this machine only; Duet runs live on both displays.</div>
      </header>
      {url && <iframe ref={duo} src={url} title="iPhone Duo, 3D" onLoad={send} style={{ width: "100%", height: "min(68vh, 760px)", border: 0, display: "block", background: "transparent" }} />}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", padding: "0 16px" }}>
        <div role="toolbar" aria-label="Device" style={{ ...group, alignItems: "center" }}>
          <Tool label={s.posture === "open" ? "Fold" : "Unfold"} onClick={() => go({ posture: s.posture === "open" ? "closed" : "open" })}>
            {s.posture === "open" ? <Tablet size={18} style={{ rotate: "90deg" }} /> : <Smartphone size={18} />}
          </Tool>
          <Rule />
          {([[-90, "Rotate left", RotateCcw], [90, "Rotate right", RotateCw]] as const).map(([by, label, Icon]) => (
            <Tool key={by} label={label} onClick={() => go(rotate(s, by))}><Icon size={18} /></Tool>
          ))}
          <Rule />
          <Tool label="Home Screen" on={s.app === "home"} onClick={() => go({ app: "home" })}><House size={18} /></Tool>
          <Tool label="Safari" on={s.app === "safari"} onClick={() => go({ app: "safari" })}><Compass size={18} /></Tool>
          <Tool label={split ? "Swap Split View sides" : "Split View"} on={split} onClick={() => go(split ? { pane: s.pane === "left" ? "right" : "left" } : { app: "split" })}><Pane size={18} /></Tool>
          <Tool label="Safari window" on={s.app === "window"} onClick={() => go({ app: "window" })}><AppWindow size={18} /></Tool>
        </div>
        <label style={{ ...control, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", background: "var(--card)", boxShadow: "0 0 0 0.5px var(--line)" }}>
          Fold
          <input type="range" aria-label="Fold" min={0} max={1} step={0.001} value={deg / 180} onChange={(e) => scrub(+e.currentTarget.value)} style={{ width: 120, accentColor: "var(--accent)" }} />
        </label>
      </div>
      <Phases app={s.app} at={at} tour={tour} onPick={(i) => go({ ...TOUR[i], live: s.live })} onTour={() => setTour((t) => !t)} live={s.live} onLive={() => go({ live: !s.live })} row />
    </div>
  );
}
