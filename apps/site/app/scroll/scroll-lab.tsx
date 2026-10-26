"use client";

import { useEffect, useState } from "react";
import { Duet, useDuet } from "duet-ui";
import { BookOpen, Camera, CircleHelp, Search, Share, Sparkles, TrendingUp } from "lucide-react";

const SECTIONS = [
  { id: "check", label: "Check", icon: <Search size={22} /> },
  { id: "highlights", label: "Highlights", icon: <Sparkles size={22} /> },
  { id: "closer", label: "Closer look", icon: <Camera size={22} /> },
  { id: "outlook", label: "Outlook", icon: <TrendingUp size={22} /> },
  { id: "faq", label: "Questions", icon: <CircleHelp size={22} /> },
] as const;
type Id = (typeof SECTIONS)[number]["id"];

const jumpTo = (id: Id) => {
  if (id === "check") scrollTo({ top: 0, behavior: "smooth" });
  else document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export function ScrollLab() {
  const [tab, setTab] = useState<Id>("check");
  const jump = (id: Id) => { setTab(id); jumpTo(id); };
  return (
    <>
      <main style={{ padding: "24px calc(var(--duet-inset-right, 0px) + 16px) 140px calc(var(--duet-inset-left, 0px) + 16px)" }}>
        <Hud />
        <Marker />
        {SECTIONS.map((s, i) => (
          <section key={s.id} id={s.id} style={{ minHeight: 700, paddingTop: 8 }}>
            <h2 style={{ margin: "8px 0 12px", fontSize: 28 }}>{s.label}</h2>
            {i === 0 && <Chips />}
            {Array.from({ length: 6 }, (_, j) => (
              <div key={j} style={{ height: 96, margin: "0 0 12px", borderRadius: 16, background: `hsl(${(i * 70 + j * 12) % 360} 70% 80%)`, display: "flex", alignItems: "center", padding: "0 16px", fontWeight: 600, color: "#000" }}>
                {s.label} {j + 1}
              </div>
            ))}
          </section>
        ))}
      </main>
      <Duet<Id> minimizeOnScroll menuStyle="morph"
        leading={[{ id: "credits", label: "3 credits", icon: <BookOpen size={22} />, badge: 3 }]}
        actions={[{ id: "share", label: "Share", icon: <Share size={22} /> }]}
        tabs={{ items: SECTIONS, selected: tab, onSelect: jump }} />
    </>
  );
}

// A sideways scroller like RegTail's chip rows: a swipe that reaches its end used to pan the whole document.
function Chips() {
  return (
    <div data-testid="chips" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 0 16px", padding: "4px 0" }}>
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} style={{ flex: "none", padding: "10px 16px", borderRadius: 99, background: "var(--card)", border: "1px solid var(--line)" }}>Chip {i + 1}</span>
      ))}
    </div>
  );
}

// Live readout: the document's scroll offsets and the heights Duet reports, to watch drift and URL-bar resizes.
function Hud() {
  const ctx = useDuet();
  const [s, set] = useState({ x: 0, y: 0, h: 0 });
  useEffect(() => {
    const f = () => set({ x: Math.round(scrollX), y: Math.round(scrollY), h: innerHeight });
    f();
    addEventListener("scroll", f, { passive: true }); addEventListener("resize", f);
    return () => { removeEventListener("scroll", f); removeEventListener("resize", f); };
  }, []);
  return (
    <p data-testid="hud" style={{ font: "12px ui-monospace, monospace", margin: "0 0 12px" }}>
      {ctx.mode} x={s.x} y={s.y} ih={s.h} h={ctx.height} vh={ctx.stableHeight}
    </p>
  );
}

// ?marker: a fixed blue square, a still reference to measure the controls against in a screen recording.
// ?auto: smooth in-page jumps (scrollIntoView, then scrollTo top) 3s and 6s after load, hands off the screen.
function Marker() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setOn(q.has("marker"));
    if (!q.has("auto")) return;
    const t = [setTimeout(() => jumpTo("outlook"), 3000), setTimeout(() => jumpTo("check"), 6000)];
    return () => t.forEach(clearTimeout);
  }, []);
  return on ? <div style={{ position: "fixed", top: 300, left: 20, width: 40, height: 40, background: "blue", zIndex: 99 }} /> : null;
}
