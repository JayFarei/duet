"use client";

import { useState } from "react";
import { Duet, DuetInspectButton, DuetInspector, DuetViewer, DuetViewerGroup, inspectable, useInspector, paneGlyph } from "duet-ui";
import { Duo } from "../../duo/duo";
import { useDesktop } from "../../duo/web-duo";
import "./inspector-lab.css";

// A month of household spending: each card opens in the inspector, each figure in a viewer.
interface Card { id: string; section: string; title: string; amount: string; note: string; weeks: number[] }
const CARDS: Card[] = [
  { id: "rent", section: "Housing", title: "Rent", amount: "1,850", note: "Paid on the 1st, standing order.", weeks: [1850, 0, 0, 0] },
  { id: "groceries", section: "Food", title: "Groceries", amount: "642", note: "Two shops a week, one market Saturday.", weeks: [168, 142, 181, 151] },
  { id: "transit", section: "Travel", title: "Transit", amount: "118", note: "Monthly pass plus two taxis.", weeks: [84, 12, 0, 22] },
  { id: "utilities", section: "Housing", title: "Utilities", amount: "214", note: "Power, water, broadband.", weeks: [0, 96, 54, 64] },
  { id: "savings", section: "Future", title: "Savings", amount: "900", note: "Moved on payday, untouched since.", weeks: [900, 0, 0, 0] },
  { id: "leisure", section: "Life", title: "Leisure", amount: "287", note: "Cinema, a concert, books.", weeks: [42, 120, 61, 64] },
];
const IDS = CARDS.map((c) => c.id);
const FIGURES = [
  { id: "fig-month", title: "The month by week", caption: "Every card, week by week." },
  { id: "fig-share", title: "Share of spending", caption: "Each card's part of the total." },
  { id: "fig-year", title: "The year so far", caption: "Ten months against the plan." },
];

export function InspectorLab() {
  const desktop = useDesktop();
  return desktop ? <Duo src="/lab/inspector" /> : <div className={desktop === null ? "ssr-site" : undefined}><Ledger /></div>;
}

function Bars({ weeks, tall }: { weeks: number[]; tall?: boolean }) {
  const max = Math.max(...weeks, 1), h = tall ? 120 : 28;
  return (
    <svg className="ilab-bars" width={tall ? 320 : 72} height={h} viewBox={`0 0 ${weeks.length * 10} ${h}`} preserveAspectRatio="none" aria-hidden>
      {weeks.map((w, i) => <rect key={i} x={i * 10 + 1} width={8} y={h - (w / max) * h} height={(w / max) * h} />)}
    </svg>
  );
}

function Ledger() {
  const ins = useInspector({ ids: IDS, repairHistory: true });
  const card = CARDS.find((c) => c.id === ins.selected);
  const [figure, setFigure] = useState<string | null>(null);
  return (
    <Duet menu={ins.selected ? undefined : { items: [{ id: "household", label: "Household", icon: paneGlyph("split") }], tabs: true, selected: "household", onSelect: () => window.scrollTo(0, 0) }}>
      <div className="ilab" data-inspector-selected={ins.selected ?? ""}>
        <main className="ilab-overview">
          <p className="ilab-eyebrow">October</p>
          <h1>Household</h1>
          <p className="ilab-lede">Tap a card, or its inspect button, to open it beside the month. Escape, Back and the arrows step through.</p>
          <ol className="ilab-cards">
            {CARDS.map((c) => (
              <li key={c.id} data-card={c.id} data-open={ins.selected === c.id || undefined} {...inspectable((t) => ins.open(c.id, t))}>
                <div className="ilab-card-head">
                  <span className="ilab-eyebrow">{c.section}</span>
                  <DuetInspectButton label={`Inspect ${c.title}`} expanded={ins.selected === c.id} onPress={(t) => ins.open(c.id, t)} />
                </div>
                <h2>{c.title}</h2>
                <p className="ilab-amount">{c.amount}</p>
                <Bars weeks={c.weeks} />
                <p className="ilab-note">{c.note} <a href={`#${c.id}-source`} data-source={c.id}>Source</a></p>
              </li>
            ))}
          </ol>
          <section className="ilab-figures" aria-label="Figures">
            <h2>Figures</h2>
            <DuetViewerGroup>
              {FIGURES.map((f) => (
                <DuetViewer key={f.id} id={f.id} title={f.title} open={figure === f.id} onOpenChange={(o) => setFigure((at) => (o ? f.id : at === f.id ? null : at))}
                  trigger={<button type="button" className="ilab-figure" data-figure={f.id}>{f.title}</button>}>
                  <p className="ilab-note">{f.caption}</p>
                  <Bars weeks={CARDS.map((c) => c.weeks.reduce((a, b) => a + b, 0))} tall />
                </DuetViewer>
              ))}
            </DuetViewerGroup>
          </section>
        </main>
        <DuetInspector {...ins.paneProps} title={card?.title} eyebrow={card?.section} caption={card ? `${card.amount} this month` : undefined}
          fullOnly={card && (
            <table className="ilab-weeks">
              <caption>By week</caption>
              <tbody>{card.weeks.map((w, i) => <tr key={i}><th scope="row">Week {i + 1}</th><td>{w}</td></tr>)}</tbody>
            </table>
          )}>
          {card && <>
            <p>{card.note}</p>
            <Bars weeks={card.weeks} tall />
            <label className="ilab-field">Note <input type="text" placeholder="Add a note" /></label>
          </>}
        </DuetInspector>
      </div>
    </Duet>
  );
}
