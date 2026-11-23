"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Duo3D } from "../duo3d/duo3d";
import type { ClipPosture } from "../duo3d/clips";
import { ExDemo } from "../ex-demo";
import { LoopVideo } from "../loop-video";
import { SiteNav } from "../site-nav";
import { EXAMPLES } from "./list";
import "./examples.css";

const POSTURES: [ClipPosture, string][] = [["closed", "Closed"], ["open", "Open"], ["laptop", "Laptop"], ["sideways", "Sideways"]];
const WIDE = "(min-width: 768px)";

const wideNow = () => matchMedia(WIDE).matches;
const onResize = (f: () => void) => { const m = matchMedia(WIDE); m.addEventListener("change", f); return () => m.removeEventListener("change", f); };

type Tab = "preview" | "code";
/** The block's state in the URL (?view=code, ?posture=open), so a link or a reload lands on the same view. replaceState:
 *  a posture or a tab is not a page, so Back leaves the example. */
function useUrlState() {
  const [posture, setPosture] = useState<ClipPosture>("closed");
  const [tab, setTab] = useState<Tab>("preview");
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const p = q.get("posture");
    if (POSTURES.some(([id]) => id === p)) setPosture(p as ClipPosture);
    if (q.get("view") === "code") setTab("code");
  }, []);
  const write = (key: string, value: string, base: string) => {
    const u = new URL(location.href);
    if (value === base) u.searchParams.delete(key); else u.searchParams.set(key, value);
    history.replaceState(history.state, "", u);
  };
  return {
    posture, tab,
    pickPosture: (p: ClipPosture) => { setPosture(p); write("posture", p, "closed"); },
    pickTab: (t: Tab) => { setTab(t); write("view", t, "preview"); },
  };
}

/** One example: the site's top bar, its app on the 3D Duo with a posture picker, its single source file, and a link to
 *  the bare app (/examples/<name>?plain, app/plain). The stage lets the page scroll over it until the visitor picks
 *  "Use the device"; Done or Escape hands the wheel back. Below 768px the block plays its recorded loop instead of
 *  the stage. Under it, the other examples' loops link to them. */
export function Block({ name, title, intro, code, loops }: { name: string; title: string; intro: ReactNode; code: string; loops: Record<string, boolean> }) {
  const loop = !!loops[name];
  const wide = useSyncExternalStore(onResize, wideNow, () => null);
  const { posture, tab, pickPosture, pickTab } = useUrlState();
  const href = `/examples/${name}?plain`;

  return (
    <>
      <SiteNav />
      <div className="ex-page">
        <header className="ex-head">
          <a href="/examples" className="ex-back">Examples</a>
          <h1 className="ex-title">{title}</h1>
          <p className="ex-intro">{intro}</p>
        </header>
        <div className="ex-bar">
          {wide && tab === "preview" && (
            <div className="ex-seg" role="group" aria-label="Posture" data-testid="posture">
              {POSTURES.map(([id, label]) => <button key={id} aria-pressed={posture === id} onClick={() => pickPosture(id)}>{label}</button>)}
            </div>
          )}
          <div className="ex-seg" role="tablist" aria-label="View">
            <button role="tab" aria-selected={tab === "preview"} onClick={() => pickTab("preview")}>Preview</button>
            <button role="tab" aria-selected={tab === "code"} onClick={() => pickTab("code")}>Code</button>
          </div>
          <a className="ex-open" href={href} target="_blank" rel="noopener">Open in new tab <ArrowUpRight size={15} aria-hidden /></a>
        </div>
        <div className="ex-frame">
          {tab === "code" ? <pre className="code ex-code"><code dangerouslySetInnerHTML={{ __html: code }} /></pre>
            : wide ? <Duo3D embed chrome={false} posture={posture} src={href} />
            : wide === false && loop ? <LoopVideo className="ex-loop" name={`example-${name}`} available label={`${title} on the iPhone Duo`} />
            : wide === false ? <div className="ex-card"><p>{title} runs on the iPhone Duo. Open it on its own to try it here.</p><a href={href}>Open</a></div>
            : <div className="ex-wait" />}
        </div>
        <h2 className="ex-more-h">Other examples</h2>
        <div className="ex-more">
          {EXAMPLES.filter((e) => e.id !== name).map((e) => (
            <a key={e.id} className="ex-item" href={`/examples/${e.id}`}>
              {loops[e.id] ? <LoopVideo name={`example-${e.id}`} available label={`${e.title} on the iPhone Duo`} /> : <ExDemo name={e.id} />}
              <h2>{e.title}</h2>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
