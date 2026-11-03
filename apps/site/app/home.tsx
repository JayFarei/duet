"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BookOpen, Check, ListTree, Moon, PanelBottom, PanelRight, Sun } from "lucide-react";
import { Duet, column, useDuet, type DuetItem } from "duet-ui";
import pkg from "duet-ui/package.json";
import { highlight } from "sugar-high";
import { AGENT_PROMPT } from "./agent-prompt";
import { ClaudeGlyph, CodexGlyph, GrokGlyph, PiGlyph } from "./agent-glyphs";
import { Duo } from "./duo/duo";
import { TINTS, useTheme, useTint } from "./theme";

const REPO = "https://github.com/JayFarei/duet";
/** The app icon drawn as a line icon: the page, and the column beside it with a button. */
function DuetMark() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="3.5" width="11" height="17" rx="3" /><rect x="16" y="3.5" width="5.5" height="17" rx="2.75" />
      <circle cx="18.75" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
const SECTIONS: DuetItem[] = [
  { id: "top", label: "Duet", icon: <DuetMark /> },
  { id: "rules", label: "How it works", icon: <ListTree size={24} /> },
  { id: "docs", label: "Docs", icon: <BookOpen size={24} /> },
];

const quick = (tint?: string) => `import { Duet } from "duet-ui";

<Duet menu={{ items: PLACES, selected: place, onSelect: setPlace, tabs: true }}${tint ? `\n  tint="${tint}"` : ""}>
  <App />
</Duet>`;


// Recorded on the Duo simulator and framed by tools/media/compose.sh.
const ISLANDS: [string, string, string, string][] = [
  ["Home Screen", "Strip", "In the strip iOS gives the app, beside the page.", "strip"],
  ["Safari", "Column", "In the empty part of Safari's column. The page keeps its full width.", "column"],
  ["Everywhere else", "Inline", "A slim strip inside the page, beside the content.", "inline"],
];

/** One page for every screen, navigated by its own Duet controls, with the web Duo playing on a stage. On a Duo too:
 *  the page is a demo there already, and the stage lets the reader try every other posture on the device (#165). */
export type InstallStats = { total: number; daily: number[] };

export function Home({ installs }: { installs: InstallStats | null }) {
  return <Site installs={installs} />;
}

function Site({ installs }: { installs: InstallStats | null }) {
  const [tab, setTab] = useState("top");
  // A portrait iPhone gets an iPhone's bars, with a button to try the Duo's side controls on it.
  const { device, width, height } = useDuet();
  const [sides, setSides] = useState(false);
  const theme = useTheme();
  const { tint } = useTint();
  const go = (id: string) => { setTab(id); requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })); };
  const portrait = device === "iphone" && height > width;
  if (portrait && !sides) return <Bars installs={installs} tab={tab} setTab={setTab} go={go} onSides={() => setSides(true)} theme={theme} />;
  return (
    <Duet
      menu={{ items: SECTIONS, selected: tab, onSelect: go, tabs: true, burger: false }}
      actions={[
        { id: "gh", label: "GitHub", icon: <GitHub />, onPress: () => window.open(REPO, "_blank") },
        { id: "theme", label: theme.dark ? "Light mode" : "Dark mode", icon: theme.dark ? <Sun size={22} /> : <Moon size={22} />, onPress: theme.toggle },
        ...(device === "iphone" ? [{ id: "bars", label: "Top and bottom bars", icon: <PanelBottom size={22} />, onPress: () => setSides(false) }] : []),
      ]}
      appearance={theme.appearance}
      tint={tint}
    >
      {/* On a portrait iPhone the side controls float over the page, which keeps the layout of the bars. */}
      {portrait ? <div className="float"><Page installs={installs} /></div> : <Page installs={installs} />}
    </Duet>
  );
}

/** The page as an iPhone app would show it: actions in a top bar, sections in a tab bar at the bottom. The document
 *  itself scrolls, so the page runs on under Safari's toolbar. */
