// Duet, added to any page the 3D Duo's Safari loads through /duo3d/web. No children: in Safari's column Duet
// places the page beside the controls itself, so a site built without Duet needs nothing of its own. The host's
// "Without Duet" takes it away again (the same skeleton:duet message the skeleton page answers), so the two show
// the site as it is and as it would be with Duet.
//
// "With Duet" is the site optimised for it: the page's header links and buttons go to /duo3d/optimize, where a
// decision model says which Duet control each would be (a tab, the primary button, an action, search), and the
// strip is built from them, pressing the original element, which is hidden while Duet shows. Until the answer
// comes, or where it finds nothing, the strip is Safari's own: Back, Forward, Reload and Share.
import { useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight, Bell, Book, Box, Briefcase, Building, Calendar, CircleHelp, Code, Compass, Download, FileText, Globe,
  GraduationCap, Heart, House, Image, Layers, LayoutGrid, LogIn, Mail, MapPin, MessageCircle, Newspaper, Phone, Play,
  Rocket, RotateCw, Search, Settings, Share, ShoppingCart, Star, Tag, User, Users,
} from "lucide-react";
import { Duet, type DuetItem, type DuetProps } from "duet-ui";
import type { Candidate, Icon, Optimized } from "./spec";

// Duet's own pages keep text and buttons clear of the controls by the insets (column(), bleed()); a page built
// without Duet knows nothing of them, so it is held beside the controls whole. In Safari's column real Safari does
// that itself; the 3D Duo's emulated frame spans the column, so it is done here in every mode. What moved into
// Duet leaves the page.
const BESIDE = `html[data-duet-mode] { margin-right: var(--duet-inset-right, 0px) !important; margin-left: var(--duet-inset-left, 0px) !important; }
html[data-duet-mode] [data-duo3d-moved] { display: none !important; }`;

const ICON: Record<Icon, (size: number) => ReactNode> = {
  home: (s) => <House size={s} />, tag: (s) => <Tag size={s} />, box: (s) => <Box size={s} />, layers: (s) => <Layers size={s} />,
  book: (s) => <Book size={s} />, code: (s) => <Code size={s} />, newspaper: (s) => <Newspaper size={s} />, users: (s) => <Users size={s} />,
  building: (s) => <Building size={s} />, briefcase: (s) => <Briefcase size={s} />, "message-circle": (s) => <MessageCircle size={s} />,
  "help-circle": (s) => <CircleHelp size={s} />, search: (s) => <Search size={s} />, "shopping-cart": (s) => <ShoppingCart size={s} />,
  user: (s) => <User size={s} />, "log-in": (s) => <LogIn size={s} />, rocket: (s) => <Rocket size={s} />, calendar: (s) => <Calendar size={s} />,
  play: (s) => <Play size={s} />, download: (s) => <Download size={s} />, "graduation-cap": (s) => <GraduationCap size={s} />,
  compass: (s) => <Compass size={s} />, grid: (s) => <LayoutGrid size={s} />, "map-pin": (s) => <MapPin size={s} />, globe: (s) => <Globe size={s} />,
  star: (s) => <Star size={s} />, heart: (s) => <Heart size={s} />, mail: (s) => <Mail size={s} />, phone: (s) => <Phone size={s} />,
  "file-text": (s) => <FileText size={s} />, image: (s) => <Image size={s} />, bell: (s) => <Bell size={s} />, settings: (s) => <Settings size={s} />,
};

const here = () => (window as unknown as { __duo3dUrl: string }).__duo3dUrl;

// The page's own scheme, from its background: a light site on a dark system keeps light glass, not white glyphs.
function scheme(): "light" | "dark" {
  for (const el of [document.body, document.documentElement]) {
    const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
    if (m && (m[3] === undefined || +m[3] > 0.5)) return 0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2] > 128 ? "light" : "dark";
  }
  return "light";
}

// The header's links and buttons, hidden ones included: on a phone-width page the site's nav is often folded into
// its own menu, and those are the sections an app would have as tabs. One per label and destination.
const MAX = 40;
function candidates(): { list: Candidate[]; els: Map<number, HTMLElement> } {
  const sel = "a[href], button, [role=button]";
  const scoped = [...document.querySelectorAll<HTMLElement>(`header :is(${sel}), nav :is(${sel}), [role=banner] :is(${sel}), [role=navigation] :is(${sel})`)];
  const top = [...document.querySelectorAll<HTMLElement>(sel)].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.top + scrollY < 140; });
  const seen = new Set<string>(), list: Candidate[] = [], els = new Map<number, HTMLElement>();
  for (const el of [...new Set([...top, ...scoped])]) {
    if (list.length >= MAX || el.closest("footer, [role=contentinfo], #duo3d-duet")) continue;
    const text = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 32) continue;
    const a = el.closest("a[href]") as HTMLAnchorElement | null;
    const href = a ? new URL(a.getAttribute("href")!, document.baseURI).href : undefined;
    if (href && !/^https?:/.test(href)) continue;
    const k = text.toLowerCase() + "\n" + (href ?? "");
    if (seen.has(k)) continue;
    seen.add(k);
    const id = list.length;
    list.push({ id, text, tag: el.tagName.toLowerCase(), href: href && href.replace(/^https?:\/\/(www\.)?/, ""), region: el.closest("nav, [role=navigation]") ? "nav" : el.closest("header, [role=banner]") ? "header" : "top" });
    els.set(id, el);
  }
  return { list, els };
}

