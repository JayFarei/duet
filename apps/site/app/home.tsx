"use client";

import { useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { column } from "duet-ui";
import pkg from "duet-ui/package.json";
import { highlight } from "sugar-high";
import { AGENT_PROMPT } from "./agent-prompt";
import { ClaudeGlyph, CodexGlyph, GrokGlyph, PiGlyph } from "./agent-glyphs";
import { LoopVideo } from "./loop-video";
import { REPO, SiteNav } from "./site-nav";
import { TINTS, useTint } from "./theme";
import { Tour } from "./tour";

const DOC = `${REPO}/blob/main/docs`;

const quick = (tint?: string) => `import { Duet } from "duet-ui";

<Duet
  menu={{ items: PLACES, selected: place, onSelect: setPlace, tabs: true }}
  actions={[{ id: "share", label: "Share", icon: <Share />, onPress: share }]}
  primary={{ id: "pay", label: "Pay", icon: <CreditCard />, onPress: pay }}${tint ? `\n  tint="${tint}"` : ""}
>
  <App />
</Duet>`;

export type InstallStats = { total: number; daily: number[] };
/** Which recorded clips are on disk (app/clip.ts, read on the server). */
export type Clips = Record<string, boolean>;

/** The examples, each a real app in one file at /examples/<name>. */
const EXAMPLES = [
  { name: "inbox", title: "Inbox", text: "Nine folders as Navigation in all three fits, Actions, and Close over a message." },
  { name: "checkout", title: "Checkout", text: "Pay as a Primary that asks to confirm, the order as a sheet." },
  { name: "reader", title: "Reader", text: "A book with a Pane bar, and Next book as a Direct Primary." },
];
/** Our own apps on the Duo, on demo or mock data. */
const APPS = [
  { name: "regtail", title: "RegTail", text: "Car checks. Open, the report's sections are tabs." },
  { name: "dashboard", title: "Dashboard", text: "Server monitoring. Its five pages fit as tabs." },
  { name: "wealth", title: "Wealth", text: "Personal finance. Closed, nine sections go in the Sidebar." },
];
/** Where Duet puts its controls. */
const MODES = [
  { name: "strip", title: "Strip", where: "Home Screen app", text: "In the strip iOS gives the app beside the page." },
  { name: "column", title: "Column", where: "Safari", text: "In the empty part of Safari's column. The page keeps its full width." },
  { name: "inline", title: "Inline", where: "Everywhere else", text: "A slim strip inside the page, beside the content." },
];

/** The home page: the live Duo and its tour, the examples, the docs. */
export function Home({ installs, clips }: { installs: InstallStats | null; clips: Clips }) {
  return (
    <>
      <SiteNav />
      <main className="home">
        <section className="hero" data-testid="hero">
          <div className="hero-copy wrap">
            <h1 className="display">Native side controls for your web app on the <em>iPhone Duo.</em></h1>
            <p className="lede">You pass the places in your app. Duet measures the free space beside your page and draws the largest controls that fit. No device checks in your code.</p>
            <div className="actions">
              <div className="ctas"><AgentPrompt /><Npm /></div>
              <Stats installs={installs} />
            </div>
          </div>
          <Tour />
        </section>

        <section id="examples" className="section wrap">
          <h2 className="h2">Examples</h2>
          <p className="lede lede-l">Three small apps, one file each. Open one to try it on the 3D Duo in every posture.</p>
          <div className="cards">
            {EXAMPLES.map((e) => (
              <a key={e.name} className="card ex-card-link" href={`/examples/${e.name}`}>
                <LoopVideo name={`example-${e.name}`} available={!!clips[`example-${e.name}`]} label={`${e.title} on the iPhone Duo`} />
                <h3 className="card-h">{e.title}<ArrowUpRight size={18} aria-hidden /></h3>
                <p className="card-p">{e.text}</p>
              </a>
            ))}
          </div>
          <h3 className="h3">In real apps</h3>
          <p className="lede lede-l">Three of our apps, on the same Duo.</p>
          <div className="cards">
            {APPS.map((a) => (
              <div key={a.name} className="card">
                <LoopVideo name={`app-${a.name}`} available={!!clips[`app-${a.name}`]} still={`/media/app-${a.name}.webp`} label={`${a.title} on the iPhone Duo`} />
                <h3 className="card-h">{a.title}</h3>
                <p className="card-p">{a.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="docs" className="section wrap">
          <h2 className="h2">Docs</h2>
          <p className="lede lede-l">Install, wrap your app, list your places most used first.</p>
          <h3 className="h3">Install</h3>
          <div className="ctas ctas-l"><Npm /><AgentPrompt /></div>
          <h3 className="h3">Usage</h3>
          <Integrate />
          <h3 className="h3">Modes</h3>
          <p className="lede lede-l">Duet picks where the controls go from the device and the browser.</p>
          <div className="modes">
            {MODES.map((m) => (
              <div key={m.name} className="mode">
                <LoopVideo name={`mode-${m.name}`} available={!!clips[`mode-${m.name}`]} label={`${m.title} mode on the iPhone Duo`} />
                <div><p className="mode-k">{m.where}</p><h3 className="card-h">{m.title}</h3><p className="card-p">{m.text}</p></div>
              </div>
            ))}
          </div>
          <h3 className="h3">Reference</h3>
          <p className="lede lede-l">Every control, its variants and its props, then the full API.</p>
          <div className="ctas ctas-l">
            <a href="/components" className="pill pill-solid">Components</a>
            <a href={`${DOC}/api.md`} className="pill" target="_blank" rel="noreferrer">API reference</a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

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
  const copy = () => navigator.clipboard?.writeText("pnpm add duet-ui").then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); });
  return (
    <button className="pill pill-solid npm" onClick={copy} aria-label="Copy the install command">
      <code>pnpm add duet-ui</code><span className="npm-hint">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
