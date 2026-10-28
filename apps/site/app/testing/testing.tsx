"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Film, FlaskConical, Grid3x3, House, Moon, Pause, Play, RefreshCw, Smartphone, Sun, TriangleAlert } from "lucide-react";
import { Duet, column, useDuet, type DuetItem } from "duet-ui";
import { useTheme, useTint } from "../theme";

// The page's data, as scripts/e2e-snapshot.mjs writes it to public/e2e/summary.json.
type Status = "PASS" | "FAIL" | "UNVERIFIED";
// note: why a step is not PASS, written by a person after the run (scripts/e2e-notes.json).
type Step = { d: string; s: Status; why: string[]; expect: string; j: string; tr: string; ms: number; note: string | null };
type Cell = { surface: string; screen: string; angle: number; live: boolean; pass: number; fail: number; unverified: number; steps: string[]; rep: string; film: string };
type Rect = [string, number, number, number, number];
type Row = { t: number; place: string | null; hidden: string | null; flash: boolean; screen: string; rects: Rect[] };
type Side = { run: string; commit: string | null; status: Status; reasons: string[]; expect: string; film: string; onset: number; change: number; final: number; sampleMs: number; box: [number, number]; rows: Row[] };
type Edge = { title: string; see: string; cause: string; does: string; you?: string; issues: number[]; status?: string; film?: string; step?: string };
export type Summary = {
  run: { id: string; date: string; commit: string; branch: string; label: string; journeys: number; steps: number; frames: number; sampleMs: number; pass: number; fail: number; unverified: number; journeysPass: number; journeysFail: number; journeysUnverified: number; confirm: { rerun: number; journeys: number } };
  dims: { surfaces: [string, string][]; screens: [string, string][]; angles: number[]; live: [boolean, string][] };
  cells: Cell[];
  steps: Record<string, Step>;
  journeys: Record<string, string>;
  transitions: { key: string; label: string; steps: number; pass: number; fail: number; unverified: number }[];
  pairs: number;
  pair: { id: string; desc: string; journey: string; before: Side; after: Side };
  edges: Edge[];
};

const REPO = "https://github.com/JayFarei/duet";
const SECTIONS: DuetItem[] = [
  { id: "top", label: "Tested", icon: <FlaskConical size={24} /> },
  { id: "space", label: "The space", icon: <Grid3x3 size={24} /> },
  { id: "frames", label: "Frames", icon: <Film size={24} /> },
  { id: "edges", label: "Edge cases", icon: <TriangleAlert size={24} /> },
  { id: "loop", label: "The loop", icon: <RefreshCw size={24} /> },
  { id: "yours", label: "Your site", icon: <Smartphone size={24} /> },
];
const n = (x: number) => x.toLocaleString("en-US");
const statusOf = (c: { fail: number; unverified: number }): Status => (c.fail ? "FAIL" : c.unverified ? "UNVERIFIED" : "PASS");

export function Testing({ data }: { data: Summary }) {
  const [tab, setTab] = useState("top");
  const { device, width, height } = useDuet();
  const theme = useTheme();
  const { tint } = useTint();
  const go = (id: string) => { setTab(id); requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })); };
  useEffect(() => {
    // The tab follows the section in view.
    const f = () => {
      let at = SECTIONS[0].id;
      for (const s of SECTIONS) if ((document.getElementById(s.id)?.getBoundingClientRect().top ?? 1e9) < innerHeight * 0.4) at = s.id;
      setTab(at);
    };
    addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, []);
  const page = <Page data={data} />;
  return (
    <Duet
      tabs={{ items: SECTIONS, selected: tab, onSelect: go }}
      actions={[
        { id: "home", label: "Home", icon: <House size={22} />, onPress: () => { location.href = "/"; } },
        { id: "theme", label: theme.dark ? "Light mode" : "Dark mode", icon: theme.dark ? <Sun size={22} /> : <Moon size={22} />, onPress: theme.toggle },
      ]}
      minimizeOnScroll={device === "desktop" ? "always" : true}
      menuStyle={device === "desktop" ? "morph" : undefined}
      appearance={theme.appearance}
      tint={tint}
    >
      {/* On a portrait iPhone the side controls float over the page, as on the home page. */}
      {device === "iphone" && height > width ? <div className="float">{page}</div> : page}
    </Duet>
  );
}

