"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import { column } from "duet-ui";
import pkg from "duet-ui/package.json";
import { highlight } from "sugar-high";
import { AGENT_PROMPT } from "./agent-prompt";
import { Duo } from "./duo/duo";
import { GitHub, REPO, SiteNav } from "./site-nav";

const DOC = `${REPO}/blob/main/docs`;

const QUICK = `import { Duet } from "duet-ui";

<Duet
  menu={{ items: PLACES, selected: place, onSelect: setPlace, tabs: true }}
  actions={[{ id: "share", label: "Share", icon: <Share />, onPress: share }]}
  primary={{ id: "pay", label: "Pay", icon: <CreditCard />, onPress: pay }}
>
  <App />
</Duet>`;

export type InstallStats = { total: number; daily: number[] };

/** The examples, each a real app in one file at /examples/<name>. The simulator loads `?plain`: the app alone. */
export const EXAMPLES = [
  { name: "inbox", title: "Inbox", text: "Nine folders as Navigation: Tabs open, Tabs + More or Sidebar closed. Actions, and Close over a message." },
  { name: "checkout", title: "Checkout", text: "Pay as a Primary that asks to confirm. Turned sideways, Pay folds into More." },
  { name: "reader", title: "Reader", text: "Two panes with a Pane bar, and Next book as a Primary with no confirm." },
] as const;
type Name = (typeof EXAMPLES)[number]["name"];

/** How Duet decides, in order. */
const STEPS = [
  ["Wrap your app", "Pass your places (most used first), your actions, and at most one primary action. No device checks."],
  ["Duet measures", "It finds the free space beside your page: the strip iOS gives a Home Screen app, the empty part of Safari's column, or a slim strip inside the page elsewhere."],
  ["It draws what fits", "The largest controls that fit that space: all places as Tabs, some as Tabs with the rest in More, or one Sidebar button. Actions and Primary sit beside them."],
  ["It steps aside", "When a sheet or a page opens over yours, the controls shrink to Close."],
] as const;

/** The glossary, one word per thing. */
const NOUNS = [
  ["Group", "One glass bar holding a set of controls."],
  ["Navigation", "Your places. Shown as Tabs, Tabs + More, or a Sidebar, whichever is largest that fits."],
  ["More", "The … button. Its list holds the Places and Actions that did not fit."],
  ["Actions", "Buttons that do something on the current place, like Share or Archive."],
  ["Primary", "The one main action, like Pay. It can ask to confirm first."],
  ["Close", "What the controls become while something is open over your page."],
  ["Pane bar", "Close and Full screen for a second pane beside your page."],
] as const;

/** The home page: the live simulator, how Duet works, the examples, install. */
export function Home({ installs, sources }: { installs: InstallStats | null; sources: Record<Name, string> }) {
  const [app, setApp] = useState<Name>("inbox");
  const sim = useRef<HTMLElement>(null);
  // The screens tell which app they run, so a Moment (always the Inbox) moves the picker back.
  useEffect(() => {
    const on = (e: Event) => { const src = String((e as CustomEvent<string>).detail); const hit = EXAMPLES.find((x) => src.includes(`/examples/${x.name}`)); if (hit) setApp(hit.name); };
    addEventListener("duet:screen", on);
    return () => removeEventListener("duet:screen", on);
  }, []);
  const load = (name: Name, scroll = false) => {
    setApp(name);
    dispatchEvent(new CustomEvent("duet:example", { detail: { src: `/examples/${name}?plain`, moment: "fit" } }));
    if (scroll) sim.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };
  return (
    <>
      <SiteNav />
      <main className="home">
        <header className="intro wrap" data-testid="hero">
          <h1 className="display">Native side controls for your web app on the <em>iPhone Duo.</em></h1>
          <p className="lede">You pass the places in your app. Duet measures the free space beside your page and draws the largest controls that fit.</p>
          <div className="actions">
            <div className="ctas"><Npm /><AgentPrompt /></div>
            <Stats installs={installs} />
          </div>
        </header>

        <section id="simulator" ref={sim} className="sim" data-testid="simulator">
          <div className="wrap sim-head">
            <h2 className="h2">Try it</h2>
            <div className="seg" role="group" aria-label="App" data-testid="app-picker">
              {EXAMPLES.map((e) => <button key={e.name} type="button" aria-pressed={app === e.name} onClick={() => load(e.name)}>{e.title}</button>)}
            </div>
          </div>
          <div className="stage"><Duo embed src="/examples/inbox?plain" /></div>
        </section>

        <section id="how" className="section wrap">
          <h2 className="h2">How it works</h2>
          <ol className="how">
            {STEPS.map(([h, p], i) => <li key={h}><span className="how-n">{i + 1}</span><h3>{h}</h3><p>{p}</p></li>)}
          </ol>
          <table className="glossary">
            <tbody>{NOUNS.map(([n, d]) => <tr key={n}><th scope="row">{n}</th><td>{d}</td></tr>)}</tbody>
          </table>
        </section>

        <section id="examples" className="section wrap">
          <h2 className="h2">Examples</h2>
          <p className="lede lede-l">Three small apps, one file each.</p>
          <div className="exs">
            {EXAMPLES.map((e) => (
              <article key={e.name} className="card ex">
                <h3 className="card-h">{e.title}</h3>
                <p className="card-p">{e.text}</p>
                <div className="ex-acts">
                  <button type="button" className="pill pill-sm pill-solid" onClick={() => load(e.name, true)}>Try it</button>
                  <a className="pill pill-sm" href={`/examples/${e.name}`}>Open<ArrowUpRight size={14} aria-hidden /></a>
                </div>
                <details className="ex-src">
                  <summary>Show code</summary>
                  <pre className="code"><code dangerouslySetInnerHTML={{ __html: sources[e.name] }} /></pre>
                </details>
              </article>
            ))}
          </div>
        </section>

        <section id="install" className="section wrap">
          <h2 className="h2">Install</h2>
          <div className="ctas ctas-l"><Npm /><AgentPrompt /></div>
          <pre className="card code"><code dangerouslySetInnerHTML={{ __html: highlight(QUICK) }} /></pre>
          <div className="ctas ctas-l">
            <a href={`${DOC}/api.md`} className="pill" target="_blank" rel="noreferrer">API reference<ArrowUpRight size={16} aria-hidden /></a>
            <a href={`${DOC}/how-duet-decides.md`} className="pill" target="_blank" rel="noreferrer">How Duet decides<ArrowUpRight size={16} aria-hidden /></a>
            <a href={REPO} className="pill" target="_blank" rel="noreferrer"><GitHub />GitHub</a>
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

/** Copies a prompt that has a coding agent make the reader's app Duo-ready. The label flips to a check once the prompt
 *  is on the clipboard. */
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
        <Sparkles size={18} strokeWidth={2.2} aria-hidden />
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
