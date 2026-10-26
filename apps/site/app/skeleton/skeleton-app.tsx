"use client";

import { useState, type CSSProperties } from "react";
import { Bell, House, Library, Plus, Search, Share } from "lucide-react";
import { Duet, bleed, column, type DuetItem } from "duet-ui";

const TABS = [
  { id: "home", label: "Home", icon: <House size={24} /> },
  { id: "library", label: "Library", icon: <Library size={24} /> },
  { id: "alerts", label: "Alerts", icon: <Bell size={24} /> },
] as const satisfies readonly DuetItem[];

const CSS = `
[data-sk] { background: var(--sk); }
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

export function SkeletonApp() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"] | "search">("home");
  return (
    <Duet
      tabs={{ items: TABS, selected: tab, onSelect: setTab, search: { id: "search", label: "Search", icon: <Search size={24} /> } }}
      actions={[{ id: "share", label: "Share", icon: <Share size={22} />, onPress: () => {} }]}
      primary={{ id: "new", label: "New", icon: <Plus size={22} />, onPress: () => {} }}
      minimizeOnScroll
    >
      <style>{CSS}</style>
      <main style={{ padding: "calc(24px + env(safe-area-inset-top)) 0 120px" }}>
        <div style={{ ...column(720), display: "grid", gap: 10, paddingBottom: 18 }}>
          <Box w="46%" h={34} r={10} />
          <Box w="70%" h={14} r={7} />
        </div>
        {/* A full-width band: it runs under the controls, its content stays beside them. */}
        <div style={{ ...bleed(16), paddingTop: 4, paddingBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, overflow: "hidden" }}>
            {[0, 1, 2, 3].map((i) => <Box key={i} w={220} h={150} r={18} />)}
          </div>
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
    </Duet>
  );
}
