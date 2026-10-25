"use client";

import { Fragment, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { BookOpen, Layers, Sparkles } from "lucide-react";
import { Duet, DuoCookie, bleed, column, type DuetItem } from "duet-ui";
import { highlight } from "sugar-high";
import { WebDuo } from "./duo/web-duo";

const REPO = "https://github.com/JayFarei/duet";
const SECTIONS: DuetItem[] = [
  { id: "top", label: "Duet", icon: <Sparkles size={24} /> },
  { id: "code", label: "Integrate", icon: <BookOpen size={24} /> },
  { id: "examples", label: "Examples", icon: <Layers size={24} /> },
];

const QUICK = `import { Duet } from "duet-ui";

<Duet tabs={{ items: TABS, selected: tab, onSelect: setTab }}>
  <App />
</Duet>`;


// Recorded on the Duo simulator and framed by tools/media/compose.sh.
const ISLANDS: [string, string, string, string][] = [
  ["Home Screen", "Strip", "In the strip iOS gives the app, beside the page.", "strip"],
  ["Safari", "Column", "In the empty part of Safari's column. The page keeps its full width.", "column"],
  ["Everywhere else", "Inline", "A slim strip in the page, on the side the reader drags it to.", "inline-drag"],
];

/** One page for every screen, navigated by its own Duet controls. On the Duo (told to the server by the duet-duo
 *  cookie) the page is the demo; elsewhere the Duo also plays on a stage. */
export function Home({ duo }: { duo: boolean }) {
  return (
    <>
      <DuoCookie rendered={duo} />
      <Site self={duo} />
    </>
  );
}

function Site({ self }: { self: boolean }) {
  const [tab, setTab] = useState("top");
  const go = (id: string) => { setTab(id); requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })); };
  return (
    <Duet
      tabs={{ items: SECTIONS, selected: tab, onSelect: go }}
      actions={[{ id: "gh", label: "GitHub", icon: <GitHub />, onPress: () => window.open(REPO, "_blank") }]}
      minimizeOnScroll
    >
      <Page self={self} />
    </Duet>
  );
}

function Page({ self = false }: { self?: boolean }) {
  return (
    <main>
      <section id="top" className="hero" style={column(980, 20)}>
        <p className="eyebrow">duet-ui</p>
        <h1 className="display">
          <Rise words={["Vertical", "controls", "for", "the"]} />{" "}
          <em><Rise words={["iPhone", "Duo."]} from={4} /></em>
        </h1>
        <p className="lede">A React library that approximates the Duo&apos;s native side controls.</p>
        <div className="ctas">
          <Npm />
        </div>
      </section>

      <section className="stage" style={bleed(16)}>
        {self ? (
          <div style={{ ...column(980, 20), width: "100%" }}>
            <div className="card self">
              <h3 className="tile-h">This page uses Duet.</h3>
              <p className="tile-p">The controls on the side are Duet. Unfold, turn or split Safari to see them move.</p>
            </div>
          </div>
        ) : <>
          <WebDuo embed src="/skeleton" />
        </>}
      </section>

      <Section id="code" title="Integrate" lede="Wrap your app and pass your tabs. useDuet() also reports the device, the browser and whether the page runs from the Home Screen.">
        <Snippet code={QUICK} />
        <div className="ctas" style={{ justifyContent: "flex-start" }}>
          <a href={`${REPO}#readme`} className="pill pill-solid">Read the docs</a>
          <a href="/panes" className="pill">Panes example</a>
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

/** Words that rise into place one by one, on the same ease as Duet's islands. */
function Rise({ words, from = 0 }: { words: string[]; from?: number }) {
  return <>{words.map((w, i) => (
    <Fragment key={w}>{i > 0 && " "}<span className="rise"><span style={{ animationDelay: `${(from + i) * 70}ms` }}>{w}</span></span></Fragment>
  ))}</>;
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

function Snippet({ code }: { code: string }) {
  return <pre className="card code"><code dangerouslySetInnerHTML={{ __html: highlight(code) }} /></pre>;
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
  const src = useDark() ? `${name}-dark` : name;
  return (
    <video key={src} src={`/media/${src}.mp4`} poster={`/media/${src}.jpg`} autoPlay muted loop playsInline preload="metadata" aria-hidden
      style={{ display: "block", width: "100%", height: "auto", aspectRatio: "4 / 5", objectFit: "contain", background: "var(--card)", borderRadius: 18, ...style }} />
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
