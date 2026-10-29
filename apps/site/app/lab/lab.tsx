"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Bell, Bookmark, Pencil, Plus, Share, Trash2 } from "lucide-react";
import { Duet, bleed, useDuet, type DuetItem, type DuetMenuItem } from "duet-ui";
import { Feed } from "./feed";
import { ChatIcon, CodeIcon, HomeIcon, MenuIcon, ProfileIcon, SearchIcon } from "./dev-icons";

// A developer app's places: solid mono glyphs; only the selected one takes the one accent colour.
const PLACES: DuetMenuItem[] = [
  { id: "0", label: "Home", icon: <HomeIcon /> },
  { id: "1", label: "Chat", icon: <ChatIcon />, badge: 3 },
  { id: "2", label: "Code", icon: <CodeIcon /> },
  { id: "3", label: "Profile", icon: <ProfileIcon /> },
  { id: "4", label: "Menu", icon: <MenuIcon /> },
];
// Glass test backgrounds, same as the native lab's Backdrop: 1 vertical gradient, 2 saturated 24px bands,
// 3 black with thin white lines.
const BACKDROPS = ["", "linear-gradient(#7f00ff, #e100ff, #ff4e50)",
  "repeating-linear-gradient(#ff3b30 0 24px, #ffcc00 24px 48px, #34c759 48px 72px, #007aff 72px 96px)",
  "repeating-linear-gradient(#000 0 16px, #fff 16px 18px)"];
const ICONS = [Bell, Share, Bookmark, Trash2, Pencil];
const NAMES = ["Alerts", "Share", "Save", "Delete", "Edit"];

// Query keys. menu=N places (tabs=N is the 0.5 name, still read), searchTab=1 adds a Search place, back=1 opens a
// detail with a Back action first, leading=N more actions before them, actions=N, primary=1, close=1 (a sheet).
// Keys of removed props (accessory, minimize, search, morph) are ignored, so old capture URLs still load.
type S = Record<"menu" | "back" | "actions" | "primary" | "close" | "title" | "leading" | "searchTab" | "list" | "dark" | "feed" | "bg", number>;
function parse(q: string): S {
  const s = { menu: 0, back: 0, actions: 0, primary: 0, close: 0, title: 0, leading: 0, searchTab: 0, list: 0, dark: 0, feed: 0, bg: 0 };
  for (const kv of q.replace(/^\?/, "").split(/[,&]/)) {
    const [k0, v] = kv.split("="), k = k0 === "tabs" ? "menu" : k0;
    if (k in s) s[k as keyof S] = Number(v) || 0;
  }
  return s;
}

export function Lab() {
  const [q, setQ] = useState<string | null>(null);
  const [tab, setTab] = useState("0");
  const [depth, setDepth] = useState(0);
  const [tapped, setTapped] = useState(""); // proof that taps reach the handlers
  const ctx = useDuet();
  const [sig, setSig] = useState("");
  useEffect(() => { setSig(`${innerWidth}x${innerHeight} / ${outerWidth}x${outerHeight} vv${visualViewport?.height}`); }, [ctx]); // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    // URL query wins; otherwise (Home Screen app, fixed start URL) follow the harness relay.
    if (location.search.length > 1) return setQ(location.search);
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/lab-scenario", { cache: "no-store" });
        const { scenario } = await r.json();
        if (alive) setQ((old) => (old === scenario ? old : scenario));
      } catch {}
      if (alive) setTimeout(poll, 700);
    };
    poll();
    return () => { alive = false; };
  }, []);

  const s = parse(q ?? "");
  useEffect(() => { setDepth(s.back); setTab("0"); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  // dark=1 forces dark, dark=-1 light, absent follows the system (via GlassyUI's data-lg-theme).
  const theme = `:root{--bg:rgb(237 240 245);--ink:#000;--line:#c6c6c8}
@media (prefers-color-scheme: dark){:root:not([data-lg-theme="light"]){--bg:#000;--ink:#fff;--line:#333}}
:root[data-lg-theme="dark"]{--bg:#000;--ink:#fff;--line:#333}
html,body{margin:0;background:var(--bg)}
`;
  const action = (i: number, prefix = "a"): DuetItem => {
    const I = ICONS[i % 5];
    return { id: `${prefix}${i}`, label: NAMES[i % 5], icon: <I size={22} />, badge: i % 5 === 0 ? 12 : undefined, onPress: () => setTapped(NAMES[i % 5]) };
  };
  const name = depth ? "Detail" : s.menu ? PLACES[Number(tab)]?.label ?? "Search" : "Root";
  const places = [...PLACES.slice(0, s.menu), ...(s.searchTab ? [{ id: "99", label: "Search", icon: <SearchIcon /> }] : [])];
  const [sheet, setSheet] = useState(false);
  useEffect(() => { setSheet(s.close > 0); }, [s.close]);

  return (
    <div style={{ background: "var(--bg)", color: "var(--ink)", fontFamily: "-apple-system, system-ui" }}>
      <style>{theme}</style>
      <Duet
        dark={s.dark ? s.dark > 0 : undefined}
        menu={places.length ? { items: places, selected: tab, onSelect: (id) => { setTab(id); setTapped(`place ${id}`); } } : undefined}
        actions={[
          ...(depth > 0 ? [{ id: "back", label: "Back", icon: <ArrowLeft size={22} />, onPress: () => { setDepth(0); setTapped("Back"); } }] : []),
          ...Array.from({ length: s.leading }, (_, i) => action(i + 2, "l")),
          ...Array.from({ length: s.actions }, (_, i) => action(i)),
        ]}
        primary={s.primary ? { id: "new", label: "New", icon: <Plus size={22} />, onPress: () => setTapped("New") } : undefined}
        close={sheet ? { label: "Close", onPress: () => { setSheet(false); setTapped("Close"); } } : undefined}
      >
        {s.title > 0 && <div style={{ position: "sticky", top: 0, zIndex: 1, padding: "calc(12px + var(--duet-inset-top, 0px)) 20px 12px", ...bleed(20), background: "var(--bg)", font: "600 17px -apple-system" }}>
          {name} <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.5 }}>{ctx.mode} {sig}</span>{tapped && <span id="tapped" style={{ fontWeight: 400, opacity: 0.6 }}> · tapped {tapped}</span>}
        </div>}
        {s.bg > 0 && <div style={{ position: "fixed", inset: 0, zIndex: -1, background: BACKDROPS[s.bg] }} />}
        {s.feed > 0 && <Feed />}
        {s.list > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: "8px 0 120px" }}>
            {Array.from({ length: 40 }, (_, i) => (
              <li key={i} style={{ padding: "11px 0", ...bleed(20), borderBottom: "0.5px solid var(--line)", fontSize: 17 }}>Row {i}</li>
            ))}
          </ul>
        )}
      </Duet>
    </div>
  );
}
