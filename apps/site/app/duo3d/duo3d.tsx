"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { Activity, AppWindow, ArrowLeftRight, ArrowRight, Check, ChevronDown, Columns2, Compass, Ellipsis, Globe, Keyboard, LayoutGrid, Maximize2, MessageSquareShare, MessageSquareText, PanelBottom, RotateCcw, RotateCw, Rotate3d, Square } from "lucide-react";
import { detect } from "duet-ui/geometry";
import { SCREEN, scene } from "../duo/web-duo";
import { ONLY_OPEN, Phases, Segmented, TOUR, control, fit, group, hardware, rotate, sameView, type State, type Turn } from "./reexports";
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
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState("");
  const width = useSyncExternalStore((f) => { addEventListener("resize", f); return () => removeEventListener("resize", f); }, () => innerWidth, () => 1440);
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

  const safari = s.app === "safari" || s.app === "split" || s.app === "window", preview = s.app === "sheet" || s.app === "preview";
  const split = s.app === "split";

  // What the simulation is showing, in words: the same scene the displays draw, asked for its note.
  const laptop = stand === "elevated";
  const n = SCREEN[s.posture], [W, H] = upright ? [n.h, n.w] : [n.w, n.h];
  const note = scene({ ...fit({ ...s, laptop }), turn: upright }, W, H, "localhost", (x) => duet ? detect(x).mode : "inline").note;

  // The controls, as data: each section is one question about the simulation, rendered three ways by width.
  const sections: Section[] = [
    { key: "device", title: "Device", one: true, opts: POSTURES.map(([to, label, Icon]) => ({ id: to, label, icon: <Icon />, on: now === to, pick: () => posture(to) })) },
    { key: "surface", title: "Surface", one: true, opts: [
      { id: "safari", label: "Safari", icon: <Compass size={18} />, on: safari, pick: () => safari || go({ app: "safari" }) },
      { id: "pwa", label: "PWA", icon: <LayoutGrid size={18} />, on: s.app === "home", pick: () => go({ app: "home" }) },
      { id: "preview", label: "Preview", icon: <MessageSquareText size={18} />, on: preview, pick: () => preview || go({ app: "sheet" }), hint: "A link from Messages, opened in-app" },
    ] },
    { key: "layout", title: "Layout", one: true, opts: preview ? [
      { id: "sheet", label: "Sheet", icon: <PanelBottom size={18} />, on: s.app === "sheet", pick: () => go({ app: "sheet" }) },
      { id: "full", label: "Full screen", icon: <Maximize2 size={18} />, on: s.app === "preview", pick: () => go({ app: "preview" }) },
    ] : s.app === "home" ? [
      { id: "single", label: "Single", icon: <Square size={18} />, on: true, pick: () => {} },
    ] : [
      { id: "single", label: "Single", icon: <Square size={18} />, on: s.app === "safari", pick: () => go({ app: "safari" }) },
      { id: "split", label: split ? "Swap" : "Split", icon: <Columns2 size={18} />, on: split, pick: () => go(split ? { pane: s.pane === "left" ? "right" : "left" } : { app: "split" }), hint: split ? "Swap Split View sides" : "Split View" },
      { id: "window", label: "Window", icon: <AppWindow size={18} />, on: s.app === "window", pick: () => go({ app: "window" }) },
    ] },
    { key: "system", title: "System UI", opts: [
      { id: "shared", label: "iMessage", icon: <MessageSquareShare size={18} />, on: !!s.shared, off: !safari, pick: () => go({ shared: !s.shared }), hint: "Shared with You bar (Safari)" },
      { id: "live", label: "Live Activity", icon: <Activity size={18} />, on: s.live, pick: () => go({ live: !s.live }) },
      { id: "keyboard", label: "Keyboard", icon: <Keyboard size={18} />, on: !!s.keyboard, pick: () => go({ keyboard: !s.keyboard }) },
      { id: "forward", label: "Navigation", icon: <ArrowLeftRight size={18} />, on: !!s.forward, off: !safari, pick: () => go({ forward: !s.forward }), hint: "Forward history (Safari)" },
    ] },
  ];
  const fold = <input type="range" aria-label="Fold" title="Fold" min={0} max={1} step={0.001} value={deg / 180} onChange={(e) => scrub(+e.currentTarget.value)} style={{ flex: 1, minWidth: 90, accentColor: "var(--accent)" }} />;
  const turns = ([[-90, "Rotate left", RotateCcw], [90, "Rotate right", RotateCw]] as const).map(([by, label, Icon]) => (
    <Square42 key={by} label={label} onClick={() => go(rotate(s, by), false, "flat")}><Icon size={18} /></Square42>
  ));
  const where = sections.slice(0, 3).map((x) => x.opts.find((o) => o.on)?.label).join(" · ");

  const wide = width >= 1180, list = width < 700;
  const header = (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: list ? "16px 16px 0" : "22px 26px 0" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: `700 ${list ? 18 : 24}px/1.15 -apple-system, system-ui`, letterSpacing: -0.4 }}>Duo 3D, local</div>
        <div aria-live="polite" style={{ marginTop: 6, maxWidth: 620, font: `400 ${list ? 12 : 13}px/1.45 -apple-system, system-ui`, color: "var(--dim)" }}>
          <b style={{ color: "var(--ink)", fontWeight: 600 }}>{where}{duet ? "" : ", without Duet"}.</b> {duet ? note : "The same site as a plain mobile site: nothing paints in Safari's column."}
        </div>
      </div>
      {!list && <Segmented value={duet ? "on" : "off"} onChange={(v) => setDuet(v === "on")} options={[["off", "Without Duet"], ["on", "With Duet"]]} />}
      {wide && <Pill onClick={front}><Rotate3d size={16} /> Reset view</Pill>}
      <div style={{ position: "relative" }}>
        <Square42 label="More" on={more} onClick={() => setMore((m) => !m)}><Ellipsis size={18} /></Square42>
        {more && (
          <div style={{ position: "absolute", right: 0, top: 48, zIndex: 5, width: list ? "calc(100vw - 32px)" : 420, maxWidth: 420, padding: 14, borderRadius: 18, background: "var(--card)", boxShadow: "0 0 0 0.5px var(--line), 0 18px 50px rgb(0 0 0 / 0.35)", display: "grid", gap: 12, justifyItems: "stretch" }}>
            {/* Before and after: the same site as a plain mobile site, then with Duet. */}
            <form onSubmit={(e) => { e.preventDefault(); setPage(String(new FormData(e.currentTarget).get("url") ?? "").trim()); }} style={{ ...group, alignItems: "center", gap: 6, padding: "0 6px 0 14px" }}>
              <Globe size={16} style={{ color: "var(--dim)", flexShrink: 0 }} />
              <input name="url" type="text" inputMode="url" autoCapitalize="off" spellCheck={false} placeholder="Any URL, or empty for the skeleton" defaultValue={page}
                style={{ flex: 1, minWidth: 0, height: 36, border: 0, background: "transparent", color: "var(--ink)", font: "400 15px -apple-system, system-ui", outline: "none" }} />
              <button type="submit" aria-label="Load in Safari" style={{ ...control, width: 36, height: 36, display: "grid", placeItems: "center", background: "transparent" }}><ArrowRight size={16} /></button>
            </form>
            {list && <Segmented value={duet ? "on" : "off"} onChange={(v) => setDuet(v === "on")} options={[["off", "Without Duet"], ["on", "With Duet"]]} />}
            {!wide && <Pill onClick={front}><Rotate3d size={16} /> Reset view</Pill>}
            <Phases app={s.app} at={at} tour={tour} onPick={(i) => go({ ...TOUR[i], live: s.live }, false, "flat")} onTour={() => setTour((t) => !t)} live={s.live} onLive={() => go({ live: !s.live })} row />
          </div>
        )}
      </div>
    </div>
  );

  // Wide: one row, every choice named under its icon. Compact: icons only, a one-of group titled by its choice.
  const panel = !list && (
    <div style={{ margin: "0 18px 18px", padding: wide ? "14px 18px" : "12px 14px", borderRadius: 20, background: "color-mix(in srgb, var(--card), transparent 25%)", backdropFilter: "blur(20px)", boxShadow: "0 0 0 0.5px var(--line)", display: "flex", flexWrap: "wrap", alignItems: "stretch", columnGap: wide ? 0 : 10, rowGap: 12 }}>
      {sections.map((x, i) => (
        <div key={x.key} role="toolbar" aria-label={x.title} style={{ display: "grid", gap: 8, alignContent: "start", padding: wide ? "0 18px" : "0 6px", borderLeft: wide && i ? "0.5px solid var(--line)" : undefined, ...(wide && !i && { paddingLeft: 0 }) }}>
          <div style={caption}>{wide || !x.one ? x.title : x.opts.find((o) => o.on)?.label}</div>
          <div style={{ display: "flex", gap: wide ? 6 : 4 }}>
            {x.opts.map((o) => wide
              ? <Choice key={o.id} o={o} />
              : <Square42 key={o.id} label={o.hint ?? o.label} on={o.on} off={o.off} onClick={o.pick}>{o.icon}</Square42>)}
          </div>
        </div>
      ))}
      <div style={{ display: "grid", gap: 8, alignContent: "start", padding: wide ? "0 0 0 18px" : "0 6px", borderLeft: wide ? "0.5px solid var(--line)" : undefined, flex: 1, minWidth: 220 }}>
        <div style={caption}>Rotate and fold</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{turns}<span style={{ width: 8 }} />{fold}</div>
      </div>
    </div>
  );

  // Narrow: an accordion, one question open at a time, each row showing what is chosen.
  const accordion = list && (
    <div style={{ display: "grid", gap: 8, padding: "0 16px" }}>
      {sections.map((x) => {
        const cur = x.opts.find((o) => o.on), on = x.opts.filter((o) => o.on).length;
        return (
          <div key={x.key} style={{ borderRadius: 16, background: "var(--card)", boxShadow: "0 0 0 0.5px var(--line)", overflow: "hidden" }}>
            <button onClick={() => setOpen(open === x.key ? "" : x.key)} aria-expanded={open === x.key} style={{ ...row, height: 48, padding: "0 14px" }}>
              <span style={{ display: "grid", placeItems: "center", width: 26, color: "var(--accent)" }}>{x.one ? cur?.icon : x.opts[0].icon}</span>
              <span style={{ flex: 1, textAlign: "left" }}>{x.one ? cur?.label : x.title}</span>
              {!x.one && on > 0 && <span style={{ font: "500 12px -apple-system, system-ui", color: "var(--dim)" }}>{on} on</span>}
              <ChevronDown size={16} style={{ color: "var(--dim)", transform: open === x.key ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
            </button>
            {open === x.key && x.opts.map((o) => (
              <button key={o.id} onClick={o.pick} disabled={o.off} aria-pressed={o.on} style={{ ...row, height: 44, padding: "0 14px", opacity: o.off ? 0.35 : 1, background: o.on ? "color-mix(in srgb, var(--accent), transparent 85%)" : "transparent" }}>
                <span style={{ display: "grid", placeItems: "center", width: 26 }}>{o.icon}</span>
                <span style={{ flex: 1, textAlign: "left" }}>{o.hint && !x.one ? o.hint : o.label}</span>
                {o.on && <Check size={16} style={{ color: "var(--accent)" }} />}
              </button>
            ))}
          </div>
        );
      })}
      <div style={{ borderRadius: 16, background: "var(--card)", boxShadow: "0 0 0 0.5px var(--line)", display: "flex", alignItems: "center", gap: 4, padding: "6px 14px 6px 6px" }}>{turns}<span style={{ width: 8 }} />{fold}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", gap: 12, padding: list ? "12px 0 24px" : 18, boxSizing: "border-box", background: "var(--bg)" }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", borderRadius: list ? 0 : 26, background: "radial-gradient(120% 90% at 50% 35%, color-mix(in srgb, var(--bg), #888 14%), var(--bg))", boxShadow: list ? undefined : "0 0 0 0.5px var(--line)" }}>
        {header}
        {url && <iframe ref={duo} src={url} title="iPhone Duo, 3D" onLoad={send} style={{ width: "100%", height: list ? "44vh" : wide ? "min(62vh, 700px)" : "min(56vh, 640px)", border: 0, display: "block", background: "transparent" }} />}
        {panel}
      </div>
      {accordion}
    </div>
  );
}

