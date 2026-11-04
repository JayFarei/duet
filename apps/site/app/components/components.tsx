"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { highlight } from "sugar-high";
import { LoopVideo } from "../loop-video";
import { SiteNav } from "../site-nav";

type Variant = { id: string; label: string; clip: string; cue: string; code: string };
type Prop = [name: string, type: string, text: string];
type Noun = { id: string; name: string; text: string; live: string; variants: Variant[]; props: Prop[] };

const PLACES = `const PLACES = [
  { id: "inbox", label: "Inbox", icon: <Inbox /> },
  { id: "sent", label: "Sent", icon: <Send /> },
  // ...
];`;

/** The glossary, in order: one section per noun, each with its recorded variants, code and props. */
const NOUNS: Noun[] = [
  {
    id: "group", name: "Group", live: "/#tour-places",
    text: "A glass column of buttons in the free space beside the page. Duet draws one Group for Navigation, More and Actions, and the Primary in a Group of its own.",
    variants: [{ id: "group", label: "Group", clip: "group", cue: "groups 2, free space left over", code: `<Duet menu={{ items: PLACES, selected, onSelect }} actions={ACTIONS} primary={PAY}>\n  <App />\n</Duet>` }],
    props: [["appearance", `"auto" | "light" | "dark"`, "Light or dark glass. Default follows the system."], ["tint", "string", "Accent for the selected place, the Primary and checked rows."]],
  },
  {
    id: "navigation", name: "Navigation", live: "/#tour-navigation",
    text: "Your places, in the largest form that fits the free space: Tabs when they all fit, Tabs + More when some do, the Sidebar button when fewer than three would.",
    variants: [
      { id: "tabs", label: "Tabs", clip: "navigation-tabs", cue: "fit tabs", code: `${PLACES}\n\n<Duet menu={{ items: PLACES, selected, onSelect, tabs: true }}>\n  <App />\n</Duet>` },
      { id: "tabs-more", label: "Tabs + More", clip: "navigation-tabs-more", cue: "fit tabs-more", code: `// Same props: Duet folds the places that do not fit into More.\n<Duet menu={{ items: PLACES, selected, onSelect, tabs: true }}>\n  <App />\n</Duet>` },
      { id: "sidebar", label: "Sidebar", clip: "navigation-sidebar", cue: "fit sidebar", code: `// Same props: with no room for tabs, one button opens the Sidebar.\n<Duet menu={{ items: PLACES, selected, onSelect, tabs: true }}>\n  <App />\n</Duet>` },
    ],
    props: [["menu.items", "DuetMenuItem[]", "The places, most used first: { id, label, icon?, badge? }."], ["menu.selected", "id", "The place showing."], ["menu.onSelect", "(id) => void", "Called with the place picked."], ["menu.tabs", "boolean", "Show places as tabs where they fit."]],
  },
  {
    id: "more", name: "More", live: "/#tour-more",
    text: "One button that opens a list of what did not fit, under two headings: Places, then Actions. Duet adds it only when something is left over.",
    variants: [{ id: "more", label: "More", clip: "more", cue: "Places, Actions", code: `// No prop of its own: More appears when places or actions do not fit.\n<Duet menu={{ items: PLACES, selected, onSelect, tabs: true }} actions={ACTIONS}>\n  <App />\n</Duet>` }],
    props: [["actions[].folded", "boolean", "Keep an action in More even where it would fit."], ["actions[].destructive", "boolean", "Only in More, last, in red."]],
  },
  {
    id: "actions", name: "Actions", live: "/#tour-actions",
    text: "Commands such as Compose or Share, as round buttons while they fit. They fire and leave nothing selected; the rest move into More one at a time.",
    variants: [{ id: "actions", label: "Actions", clip: "actions", cue: "fit sidebar, actions 3", code: `const ACTIONS = [\n  { id: "compose", label: "Compose", icon: <PenSquare />, onPress: compose },\n  { id: "archive", label: "Archive", icon: <Archive />, onPress: archive },\n  { id: "delete", label: "Delete", icon: <Trash />, onPress: remove, destructive: true },\n];\n\n<Duet actions={ACTIONS}>\n  <App />\n</Duet>` }],
    props: [["actions", "DuetItem[]", "{ id, label, icon, onPress?, badge?, tint?, destructive?, folded? }."]],
  },
  {
    id: "primary", name: "Primary", live: "/#tour-primary",
    text: "The page's one main action, tinted and always on screen. Confirm grows into a box that asks first, Direct runs on the first press, and where one button is all that fits it is Folded into More.",
    variants: [
      { id: "confirm", label: "Confirm", clip: "primary-confirm", cue: "press, confirm, run", code: `<Duet primary={{ id: "pay", label: "Pay", icon: <CreditCard />, confirm: "Pay $24", onPress: pay }}>\n  <App />\n</Duet>` },
      { id: "direct", label: "Direct", clip: "primary-direct", cue: "press, run", code: `<Duet primary={{ id: "next", label: "Next book", icon: <BookOpen />, confirm: false, onPress: next }}>\n  <App />\n</Duet>` },
      { id: "folded", label: "Folded", clip: "primary-folded", cue: "in More: press, confirm, run", code: `// Same props: where one button is all that fits, the Primary waits in More\n// and arms on the first press, runs on the second.\n<Duet primary={PAY}>\n  <App />\n</Duet>` },
    ],
    props: [["primary.id", "string", "Stable id."], ["primary.label", "string", "Accessible name, shown when it opens."], ["primary.icon", "ReactNode", "What the button shows."], ["primary.confirm", "string | false", "The confirm button's label, or false to run at once."], ["primary.onPress", "() => void", "Runs the action."]],
  },
  {
    id: "close", name: "Close", live: "/#tour-close",
    text: "While a sheet or card is open, Duet shows only Close, the way a native sheet does. Clear the prop and the controls come back.",
    variants: [{ id: "close", label: "Close", clip: "close", cue: "controls: close", code: `<Duet close={open ? { label: "Close message", onPress: () => setOpen(false) } : false}>\n  <App />\n</Duet>` }],
    props: [["close", "false | { label?, onPress }", "Set while something is open over the page."], ["close.label", "string", "Accessible name. Default Close."], ["close.onPress", "() => void", "Closes what is open."]],
  },
  {
    id: "pane-bar", name: "Pane bar", live: "/examples/reader",
    text: "Two panes, such as a list and the item it opens: closed, one shows at a time; open, they sit side by side. The Pane bar closes the second pane or takes it full screen.",
    variants: [{ id: "pane-bar", label: "Pane bar", clip: "pane-bar", cue: "close, full screen", code: `const nav = usePanes(PATH, "book");\n\n<DuetPanes path={PATH} at={nav.at} expanded={nav.expanded} panes={{ list: <List />, book: (\n  <>\n    <DuetPaneBar onClose={nav.close} onToggle={nav.toggle} expanded={nav.expanded} />\n    <Book />\n  </>\n) }} />` }],
    props: [["onClose", "() => void", "Closes the pane."], ["onToggle", "() => void", "Full screen on or off."], ["expanded", "boolean", "Whether the pane is full screen."]],
  },
];

