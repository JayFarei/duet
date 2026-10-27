"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BODY, BODY_SHADE, CAMERA, CAMERA_PILL, FINISH, SCREEN, corners, type Corner } from "../duo/web-duo";

// The system journeys workbench: one card per placement (a window type on a screen, with 0-2 Live Activities and
// Safari's tab bar setting), drawn on the web Duo with the screenshot of the step that ended there, Duet's slots and
// Safari's own buttons outlined, its status, and its footage. Placements nothing has played yet are drawn as a grey
// sketch of what EXPECTED.md says should happen. Data: tools/e2e/workbench.py.

type Status = "PASS" | "FAIL" | "BLOCKED" | "untested";
type Box = { x: number; y: number; w: number; h: number };
type Expect = { preview?: boolean; mode?: "column" | "inline" | "strip"; side?: "left" | "right" | "both"; hidden?: boolean; gap?: boolean } | null;
type Obs = {
  id: string; journey: string; report: string; desc: string; status: Exclude<Status, "untested">; reasons: string[]; notes: string[];
  expect_en?: string | null; check?: Record<string, unknown> | null; env?: Record<string, unknown> | null; final?: Record<string, unknown> | null;
  slots: (Box & { slot: string })[]; native: (Box & { id?: string; label?: string })[]; settle_ms?: number | null;
  shot?: string | null; thumb?: string | null; overlay?: string | null; frames?: string | null; video?: string | null;
};
type Place = {
  id: string; window: string; screen: string; live: number; tabbar: "bottom" | "top" | null; expect: Expect; expect_en: string;
  untested: string | null; status: Status; obs: Obs[];
};
type Screen = { id: string; posture: "closed" | "open"; angle: number; label: string; w: number; h: number };
type Journey = { id: string; title: string; status: string; report: string; film: string | null; steps: number };
export type Data = {
  generated: string; reports: string[]; windows: { id: string; label: string; note: string | null }[]; screens: Screen[]; places: Place[];
  journeys: Record<string, Journey>; summary: { places: number; PASS: number; FAIL: number; BLOCKED: number; untested: number; stray: number };
};

const file = (p: string) => `/workbench/files/${p.split("/").map(encodeURIComponent).join("/")}`;
const LIVE = ["no Live Activity", "1 Live Activity", "2 Live Activities"];
const COLOR: Record<Status, string> = { PASS: "var(--wb-pass)", FAIL: "var(--wb-fail)", BLOCKED: "var(--wb-blocked)", untested: "var(--dim)" };
const CARD = 0.27;

// ---- the device ----------------------------------------------------------------------------------------------------
// Drawn in points like the web Duo, natural (unturned) hardware rotated into the screen's orientation, then zoomed.
// Screenshots and the harness's coordinates are in display orientation, so the screen's content is not rotated.
// screen.orientation 90 is the interface turned anticlockwise: the body turns -90deg, its camera ends up on the left.
function geometry(posture: Screen["posture"], angle: number) {
  const b = BODY[posture], n = SCREEN[posture], r = angle === 90 ? -90 : angle === 270 ? 90 : 0;
  const map = (x: number, y: number) => r === -90 ? [y, b.w - x] : r === 90 ? [b.h - y, x] : [x, y];
  const [x0, y0] = map(b.x, b.y), [x1, y1] = map(b.x + n.w, b.y + n.h);
  // Corners run top left, top right, bottom right, bottom left.
  const turn = (c: Corner[]) => r === -90 ? [c[1], c[2], c[3], c[0]] : r === 90 ? [c[3], c[0], c[1], c[2]] : c;
  return {
    b, r, w: r ? b.h : b.w, h: r ? b.w : b.h,
    screen: { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }, screenR: turn(b.screenR),
  };
}

function Device({ screen, zoom, island, children }: { screen: Screen; zoom: number; island?: number; children: ReactNode }) {
  const g = geometry(screen.posture, screen.angle), b = g.b;
  const natural: CSSProperties = { position: "absolute", left: (g.w - b.w) / 2, top: (g.h - b.h) / 2, width: b.w, height: b.h, transform: g.r ? `rotate(${g.r}deg)` : undefined };
  return (
    <div style={{ position: "relative", width: g.w, height: g.h, zoom, flex: "none" }}>
      <div style={natural}>
        <div data-wd-shape style={{ ...corners(b.r), position: "absolute", inset: 0, background: FINISH.front, boxShadow: BODY_SHADE }} />
      </div>
      <div data-wd-shape style={{ ...corners(g.screenR), position: "absolute", left: g.screen.x, top: g.screen.y, width: g.screen.w, height: g.screen.h, overflow: "hidden", background: "var(--bg)" }}>
        {children}
      </div>
      {island !== undefined && screen.posture === "closed" && <div style={natural}><Island live={island} /></div>}
    </div>
  );
}

