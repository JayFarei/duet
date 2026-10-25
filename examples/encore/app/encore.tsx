"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownToLine, Check, ChevronRight, Disc3, FastForward, Heart, House, LayoutGrid, Library, ListMusic,
  MicVocal, Music, Pause, Play, Plus, Radio, Search, Share, Shuffle, User, UserRound,
} from "lucide-react";
import { Duet, bleed, type DuetItem } from "duet-ui";
import { ALBUMS, GENRES, MIXES, NEW, STATIONS, album, time, track, type Album, type Track } from "./data";
import { Art, tone } from "./art";
import * as audio from "./tone";

const ACCENT = "var(--accent)";
type Tab = "home" | "new" | "radio" | "library" | "search";

export function Encore() {
  const [tab, setTab] = useState<Tab>("home");
  const [open, setOpen] = useState<string | null>(null); // album detail
  const [now, setNow] = useState(ALBUMS[0].tracks[2].id);
  const [playing, setPlaying] = useState(false);
  const [seenNew, setSeenNew] = useState(false);
  const [saved, setSaved] = useState<Record<string, "added" | "loved" | "down" | undefined>>({});

  // Each view starts at its top, like a native navigation push or tab switch.
  useEffect(() => { document.querySelector(".duet-scroller")?.scrollTo(0, 0); }, [tab, open]);
  useEffect(() => () => audio.stop(), []);

  const start = (id: string) => { setNow(id); setPlaying(true); audio.play(track(id).n + album(track(id).albumId).hues[0]); };
  const toggle = () => { if (playing) audio.stop(); else audio.play(track(now).n + album(track(now).albumId).hues[0]); setPlaying(!playing); };
  const skip = () => {
    const t = track(now), list = album(t.albumId).tracks;
    start(list[(t.n) % list.length].id);
  };
  const select = (id: string) => { setTab(id as Tab); setOpen(null); if (id === "new") setSeenNew(true); };

  const tabs: DuetItem[] = [
    { id: "home", label: "Home", icon: <House size={24} />, tint: ACCENT },
    { id: "new", label: "New", icon: <LayoutGrid size={24} />, tint: ACCENT, badge: seenNew ? undefined : NEW.length },
    { id: "radio", label: "Radio", icon: <Radio size={24} />, tint: ACCENT },
    { id: "library", label: "Library", icon: <Library size={24} />, tint: ACCENT },
  ];
  const a = open ? album(open) : null;
  const mark = (k: "added" | "loved" | "down") => a && setSaved((s) => ({ ...s, [`${a.id}:${k}`]: s[`${a.id}:${k}`] ? undefined : k }));
  const has = (k: string) => !!a && !!saved[`${a.id}:${k}`];
  const actions: DuetItem[] = a ? [
    { id: "add", label: has("added") ? "In Library" : "Add to Library", icon: has("added") ? <Check size={22} /> : <Plus size={22} />, onPress: () => mark("added") },
    { id: "love", label: "Favourite", icon: <Heart size={21} fill={has("loved") ? "currentColor" : "none"} />, onPress: () => mark("loved") },
    { id: "down", label: "Download", icon: <ArrowDownToLine size={22} />, onPress: () => mark("down") },
    { id: "share", label: "Share", icon: <Share size={21} />, onPress: () => navigator.share?.({ title: a.title, text: `${a.title} by ${a.artist}` }).catch(() => {}) },
  ] : [{ id: "account", label: "Account", icon: <UserRound size={22} /> }];

  const t = track(now), ta = album(t.albumId);
  const nav = { open: (id: string) => setOpen(id), play: start, now, playing };

  return (
    <Duet
      back={!!a && { label: "Back", onPress: () => setOpen(null) }}
      actions={actions}
      tabs={{ items: tabs, selected: tab, onSelect: select, search: { id: "search", label: "Search", icon: <Search size={24} />, tint: ACCENT } }}
      minimizeOnScroll
      accessory={
        <div className="mp-wrap">
          <button className="mp" aria-label={`Now playing: ${t.title}`} onClick={() => setOpen(ta.id)}>
            <Art hues={ta.hues} style={ta.style} size={30} radius={6} />
            <span className="mp-text"><span className="mp-title">{t.title}</span><span className="mp-sub">{ta.artist}</span></span>
          </button>
          <button className="mp-btn" aria-label={playing ? "Pause" : "Play"} onClick={toggle}>
            {playing ? <Pause size={22} fill="currentColor" strokeWidth={0} /> : <Play size={22} fill="currentColor" strokeWidth={0} />}
          </button>
          <button className="mp-btn" aria-label="Next" onClick={skip}><FastForward size={24} fill="currentColor" strokeWidth={0} /></button>
        </div>
      }
    >
      {a ? <AlbumView a={a} {...nav} />
        : tab === "home" ? <Home {...nav} />
        : tab === "new" ? <New {...nav} />
        : tab === "radio" ? <RadioView {...nav} />
        : tab === "library" ? <LibraryView {...nav} />
        : <SearchView {...nav} />}
    </Duet>
  );
}

