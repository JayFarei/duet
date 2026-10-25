"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { BookOpen, Code, FlaskConical, LayoutGrid, MonitorSmartphone } from "lucide-react";
import { Duet, bleed, column, useDuet, type DuetItem } from "duet-ui";
import { highlight } from "sugar-high";
import { WebDuo, useDesktop } from "./duo/web-duo";

const REPO = "https://github.com/JayFarei/duet";
const SECTIONS: DuetItem[] = [
  { id: "intro", label: "Duet", icon: <BookOpen size={24} /> },
  { id: "modes", label: "Modes", icon: <MonitorSmartphone size={24} /> },
  { id: "start", label: "Start", icon: <LayoutGrid size={24} /> },
  { id: "lab", label: "Lab", icon: <FlaskConical size={24} /> },
];

const card: CSSProperties = { background: "var(--card)", borderRadius: 22, padding: "18px 20px", margin: "0 0 14px" };
const h2: CSSProperties = { font: "700 28px/1.1 -apple-system, system-ui", letterSpacing: -0.4, margin: "0 0 14px" };
const dim: CSSProperties = { color: "var(--dim)", font: "400 16px/1.45 -apple-system, system-ui", margin: 0 };

const QUICK = `import { Duet } from "duet-ui";

export function App() {
  const [tab, setTab] = useState("home");
  return (
    <Duet
      tabs={{ items: TABS, selected: tab, onSelect: setTab }}
      actions={[{ id: "share", label: "Share", icon: <Share />, onPress: share }]}
    >
      <Page tab={tab} />
    </Duet>
  );
}`;

// Recorded on the Duo simulator and framed by tools/media/compose.sh.
const MODES: [string, string, string][] = [
  ["Strip", "Added to the Home Screen, your app owns the whole display. Controls live in the slim strip beside the page, like a native app.", "strip"],
  ["Column", "In a closed Safari tab, Safari leaves a column empty beside the page. Duet paints its controls there, so the page keeps its full width.", "column"],
  ["Inline", "Unfolded, in split view, or in landscape, Duet reserves an 84pt strip inside the page. Drag it to the side of the hand you hold; it remembers.", "inline-drag"],
];

/** Desktop browsers get the site on a web Duo; phones, and the page inside the web Duo, get the site itself. */
export function Home() {
  const desktop = useDesktop();
  // Before hydration the server can't tell a phone from a desktop: send the phone site, so a phone never sees a
  // blank page, and hide it on desktops (site.css) until the web Duo takes over.
  return desktop ? <WebDuo src="/" /> : <div className={desktop === null ? "ssr-site" : undefined}><Site /></div>;
}

