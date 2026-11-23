import type { Metadata } from "next";
import { SiteNav } from "../site-nav";
import { EXAMPLES } from "./list";
import "./examples.css";

export const metadata: Metadata = { title: "Examples", description: "Four small apps built with duet-ui, live on the 3D iPhone Duo." };

export default function Page() {
  return (
    <>
      <SiteNav />
      <div className="ex-page">
        <header className="ex-head">
          <h1 className="ex-title">Examples</h1>
          <p className="ex-intro">Four small apps, each one source file, live on the 3D iPhone Duo. Pick a posture and watch Duet pick the largest controls that fit.</p>
        </header>
        <div className="ex-list">
          {EXAMPLES.map((e) => <a key={e.id} className="ex-item" href={`/examples/${e.id}`}><h2>{e.title}</h2><p>{e.line}</p></a>)}
        </div>
      </div>
    </>
  );
}