interface Nav { open: (id: string) => void; play: (id: string) => void; now: string; playing: boolean }

// --- pieces -------------------------------------------------------------------------------------

const Heading = ({ children, more = true }: { children: ReactNode; more?: boolean }) => (
  <h2 className="h2">{children}{more && <ChevronRight size={20} strokeWidth={2.5} />}</h2>
);

function Carousel({ children }: { children: ReactNode }) {
  // Sits inside .page (20px padding), so it also cancels that padding to reach the edges.
  const b = bleed(20);
  const style = { ...b, marginLeft: `calc(-20px + ${b.marginLeft})`, marginRight: `calc(-20px + ${b.marginRight})`, scrollPaddingLeft: b.paddingLeft, scrollPaddingRight: b.paddingRight };
  return <div className="carousel" style={style}>{children}</div>;
}

const AlbumCard = ({ a, open }: { a: Album; open: (id: string) => void }) => (
  <button className="card" onClick={() => open(a.id)}>
    <Art hues={a.hues} style={a.style} label={`${a.title} cover`} />
    <div className="card-title">{a.title}</div>
    <div className="card-sub">{a.artist}</div>
  </button>
);

const Eq = ({ paused }: { paused: boolean }) => <span className="eq" data-paused={paused || undefined}><i /><i /><i /></span>;

