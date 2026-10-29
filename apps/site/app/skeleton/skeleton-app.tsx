"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Bell, House, Library, Plus, Search, Share } from "lucide-react";
import { Duet, bleed, column, readSignals, watchSignals, type DuetMenuItem } from "duet-ui";
import { useTheme, useTint } from "../theme";

const TABS = [
  { id: "home", label: "Home", icon: <House size={24} /> },
  { id: "library", label: "Library", icon: <Library size={24} /> },
  { id: "alerts", label: "Alerts", icon: <Bell size={24} /> },
] as const satisfies readonly DuetMenuItem[];

const CSS = `
[data-sk] { background: var(--sk); }
[data-sk-row]::-webkit-scrollbar { display: none; }
/* Duet off and on (the 3D Duo's before and after): each control's icon glides between the plain site's bars and Duet's. */
.duet [aria-label="Home"] > svg, .sk-plain [aria-label="Home"] > svg { view-transition-name: sk-home; }
.duet [aria-label="Library"] > svg, .sk-plain [aria-label="Library"] > svg { view-transition-name: sk-library; }
.duet [aria-label="Alerts"] > svg, .sk-plain [aria-label="Alerts"] > svg { view-transition-name: sk-alerts; }
.duet [aria-label="Search"] > svg, .sk-plain [aria-label="Search"] > svg { view-transition-name: sk-search; }
.duet [aria-label="Share"] > svg, .sk-plain [aria-label="Share"] > svg { view-transition-name: sk-share; }
.duet [aria-label="New"] > svg, .sk-plain [aria-label="New"] > svg { view-transition-name: sk-new; }
::view-transition-group(*) { animation-duration: 520ms; animation-timing-function: cubic-bezier(0.32, 0.72, 0, 1); }
:root { --sk: rgb(60 60 67 / 0.13); }
@media (prefers-color-scheme: dark) { :root:not([data-lg-theme="light"]) { --sk: rgb(235 235 245 / 0.12); } }
:root[data-lg-theme="dark"] { --sk: rgb(235 235 245 / 0.12); }
`;

/** A ghost box: where a piece of content would be. */
function Box({ w = "100%", h, r = 12, style }: { w?: number | string; h: number; r?: number; style?: CSSProperties }) {
  return <div data-sk="" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />;
}

function Row() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0" }}>
      <Box w={48} h={48} r={24} />
      <div style={{ flex: 1, display: "grid", gap: 8 }}><Box w="62%" h={14} r={7} /><Box w="38%" h={12} r={6} /></div>
    </div>
  );
}

/** The page itself, the same with Duet or without. */
function Content({ top }: { top: string }) {
  return (
    <main style={{ padding: `${top} 0 120px` }}>
      <div style={{ ...column(720), display: "grid", gap: 10, paddingBottom: 18 }}>
        <Box w="46%" h={34} r={10} />
        <Box w="70%" h={14} r={7} />
      </div>
      {/* A full-width carousel: it clips at the window edge, so its cards run on under the controls, and starts
          beside them. */}
      <div data-sk-row="" style={{ ...bleed(16), display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", paddingTop: 4, paddingBottom: 20 }}>
        {[0, 1, 2, 3].map((i) => <Box key={i} w={220} h={150} r={18} />)}
      </div>
      <div style={{ ...column(720) }}>
        <div style={{ display: "flex", gap: 8, paddingBottom: 10 }}>
          {[72, 90, 64, 80].map((w, i) => <Box key={i} w={w} h={30} r={15} />)}
        </div>
        {[0, 1, 2, 3].map((i) => <Row key={i} />)}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, paddingTop: 16 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => <Box key={i} h={120} r={16} />)}
        </div>
        {[0, 1, 2, 3].map((i) => <Row key={`b${i}`} />)}
      </div>
    </main>
  );
}

// The same site without Duet, as a typical mobile site lays out: a top bar with its actions, a tab bar at the
// bottom, everything inside the safe area, so nothing runs on under the system's strip.
const bar: CSSProperties = { position: "fixed", zIndex: 10, display: "flex", alignItems: "center", background: "color-mix(in srgb, var(--bg) 85%, transparent)", WebkitBackdropFilter: "blur(20px)", backdropFilter: "blur(20px)" };
const icon: CSSProperties = { width: 40, height: 40, display: "grid", placeItems: "center", border: 0, background: "transparent", color: "var(--ink)", padding: 0 };

function Plain({ tab, onTab, inset }: { tab: string; onTab: (t: (typeof TABS)[number]["id"] | "search") => void; inset: { l: number; r: number } }) {
  const all: { id: (typeof TABS)[number]["id"] | "search"; label: string; icon: ReactNode }[] = [...TABS, { id: "search", label: "Search", icon: <Search size={24} /> }];
  return (
    <div className="sk-plain" style={{ paddingLeft: inset.l, paddingRight: inset.r }}>
      <header style={{ ...bar, top: 0, left: inset.l, right: inset.r, height: 56, padding: "0 8px 0 20px", gap: 4, boxShadow: "0 0.5px 0 var(--line)" }}>
        <Box w={96} h={20} r={6} style={{ marginRight: "auto" }} />
        <button aria-label="Share" style={icon}><Share size={22} /></button>
        <button aria-label="New" style={icon}><Plus size={22} /></button>
      </header>
      <Content top="80px" />
      <nav style={{ ...bar, bottom: 0, left: inset.l, right: inset.r, height: 64, justifyContent: "space-around", boxShadow: "0 -0.5px 0 var(--line)" }}>
        {all.map((t) => (
          <button key={t.id} aria-label={t.label} onClick={() => onTab(t.id)} style={{ ...icon, width: 64, height: 52, gap: 2, color: t.id === tab ? "var(--cta)" : "var(--dim)", font: "500 10px -apple-system, system-ui" }}>
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export function SkeletonApp() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"] | "search">("home");
  const { appearance } = useTheme();
  const { tint } = useTint();
  // A host on this origin (the 3D Duo) turns Duet off and on; the controls morph between the two layouts.
  const [duet, setDuet] = useState(true);
  const now = useRef(true);
  const [inset, setInset] = useState({ l: 0, r: 0 });
  useEffect(() => {
    const read = () => { const x = readSignals(); setInset({ l: x.insetLeft, r: x.insetRight }); };
    read();
    const unwatch = watchSignals(read);
    const on = (e: MessageEvent) => {
      if (e.source !== parent || e.origin !== location.origin) return;
      if (e.data?.type === "skeleton:duet") {
        const to = !!e.data.on, swap = () => flushSync(() => setDuet(to));
        if (to === now.current) return;
        now.current = to;
        // A swap that comes while one plays skips it; the layout still lands.
        if (document.startViewTransition) document.startViewTransition(swap).ready.catch(() => {}); else swap();
      }
    };
    addEventListener("message", on);
    if (parent !== window) parent.postMessage({ type: "skeleton:ready" }, location.origin); // the host answers with Duet on or off
    return () => { unwatch(); removeEventListener("message", on); };
  }, []);
  if (!duet) return <><style>{CSS}</style><Plain tab={tab} onTab={setTab} inset={inset} /></>;
  return (
    <Duet
      menu={{ items: [...TABS, { id: "search", label: "Search", icon: <Search size={24} /> }], selected: tab, onSelect: setTab }}
      actions={[{ id: "share", label: "Share", icon: <Share size={22} />, onPress: () => {} }]}
      appearance={appearance}
      tint={tint}
    >
      <style>{CSS}</style>
      <Content top="calc(24px + env(safe-area-inset-top))" />
    </Duet>
  );
}
