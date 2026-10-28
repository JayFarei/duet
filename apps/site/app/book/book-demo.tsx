"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { CalendarCheck, Check, ChevronRight, Heart, Home, Search, Share, Ticket, User } from "lucide-react";
import { Duet, bleed, type DuetPrimary } from "duet-ui";
import { WebDuo, useDesktop } from "../duo/web-duo";

const CLASSES = [
  { id: "sauna", name: "Sauna and cold plunge", when: "Today, 18:30", credits: 2 },
  { id: "yoga", name: "Vinyasa flow", when: "Today, 19:00", credits: 1 },
  { id: "hiit", name: "HIIT 45", when: "Tomorrow, 07:15", credits: 1 },
  { id: "swim", name: "Lane swim", when: "Tomorrow, 12:00", credits: 1 },
  { id: "spin", name: "Spin, climbs", when: "Thursday, 18:00", credits: 2 },
  { id: "pilates", name: "Reformer pilates", when: "Friday, 08:30", credits: 3 },
];
const TABS = [
  { id: "home", label: "Classes", icon: <Home size={22} /> },
  { id: "search", label: "Search", icon: <Search size={22} /> },
  { id: "bookings", label: "Bookings", icon: <Ticket size={22} /> },
  { id: "me", label: "Profile", icon: <User size={22} /> },
] as const;
type Tab = (typeof TABS)[number]["id"];

const title: CSSProperties = { font: "700 30px/1.1 -apple-system, system-ui", letterSpacing: -0.4, margin: "0 0 8px" };
const dim: CSSProperties = { color: "var(--dim)", font: "400 15px/1.4 -apple-system, system-ui", margin: 0 };
const row: CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "15px 4px", border: 0, borderBottom: "0.5px solid var(--line)", background: "none", color: "var(--ink)", font: "400 17px -apple-system, system-ui", textAlign: "left", cursor: "pointer" };

export function BookDemo() {
  const desktop = useDesktop();
  return desktop ? <WebDuo src="/book" title="Call to action" intro="Open a class: its page puts Book · 2 credits by the thumb and folds the rest into “…”. Book it and the button reshapes." />
    : <div className={desktop === null ? "ssr-site" : undefined}><Book /></div>;
}

// The open class lives in the URL (?c=sauna), so the back gesture and Duet's back button walk the same history.
function Book() {
  const [tab, setTab] = useState<Tab>("home");
  const [open, setOpen] = useState<string | null>(null);
  const [booked, setBooked] = useState<ReadonlySet<string>>(new Set());
  const [liked, setLiked] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const sync = () => setOpen(new URLSearchParams(location.search).get("c"));
    sync();
    addEventListener("popstate", sync);
    return () => removeEventListener("popstate", sync);
  }, []);
  const go = (id: string | null) => {
    history.pushState(null, "", id ? `?c=${id}` : location.pathname);
    setOpen(id);
  };
  const toggle = (set: ReadonlySet<string>, id: string) => { const n = new Set(set); if (!n.delete(id)) n.add(id); return n; };

  const c = CLASSES.find((x) => x.id === open);
  const isBooked = !!c && booked.has(c.id);
  // The call to action is plain props: label, icon and tint change with the page's state.
  const primary: DuetPrimary | undefined = c && (isBooked
    ? { id: "booked", label: "Booked", icon: <Check size={22} />, tint: "#34c759", prominent: true, expanded: true, onPress: () => setBooked(toggle(booked, c.id)) }
    : { id: "book", label: `Book · ${c.credits} credit${c.credits > 1 ? "s" : ""}`, icon: <CalendarCheck size={22} />, prominent: true, onPress: () => setBooked(toggle(booked, c.id)) });

  const page = c ? (
    <main key={c.id} style={{ paddingTop: "calc(24px + env(safe-area-inset-top))", paddingBottom: 140, ...bleed(20) }}>
      <div style={{ height: 180, borderRadius: 20, background: "linear-gradient(135deg, #ff9f0a, #ff375f)", marginBottom: 20 }} />
      <h1 style={title}>{c.name}</h1>
      <p style={{ ...dim, marginBottom: 16 }}>{c.when} · {c.credits} credit{c.credits > 1 ? "s" : ""}</p>
      <p style={dim}>The page passes a prominent primary, so the controls hold one call to action by the thumb. Share and Favourite are folded into “…” even where there is room for them; the tabs join them when the band is tight. {isBooked ? "Booked: tap the green button to cancel." : "Tap the button to book; the label, icon and tint change on a spring."}</p>
    </main>
  ) : (
    <main style={{ paddingTop: "calc(24px + env(safe-area-inset-top))", paddingBottom: 140, ...bleed(20) }}>
      <h1 style={title}>Classes</h1>
      <p style={{ ...dim, marginBottom: 16 }}>Open a class. This page has tabs and no call to action; the class page adds one.</p>
      {CLASSES.map((x) => (
        <button key={x.id} style={row} onClick={() => go(x.id)}>
          <span style={{ flex: 1 }}>{x.name}<br /><span style={{ ...dim, fontSize: 13 }}>{x.when}{booked.has(x.id) ? " · Booked" : ""}</span></span>
          <ChevronRight size={18} color="var(--dim)" />
        </button>
      ))}
    </main>
  );
  return (
    <Duet<Tab>
      tabs={{ items: TABS, selected: tab, onSelect: (t) => { setTab(t); if (c) go(null); } }}
      back={c ? { label: "Classes", onPress: () => history.back() } : undefined}
      primary={primary}
      actions={c ? [
        { id: "share", label: "Share", icon: <Share size={22} />, folded: true },
        { id: "like", label: liked.has(c.id) ? "Unfavourite" : "Favourite", icon: <Heart size={22} fill={liked.has(c.id) ? "currentColor" : "none"} />, folded: true, onPress: () => setLiked(toggle(liked, c.id)) },
      ] : [{ id: "share", label: "Share", icon: <Share size={22} /> }]}>
      {page}
    </Duet>
  );
}
