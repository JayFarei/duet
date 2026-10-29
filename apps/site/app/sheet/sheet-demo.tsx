"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ChevronRight, Home, Search, Settings, Share, X } from "lucide-react";
import { Duet, bleed } from "duet-ui";
import { WebDuo, useDesktop } from "../duo/web-duo";

const ROWS = ["Weekend in Lisbon", "Hinge stress test", "Fold diary", "Column notes", "Split view sketches", "Release checklist", "Lunch on Thursday", "Trip photos"];
const TABS = [
  { id: "home", label: "Home", icon: <Home size={22} /> },
  { id: "search", label: "Search", icon: <Search size={22} /> },
  { id: "settings", label: "Settings", icon: <Settings size={22} /> },
] as const;
type Tab = (typeof TABS)[number]["id"];

const title: CSSProperties = { font: "700 30px/1.1 -apple-system, system-ui", letterSpacing: -0.4, margin: "0 0 8px" };
const dim: CSSProperties = { color: "var(--dim)", font: "400 15px/1.4 -apple-system, system-ui", margin: 0 };
const row: CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "15px 4px", border: 0, borderBottom: "0.5px solid var(--line)", background: "none", color: "var(--ink)", font: "400 17px -apple-system, system-ui", textAlign: "left", cursor: "pointer" };

export function SheetDemo() {
  const desktop = useDesktop();
  return desktop ? <WebDuo src="/sheet" title="Sheets" intro="A sheet over a full-screen scrim. In Safari's column on the closed Duo its close button moves into the column." />
    : <div className={desktop === null ? "ssr-site" : undefined}><Sheets /></div>;
}

// ?open opens the first sheet on load, for captures. ?doc mounts <Duet> without children, so the document scrolls
// (RegTail's shape).
function Sheets() {
  const [tab, setTab] = useState<Tab>("home");
  const [open, setOpen] = useState<string | null>(null);
  const [doc, setDoc] = useState(false);
  const [probe, setProbe] = useState<CSSProperties>({});
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setDoc(q.has("doc")); // eslint-disable-line react-hooks/set-state-in-effect
    if (process.env.NODE_ENV !== "production") setProbe(scrimProbe(q));
    if (q.has("open")) setOpen(ROWS[0]);
  }, []);
  // Escape closes, like the column X and the sheet's own.
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [open]);

  const page = (
    <main style={{ paddingTop: "calc(24px + env(safe-area-inset-top))", paddingBottom: 140, ...bleed(20) }}>
      <h1 style={title}>Sheets</h1>
      <p style={{ ...dim, marginBottom: 16 }}>Open a row. The sheet sits on a full-screen scrim (position: fixed, inset: 0). While Duet shows its close button (in Safari&apos;s column, or beside the page unfolded) the sheet&apos;s own X steps aside.</p>
      {ROWS.map((r) => (
        <button key={r} style={row} onClick={() => setOpen(r)}><span style={{ flex: 1 }}>{r}</span><ChevronRight size={18} color="var(--dim)" /></button>
      ))}
    </main>
  );
  const sheet = open && (
    <div className="sheet-scrim" style={probe} onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={open}>
        <header className="sheet-head">
          <h2 style={{ font: "600 20px -apple-system, system-ui", margin: 0, flex: 1 }}>{open}</h2>
          <button className="sheet-x" aria-label="Close" onClick={() => setOpen(null)}><X size={20} /></button>
        </header>
        <p style={dim}>This sheet&apos;s scrim covers the whole page. Close it with the X in Safari&apos;s column, a tap on the scrim, or Escape.</p>
        <button style={{ ...row, borderTop: "0.5px solid var(--line)", marginTop: 16 }}><Share size={20} /><span style={{ flex: 1 }}>Share</span></button>
      </div>
    </div>
  );
  const duet = {
    menu: { items: TABS, selected: tab, onSelect: setTab },
    actions: [{ id: "share", label: "Share", icon: <Share size={22} /> }],
    // The recipe: while the sheet is open, the controls hold only its close button.
    close: open ? { label: "Close", onPress: () => setOpen(null) } : undefined,
  };
  return doc
    ? <>{page}{sheet}<Duet<Tab> {...duet} /></>
    : <Duet<Tab> {...duet}>{page}{sheet}</Duet>;
}

// Dev only: reshape the scrim from the query to find what hides the column layer (#79). ?pos=absolute, ?w=90 and
// ?h=40 (percent of the viewport), ?bg=transparent, ?blur=0, ?z=60, ?right=1 (px off the right edge).
function scrimProbe(q: URLSearchParams): CSSProperties {
  const s: CSSProperties = {};
  if (q.get("pos")) s.position = q.get("pos") as CSSProperties["position"];
  if (q.get("w")) { s.right = "auto"; s.width = `${q.get("w")}%`; }
  if (q.get("h")) { s.top = "auto"; s.height = `${q.get("h")}%`; }
  if (q.get("right")) s.right = `${q.get("right")}px`;
  if (q.get("bg")) s.background = q.get("bg")!;
  if (q.get("blur") === "0") { s.backdropFilter = "none"; s.WebkitBackdropFilter = "none"; }
  if (q.get("z")) s.zIndex = Number(q.get("z"));
  return s;
}
