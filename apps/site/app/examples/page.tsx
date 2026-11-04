import type { Metadata } from "next";
import "./examples.css";

export const metadata: Metadata = { title: "Examples", description: "Three small apps built with duet-ui, live on the 3D iPhone Duo." };

const EXAMPLES = [
  ["inbox", "Inbox", "Navigation in all three fits, Actions, More, and Close over a message."],
  ["checkout", "Checkout", "A Primary with a confirm box, and the Primary folded into More when the device turns."],
  ["reader", "Reader", "Two panes, the Pane bar with Close and Full screen, and a Primary with no confirm box."],
] as const;

export default function Page() {
  return (
    <div className="ex-page">
      <header className="ex-head">
        <a href="/" className="ex-back">Duet</a>
        <h1 className="ex-title">Examples</h1>
        <p className="ex-intro">Three small apps, each one source file, live on the 3D iPhone Duo. Pick a posture and watch Duet pick the largest controls that fit.</p>
      </header>
      <div className="ex-list">
        {EXAMPLES.map(([id, h, p]) => <a key={id} className="ex-item" href={`/examples/${id}`}><h2>{h}</h2><p>{p}</p></a>)}
      </div>
    </div>
  );
}