function Site() {
  const [tab, setTab] = useState("intro");
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<"island" | "morph">("island");
  // ?menu=morph opens the site on the morph style (used by the clip recordings).
  useEffect(() => { if (new URLSearchParams(location.search).get("menu") === "morph") setMenuStyle("morph"); }, []);
  const ctx = useDuet();
  const show = (v: boolean) => { setOpen(v); scrollTo(0, 0); };
  const go = (id: string) => { setTab(id); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); };

  return (
    <Duet
      tabs={{ items: SECTIONS, selected: tab, onSelect: go }}
      actions={[{ id: "gh", label: "GitHub", icon: <Code size={22} />, onPress: () => window.open(REPO, "_blank") }]}
      close={open && { onPress: () => show(false) }}
      menuStyle={menuStyle}
      minimizeOnScroll
    >
      {open ? <Sheet /> : <main style={{ padding: "calc(28px + env(safe-area-inset-top)) 0 140px", ...column(680) }}>
        <section id="intro" style={{ textAlign: "center", padding: "24px 0 36px" }}>
          <img src="/icon-512.png" alt="" width={112} height={112} style={{ borderRadius: 26 }} />
          <h1 style={{ font: "800 48px/1 -apple-system, system-ui", letterSpacing: -1.2, margin: "18px 0 10px" }}>Duet</h1>
          <p style={{ ...dim, fontSize: 19, maxWidth: 440, margin: "0 auto" }}>
            Native-feeling controls for React web apps on the foldable iPhone. Your page and its control strip, playing together.
          </p>
          <p style={{ ...dim, fontSize: 13, marginTop: 14 }}>You are in <b style={{ color: "var(--ink)" }}>{ctx.mode}</b> mode{ctx.preview ? " (in-app preview)" : ""}, controls on the {ctx.side}.</p>
          <pre style={{ display: "inline-block", background: "var(--card)", borderRadius: 14, padding: "10px 16px", margin: "18px 0 0", fontSize: 15 }}><span style={{ color: "var(--sh-entity)" }}>npm</span> i duet-ui</pre>
        </section>

        <section id="modes" style={{ paddingTop: 12 }}>
          <h2 style={h2}>Three modes, picked for you</h2>
          {MODES.map(([name, text, clip]) => (
            <div key={name} style={card}>
              <Clip name={clip} style={{ margin: "4px auto 16px" }} />
              <div style={{ font: "600 19px -apple-system, system-ui", marginBottom: 4 }}>{name}</div><p style={dim}>{text}</p>
            </div>
          ))}
        </section>

        <section id="start" style={{ paddingTop: 24 }}>
          <h2 style={h2}>Start</h2>
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <pre style={{ margin: 0, padding: "18px 20px", fontSize: 13, lineHeight: 1.5, overflowX: "auto" }}><code dangerouslySetInnerHTML={{ __html: highlight(QUICK) }} /></pre>
          </div>
          <p style={dim}>Content that should run edge to edge, like a hero band or a sticky title, uses <code>bleed()</code>: its background goes under the strip, its text stays beside it. A reading column uses <code>column()</code>: it centres on the whole screen, like a native app, and moves aside only as far as the strip needs.</p>
        </section>

        <section id="lab" style={{ paddingTop: 28 }}>
          <h2 style={h2}>Try it</h2>
          <button onClick={() => show(true)} style={{ ...card, display: "block", width: "100%", textAlign: "left", border: 0, cursor: "pointer" }}>
            <div style={{ font: "600 17px -apple-system, system-ui", color: "var(--ink)" }}>Open a card</div>
            <p style={dim}>Pass <code>close</code> and the strip steps aside for a single close button, like an iOS sheet.</p>
          </button>
          <div style={card}>
            <div style={{ font: "600 17px -apple-system, system-ui", marginBottom: 4 }}>Menus</div>
            <p style={dim}>Scroll down until the tab bar shrinks to one button, then tap it. <b style={{ color: "var(--ink)" }}>Island</b> stretches the button into a pill of icons, like the Dynamic Island. <b style={{ color: "var(--ink)" }}>Morph</b> grows it into a labelled list, like a context menu.</p>
            <div role="radiogroup" aria-label="Menu style" style={{ display: "flex", gap: 4, padding: 3, marginTop: 14, borderRadius: 12, background: "var(--line)" }}>
              {(["island", "morph"] as const).map((m) => (
                <button key={m} role="radio" aria-checked={menuStyle === m} onClick={() => setMenuStyle(m)}
                  style={{ flex: 1, height: 34, border: 0, borderRadius: 9, cursor: "pointer", font: "600 15px -apple-system, system-ui", color: "var(--ink)", background: menuStyle === m ? "var(--card)" : "transparent", boxShadow: menuStyle === m ? "0 1px 3px rgb(0 0 0 / 0.15)" : "none" }}>
                  {m === "island" ? "Island" : "Morph"}
                </button>
              ))}
            </div>
            <pre style={{ margin: "12px 0 0", fontSize: 13 }}><code dangerouslySetInnerHTML={{ __html: highlight(`<Duet menuStyle="${menuStyle}" … />`) }} /></pre>
          </div>
          <a href="/panes" style={{ ...card, display: "block" }}>
            <div style={{ font: "600 17px -apple-system, system-ui", color: "var(--ink)" }}>Panes</div>
            <p style={dim}>A path of screens that follows the fold: one pane closed, two side by side unfolded. Going deeper slides the pair along, and a draft survives folding.</p>
          </a>
          <a href="/lab?tabs=4,searchTab=1,back=1,actions=2,title=1,feed=1" style={{ ...card, display: "block" }}>
            <div style={{ font: "600 17px -apple-system, system-ui", color: "var(--ink)" }}>Lab</div>
            <p style={dim}>Every control combination, set from the URL. Open it on the phone, or add it to the Home Screen.</p>
          </a>
          <a href="/mockup" style={{ ...card, display: "block" }}>
            <div style={{ font: "600 17px -apple-system, system-ui", color: "var(--ink)" }}>Split view mockup</div>
            <p style={dim}>The open device with two apps side by side, Duet running in the Safari pane.</p>
          </a>
          <a href={REPO} style={{ ...card, display: "block" }}>
            <div style={{ font: "600 17px -apple-system, system-ui", color: "var(--ink)" }}>Source and docs</div>
            <p style={dim}>README, API, examples and the simulator tools.</p>
          </a>
        </section>
      </main>}
      <footer style={{ borderTop: "0.5px solid var(--line)", padding: "18px 0 40px", textAlign: "center", ...dim, fontSize: 13, ...bleed(20) }}>
        MIT licensed. Not affiliated with Apple.
      </footer>
    </Duet>
  );
}

