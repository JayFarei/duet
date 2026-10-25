"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ALargeSmall, Bookmark, Library, Newspaper, Search, Share } from "lucide-react";
import { Duet, bleed, type DuetItem } from "duet-ui";
import { ARTICLES, find, minutes, type Article } from "./articles";
import { Art } from "./art";

type Tab = "today" | "library" | "saved" | "search";
const tint = "var(--accent)"; // resolves per theme inside the pill
const TABS: DuetItem[] = [
  { id: "today", label: "Today", icon: <Newspaper size={24} />, tint },
  { id: "library", label: "Library", icon: <Library size={24} />, tint },
  { id: "saved", label: "Saved", icon: <Bookmark size={24} />, tint },
];
const SEARCH: DuetItem = { id: "search", label: "Search", icon: <Search size={24} />, tint };
const SIZES = [{ px: 17, name: "Small" }, { px: 19, name: "Medium" }, { px: 22, name: "Large" }];
const SAVED_KEY = "almanac-saved";

const scroller = () => document.querySelector<HTMLElement>(".duet-scroller");

export function Almanac() {
  const [tab, setTab] = useState<Tab>("today");
  const [open, setOpen] = useState<string | null>(null);
  const [size, setSize] = useState(1);
  const [saved, setSaved] = useState<string[]>(["moss"]);
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const listY = useRef(0); // list scroll position to come back to
  const article = find(open);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- browser-only state, read after hydration */
    try { const s = localStorage.getItem(SAVED_KEY); if (s) setSaved(JSON.parse(s)); } catch {}
    const h = location.hash.slice(1); // a shared link opens its story
    if (find(h)) setOpen(h);
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 1600); return () => clearTimeout(t); }, [toast]);
  const say = (text: string) => setToast((t) => ({ text, n: (t?.n ?? 0) + 1 }));

  // Each view starts at its top; going back returns the list to where it was.
  const restore = useRef<number | null>(null);
  useLayoutEffect(() => { const el = scroller(); if (el) el.scrollTop = restore.current ?? 0; restore.current = null; }, [open, tab]);

  const read = (slug: string) => { listY.current = scroller()?.scrollTop ?? 0; setOpen(slug); };
  const back = () => { restore.current = listY.current; setOpen(null); };
  const select = (id: string) => { setOpen(null); setTab(id as Tab); };
  const toggleSave = (slug: string) => {
    const on = !saved.includes(slug), next = on ? [...saved, slug] : saved.filter((s) => s !== slug);
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
    say(on ? "Saved for later" : "Removed from Saved");
  };
  const share = async (a: Article) => {
    const url = `${location.origin}/#${a.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: a.title, text: a.dek, url });
      else { await navigator.clipboard.writeText(url); say("Link copied"); }
    } catch {}
  };

  const isSaved = !!article && saved.includes(article.slug);
  const actions: DuetItem[] = article ? [
    { id: "size", label: "Text size", icon: <ALargeSmall size={23} />, onPress: () => { const n = (size + 1) % SIZES.length; setSize(n); say(`Text size: ${SIZES[n].name}`); } },
    { id: "save", label: isSaved ? "Remove bookmark" : "Bookmark", onPress: () => toggleSave(article.slug),
      icon: <Bookmark size={22} style={isSaved ? { color: "var(--accent)", fill: "currentColor" } : undefined} /> },
    { id: "share", label: "Share", icon: <Share size={21} />, onPress: () => share(article) },
  ] : [];

  return (
    <Duet
      back={!!article && { label: "Back", onPress: back }}
      actions={actions}
      tabs={{ items: TABS, selected: tab, onSelect: select, search: SEARCH }}
      menuStyle="morph"
      minimizeOnScroll
    >
      {article ? <Story a={article} size={SIZES[size].px} /> : (
        <div className="page">
          {tab === "today" && <Today read={read} />}
          {tab === "library" && <LibraryView read={read} />}
          {tab === "saved" && <Saved list={ARTICLES.filter((a) => saved.includes(a.slug))} read={read} />}
          {tab === "search" && <SearchView read={read} />}
        </div>
      )}
      {toast && <div className="toast-wrap" key={toast.n}><div className="toast" role="status">{toast.text}</div></div>}
    </Duet>
  );
}

// --- tab pages ----------------------------------------------------------------------------------

type Read = { read: (slug: string) => void };

function Row({ a, read, kicker = true }: { a: Article; kicker?: boolean } & Read) {
  return (
    <button className="tap row" onClick={() => read(a.slug)}>
      <div className="thumb"><Art kind={a.slug} hue={a.hue} /></div>
      <div>
        {kicker && <p className="kicker">{a.section}</p>}
        <h3>{a.title}</h3>
        <div className="meta">{a.author} · {minutes(a)} min read</div>
      </div>
    </button>
  );
}

function Today({ read }: Read) {
  const [lead, ...rest] = ARTICLES;
  return (
    <>
      <p className="eyebrow">Saturday, October 24</p>
      <h1 className="large">Today</h1>
      <button className="tap feature" onClick={() => read(lead.slug)}>
        <div className="thumb"><Art kind={lead.slug} hue={lead.hue} /></div>
        <p className="kicker">{lead.section}</p>
        <h2>{lead.title}</h2>
        <p className="dek">{lead.dek}</p>
        <div className="meta">{lead.author} · {minutes(lead)} min read</div>
      </button>
      <h2 className="group">More to read</h2>
      {rest.map((a) => <Row key={a.slug} a={a} read={read} />)}
    </>
  );
}

function LibraryView({ read }: Read) {
  const sections = [...new Set(ARTICLES.map((a) => a.section))];
  return (
    <>
      <h1 className="large">Library</h1>
      {sections.map((s) => (
        <section key={s}>
          <h2 className="group">{s}</h2>
          {ARTICLES.filter((a) => a.section === s).map((a) => <Row key={a.slug} a={a} read={read} kicker={false} />)}
        </section>
      ))}
    </>
  );
}

function Saved({ list, read }: { list: Article[] } & Read) {
  return (
    <>
      <h1 className="large">Saved</h1>
      {list.length ? list.map((a) => <Row key={a.slug} a={a} read={read} />) : (
        <div className="empty"><Bookmark size={34} /><b>Nothing saved yet</b>Tap the bookmark beside a story to keep it here for later.</div>
      )}
    </>
  );
}

function SearchView({ read }: Read) {
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = ARTICLES.filter((a) => {
    const hay = [a.title, a.dek, a.section, a.author, ...a.body].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  return (
    <>
      <h1 className="large">Search</h1>
      <label className="search"><Search size={18} /><input type="search" placeholder="Stories, topics, authors" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" /></label>
      {!words.length && (
        <div className="chips">{["Sea", "Maps", "Bread", "Books", "Gardens"].map((c) => <button key={c} className="chip" onClick={() => setQ(c)}>{c}</button>)}</div>
      )}
      {words.length > 0 && (hits.length ? hits.map((a) => <Row key={a.slug} a={a} read={read} />)
        : <div className="empty"><b>No results</b>Nothing in the Almanac mentions “{q}”.</div>)}
    </>
  );
}

// --- article ------------------------------------------------------------------------------------

/** Hero band under the strip, then the text column. The compact title bar fades in once the headline has
 *  scrolled away; it is a bleed() band, so its glass runs under the controls while its title stays beside them. */
function Story({ a, size }: { a: Article; size: number }) {
  const head = useRef<HTMLHeadingElement>(null);
  const [bar, setBar] = useState({ on: false, p: 0 });
  useEffect(() => {
    const el = scroller();
    if (!el) return;
    let raf = 0;
    const f = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const on = (head.current?.getBoundingClientRect().bottom ?? 1) < 60;
        const p = Math.min(1, el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight));
        setBar((b) => (b.on === on && Math.abs(b.p - p) < 0.002 ? b : { on, p }));
      });
    };
    f();
    el.addEventListener("scroll", f, { passive: true });
    return () => { el.removeEventListener("scroll", f); cancelAnimationFrame(raf); };
  }, [a.slug]);

  let first = true;
  return (
    <article className="story" style={{ "--size": `${size}px` } as CSSProperties}>
      <div className="bar" data-on={bar.on || undefined} aria-hidden={!bar.on} style={{ ...bleed(16), "--p": bar.p } as CSSProperties}>
        <span>{a.title}</span><i />
      </div>
      <div className="hero" style={bleed(false)}><Art kind={a.slug} hue={a.hue} /></div>
      <div className="read">
        <p className="kicker">{a.section}</p>
        <h1 ref={head}>{a.title}</h1>
        <p className="dek">{a.dek}</p>
        <div className="byline">By <b>{a.author}</b> · {a.date} · {minutes(a)} min read</div>
        {a.body.map((t, i) => {
          if (t.startsWith("## ")) return <h2 key={i}>{t.slice(3)}</h2>;
          if (t.startsWith("> ")) return <blockquote key={i}>{t.slice(2)}</blockquote>;
          const cls = first ? "first" : undefined;
          first = false;
          return <p key={i} className={cls}>{t}</p>;
        })}
        <div className="end" aria-hidden>◆ ◆ ◆</div>
      </div>
    </article>
  );
}