interface Opt { id: string; label: string; icon: ReactNode; on: boolean; off?: boolean; pick: () => void; hint?: string }
interface Section { key: string; title: string; one?: boolean; opts: Opt[] }

const caption: CSSProperties = { font: "500 12px -apple-system, system-ui", color: "var(--dim)", whiteSpace: "nowrap" };
const row: CSSProperties = { ...control, width: "100%", borderRadius: 0, display: "flex", alignItems: "center", gap: 10, background: "transparent", font: "500 15px -apple-system, system-ui" };
const lit = (on?: boolean): CSSProperties => on
  ? { background: "color-mix(in srgb, var(--accent), transparent 80%)", boxShadow: "inset 0 0 0 1.5px var(--accent)", color: "var(--ink)" }
  : { background: "color-mix(in srgb, var(--ink), transparent 94%)", color: "var(--ink)" };

/** A choice with its name under it, for the wide row. */
function Choice({ o }: { o: Opt }) {
  return (
    <button onClick={o.pick} disabled={o.off} aria-pressed={o.on} title={o.hint ?? o.label}
      style={{ ...control, height: "auto", width: 66, padding: 0, display: "grid", justifyItems: "center", gap: 5, background: "transparent", opacity: o.off ? 0.35 : 1, cursor: o.off ? "default" : "pointer" }}>
      <span style={{ width: 46, height: 46, borderRadius: 13, display: "grid", placeItems: "center", transition: "background 0.2s, box-shadow 0.2s", ...lit(o.on) }}>{o.icon}</span>
      <span style={{ font: "500 12px -apple-system, system-ui", color: o.on ? "var(--ink)" : "var(--dim)", whiteSpace: "nowrap" }}>{o.label}</span>
    </button>
  );
}

function Square42({ label, on, off, onClick, children }: { label: string; on?: boolean; off?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} disabled={off} aria-label={label} title={label} aria-pressed={on}
      style={{ ...control, width: 42, height: 42, borderRadius: 12, padding: 0, flex: "none", display: "grid", placeItems: "center", opacity: off ? 0.35 : 1, cursor: off ? "default" : "pointer", transition: "background 0.2s, box-shadow 0.2s", ...lit(on) }}>{children}</button>
  );
}

function Pill({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} style={{ ...control, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", whiteSpace: "nowrap", ...lit() }}>{children}</button>;
}