/** The card the demo opens: while it is up, the strip holds only the close button. */
function Sheet() {
  const row: CSSProperties = { display: "flex", justifyContent: "space-between", padding: "13px 0", borderBottom: "0.5px solid var(--line)", font: "400 17px -apple-system, system-ui" };
  return (
    <main style={{ padding: "calc(28px + env(safe-area-inset-top)) 0 140px", ...column(560) }}>
      <div style={{ textAlign: "center", padding: "12px 0 24px" }}>
        <div style={{ width: 84, height: 84, borderRadius: 99, margin: "0 auto 12px", background: "linear-gradient(135deg, #64d2ff, #0a84ff)" }} />
        <h2 style={{ ...h2, margin: "0 0 4px" }}>A card</h2>
        <p style={dim}>Every other control stepped aside. Tap the X to go back.</p>
      </div>
      <div style={{ ...card, padding: "4px 20px" }}>
        {[["Mode", "the strip stays put"], ["Close", "where back goes"], ["Prop", "close={{ onPress }}"]].map(([k, v]) => (
          <div key={k} style={row}><span>{k}</span><span style={{ color: "var(--dim)" }}>{v}</span></div>
        ))}
      </div>
    </main>
  );
}

/** A screen recording of the real device in its frame: silent, looping, poster first. Each clip is composed twice,
 *  on the card colour of each theme (`name` and `name-dark`), so the device sits on the card with no seam. */
function Clip({ name, style }: { name: string; style?: CSSProperties }) {
  const src = useDark() ? `${name}-dark` : name;
  return (
    <video key={src} src={`/media/${src}.mp4`} poster={`/media/${src}.jpg`} autoPlay muted loop playsInline preload="metadata" aria-hidden
      style={{ display: "block", width: "100%", height: "auto", maxHeight: 520, objectFit: "contain", background: "var(--card)", ...style }} />
  );
}

/** Dark mode as site.css applies it: the system setting, unless data-lg-theme forces one. */
function useDark() {
  const get = () => {
    const forced = document.documentElement.getAttribute("data-lg-theme");
    return forced ? forced === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  };
  return useSyncExternalStore((cb) => {
    const mq = matchMedia("(prefers-color-scheme: dark)"), mo = new MutationObserver(cb);
    mq.addEventListener("change", cb);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-lg-theme"] });
    return () => { mq.removeEventListener("change", cb); mo.disconnect(); };
  }, get, () => false);
}
