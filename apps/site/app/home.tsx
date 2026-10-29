"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, CodeXml, Moon, PanelBottom, PanelRight, Sun, TabletSmartphone } from "lucide-react";
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
  { id: "code", label: "Integrate", icon: <CodeXml size={24} /> },
  { id: "examples", label: "Examples", icon: <TabletSmartphone size={24} /> },
];

const quick = (tint?: string) => `import { Duet } from "duet-ui";

<Duet menu={{ items: PLACES, selected: place, onSelect: setPlace }}${tint ? `\n  tint="${tint}"` : ""}>
  <App />
</Duet>`;


// Recorded on the Duo simulator and framed by tools/media/compose.sh.
const ISLANDS: [string, string, string, string][] = [
  ["Home Screen", "Strip", "In the strip iOS gives the app, beside the page.", "strip"],
  ["Safari", "Column", "In the empty part of Safari's column. The page keeps its full width.", "column"],
  ["Everywhere else", "Inline", "A slim strip in the page, on the side the reader drags it to.", "inline-drag"],
];

/** One page for every screen, navigated by its own Duet controls, with the web Duo playing on a stage. On a Duo too:
 *  the page is a demo there already, and the stage lets the reader try every other posture on the device (#165). */
export function Home() {
  return <Site />;
}

function Site() {
  const [tab, setTab] = useState("top");
  // A portrait iPhone gets an iPhone's bars, with a button to try the Duo's side controls on it.
  const { device, width, height } = useDuet();
  const [sides, setSides] = useState(false);
  const theme = useTheme();
  const { tint } = useTint();
  const go = (id: string) => { setTab(id); requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })); };
  const portrait = device === "iphone" && height > width;
  if (portrait && !sides) return <Bars tab={tab} setTab={setTab} go={go} onSides={() => setSides(true)} theme={theme} />;
  return (
    <Duet
      menu={{ items: SECTIONS, selected: tab, onSelect: go, burger: false }}
      actions={[
        { id: "gh", label: "GitHub", icon: <GitHub />, onPress: () => window.open(REPO, "_blank") },
        { id: "theme", label: theme.dark ? "Light mode" : "Dark mode", icon: theme.dark ? <Sun size={22} /> : <Moon size={22} />, onPress: theme.toggle },
        ...(device === "iphone" ? [{ id: "bars", label: "Top and bottom bars", icon: <PanelBottom size={22} />, onPress: () => setSides(false) }] : []),
      ]}
      appearance={theme.appearance}
      tint={tint}
    >
      {/* On a portrait iPhone the side controls float over the page, which keeps the layout of the bars. */}
      {portrait ? <div className="float"><Page /></div> : <Page />}
    </Duet>
  );
}

/** The page as an iPhone app would show it: actions in a top bar, sections in a tab bar at the bottom. The document
 *  itself scrolls, so the page runs on under Safari's toolbar. */
function Bars({ tab, setTab, go, onSides, theme }: { tab: string; setTab: (id: string) => void; go: (id: string) => void; onSides: () => void; theme: ReturnType<typeof useTheme> }) {
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
      <Page />
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

function Page() {
  return (
    <main>
      <section id="top" className="hero" style={column(980, 20)}>
        <p className="eyebrow">duet-ui {pkg.version}</p>
        <h1 className="display">
          Native-feeling controls for web apps on the <em>iPhone Duo.</em>
        </h1>
        <p className="lede">A React library that approximates the Duo&apos;s native side controls.</p>
        <div className="ctas">
          <AgentPrompt />
          <Npm />
        </div>
      </section>

      <section className="stage">
        <Duo embed src="/skeleton" />
      </section>

      <Section id="code" title="Integrate" lede="Wrap your app and pass your places. useDuet() also reports the device, the browser and whether the page runs from the Home Screen.">
        <Integrate />
        <div className="ctas" style={{ justifyContent: "flex-start" }}>
          <a href={`${REPO}#readme`} className="pill pill-solid">Read the docs</a>
          <a href="/panes" className="pill">Panes example</a>
          <a href="/sheet" className="pill">Sheets example</a>
          <a href="/book" className="pill">Call to action example</a>
        </div>
      </Section>

      <Section id="examples" title="Where the controls go" lede="Duet picks one of three places from the device, the browser and the window.">
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
      </Section>

      <footer className="foot" style={column(980, 20)}>MIT licensed. Not affiliated with Apple.</footer>
    </main>
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