const SURE = 0.7;
function build(found: Optimized, list: Candidate[], els: Map<number, HTMLElement>): Partial<DuetProps> | null {
  const press = (el: HTMLElement) => () => el.click();
  const pick = (role: string) => list.filter((c) => found[c.id]?.role === role && found[c.id].p >= SURE);
  const label = new Set<string>();
  const once = (c: Candidate) => { const k = c.text.toLowerCase(); if (label.has(k)) return false; label.add(k); return true; };
  const item = (c: Candidate, size: number): DuetItem => ({ id: `c${c.id}`, label: c.text, icon: ICON[found[c.id].icon]?.(size) ?? ICON.compass(size), onPress: press(els.get(c.id)!) });

  const root = new URL(here()).origin + "/";
  let tabs = pick("tab").filter(once).slice(0, 5);
  const primary = pick("primary").sort((a, b) => found[b.id].p - found[a.id].p)[0];
  if (primary) label.add(primary.text.toLowerCase());
  let actions = pick("action").filter(once).slice(0, 4);
  if (tabs.length < 2) { actions = [...tabs, ...actions]; tabs = []; }
  const search = pick("search")[0];
  if (!tabs.length && !primary && !actions.length && !search) return null;

  for (const c of [...tabs, ...actions, ...(primary ? [primary] : []), ...(search ? [search] : [])]) els.get(c.id)!.setAttribute("data-duo3d-moved", "");
  const props: Partial<DuetProps> = {
    actions: actions.map((c) => item(c, 22)),
    primary: primary && item(primary, 22),
    searchButton: search && press(els.get(search.id)!),
  };
  if (tabs.length) {
    // A Home tab where no section is the site's root, as an app's first tab; the selected tab is the section this
    // page is in.
    const path = (c: Candidate) => c.href ? new URL("https://" + c.href).pathname : "";
    const items: DuetItem[] = tabs.map((c) => item(c, 22));
    if (!tabs.some((c) => path(c) === "/")) items.unshift({ id: "home", label: "Home", icon: ICON.home(22), onPress: () => { location.href = location.origin + "/duo3d/web?url=" + encodeURIComponent(root); } });
    const at = new URL(here()).pathname;
    const best = tabs.filter((c) => c.href && path(c) !== "/" && at.startsWith(path(c))).sort((a, b) => path(b).length - path(a).length)[0];
    const selected = best ? `c${best.id}` : at === "/" ? (items[0].id) : "";
    const tabItems = items.slice(0, 5);
    props.tabs = { items: tabItems, selected, onSelect: (id) => tabItems.find((t) => t.id === id)?.onPress?.() };
  }
  return props;
}

const SAFARI: Partial<DuetProps> = {
  actions: [
    { id: "forward", label: "Forward", icon: <ArrowRight size={22} />, onPress: () => history.forward() },
    { id: "reload", label: "Reload", icon: <RotateCw size={20} />, onPress: () => location.reload() },
    { id: "share", label: "Share", icon: <Share size={22} />, onPress: () => navigator.clipboard?.writeText(here()) },
  ],
};

function Shell() {
  const [on, setOn] = useState(true);
  const [appearance] = useState(scheme);
  const [optimized, setOptimized] = useState<Partial<DuetProps> | null>(null);
  useEffect(() => {
    const msg = (e: MessageEvent) => { if (e.source === parent && e.data?.type === "skeleton:duet") setOn(!!e.data.on); };
    addEventListener("message", msg);
    if (parent !== window) parent.postMessage({ type: "skeleton:ready" }, "*");
    return () => removeEventListener("message", msg);
  }, []);
  useEffect(() => {
    // A beat for the site's own scripts to draw their header.
    const t = setTimeout(async () => {
      const { list, els } = candidates();
      if (!list.length) return;
      try {
        const res = await fetch(location.origin + "/duo3d/optimize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: here(), title: document.title, candidates: list }) });
        if (res.ok) setOptimized(build(await res.json(), list, els));
        else console.warn("duo3d optimize:", await res.text());
      } catch (e) { console.warn("duo3d optimize:", e); }
    }, 500);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  return (
    <>
    <style>{BESIDE}</style>
    <Duet appearance={appearance} back={{ onPress: () => history.back() }} {...(optimized ?? SAFARI)} />
    </>
  );
}

const mount = () => { const el = document.createElement("div"); el.id = "duo3d-duet"; document.body.appendChild(el); createRoot(el).render(<Shell />); };
if (document.body) mount(); else addEventListener("DOMContentLoaded", mount);