function Page({ data }: { data: Summary }) {
  const { run } = data;
  const date = new Date(run.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <main className="t">
      <section id="top" className="hero" style={column(980, 20)}>
        <p className="eyebrow">How Duet is tested</p>
        <h1 className="display">No gap, <em>no button.</em></h1>
        <p className="lede">
          Safari on the iPhone Duo leaves a different gap for controls in every window, screen, angle and Live Activity, and moves it mid-animation. Duet&apos;s button has to sit inside that gap, painted, in every frame. Where there is no gap, there is no button. This page shows how we check that, frame by frame, and how you can check your own site.
        </p>
        <div className="t-stats">
          {([[n(run.journeys), "journeys"], [n(run.steps), "steps"], [n(run.frames), "frames judged"], [`${run.sampleMs}ms`, "between samples"]] as const).map(([v, k]) => (
            <div key={k} className="t-stat"><b>{v}</b><span>{k}</span></div>
          ))}
        </div>
        <Bar pass={run.pass} fail={run.fail} unverified={run.unverified} />
        <p className="t-note">
          Last run {date} on <a href={`${REPO}/commit/${run.commit}`}><code>{run.commit}</code></a> ({run.label}, a release candidate). Steps: {run.pass} pass, {run.fail} fail, {run.unverified} unverified.
          {run.fail ? " Red here is real: these are open bugs on that build." : " No step failed. A step is unverified when the run could not show it either way; each one is below, with why."}
        </p>
        <Open data={data} />
      </section>

      <Section id="space" title="The space" lede="The gap depends on where the page is, which screen, which way the phone is held and whether a Live Activity takes the top. Then something moves.">
        <Space data={data} />
      </Section>

      <Section id="frames" title="Every frame judged" lede={`The page reports where Duet put its controls every ${run.sampleMs}ms while the simulator films the screen. A judge checks every sample, not the last one.`}>
        <Replay pair={data.pair} />
      </Section>

      <Section id="edges" title="Edge cases" lede="Each one was seen on a device or in a run, fixed in duet-ui and written up in the README.">
        <Edges edges={data.edges} />
      </Section>

      <Section id="loop" title="How we keep it true" lede="A bug found on a phone becomes a journey that fails, then a fix, then a line in the README, then a gate on every release.">
        <Loop data={data} />
      </Section>

      <Section id="yours" title="Test your own site" lede="You can run the same harness, or check the same states by hand on a phone.">
        <Yours data={data} />
      </Section>

      <footer className="foot" style={column(980, 20)}>
        Numbers, films and verdicts come from run <code>{run.id}</code>, snapshotted by <code>apps/site/scripts/e2e-snapshot.mjs</code>.
      </footer>
    </main>
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

function Bar({ pass, fail, unverified }: { pass: number; fail: number; unverified: number }) {
  return (
    <div className="t-bar" role="img" aria-label={`${pass} pass, ${fail} fail, ${unverified} unverified`}>
      <i data-s="PASS" style={{ flexGrow: pass }} /><i data-s="FAIL" style={{ flexGrow: fail }} /><i data-s="UNVERIFIED" style={{ flexGrow: unverified }} />
    </div>
  );
}

const Dot = ({ s }: { s: Status }) => <i className="t-dot" data-s={s} title={s} />;

/** Every step that is not PASS, with the person-checked reason when there is one, else the judge's. */
function Open({ data }: { data: Summary }) {
  const open = Object.entries(data.steps).filter(([, s]) => s.s !== "PASS");
  if (!open.length) return null;
  return (
    <ul className="t-open">
      {open.map(([id, s]) => (
        <li key={id}>
          <Dot s={s.s} /> <code>{id}</code> {s.d}<span className="t-dim"> {data.journeys[s.j] ?? ""}</span>
          <span className="t-open-why">{s.note ? <Rich text={s.note} /> : s.why[0]}</span>
        </li>
      ))}
    </ul>
  );
}

/* -- The space ------------------------------------------------------------------------------------------------- */

function Space({ data }: { data: Summary }) {
  const { dims, cells, transitions } = data;
  const states = dims.surfaces.length * dims.screens.length * dims.angles.length * dims.live.length;
  const find = (s: string, sc: string, a: number, l: boolean) => cells.find((c) => c.surface === s && c.screen === sc && c.angle === a && c.live === l);
  const [open, setOpen] = useState<Cell | null>(() => cells.find((c) => c.steps.includes(data.pair.id)) ?? cells[0]);
  return (
    <>
      <div className="t-mult">
        <span><b>{dims.surfaces.length}</b> windows</span>×<span><b>{dims.screens.length}</b> screens</span>×<span><b>{dims.angles.length}</b> angles</span>×<span><b>{dims.live.length}</b> Live Activity</span>=<span className="t-mult-v"><b>{states}</b> states</span>
        <br />×<span><b>{transitions.length}</b> transitions</span>=<span className="t-mult-v"><b>{n(states * transitions.length)}</b></span>
        ×<span><b>2⁵</b> settings</span>=<span className="t-mult-v"><b>{n(states * transitions.length * 32)}</b></span>
      </div>
      <p className="t-p">
        Settings are tab bar position, Back and Forward buttons, Shared with You, dark mode and larger text. They are spread across the journeys so every value is covered, not every product. This run reached <b>{cells.length} of {states}</b> states and <b>{data.pairs}</b> state and transition pairs. Hatched cells are not covered yet. Pick a cell to see its film and every step judged in it.
      </p>
      <div className="t-grid-wrap">
        <table className="t-grid">
          <thead>
            <tr><th />{dims.angles.map((a) => <th key={a} colSpan={dims.live.length}>{a}°</th>)}</tr>
            <tr><th />{dims.angles.map((a) => dims.live.map(([l]) => <th key={`${a}${l}`} className="t-sub">{l ? "LA" : "none"}</th>))}</tr>
          </thead>
          <tbody>
            {dims.surfaces.map(([s, sl]) => dims.screens.map(([sc, scl], i) => (
              <tr key={s + sc} className={i === 0 ? "t-first" : undefined}>
                <th scope="row">{i === 0 ? <b>{sl}</b> : null}<span>{scl}</span></th>
                {dims.angles.map((a) => dims.live.map(([l]) => {
                  const c = find(s, sc, a, l);
                  if (!c) return <td key={`${a}${l}`}><span className="t-cell" data-s="none" title="Not covered" /></td>;
                  const on = open === c;
                  return (
                    <td key={`${a}${l}`}>
                      <button className="t-cell" data-s={statusOf(c)} data-on={on || undefined} onClick={() => setOpen(c)}
                        aria-label={`${sl}, ${scl}, ${a}°, ${l ? "Live Activity" : "no Live Activity"}: ${c.pass} pass, ${c.fail} fail, ${c.unverified} unverified`}>
                        {c.steps.length}
                      </button>
                    </td>
                  );
                }))}
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      <p className="t-legend"><Dot s="PASS" /> all pass <Dot s="FAIL" /> a step fails <Dot s="UNVERIFIED" /> a step unverified. The number is steps judged in that state. LA: a Live Activity in the top band.</p>
      {open && <CellPanel cell={open} data={data} />}
      <h3 className="t-h3">By transition</h3>
      <div className="t-trs">
        {transitions.map((t) => (
          <div key={t.key} className="t-tr">
            <span>{t.label}</span>
            <Bar pass={t.pass} fail={t.fail} unverified={t.unverified} />
            <span className="t-num">{t.pass}/{t.steps}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function CellPanel({ cell, data }: { cell: Cell; data: Summary }) {
  const label = (k: string, list: [string, string][]) => list.find(([x]) => x === k)?.[1] ?? k;
  const steps = cell.steps.map((id) => [id, data.steps[id]] as const).filter(([, s]) => s);
  // Failures first, so the reason for a cell's colour is on top.
  const rank = { FAIL: 0, UNVERIFIED: 1, PASS: 2 };
  steps.sort((a, b) => rank[a[1].s] - rank[b[1].s]);
  const rep = data.steps[cell.rep];
  return (
    <div className="card t-panel">
      <div className="t-film">
        <video key={cell.film} src={cell.film} poster={cell.film.replace(/\.mp4$/, ".jpg")} muted loop autoPlay playsInline />
        <p className="t-cap">{cell.rep}: {rep?.d}</p>
      </div>
      <div className="t-steps">
        <p className="tile-k" style={{ margin: "0 0 8px" }}>
          {label(cell.surface, data.dims.surfaces)}, {label(cell.screen, data.dims.screens)}, {cell.angle}°, {cell.live ? "Live Activity" : "no Live Activity"}
        </p>
        <p className="t-p" style={{ margin: "0 0 12px" }}>{cell.pass} pass, {cell.fail} fail, {cell.unverified} unverified</p>
        <ul>
          {steps.map(([id, s]) => (
            <li key={id}>
              <Dot s={s.s} /> <code>{id}</code> {s.d}
              <span className="t-dim"> {data.journeys[s.j] ?? ""}</span>
              {s.note && <span className="t-why"><Rich text={s.note} /></span>}
              {/* The judge's "passed alone" line is out of date once a note says what is known since. */}
              {s.s !== "PASS" && s.why.filter((w) => !(s.note && /passed alone/.test(w))).slice(0, 2).map((w, i) => <code key={i} className="t-why">{w}</code>)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* -- Every frame judged ------------------------------------------------------------------------------------------ */

const at = (rows: Row[], t: number) => { let r: Row | null = null; for (const x of rows) { if (x.t > t) break; r = x; } return r; };
const placeText = (r: Row | null) => !r ? "before the step" : r.hidden ? `hidden (${r.hidden})` : r.place ? `${r.place}${r.screen === "closed" ? ", closed screen" : ""}` : "no controls";

/** Both runs of one step, played together. The clock is the "before" film; each film's samples are drawn over it. */
function Replay({ pair }: { pair: Summary["pair"] }) {
  const a = useRef<HTMLVideoElement>(null), b = useRef<HTMLVideoElement>(null);
  const { before, after } = pair;
  const start = -before.onset * 1000, end = 3500;
  const first = before.rows.find((r) => r.flash)?.t ?? 0;
  const [t, setT] = useState(first);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(0.25);
  const seek = (ms: number) => {
    for (const v of [a.current, b.current]) if (v) v.currentTime = before.onset + ms / 1000;
    setT(ms);
  };
  useEffect(() => {
    for (const v of [a.current, b.current]) if (v) v.playbackRate = rate;
  }, [rate]);
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const tick = () => {
      const v = a.current, w = b.current;
      if (v && w) {
        let ms = (v.currentTime - before.onset) * 1000;
        if (ms > end) { v.currentTime = 0; ms = start; }
        if (Math.abs(w.currentTime - v.currentTime) > 0.05) w.currentTime = v.currentTime;
        setT(ms);
      }
      id = requestAnimationFrame(tick);
    };
    for (const v of [a.current, b.current]) v?.play().catch(() => setPlaying(false));
    id = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(id); for (const v of [a.current, b.current]) v?.pause(); };
  }, [playing, before.onset, start]);
  return (
    <div className="card t-replay">
      <p className="t-p" style={{ marginTop: 0 }}>
        <code>{pair.id}</code> {pair.desc}, expecting {before.expect}. The same step on {before.commit ? <a href={`${REPO}/commit/${before.commit}`}><code>{before.commit}</code></a> : before.run}, before the fix in <a href={`${REPO}/pull/116`}>PR #116</a> for <a href={`${REPO}/issues/115`}>#115</a>, and on {after.commit ? <a href={`${REPO}/commit/${after.commit}`}><code>{after.commit}</code></a> : after.run}, with it.
      </p>
      <div className="t-pair">
        {([["Before", before, a], ["After", after, b]] as const).map(([k, s, ref]) => {
          const r = at(s.rows, t);
          return (
            <figure key={k} className="t-fig">
              <div className="t-screen" style={{ aspectRatio: `${s.box[0]} / ${s.box[1]}` }}>
                <video ref={ref} src={s.film} poster={s.film.replace(/\.mp4$/, ".jpg")} muted playsInline preload="auto"
                  onLoadedMetadata={(e) => { e.currentTarget.currentTime = s.onset + t / 1000; e.currentTarget.playbackRate = rate; }} />
                <svg viewBox={`0 0 ${s.box[0]} ${s.box[1]}`} aria-hidden>
                  {r?.rects.map(([slot, x, y, w, h]) => (
                    <rect key={slot} x={x} y={y} width={w} height={h} rx={w / 2} data-flash={r.flash || undefined} />
                  ))}
                </svg>
              </div>
              <figcaption>
                <span className="t-badge" data-s={s.status}>{k}: {s.status}</span>
                <span className="t-place" data-flash={r?.flash || undefined}>{placeText(r)}{r?.flash ? ", flash" : ""}</span>
              </figcaption>
              <Ticks rows={s.rows} start={start} end={end} t={t} />
            </figure>
          );
        })}
      </div>
      <div className="t-ctl">
        <button className="pill pill-sm" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        <input type="range" min={start} max={end} step={4} value={Math.round(t)} onChange={(e) => { setPlaying(false); seek(+e.target.value); }} aria-label="Time from the unfold" />
        <span className="t-num">{t >= 0 ? "+" : ""}{Math.round(t)}ms</span>
        <button className="pill pill-sm" onClick={() => setRate(rate === 1 ? 0.25 : 1)}>{rate === 1 ? "1×" : "¼×"}</button>
      </div>
      <p className="t-p">
        Time is from the moment the window size changed. Each tick is one sample: green where the controls sat where the judge expected, red where they did not, grey while the closed screen showed or the controls were hidden. The first render after the change may keep the old place (150ms grace). Before the fix, the strip stayed on the left 98ms past that, on an open screen that has no strip:
      </p>
      <code className="t-why">{before.reasons[0]}</code>
      <p className="t-p">
        The simulator blanks its screen while it unfolds, so the flash is not in the film; the drawn boxes are the samples. On a phone it showed as controls jumping across the screen, which is how it was found.
      </p>
    </div>
  );
}

function Ticks({ rows, start, end, t }: { rows: Row[]; start: number; end: number; t: number }) {
  const x = (ms: number) => `${((ms - start) / (end - start)) * 100}%`;
  return (
    <div className="t-ticks" aria-hidden>
      {rows.map((r, i) => (
        <i key={i} style={{ left: x(r.t) }} data-s={r.flash ? "FAIL" : r.screen === "open" && r.rects.length ? "PASS" : "none"} />
      ))}
      <b style={{ left: x(t) }} />
    </div>
  );
}

/* -- Edge cases --------------------------------------------------------------------------------------------------- */

/** README prose: `code`, **bold** and #N issue links. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`|\*\*[^*]+\*\*|#\d+)/g).map((p, i) =>
        p.startsWith("`") ? <code key={i}>{p.slice(1, -1)}</code>
          : p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b>
            : /^#\d+$/.test(p) ? <a key={i} href={`${REPO}/issues/${p.slice(1)}`}>{p}</a>
              : <Fragment key={i}>{p}</Fragment>)}
    </>
  );
}

function EdgeBody({ e }: { e: Edge }) {
  return (
    <dl className="t-edge">
      <dt>You see</dt><dd><Rich text={e.see} /></dd>
      <dt>Cause</dt><dd><Rich text={e.cause} /></dd>
      <dt>Duet does</dt><dd><Rich text={e.does} /></dd>
      {e.you && <><dt>You do</dt><dd><Rich text={e.you} /></dd></>}
      {e.status && <><dt>Status</dt><dd><Rich text={e.status} /></dd></>}
    </dl>
  );
}

function Edges({ edges }: { edges: Edge[] }) {
  const filmed = edges.filter((e) => e.film), rest = edges.filter((e) => !e.film);
  return (
    <>
      <div className="t-edges">
        {filmed.map((e) => (
          <article key={e.title} className="tile t-edgecard">
            <video src={e.film} poster={e.film!.replace(/\.mp4$/, ".jpg")} muted loop autoPlay playsInline preload="none" />
            <h3 className="t-h4"><Rich text={e.title} /></h3>
            {e.step && <p className="t-cap">Film: step <code>{e.step}</code> of this run</p>}
            <EdgeBody e={e} />
          </article>
        ))}
      </div>
      <h3 className="t-h3">{rest.length} more, without a film</h3>
      <div className="t-more">
        {rest.map((e) => (
          <details key={e.title} className="card">
            <summary><Rich text={e.title} /></summary>
            <EdgeBody e={e} />
          </details>
        ))}
      </div>
      <p className="t-p">The full list, kept with the code: <a href={`${REPO}#edge-cases`}>README, Edge cases</a>.</p>
    </>
  );
}

/* -- How we keep it true ------------------------------------------------------------------------------------------ */

function Loop({ data }: { data: Summary }) {
  const { run, pair } = data;
  const steps: [string, ReactNode][] = [
    ["Found on a device", <>Unfolding a Duo with an in-app preview open, the controls jumped from the left edge to the right.</>],
    ["An issue", <><a href={`${REPO}/issues/115`}>#115</a> records what was seen, on which device and settings.</>],
    ["A journey that fails", <>Step <code>{pair.id}</code> reproduces it in the simulator and turns red: <i>{pair.before.reasons[0].split(" (")[0]}</i>.</>],
    ["A fix", <><a href={`${REPO}/pull/116`}>PR #116</a> watches every layout with a <code>ResizeObserver</code>, so Duet hides its controls on the first new size. The step turns green.</>],
    ["A README entry", <>The edge case is written up (You see, Cause, Duet does) so the next person meets it in the docs, not on a phone.</>],
    ["A release gate", <>The step stays in the matrix, which every release candidate runs before it ships.</>],
  ];
  return (
    <>
      <ol className="t-loop">
        {steps.map(([h, p], i) => <li key={h}><b>{i + 1}</b><div><h3 className="t-h4">{h}</h3><p className="t-p">{p}</p></div></li>)}
      </ol>
      <div className="tiles t-tiles">
        <div className="tile">
          <p className="tile-k">Confirm pass</p>
          <h3 className="tile-h">{run.confirm.rerun} steps re-run</h3>
          <p className="tile-p">After the matrix, every journey with a red step ({run.confirm.journeys} this run) runs again alone. A red that repeats alone at the same step is FAIL. Anything else is UNVERIFIED, not PASS, and a person writes down why: it may be load, the simulator, or a bug that only shows sometimes.</p>
        </div>
        <div className="tile">
          <p className="tile-k">The judge</p>
          <h3 className="tile-h">Checked against a broken build</h3>
          <p className="tile-p">A judge that never fails proves nothing. It was checked once against <code>packages/duet-ui/src</code> reverted to the previous commit: tab and fold turns went red. The contract asks for this on every run; that is not built yet.</p>
        </div>
        <div className="tile">
          <p className="tile-k">The model</p>
          <h3 className="tile-h">Geometry, proved</h3>
          <p className="tile-p">The placement maths (<code>detect()</code> and <code>plan()</code>) runs as <code>node --test</code> against real Duo geometry pinned in <code>packages/duet-ui/test/</code>, in CI on every pull request.</p>
        </div>
      </div>
      <h3 className="t-h3">The contract, and what runs today</h3>
      <p className="t-p">
        <a href={`${REPO}/blob/e2e-contract-110/tools/e2e/CONTRACT.md`}>CONTRACT.md</a> (<a href={`${REPO}/pull/111`}>PR #111</a>) fixes the scope so it can&apos;t shrink quietly: the gap map, signed off by a person, unknown until then; the invariant; one results page with a fixed denominator, where a page that fails to load counts as UNVERIFIED, not skipped.
      </p>
      <div className="t-table">
        <table>
          <thead><tr><th>Check</th><th>Contract</th><th>Today</th></tr></thead>
          <tbody>
            <tr><td>Model check</td><td>Every pull request</td><td>Every pull request (CI)</td></tr>
            <tr><td>Frame matrix</td><td>Every push to development</td><td>By hand on a Mac mini, sharded over 4 simulators; a second Mac is being set up</td></tr>
            <tr><td>Confirm pass</td><td>Every red</td><td>Every red</td></tr>
            <tr><td>Judge calibration</td><td>Every run, or UNVERIFIED</td><td>Checked once, by hand</td></tr>
            <tr><td>Real devices</td><td>Phone checklist per release</td><td>By hand; geometry pinned in unit fixtures</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

/* -- Test your own site ------------------------------------------------------------------------------------------- */

const CHECKLIST: [string, string][] = [
  ["Shared with You", "Open a link from Messages so the Shared with You bar shows. Simulator can't do this."],
  ["Unfold an in-app preview", "Open your site from another app's link preview, closed and turned, then unfold."],
  ["Preview with forward history", "In a preview, go back once so Forward is live, then turn."],
  ["Dialog through a turn", "Open your modal or dialog, then turn and fold with it open."],
  ["Keyboard", "Focus a text field, then turn and unfold with the keyboard up."],
  ["Live Activity", "Start a timer so a Live Activity takes the top band; repeat turns and folds."],
  ["Closed at 270°", "Turn the closed phone both ways; 90 and 270 put Safari's column on different edges."],
  ["Tab bar height", "Open screen with the tab bar at the bottom: check the bar height Duet clears."],
  ["Back and forward cache", "Leave the page and swipe back: the page restores from memory, not a load."],
  ["Full-screen overlay", "Open anything position: fixed over the whole page, then turn."],
];

function Yours({ data }: { data: Summary }) {
  return (
    <>
      <div className="tiles t-tiles">
        <div className="tile">
          <p className="tile-k">Cover</p>
          <h3 className="tile-h">The states</h3>
          <p className="tile-p">Safari tab and each way your site opens in a preview; closed and open; 0°, 90° and 270°; with and without a Live Activity. In each, the {data.transitions.length} transitions: {data.transitions.map((t) => t.label.toLowerCase()).join(", ")}.</p>
        </div>
        <div className="tile">
          <p className="tile-k">Film</p>
          <h3 className="tile-h">On a real phone</h3>
          <p className="tile-p">Control Center, Screen Recording, 5 to 15 seconds per transition. Step through it frame by frame: a 98ms flash is six frames. Look for controls on the wrong edge, Safari&apos;s buttons covered, controls missing for a frame, the page jumping.</p>
        </div>
        <div className="tile">
          <p className="tile-k">Run</p>
          <h3 className="tile-h">The harness</h3>
          <p className="tile-p">It drives a simulator and judges the page this repo serves. To judge yours, serve it with a reporter like <code>apps/site/app/e2e-reporter.tsx</code> and point the run at your page.</p>
        </div>
      </div>
      <h3 className="t-h3">Phone checklist</h3>
      <ol className="t-check">
        {CHECKLIST.map(([h, p]) => <li key={h}><b>{h}.</b> {p}</li>)}
      </ol>
      <h3 className="t-h3">Running tools/e2e</h3>
      <p className="t-p">
        Needs a Mac with <b>Xcode 27.1</b>, the <b>iOS 27.1 simulator runtime</b> and an <b>iPhone Duo simulator</b>, plus Node, pnpm and a Python venv with Pillow. Folding uses a private SpringBoard call, so it runs in the simulator only. Split view journeys drive the simulator through the Claude desktop app&apos;s simulator helper. <code>run.sh</code> serves the site on :3140 (it must answer <code>/?e2e=1</code>), a beacon on :3141 that collects the samples, and a host app with an XCUITest runner.
      </p>
      <pre className="card code">{[
        "# every journey, on the first Duo simulator it finds",
        "tools/e2e/run.sh",
        "# only some, or on a given simulator",
        "tools/e2e/run.sh --only tab,fold",
        "DUO_UDID=<udid> tools/e2e/run.sh",
        "# one catalogue journey against one page",
        "tools/e2e/run.sh --catalogue --only j07 --page /confirm",
        "# the full matrix, sharded over simulators, with the confirm pass",
        "DUO_SIMS=\"<udid> <udid>\" tools/e2e/matrix.sh --page /confirm",
      ].join("\n")}</pre>
      <p className="t-p">
        <a href={`${REPO}/tree/development/tools/e2e#readme`}>tools/e2e README</a> on development. <code>matrix.sh</code> and the journey catalogue are on <a href={`${REPO}/tree/rc/0.5.0-rc.1/tools/e2e`}>rc/0.5.0-rc.1</a> until it merges; the contract is on <a href={`${REPO}/blob/e2e-contract-110/tools/e2e/CONTRACT.md`}>e2e-contract-110</a>. Overlays in the report: red is Duet&apos;s slots, blue Safari&apos;s buttons, green the gap.
      </p>
    </>
  );
}