function Row({ t, nav, numbered }: { t: Track; nav: Nav; numbered?: boolean }) {
  const a = album(t.albumId), on = nav.now === t.id;
  return (
    <li>
      <button className="row" data-on={on || undefined} onClick={() => nav.play(t.id)}>
        {numbered
          ? <span className="num">{on ? <Eq paused={!nav.playing} /> : t.n}</span>
          : <span style={{ position: "relative" }}><Art hues={a.hues} style={a.style} size={46} radius={6} />
            {on && <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgb(0 0 0 / 0.3)", borderRadius: 6 }}><Eq paused={!nav.playing} /></span>}</span>}
        <span className="row-text">
          <span className="row-title">{t.title}</span>
          <span className="row-sub">{numbered ? time(t.seconds) : `${a.artist} · ${a.title}`}</span>
        </span>
      </button>
    </li>
  );
}

// --- views --------------------------------------------------------------------------------------

function Home(nav: Nav) {
  const f = album("paper-lanterns");
  const [h1, h2] = f.hues;
  const top = useMemo(() => ALBUMS.slice(3, 9).map((a) => a.tracks[0]), []);
  return (
    <>
      <section className="feature" style={{ ...bleed(20), background: `linear-gradient(155deg, ${tone(h1, 50, 66)}, ${tone(h2, 42, 48)})` }}>
        <h1 className="title" style={{ marginBottom: 20 }}>Home</h1>
        <div className="feature-body">
          <Art hues={f.hues} style={f.style} className="feature-art" radius={10} label={`${f.title} cover`} />
          <div className="feature-text">
            <div className="eyebrow">New Album</div>
            <h2>{f.title}</h2>
            <p>{f.artist} returns with eight warm, unhurried songs about small harbours and long evenings.</p>
            <button className="pill pill-light" onClick={() => nav.play(f.tracks[0].id)}><Play size={16} fill="currentColor" strokeWidth={0} />Play</button>
            <button className="pill" style={{ color: "#fff", background: "rgb(255 255 255 / 0.2)", marginLeft: 10 }} onClick={() => nav.open(f.id)}>View Album</button>
          </div>
        </div>
      </section>
      <div className="page">
        <Heading>Recently Played</Heading>
        <Carousel>{ALBUMS.slice(1, 9).map((a) => <AlbumCard key={a.id} a={a} open={nav.open} />)}</Carousel>
        <Heading>Made for You</Heading>
        <Carousel>
          {MIXES.map((m) => (
            <button key={m.id} className="card" onClick={() => nav.play(ALBUMS[(m.hues[0] / 30) % ALBUMS.length | 0].tracks[0].id)}>
              <div style={{ position: "relative" }}>
                <Art hues={m.hues} style={m.style} />
                <span style={{ position: "absolute", left: 10, bottom: 8, color: "#fff", font: "700 17px -apple-system, system-ui", textShadow: "0 1px 6px rgb(0 0 0 / 0.25)" }}>{m.title}</span>
              </div>
              <div className="card-sub" style={{ marginTop: 6 }}>{m.sub}</div>
            </button>
          ))}
        </Carousel>
        <Heading>Top Songs</Heading>
        <ul className="list cols">{top.map((t) => <Row key={t.id} t={t} nav={nav} />)}</ul>
      </div>
    </>
  );
}

function New(nav: Nav) {
  return (
    <div className="page top">
      <h1 className="title">New</h1>
      <div className="grid">{NEW.map((a) => <AlbumCard key={a.id} a={a} open={nav.open} />)}</div>
      <Heading>Latest Songs</Heading>
      <ul className="list cols">{NEW.map((a) => <Row key={a.id} t={a.tracks[1]} nav={nav} />)}</ul>
    </div>
  );
}

function RadioView(nav: Nav) {
  const [hero, ...rest] = STATIONS;
  return (
    <div className="page top">
      <h1 className="title">Radio</h1>
      <button className="station-hero" onClick={() => nav.play(album(hero.seed).tracks[0].id)}>
        <Art hues={hero.hues} style={hero.style} cover />
        <div><span className="live">LIVE</span><div style={{ font: "700 24px -apple-system, system-ui" }}>{hero.title}</div><div style={{ opacity: 0.85 }}>{hero.sub}</div></div>
      </button>
      <Heading>Stations</Heading>
      <div className="grid">
        {rest.map((s) => (
          <button key={s.id} className="card" onClick={() => nav.play(album(s.seed).tracks[1].id)}>
            <Art hues={s.hues} style={s.style} />
            <div className="card-title">{s.title}</div><div className="card-sub">{s.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function LibraryView(nav: Nav) {
  const rows: [string, ReactNode][] = [["Playlists", <ListMusic key="p" />], ["Artists", <MicVocal key="a" />], ["Albums", <Disc3 key="al" />], ["Songs", <Music key="s" />], ["Made for You", <User key="m" />]];
  return (
    <div className="page top">
      <h1 className="title">Library</h1>
      {rows.map(([name, icon]) => <button key={name} className="nav-row">{icon}<span>{name}</span><ChevronRight size={18} /></button>)}
      <Heading more={false}>Recently Added</Heading>
      <div className="grid">{[...ALBUMS].reverse().slice(0, 6).map((a) => <AlbumCard key={a.id} a={a} open={nav.open} />)}</div>
    </div>
  );
}

function SearchView(nav: Nav) {
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  const hits = s ? ALBUMS.flatMap((a) => a.tracks.filter((t) => `${t.title} ${a.title} ${a.artist} ${a.genre}`.toLowerCase().includes(s))).slice(0, 30) : [];
  return (
    <>
      <div className="search-bar" style={bleed(20)}>
        <h1 className="title" style={{ margin: "14px 0 12px" }}>Search</h1>
        <label className="field"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Artists, Songs, Albums" enterKeyHint="search" /></label>
      </div>
      <div className="page">
        {s ? (
          hits.length ? <ul className="list" style={{ marginTop: 8 }}>{hits.map((t) => <Row key={t.id} t={t} nav={nav} />)}</ul>
            : <p className="dim" style={{ textAlign: "center", marginTop: 60 }}>No results for “{q}”</p>
        ) : <>
          <Heading more={false}>Browse Categories</Heading>
          <div className="grid">
            {GENRES.map(([g, h]) => (
              <button key={g} className="genre" style={{ background: `linear-gradient(140deg, ${tone(h, 50, 64)}, ${tone(h + 25, 42, 46)})` }} onClick={() => setQ(g)}>{g}</button>
            ))}
          </div>
        </>}
      </div>
    </>
  );
}

function AlbumView({ a, ...nav }: Nav & { a: Album }) {
  const mins = Math.round(a.tracks.reduce((n, t) => n + t.seconds, 0) / 60);
  return (
    <>
      <header className="album-head" style={{ ...bleed(20), background: `linear-gradient(${tone(a.hues[0], 50, 70)}33, transparent)` }}>
        <Art hues={a.hues} style={a.style} className="album-art" radius={10} label={`${a.title} cover`} />
        <h1>{a.title}</h1>
        <div className="album-artist">{a.artist}</div>
        <div className="album-meta">{a.genre} · {a.year}</div>
        <div className="album-btns">
          <button className="pill" onClick={() => nav.play(a.tracks[0].id)}><Play size={17} fill="currentColor" strokeWidth={0} />Play</button>
          <button className="pill" onClick={() => nav.play(a.tracks[(a.tracks.length * 0.6) | 0].id)}><Shuffle size={17} strokeWidth={2.4} />Shuffle</button>
        </div>
      </header>
      <div className="page">
        <ul className="list">{a.tracks.map((t) => <Row key={t.id} t={t} nav={nav} numbered />)}</ul>
        <p className="foot">{a.tracks.length} songs, {mins} minutes</p>
        <Heading>You Might Also Like</Heading>
        <Carousel>{ALBUMS.filter((x) => x.id !== a.id && x.genre !== a.genre).slice(0, 6).map((x) => <AlbumCard key={x.id} a={x} open={nav.open} />)}</Carousel>
      </div>
    </>
  );
}