/** The Dynamic Island in device coordinates (the web Duo's, at rest): the first Live Activity joins the camera's pill,
 *  the second is a bubble below it. Only on sketches: screenshots show the real one. */
function Island({ live }: { live: number }) {
  const w = CAMERA_PILL.width, left = BODY.closed.x + CAMERA.x - w / 2, top = BODY.closed.y + CAMERA.y - w / 2;
  const pill = live ? w + 36 : w;
  return (
    <>
      <div style={{ ...CAMERA_PILL, left, top, height: pill }} />
      {live > 1 && <div style={{ ...CAMERA_PILL, left, top: top + pill + 6, height: w }} />}
    </>
  );
}

/** What the harness saw: the screenshot, Duet's slots filled in the step's colour, Safari's own buttons dashed. */
function Seen({ o, screen, full }: { o: Obs; screen: Screen; full?: boolean }) {
  const src = full ? o.shot : o.thumb ?? o.shot;
  return (
    <>
      {src && <img src={file(src)} alt="" loading="lazy" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill" }} />}
      <svg viewBox={`0 0 ${screen.w} ${screen.h}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {o.native.map((n, i) => <rect key={`n${i}`} x={n.x} y={n.y} width={n.w} height={n.h} rx={Math.min(n.w, n.h) / 2} fill="none" stroke="#8e8e93" strokeWidth={3} strokeDasharray="8 6" />)}
        {o.slots.map((s, i) => <rect key={`s${i}`} x={s.x} y={s.y} width={s.w} height={s.h} rx={Math.min(s.w, s.h) / 2} fill={COLOR[o.status]} fillOpacity={0.3} stroke={COLOR[o.status]} strokeWidth={4} />)}
      </svg>
    </>
  );
}

/** A sketch of what should happen where nothing has played yet: the window, and Duet's controls where EXPECTED.md puts them. */
function Sketch({ place, screen }: { place: Place; screen: Screen }) {
  const { w, h } = screen, e = place.expect;
  const win: Box = place.window === "sheet" ? { x: 10, y: 50, w: w - 20, h: h - 50 }
    : place.window === "split" ? { x: w / 2 + 3, y: 0, w: w / 2 - 3, h }
    : place.window === "window" ? { x: (w - 451) / 2, y: 2, w: 451, h: Math.min(666, h - 4) }
    : { x: 0, y: 0, w, h };
  const STRIP = 84, R = 22;
  const strip = (x: number) => (
    <g key={x}>
      <rect x={x} y={win.y} width={STRIP} height={win.h} fill="var(--line)" />
      {[0.3, 0.45, 0.6].map((f) => <circle key={f} cx={x + STRIP / 2} cy={win.y + win.h * f} r={R} fill="var(--dim)" opacity={0.5} />)}
    </g>
  );
  const sides = !e || e.hidden || e.mode === "inline" ? [] : e.side === "both" ? ["left", "right"] : [e.side];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.75 }}>
      <rect x={win.x} y={win.y} width={win.w} height={win.h} rx={place.window === "sheet" || place.window === "window" ? 30 : 0} fill="var(--card)" />
      {sides.map((s) => strip(s === "left" ? win.x : win.x + win.w - STRIP))}
      {e?.mode === "inline" && [-60, 0, 60].map((dx) => <circle key={dx} cx={win.x + win.w / 2 + dx} cy={win.y + 44} r={R} fill="var(--dim)" opacity={0.5} />)}
      {!e && <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={120} fill="var(--dim)">?</text>}
    </svg>
  );
}

function Chip({ status, small }: { status: Status; small?: boolean }) {
  return <span className="wb-chip" style={{ "--c": COLOR[status], fontSize: small ? 11 : 12 } as CSSProperties}>{status === "untested" ? "untested" : status.toLowerCase()}</span>;
}

const placeName = (p: Place, windows: Data["windows"], screens: Record<string, Screen>) =>
  [windows.find((w) => w.id === p.window)?.label, screens[p.screen].label, LIVE[p.live], p.tabbar && `tab bar at the ${p.tabbar}`].filter(Boolean).join(" · ");

// ---- the page ------------------------------------------------------------------------------------------------------
export function Workbench({ data }: { data: Data }) {
  const screens = Object.fromEntries(data.screens.map((s) => [s.id, s]));
  const [tabbar, setTabbar] = useState<"bottom" | "top">("bottom");
  const [show, setShow] = useState<"all" | Status>("all");
  const [open, setOpen] = useState<string | null>(null);
  // The open placement lives in the URL hash, so a card can be linked to.
  useEffect(() => {
    const read = () => setOpen(decodeURIComponent(location.hash.slice(1)) || null);
    read();
    addEventListener("hashchange", read);
    return () => removeEventListener("hashchange", read);
  }, []);
  const pick = (id: string | null) => {
    history.replaceState(null, "", id ? `#${encodeURIComponent(id)}` : location.pathname + location.search);
    setOpen(id);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") pick(null); };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  const current = data.places.find((p) => p.id === open);
  const visible = (p: Place) => (!p.tabbar || p.tabbar === tabbar) && (show === "all" || p.status === show);
  const s = data.summary;

  return (
    <main className="wb">
      <style>{CSS}</style>
      <header className="wb-head">
        <h1>Workbench</h1>
        <p className="wb-lede">
          Every placement a Safari window can land in on the iPhone Duo, and what the system journeys saw there. Each step a journey or
          suite plays ends in one placement, and is judged against Duet&apos;s invariants: where its controls go, that they are painted,
          that they clear Safari&apos;s own buttons. Grey placements have not been played yet.
        </p>
        <div className="wb-bar">
          <div className="wb-seg" role="group" aria-label="Status">
            {(["all", "FAIL", "PASS", "BLOCKED", "untested"] as const).map((k) => (
              <button key={k} aria-pressed={show === k} onClick={() => setShow(k)}>
                {k === "all" ? `All ${s.places}` : `${k === "untested" ? "Untested" : k[0] + k.slice(1).toLowerCase()} ${s[k]}`}
              </button>
            ))}
          </div>
          <div className="wb-seg" role="group" aria-label="Safari's tab bar">
            {(["bottom", "top"] as const).map((k) => <button key={k} aria-pressed={tabbar === k} onClick={() => setTabbar(k)}>Tab bar {k}</button>)}
          </div>
        </div>
        <p className="wb-meta">
          Built {data.generated} from {data.reports.map((r, i) => <span key={r}>{i ? ", " : ""}<a href={file(`${r}/index.html`)} target="_blank" rel="noreferrer">{r}</a></span>)}
          {s.stray ? `, ${s.stray} steps not placed` : ""}. Rebuild with <code>python3 -I tools/e2e/workbench.py</code>.
        </p>
      </header>

      {data.windows.map((w) => {
        const rows = data.screens.map((sc) => [sc, data.places.filter((p) => p.window === w.id && p.screen === sc.id && visible(p))] as const).filter(([, ps]) => ps.length);
        if (!rows.length) return null;
        const all = data.places.filter((p) => p.window === w.id && (!p.tabbar || p.tabbar === tabbar));
        const n = (st: Status) => all.filter((p) => p.status === st).length;
        return (
          <section key={w.id} className="wb-section">
            <h2>{w.label} <span className="wb-count">{n("PASS")} pass · {n("FAIL")} fail · {n("untested")} untested</span></h2>
            {w.note && <p className="wb-note">{w.note}</p>}
            {rows.map(([sc, ps]) => (
              <div key={sc.id} className="wb-row">
                <h3>{sc.label}</h3>
                <div className="wb-cards">
                  {ps.map((p) => <Card key={p.id} place={p} screen={sc} onOpen={() => pick(p.id)} />)}
                </div>
              </div>
            ))}
          </section>
        );
      })}

      {current && <Detail key={current.id} place={current} screen={screens[current.screen]} data={data} screens={screens} onClose={() => pick(null)} />}
    </main>
  );
}

function Card({ place, screen, onOpen }: { place: Place; screen: Screen; onOpen: () => void }) {
  const o = place.obs[0];
  const filmed = place.obs.some((x) => x.video);
  return (
    <button className="wb-card" onClick={onOpen} style={{ "--c": COLOR[place.status] } as CSSProperties} title={place.id}>
      <Device screen={screen} zoom={CARD} island={o ? undefined : place.live}>
        {o ? <Seen o={o} screen={screen} /> : <Sketch place={place} screen={screen} />}
      </Device>
      <span className="wb-card-name">{LIVE[place.live]}{place.tabbar ? `, tab bar ${place.tabbar}` : ""}</span>
      <span className="wb-card-foot">
        <Chip status={place.status} small />
        {place.obs.length > 0 && <span className="wb-dim">{place.obs.length} step{place.obs.length > 1 ? "s" : ""}</span>}
        <span className={filmed ? "wb-film" : "wb-dim"} title={filmed ? "filmed" : "no footage yet"}>{filmed ? "▶ film" : "no film"}</span>
      </span>
    </button>
  );
}

/** The panel's width, for fitting the device in it. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function Detail({ place, screen, data, screens, onClose }: { place: Place; screen: Screen; data: Data; screens: Record<string, Screen>; onClose: () => void }) {
  const [at, setAt] = useState(0);
  const [ref, width] = useWidth();
  const o = place.obs[at];
  const g = geometry(screen.posture, screen.angle);
  const zoom = width ? Math.min(width / g.w, 460 / g.h, 0.8) : 0;
  const journey = o && data.journeys[o.journey];
  return (
    <>
      <div className="wb-scrim" onClick={onClose} />
      <aside className="wb-detail" aria-label={place.id}>
        <div className="wb-detail-head">
          <div>
            <Chip status={place.status} />
            <h2>{placeName(place, data.windows, screens)}</h2>
            <code className="wb-dim">{place.id}</code>
          </div>
          <button className="wb-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div ref={ref} className="wb-stage">
          {zoom > 0 && (
            <Device screen={screen} zoom={zoom} island={o ? undefined : place.live}>
              {o ? <Seen o={o} screen={screen} full /> : <Sketch place={place} screen={screen} />}
            </Device>
          )}
        </div>

        {o?.video ? (
          <video key={o.video} className="wb-video" src={file(o.video)} controls muted playsInline autoPlay loop />
        ) : o ? (
          <p className="wb-dim wb-small">No footage for this step yet: the next matrix run films every step.</p>
        ) : null}

        <dl className="wb-facts">
          <dt>Expected</dt><dd>{place.expect_en}</dd>
          {place.untested && !place.obs.length && <><dt>Not played</dt><dd>{place.untested}</dd></>}
        </dl>

        {place.obs.length > 0 && (
          <>
            <h3 className="wb-h3">Steps that ended here</h3>
            <ol className="wb-obs">
              {place.obs.map((x, i) => (
                <li key={`${x.report}/${x.id}`}>
                  <button aria-pressed={i === at} onClick={() => setAt(i)}>
                    <Chip status={x.status} small /> <b>{x.id}</b> {x.desc}{x.video ? " ▶" : ""}
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}

        {o && (
          <div className="wb-step">
            {journey && <p><b>{journey.id}</b>: {journey.title} <Chip status={journey.status as Status} small /></p>}
            {o.reasons.length > 0 && <ul className="wb-reasons">{o.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
            <dl className="wb-facts">
              {o.expect_en && <><dt>Checked</dt><dd>{o.expect_en}</dd></>}
              {o.final && <><dt>Duet saw</dt><dd>{finalEn(o.final)}</dd></>}
              {o.settle_ms != null && <><dt>Settled</dt><dd>{o.settle_ms} ms after the final signals</dd></>}
              {o.env && <><dt>Settings</dt><dd><code>{JSON.stringify(o.env)}</code></dd></>}
              {o.notes.length > 0 && <><dt>Notes</dt><dd>{o.notes.join("; ")}</dd></>}
            </dl>
            <p className="wb-links">
              {o.shot && <a href={file(o.shot)} target="_blank" rel="noreferrer">Screenshot</a>}
              {o.overlay && <a href={file(o.overlay)} target="_blank" rel="noreferrer">Overlay</a>}
              {o.frames && <a href={file(o.frames)} target="_blank" rel="noreferrer">Contact sheet</a>}
              {o.video && <a href={file(o.video)} target="_blank" rel="noreferrer">Step video</a>}
              {journey?.film && <a href={file(journey.film)} target="_blank" rel="noreferrer">Journey film</a>}
              <a href={file(`${o.report}/index.html`)} target="_blank" rel="noreferrer">Report</a>
            </p>
            <p className="wb-small wb-dim">Replay</p>
            <pre className="wb-cmd">tools/e2e/run.sh --catalogue --only {o.journey}</pre>
          </div>
        )}
      </aside>
    </>
  );
}

function finalEn(f: Record<string, unknown>) {
  if (f.hidden) return `controls hidden${f.reason ? ` (${f.reason})` : ""}`;
  const parts = [f.mode && `${f.mode}${f.side ? ` on the ${f.side}` : ""}`, f.preview && "in-app preview", f.inner && `page ${f.inner}`, f.outer && `window ${f.outer}`];
  return parts.filter(Boolean).join(", ");
}

const CSS = `
.wb { --wb-pass: #248a3d; --wb-fail: #d70015; --wb-blocked: #c93400; min-height: 100vh; background: var(--bg); color: var(--ink); padding: 40px 16px 80px; max-width: 1400px; margin: 0 auto; }
@media (prefers-color-scheme: dark) { :root:not([data-lg-theme="light"]) .wb { --wb-pass: #30d158; --wb-fail: #ff453a; --wb-blocked: #ff9f0a; } }
:root[data-lg-theme="dark"] .wb { --wb-pass: #30d158; --wb-fail: #ff453a; --wb-blocked: #ff9f0a; }
.wb h1 { font-family: var(--serif); font-weight: 400; font-size: 48px; margin: 0; letter-spacing: -0.01em; }
.wb-lede { max-width: 760px; color: var(--dim); line-height: 1.5; margin: 8px 0 20px; }
.wb-bar { display: flex; flex-wrap: wrap; gap: 10px; }
.wb-seg { display: inline-flex; flex-wrap: wrap; background: var(--card); border-radius: 10px; padding: 3px; box-shadow: 0 0 0 0.5px var(--line); }
.wb-seg button { border: 0; background: none; color: var(--ink); font: inherit; font-size: 13px; padding: 6px 11px; border-radius: 8px; cursor: pointer; }
.wb-seg button[aria-pressed="true"] { background: var(--ink); color: var(--bg); }
.wb-meta { color: var(--dim); font-size: 12px; margin: 12px 0 0; }
.wb-meta a, .wb-links a { color: var(--cta); }
.wb code { font-size: 0.92em; }
.wb-section { margin-top: 44px; }
.wb-section h2 { font-size: 22px; font-weight: 600; margin: 0 0 4px; }
.wb-count { font-size: 13px; font-weight: 400; color: var(--dim); margin-left: 8px; }
.wb-note { color: var(--dim); font-size: 13px; margin: 0 0 8px; }
.wb-row { margin-top: 16px; }
.wb-row h3 { font-size: 13px; font-weight: 500; color: var(--dim); margin: 0 0 8px; }
.wb-cards { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
.wb-card { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 12px 10px; border: 0; border-radius: 16px; background: var(--card); color: inherit; font: inherit; cursor: pointer; box-shadow: 0 0 0 0.5px var(--line), inset 0 3px 0 var(--c); text-align: center; }
.wb-card:hover { box-shadow: 0 0 0 1.5px var(--c), inset 0 3px 0 var(--c); }
.wb-card-name { font-size: 12px; }
.wb-card-foot { display: flex; gap: 8px; align-items: center; font-size: 11px; }
.wb-chip { display: inline-block; padding: 1px 7px; border-radius: 99px; font-weight: 600; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); text-transform: uppercase; letter-spacing: 0.03em; }
.wb-dim { color: var(--dim); }
.wb-film { color: var(--cta); font-weight: 600; }
.wb-small { font-size: 12px; }
.wb-scrim { position: fixed; inset: 0; background: rgb(0 0 0 / 0.3); z-index: 10; }
.wb-detail { position: fixed; top: 0; right: 0; bottom: 0; width: min(620px, 100vw); overflow-y: auto; background: var(--bg); z-index: 11; padding: 20px 16px 40px; box-shadow: -10px 0 40px rgb(0 0 0 / 0.2); }
.wb-detail-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.wb-detail-head h2 { font-size: 17px; font-weight: 600; margin: 6px 0 2px; }
.wb-close { border: 0; background: var(--card); color: var(--ink); width: 32px; height: 32px; border-radius: 99px; font-size: 20px; line-height: 1; cursor: pointer; flex: none; }
.wb-stage { display: flex; justify-content: center; margin: 16px 0; }
.wb-video { width: 100%; max-height: 420px; background: #000; border-radius: 12px; }
.wb-facts { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; font-size: 13px; margin: 12px 0; }
.wb-facts dt { color: var(--dim); }
.wb-facts dd { margin: 0; overflow-wrap: anywhere; }
.wb-h3 { font-size: 14px; margin: 20px 0 6px; }
.wb-obs { list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; }
.wb-obs button { width: 100%; text-align: left; border: 0; background: var(--card); color: inherit; font: inherit; font-size: 13px; padding: 8px 10px; border-radius: 10px; cursor: pointer; }
.wb-obs button[aria-pressed="true"] { box-shadow: 0 0 0 1.5px var(--ink); }
.wb-step { margin-top: 14px; font-size: 13px; }
.wb-reasons { color: var(--wb-fail); padding-left: 18px; margin: 6px 0; }
.wb-links { display: flex; flex-wrap: wrap; gap: 12px; }
.wb-cmd { background: var(--code); padding: 10px 12px; border-radius: 10px; overflow-x: auto; font-size: 12px; margin: 4px 0 0; }
`;
