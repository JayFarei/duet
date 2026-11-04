"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Duo3D } from "../duo3d/duo3d";
import type { ClipPosture } from "../duo3d/clips";
import { LoopVideo } from "../loop-video";
import "./examples.css";

const POSTURES: [ClipPosture, string][] = [["closed", "Closed"], ["open", "Open"], ["laptop", "Laptop"], ["sideways", "Sideways"]];
const WIDE = "(min-width: 768px)";

const plainNow = () => new URLSearchParams(location.search).has("plain");
const wideNow = () => matchMedia(WIDE).matches;
const onResize = (f: () => void) => { const m = matchMedia(WIDE); m.addEventListener("change", f); return () => m.removeEventListener("change", f); };

/** One example: its app live on the 3D Duo with a posture picker, its single source file, and a link to the bare app.
 *  `?plain` renders the app alone (the stage's screens load that, and so does "Open in new tab"). Below 768px the
 *  block plays its recorded loop instead of the stage. */
export function Block({ name, title, intro, code, app, loop }: { name: string; title: string; intro: ReactNode; code: string; app: ReactNode; loop: boolean }) {
  const plain = useSyncExternalStore(() => () => {}, plainNow, () => false);
  const wide = useSyncExternalStore(onResize, wideNow, () => null);
  const [posture, setPosture] = useState<ClipPosture>("closed");
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const href = `/examples/${name}?plain`;
  if (plain) return <>{app}</>;

  return (
    <div className="ex-page">
      <header className="ex-head">
        <a href="/examples" className="ex-back">Examples</a>
        <h1 className="ex-title">{title}</h1>
        <p className="ex-intro">{intro}</p>
      </header>
      <div className="ex-bar">
        {wide && tab === "preview" && (
          <div className="ex-seg" role="group" aria-label="Posture" data-testid="posture">
            {POSTURES.map(([id, label]) => <button key={id} aria-pressed={posture === id} onClick={() => setPosture(id)}>{label}</button>)}
          </div>
        )}
        <div className="ex-seg" role="tablist" aria-label="View">
          <button role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")}>Preview</button>
          <button role="tab" aria-selected={tab === "code"} onClick={() => setTab("code")}>Code</button>
        </div>
        <a className="ex-open" href={href} target="_blank" rel="noopener">Open in new tab <ArrowUpRight size={15} aria-hidden /></a>
      </div>
      <div className="ex-frame">
        {tab === "code" ? <pre className="code ex-code"><code dangerouslySetInnerHTML={{ __html: code }} /></pre>
          : wide ? <Duo3D embed chrome={false} live posture={posture} src={href} />
          : wide === false && loop ? <LoopVideo className="ex-loop" name={`example-${name}`} available label={`${title} on the iPhone Duo`} />
          : wide === false ? <div className="ex-card"><p>{title} runs on the iPhone Duo. Open it on its own to try it here.</p><a href={href}>Open</a></div>
          : <div className="ex-wait" />}
      </div>
    </div>
  );
}