function Bars({ installs, tab, setTab, go, onSides, theme }: { installs: InstallStats | null; tab: string; setTab: (id: string) => void; go: (id: string) => void; onSides: () => void; theme: ReturnType<typeof useTheme> }) {
  useEffect(() => {
    // Duet leaves its insets on <html> when it steps aside; here nothing floats beside the page.
    const html = document.documentElement;
    for (const k of ["inset-left", "inset-right", "edge-left", "edge-right", "inset-top", "inset-bottom"]) html.style.removeProperty(`--duet-${k}`);
    delete html.dataset.duetMode;
    // The tab follows the section in view.
    const f = () => {
      let at = SECTIONS[0].id;
      for (const s of SECTIONS) if ((document.getElementById(s.id)?.getBoundingClientRect().top ?? 1e9) < innerHeight * 0.4) at = s.id;
      setTab(at);
    };
    f();
    addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, [setTab]);
  return (
    <div className="bars">
      <Page installs={installs} />
      <div className="bar-top">
        <button className="bar-glass bar-try" onClick={onSides}><PanelRight size={18} />Side controls</button>
        <span className="bar-end">
          <button className="bar-glass bar-round" onClick={theme.toggle} aria-label={theme.dark ? "Light mode" : "Dark mode"}>{theme.dark ? <Sun size={20} /> : <Moon size={20} />}</button>
          <a className="bar-glass bar-round" href={REPO} target="_blank" rel="noreferrer" aria-label="GitHub"><GitHub /></a>
        </span>
      </div>
      <nav className="bar-glass bar-tabs" role="tablist">
        {SECTIONS.map((s) => (
          <button key={s.id} role="tab" aria-selected={s.id === tab} data-on={s.id === tab || undefined} className="bar-tab" onClick={() => go(s.id)}>
            {s.icon}<span>{s.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Page({ installs }: { installs: InstallStats | null }) {
  return (
    <main>
      <section id="top" className="hero" style={column(980, 20)}>
        <h1 className="display">
          Native side controls for your web app on the <em>iPhone Duo.</em>
        </h1>
        <p className="lede">You pass the places in your app. Duet measures the free space beside your page and draws the biggest controls that fit. No device checks in your code.</p>
        <div className="actions">
          <div className="ctas">
            <AgentPrompt />
            <Npm />
          </div>
          <Stats installs={installs} />
        </div>
      </section>

      <section className="stage">
        <Duo embed src="/skeleton" />
      </section>

      <Section id="rules" title="How it works" lede="You list your places. Duet does the rest.">
        <Steps />
        <h3 className="h3">Where the controls go</h3>
        <p className="lede lede-l">Duet picks the spot from the device and the browser.</p>
        <div className="tiles">
          {ISLANDS.map(([where, mode, text, clip]) => (
            <div key={mode} className="tile">
              <Clip name={clip} />
              <p className="tile-k">{where}</p>
              <h3 className="tile-h">{mode}</h3>
              <p className="tile-p">{text}</p>
            </div>
          ))}
        </div>
        <h3 className="h3">The controls</h3>
        <p className="lede lede-l">The biggest that fit. What doesn't fit goes in “…”.</p>
        <Controls />
      </Section>

      <Section id="docs" title="Docs" lede="Wrap your app and list your places, most used first.">
        <Integrate />
        <h3 className="h3">Also included</h3>
        <p className="lede lede-l">Beyond the controls.</p>
        <Library />
        <div className="ctas ctas-l">
          <a href={`${REPO}#readme`} className="pill pill-solid">Read the docs</a>
        </div>
      </Section>

      <Footer />
    </main>
  );
}

// What the library ships beyond the controls, each linking to its docs.
const DOC = `${REPO}/blob/main/docs`;
const LIBRARY = [
  { h: "Panes", p: "One pane closed, two side by side unfolded.", href: "/panes" },
  { h: "useDuet", p: "The device, browser and layout, for your own code.", href: `${DOC}/api.md#useduet` },
  { h: "Colors", p: "Your accent color, light and dark.", href: `${DOC}/api.md#theming` },
  { h: "Server rendering", p: "The right controls on first paint, no flash.", href: `${DOC}/server-rendering.md` },
];

function Library() {
  return (
    <div className="tiles lib">
      {LIBRARY.map((x) => (
        <a key={x.h} href={x.href} className="tile lib-item">
          <h3 className="tile-h">{x.h}</h3>
          <p className="tile-p">{x.p}</p>
        </a>
      ))}
    </div>
  );
}

/** How it works: what the app passes, what Duet measures, what it draws. */
function Steps() {
  return (
    <ol className="steps">
      <li className="tile step">
        <span className="step-n">1</span>
        <h3 className="tile-h">You list your places</h3>
        <p className="tile-p">The sections of your app, primary ones first, and any actions such as Share.</p>
        <pre className="step-code"><code>{"items: [Home, Inbox,\n  Calendar, …]"}</code></pre>
      </li>
      <li className="tile step">
        <span className="step-n">2</span>
        <h3 className="tile-h">Duet measures the room</h3>
        <p className="tile-p">The free strip beside your page, from the device, the browser and the window. It changes when you fold, turn or split the screen.</p>
        <div className="step-room" aria-hidden><span>8 taps</span></div>
      </li>
      <li className="tile step">
        <span className="step-n">3</span>
        <h3 className="tile-h">Duet draws the controls</h3>
        <p className="tile-p">The biggest controls that fit: tabs, “…” for the rest, or a menu.</p>
        <div className="step-forms" aria-hidden><span>Tabs</span><span>“…”</span><span>Menu</span></div>
      </li>
    </ol>
  );
}

// Each part of duet-ui, credited by name: a still of it on the stage's 3D Duo (tools/media/duo3d-stills.mjs), a
// button that plays it on the stage (a Moment, or an example page at one), and its docs.
const CONTROLS = [
  { h: "Tabs", p: "Your places in a column, one tap each.", still: "form-tabs", play: "fit", href: `${DOC}/api.md#tabs-or-burger` },
  { h: "“…”", p: "Whatever doesn't fit, in one list.", still: "form-more", play: "folded", href: `${DOC}/api.md#tabs-or-burger` },
  { h: "Menu", p: "One button opens a sidebar with every place.", still: "control-menu", play: "burger", href: `${DOC}/api.md#duet` },
  { h: "Buttons", p: "Your actions, such as Share, as round icons.", still: "form-menu", play: "burger", href: `${DOC}/api.md#the-template` },
  { h: "Main button", p: "One tinted button, such as Book. A tap asks to confirm.", still: "control-main", play: "fold", src: "/book", href: `${DOC}/api.md#call-to-action` },
  { h: "Close", p: "A sheet is open: the controls hold just an X.", still: "control-close", play: "burger", src: "/sheet", href: "/sheet" },
];

function Controls() {
  const show = (c: (typeof CONTROLS)[number]) => {
    dispatchEvent(c.src ? new CustomEvent("duet:example", { detail: { src: c.src, moment: c.play } }) : new CustomEvent("duet:moment", { detail: c.play }));
    document.querySelector(".stage")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return (
    <div className="tiles">
      {CONTROLS.map((c) => (
        <div key={c.still} className="tile rule control">
          <div className="rule-shot"><img src={`/media/${c.still}.webp`} alt={`${c.h} on the Duo`} loading="lazy" /></div>
          <h3 className="tile-h">{c.h}</h3>
          <p className="tile-p">{c.p}</p>
          <div className="rule-row">
            <button className="rule-show" onClick={() => show(c)}>Show on the Duo</button>
            <a className="rule-link" href={c.href}>Docs</a>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The OpenMake footer shared with RegTail and OpenTraces: credit on the left, product wordmark on the right. */
/** The installs line and its faint area, after the OpenTraces hero: relative momentum, so no axes. */
function Sparkline({ values }: { values: number[] }) {
  const W = 240, H = 56, PAD = 6;
  const min = Math.min(...values), span = Math.max(...values) - min || 1;
  const line = values.length < 2 ? `M0 ${H / 2} L${W} ${H / 2}`
    : values.map((v, i) => `${i ? "L" : "M"}${((i * W) / (values.length - 1)).toFixed(1)} ${(H - PAD - ((v - min) / span) * (H - 2 * PAD)).toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="spark-fade" x1="0" y1="0" x2="0" y2="1"><stop className="spark-fade-top" offset="0" /><stop className="spark-fade-end" offset="1" /></linearGradient></defs>
      {values.length > 1 && <path className="spark-area" d={`${line} L${W} ${H} L0 ${H} Z`} />}
      <path className="spark-line" d={line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Version and installs mirrored around the sparkline, the width of the buttons above. */
function Stats({ installs }: { installs: InstallStats | null }) {
  const total = installs && new Intl.NumberFormat("en-US", { notation: installs.total >= 1000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(installs.total);
  return (
    <a className="stats" href="https://www.npmjs.com/package/duet-ui" target="_blank" rel="noreferrer">
      <span className="stat"><span className="stat-label">Version</span><span className="stat-value">{pkg.version}</span></span>
      {installs && <>
        <span className="stat-spark"><Sparkline values={installs.daily} /></span>
        <span className="stat" title="npm downloads, last 30 days"><span className="stat-label">Installs</span><span className="stat-value">{total}</span></span>
      </>}
    </a>
  );
}

function Footer() {
  return (
    <footer className="foot" style={column(980, 20)}>
      <div className="foot-row">
        <p>©2026 Duet · Built by <a href="https://openmake.ai" target="_blank" rel="noreferrer" className="foot-om"><span className="foot-mark" aria-hidden />OpenMake</a></p>
        <span className="foot-brand">Duet</span>
      </div>
      <p>Made by <a href="https://github.com/JayFarei" target="_blank" rel="noreferrer">Gabriele Farei</a> · <a href="https://farei.me/posts" target="_blank" rel="noreferrer">Blog</a></p>
      <p>MIT licensed. Not affiliated with Apple.</p>
    </footer>
  );
}

function GitHub() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.31-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3" />
    </svg>
  );
}

function Section({ id, title, lede, children }: { id: string; title: string; lede: string; children: ReactNode }) {
  return (
    <section id={id} className="section" style={column(980, 20)}>
      <h2 className="h2">{title}</h2>
      <p className="lede lede-l">{lede}</p>
      {children}
    </section>
  );
}

/** The quick start, with a tint picker: the stage and this page's own controls take the colour. */
function Integrate() {
  const { tint, setTint } = useTint();
  const on = tint ?? TINTS[0][1];
  return (
    <>
      <Snippet code={quick(tint)} />
      <div className="tints" role="radiogroup" aria-label="Tint">
        <span className="tints-k">Tint</span>
        {TINTS.map(([name, c]) => (
          <button key={c} role="radio" aria-checked={c === on} aria-label={name} className="tint" style={{ "--c": c } as CSSProperties} onClick={() => setTint(c)} />
        ))}
      </div>
    </>
  );
}

function Snippet({ code }: { code: string }) {
  return <pre className="card code"><code dangerouslySetInnerHTML={{ __html: highlight(code) }} /></pre>;
}

/** The hero's main call to action: copies a prompt that has a coding agent make the reader's app Duo-ready. A tilted
 *  deck of agent glyphs fans out on hover, and the label flips to a check once the prompt is on the clipboard. */
function AgentPrompt() {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  const copy = () => {
    const flip = () => { setCopied(true); clearTimeout(timer.current); timer.current = window.setTimeout(() => setCopied(false), 2000); };
    navigator.clipboard?.writeText(AGENT_PROMPT).then(flip, flip);
  };
  return (
    <button className="pill pill-cta" data-done={copied || undefined} onClick={copy} aria-label="Copy a prompt that makes your app Duo-ready with a coding agent">
      <span className="cta-face">
        <span className="cta-deck" aria-hidden>
          <ClaudeGlyph /><CodexGlyph /><GrokGlyph /><PiGlyph />
        </span>
        Copy prompt
      </span>
      <span className="cta-face cta-done" aria-hidden><Check size={18} strokeWidth={2.6} />Copied</span>
      <span className="sr-only" role="status">{copied ? "Prompt copied to the clipboard" : ""}</span>
    </button>
  );
}

function Npm() {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText("npm i duet-ui").then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); });
  return (
    <button className="pill pill-solid npm" onClick={copy} aria-label="Copy the install command">
      <code>npm i duet-ui</code><span className="npm-hint">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

/** A screen recording of the real device in its frame: silent, looping, poster first. Each clip is composed twice,
 *  on the card colour of each theme (`name` and `name-dark`), so the device sits on the card with no seam. */
function Clip({ name, style }: { name: string; style?: CSSProperties }) {
  const src = useTheme().dark ? `${name}-dark` : name;
  return (
    <video key={src} src={`/media/${src}.mp4`} poster={`/media/${src}.jpg`} autoPlay muted loop playsInline preload="metadata" aria-hidden
      style={{ display: "block", width: "100%", height: "auto", aspectRatio: "4 / 5", objectFit: "contain", background: "var(--card)", borderRadius: 18, ...style }} />
  );
}
