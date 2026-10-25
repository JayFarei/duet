import { memo, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { bleed } from "duet-ui";
import { Search, Star } from "lucide-react";
import { LINES, STATIONS, WORLD, YOU, clock, departures, linesAt, station, type Line } from "./data";
import { LineBadge } from "./LineBadge";

interface View { x: number; y: number; s: number }
interface Frame { left: number; top: number; width: number; height: number }
export type Layer = "transit" | "explore";

const RIVER = "M -1000 700 C -500 690, -150 660, 150 560 C 260 540, 330 560, 420 595 S 640 650, 770 590 S 1000 520, 1260 565 S 1700 620, 2200 600";
const clampS = (s: number) => Math.min(3, Math.max(0.3, s));

export function MapView(p: {
  selected: string | null; focusLine: string | null; layer: Layer; locate: number; toast: string | null;
  saved: string[]; onStation: (id: string) => void; onToggleSave: (id: string) => void; onSearch: () => void;
}) {
  const root = useRef<HTMLDivElement>(null), frameEl = useRef<HTMLDivElement>(null), card = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [view, setViewRaw] = useState<View | null>(null);
  const frameRef = useRef<Frame | null>(null);
  frameRef.current = frame;
  // Keep the city under the frame's centre, so a fling never loses the map.
  const setView = (next: View | null | ((v: View | null) => View | null)) => setViewRaw((v) => {
    const n = typeof next === "function" ? next(v) : next, f = frameRef.current;
    if (!n || !f) return n;
    const cx = f.left + f.width / 2, cy = f.top + f.height / 2, m = 60;
    const wx = Math.min(WORLD.width + m, Math.max(-m, (cx - n.x) / n.s)), wy = Math.min(WORLD.height + m, Math.max(-m, (cy - n.y) / n.s));
    return { s: n.s, x: cx - wx * n.s, y: cy - wy * n.s };
  });
  const [animate, setAnimate] = useState(false);
  const wide = !!frame && frame.width >= 600;

  // The frame is the part of the map not covered by the strip or the system bars (an invisible box inset by
  // Duet's CSS vars); the map itself runs edge to edge under the glass.
  useLayoutEffect(() => {
    const measure = () => {
      const r = frameEl.current!.getBoundingClientRect(), o = root.current!.getBoundingClientRect();
      setFrame({ left: r.left - o.left, top: r.top - o.top, width: r.width, height: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frameEl.current!); ro.observe(root.current!);
    return () => ro.disconnect();
  }, []);

  // Put a world point at a fraction of the visible frame, leaving room for the station card.
  const centerOn = (wx: number, wy: number, s: number, f: Frame, cardOpen: boolean) => {
    const cardW = cardOpen && wide ? 360 : 0, cardH = cardOpen && !wide ? (card.current?.offsetHeight ?? f.height * 0.45) : 0;
    const cx = f.left + cardW + (f.width - cardW) / 2, cy = f.top + 64 + (f.height - 64 - cardH) / 2;
    return { s, x: cx - wx * s, y: cy - wy * s };
  };
  useEffect(() => {
    if (!frame || view) return;
    const s = clampS(Math.min(frame.width / WORLD.width, frame.height / WORLD.height) * 1.7);
    setView(centerOn(WORLD.width / 2 - 20, WORLD.height / 2 - 20, s, frame, false));
  }, [frame]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!frame || !view || !p.locate) return;
    setAnimate(true);
    setView(centerOn(YOU.x, YOU.y, Math.max(view.s, 1), frame, !!p.selected));
  }, [p.locate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!frame || !view || !p.selected) return;
    const st = station(p.selected);
    // Wait a frame so the card has its height.
    requestAnimationFrame(() => { setAnimate(true); setView(centerOn(st.x, st.y, Math.max(view.s, 0.9), frame, true)); });
  }, [p.selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pan with one pointer, pinch with two, wheel to zoom. A press that barely moves is a tap on a station.
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; tap: string | null; start: View; d0: number; m0: { x: number; y: number } } | null>(null);
  const local = (e: { clientX: number; clientY: number }) => {
    const o = root.current!.getBoundingClientRect();
    return { x: e.clientX - o.left, y: e.clientY - o.top };
  };
  const snapshot = () => {
    const pts = [...ptrs.current.values()];
    const m = pts.length > 1 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0];
    const d = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 1;
    return { m, d };
  };
  const restart = (tap: string | null) => {
    const { m, d } = snapshot();
    gesture.current = { moved: gesture.current?.moved ?? 0, tap, start: view!, d0: d, m0: m };
  };
  const down = (e: RPointerEvent) => {
    if (!view || (e.target as Element).closest(".overlay")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setAnimate(false);
    ptrs.current.set(e.pointerId, local(e));
    const tap = ptrs.current.size === 1 ? (e.target as Element).closest("[data-station]")?.getAttribute("data-station") ?? null : null;
    if (ptrs.current.size === 1) gesture.current = null;
    restart(tap);
  };
  const move = (e: RPointerEvent) => {
    const g = gesture.current;
    if (!g || !ptrs.current.has(e.pointerId)) return;
    const prev = ptrs.current.get(e.pointerId)!, now = local(e);
    g.moved += Math.hypot(now.x - prev.x, now.y - prev.y);
    ptrs.current.set(e.pointerId, now);
    const { m, d } = snapshot(), k = clampS(g.start.s * (d / g.d0)) / g.start.s;
    setView({ s: g.start.s * k, x: m.x - (g.m0.x - g.start.x) * k, y: m.y - (g.m0.y - g.start.y) * k });
  };
  const up = (e: RPointerEvent) => {
    if (!ptrs.current.delete(e.pointerId)) return;
    const g = gesture.current;
    if (ptrs.current.size) return restart(null);
    if (g && g.moved < 8 && g.tap) p.onStation(g.tap);
    gesture.current = null;
  };
  useEffect(() => {
    const el = root.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      setAnimate(false);
      setView((v) => {
        if (!v) return v;
        const o = el.getBoundingClientRect(), mx = e.clientX - o.left, my = e.clientY - o.top;
        const s = clampS(v.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002))), k = s / v.s;
        return { s, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k };
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  const sel = p.selected ? station(p.selected) : null;
  return (
    <div ref={root} className="map" style={bleed(false)} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <svg className="map-svg" aria-label="Transit map" role="img">
        {view && (
          <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transition: animate ? "transform 0.55s cubic-bezier(0.32, 0.72, 0, 1)" : "none" }}>
            <World s={view.s} layer={p.layer} focusLine={p.focusLine} selected={p.selected} />
          </g>
        )}
      </svg>
      <div ref={frameEl} className="frame" aria-hidden />

      <button className="overlay searchbar" onClick={p.onSearch}><Search size={17} strokeWidth={2.2} /><span>Search stations</span></button>
      {p.toast && <div className="overlay toast" key={p.toast}>{p.toast}</div>}
      {!sel && <div className="attribution">Meridian Transit · Illustrative map</div>}
      {sel && <StationCard ref={card} id={sel.id} wide={wide} saved={p.saved.includes(sel.id)} onToggleSave={() => p.onToggleSave(sel.id)} />}
    </div>
  );
}

function StationCard({ id, wide, saved, onToggleSave, ref }: { id: string; wide: boolean; saved: boolean; onToggleSave: () => void; ref: React.Ref<HTMLDivElement> }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 20000); return () => clearInterval(t); }, []);
  const st = station(id), walk = Math.max(1, Math.round(Math.hypot(st.x - YOU.x, st.y - YOU.y) / 22));
  return (
    <section ref={ref} className={`overlay card ${wide ? "wide" : "sheet"}`} aria-label={`${st.name} departures`}>
      {!wide && <div className="grabber" />}
      <header className="card-head">
        <div>
          <h2>{st.name}</h2>
          <p className="sub">{linesAt(id).map((l) => <LineBadge key={l.id} line={l} size={18} />)}<span>{walk} min walk</span></p>
        </div>
        <button className={`save${saved ? " on" : ""}`} onClick={onToggleSave} aria-pressed={saved} aria-label={saved ? "Remove from Saved" : "Save station"}>
          <Star size={19} strokeWidth={2.2} fill={saved ? "currentColor" : "none"} />
        </button>
      </header>
      <ul className="deps">
        {departures(id, now).map((d) => (
          <li key={d.line.id + d.to}>
            <LineBadge line={d.line} />
            <div className="dep-to"><strong>{d.to}</strong><span>{d.line.alert ? d.line.status : clock(d.mins[0], now)}</span></div>
            <div className="dep-mins">
              <strong>{d.mins[0] === 0 ? "Now" : `${d.mins[0]} min`}</strong>
              <span>then {d.mins.slice(1).join(", ")} min</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const pathOf = (l: Line) => {
  const pts = l.stations.map(station);
  return "M" + pts.map((q) => `${q.x} ${q.y}`).join(" L") + (l.loop ? " Z" : "");
};

// The city, in world units. Strokes and labels are divided by the scale so they keep a steady size on screen.
const World = memo(function World({ s, layer, focusLine, selected }: { s: number; layer: Layer; focusLine: string | null; selected: string | null }) {
  const px = (n: number) => n / s;
  const lineW = px(3 + 2 * Math.min(s, 2));
  const explore = layer === "explore";
  const minor: string[] = [];
  // The street grid runs well past the city, so panning to the edge never shows where the drawing stops.
  for (let y = 40 - 66 * 12; y < WORLD.height + 800; y += 66) minor.push(`M-1000 ${y}H${WORLD.width + 1000}`);
  for (let x = 30 - 74 * 12; x < WORLD.width + 900; x += 74) minor.push(`M${x} -1000V${WORLD.height + 1000}`);
  const major = ["M-1000 385H2200", "M478 -1000V2000", "M-600 1310 L1800 -260", "M-1000 150 C -300 140, 300 160, 700 100 S 1240 220, 2200 260", "M870 -1000 C 860 -300, 840 300, 900 700 S 780 1400, 760 2000"];
  return (
    <>
      <rect className="land" x={-2000} y={-2000} width={5200} height={5000} />
      <path className="park" d="M640 70 Q 645 52 665 52 H 905 Q 925 52 925 72 V 185 Q 925 205 905 205 H 665 Q 640 205 640 185 Z" />
      <path className="park" d="M90 660 Q 210 640 330 668 L 345 760 Q 220 790 95 770 Z" />
      <rect className="park" x={600} y={490} width={92} height={70} rx={10} />
      <path className="street" d={minor.join("")} strokeWidth={px(explore ? 2.2 : 1.6)} />
      <path className="river" d={RIVER} strokeWidth={58} />
      <path className="road-case" d={major.join("")} strokeWidth={px(explore ? 7 : 5.5)} />
      <path className="road" d={major.join("")} strokeWidth={px(explore ? 5 : 3.8)} />
      <defs><path id="river-label" d="M 140 590 C 260 565, 340 570, 420 597" /></defs>
      <text className="water-label" fontSize={px(11)}><textPath href="#river-label">Meri River</textPath></text>
      {[["NORTHFIELD", 330, 150], ["OLD TOWN", 360, 480], ["DOCKLANDS", 860, 680], ["SOUTHBANK", 300, 900], ["LINDEN PARK", 782, 135]].map(([t, x, y]) => (
        <text key={t} className={t === "LINDEN PARK" ? "park-label" : "district"} x={x} y={y} fontSize={px(t === "LINDEN PARK" ? 10 : 11)} letterSpacing={px(1.6)} textAnchor="middle">{t}</text>
      ))}
      {explore && [["Broad Street", 180, 385], ["King Avenue", 478, 120], ["Harbour Way", 1000, 270]].map(([t, x, y]) => (
        <text key={t} className="street-label" x={x} y={Number(y) - px(6)} fontSize={px(10)} textAnchor="middle">{t}</text>
      ))}

      <g className="lines" style={{ opacity: explore ? 0.45 : 1 }}>
        {LINES.map((l) => <path key={l.id + "c"} d={pathOf(l)} className="line-case" strokeWidth={lineW + px(3)} />)}
        {LINES.map((l) => (
          <path key={l.id} d={pathOf(l)} stroke={l.color} strokeWidth={lineW} className="line" style={{ opacity: focusLine && focusLine !== l.id ? 0.18 : 1 }} />
        ))}
      </g>
      {STATIONS.map((st) => {
        const ls = linesAt(st.id), hub = ls.length > 1, on = st.id === selected;
        const dim = !!focusLine && !ls.some((l) => l.id === focusLine);
        const r = px(hub ? 5.5 : 4) + lineW * 0.15;
        const [dx, dy, anchor] = {
          right: [r + px(5), px(4), "start"], left: [-r - px(5), px(4), "end"], above: [0, -r - px(5), "middle"], below: [0, r + px(13), "middle"],
          aboveLeft: [-r - px(2), -r - px(3), "end"], aboveRight: [r + px(2), -r - px(3), "start"], belowLeft: [-r - px(2), r + px(12), "end"], belowRight: [r + px(2), r + px(12), "start"],
        }[st.label ?? "right"] as [number, number, "start" | "end" | "middle"];
        const showLabel = !dim && (hub || s > 0.55 || on);
        return (
          <g key={st.id} data-station={st.id} className="station" style={{ opacity: dim ? 0.3 : 1 }}>
            <circle cx={st.x} cy={st.y} r={px(20)} fill="transparent" />
            {on && <circle cx={st.x} cy={st.y} r={r + px(7)} className="station-ring" />}
            <circle cx={st.x} cy={st.y} r={r} className="station-dot" stroke={hub ? undefined : ls[0].color} strokeWidth={px(hub ? 2.4 : 2.6)} />
            {showLabel && <text x={st.x + dx} y={st.y + dy} fontSize={px(hub ? 12 : 11)} textAnchor={anchor} className={`station-label${hub ? " hub" : ""}`}>{st.name}</text>}
          </g>
        );
      })}
      <circle cx={YOU.x} cy={YOU.y} r={px(22)} className="you-halo" />
      <circle cx={YOU.x} cy={YOU.y} r={px(7)} className="you" strokeWidth={px(3)} />
    </>
  );
});