/** A row of tabs (role tab in a tablist), the look of iOS's segmented control. */
function Tabs({ label, testid, items, value, onChange }: { label: string; testid?: string; items: [string, string][]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="seg" role="tablist" aria-label={label} data-testid={testid}>
      {items.map(([id, text]) => <button key={id} type="button" role="tab" aria-selected={value === id} onClick={() => onChange(id)}>{text}</button>)}
    </div>
  );
}

function Section({ noun, prev, next, clips }: { noun: Noun; prev?: Noun; next?: Noun; clips: Record<string, boolean> }) {
  const [view, setView] = useState("preview");
  const [at, setAt] = useState(noun.variants[0].id);
  const v = noun.variants.find((x) => x.id === at) ?? noun.variants[0];
  const external = noun.live.startsWith("/examples");
  return (
    <section id={noun.id} className="cmp-sec">
      <h2>{noun.name}</h2>
      <p>{noun.text}</p>
      <div className="cmp-bar">
        <Tabs label={`${noun.name} view`} items={[["preview", "Preview"], ["code", "Code"]]} value={view} onChange={setView} />
        {noun.variants.length > 1 && <Tabs label={`${noun.name} variant`} testid={`variant-${noun.id}`} items={noun.variants.map((x) => [x.id, x.label])} value={at} onChange={setAt} />}
      </div>
      <div className="cmp-frame">
        {view === "preview"
          ? <><LoopVideo name={v.clip} available={!!clips[v.clip]} counter label={`${noun.name}: ${v.label}, on the iPhone Duo`} /><p className="cmp-cue">{v.cue}</p></>
          : <pre className="code"><code dangerouslySetInnerHTML={{ __html: highlight(v.code) }} /></pre>}
      </div>
      <h3>Props</h3>
      <table className="props">
        <thead><tr><th>Prop</th><th>Type</th><th>What it does</th></tr></thead>
        <tbody>{noun.props.map(([n, t, d]) => <tr key={n}><td><code>{n}</code></td><td><code>{t}</code></td><td>{d}</td></tr>)}</tbody>
      </table>
      <a className="cmp-live" href={noun.live}>{external ? "See it in Reader" : "See it live"} <ArrowUpRight size={15} aria-hidden /></a>
      <nav className="cmp-pager" aria-label={`Next to ${noun.name}`}>
        {prev ? <a href={`#${prev.id}`}><ArrowLeft size={14} aria-hidden /> {prev.name}</a> : <span />}
        {next ? <a href={`#${next.id}`}>{next.name} <ArrowRight size={14} aria-hidden /></a> : <span />}
      </nav>
    </section>
  );
}

/** /components: every control Duet draws, in glossary order, with recorded previews, code and props. No live stage
 *  here: one WebGL context lives on the home page, so every preview is a recorded loop. */
export function Components({ clips }: { clips: Record<string, boolean> }) {
  return (
    <>
      <SiteNav />
      <main className="wrap cmp">
        <nav className="cmp-nav" data-testid="components-nav" aria-label="Components">
          {NOUNS.map((n) => <a key={n.id} href={`#${n.id}`}>{n.name}</a>)}
        </nav>
        <div>
          <h1 className="cmp-h1">Components</h1>
          <p className="cmp-lede">Every control Duet draws, in the order it adds them. You pass props; Duet picks the form from the free space it measures.</p>
          {NOUNS.map((n, i) => <Section key={n.id} noun={n} prev={NOUNS[i - 1]} next={NOUNS[i + 1]} clips={clips} />)}
        </div>
      </main>
    </>
  );
}
