import { useEffect, useState } from "react";
import { Duet, type DuetItem, type DuetTab } from "duet-ui";
import { ChevronRight, CircleCheck, Layers, LocateFixed, Map as MapIcon, Search, Star, TrainFront, TriangleAlert } from "lucide-react";
import { LINES, STATIONS, alerts, departures, linesAt, station } from "./data";
import { LineBadge } from "./LineBadge";
import { MapView, type Layer } from "./MapView";

type Tab = "map" | "lines" | "saved" | "search";
const ACCENT = "var(--accent)"; // the one UI accent, resolved per theme in styles.css

function useSaved() {
  const [saved, setSaved] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("meridian-saved") ?? "null") ?? ["central", "observatory"]; } catch { return ["central", "observatory"]; }
  });
  useEffect(() => { try { localStorage.setItem("meridian-saved", JSON.stringify(saved)); } catch {} }, [saved]);
  const toggle = (id: string) => setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return [saved, toggle] as const;
}

export function App() {
  const [tab, setTab] = useState<Tab>("map");
  const [selected, setSelected] = useState<string | null>(null);
  const [focusLine, setFocusLine] = useState<string | null>(null);
  const [layer, setLayer] = useState<Layer>("transit");
  const [locate, setLocate] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [saved, toggleSave] = useSaved();

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 1600); return () => clearTimeout(t); }, [toast]);

  const openStation = (id: string) => { setTab("map"); setSelected(id); };
  const openLine = (id: string) => { setTab("map"); setSelected(null); setFocusLine(id); };

  const tabs: DuetTab<Tab>[] = [
    { id: "map", label: "Map", icon: <MapIcon size={24} />, tint: ACCENT },
    { id: "lines", label: "Lines", icon: <TrainFront size={24} />, tint: ACCENT, badge: alerts || undefined },
    { id: "saved", label: "Saved", icon: <Star size={24} />, tint: ACCENT },
  ];
  const leading: DuetItem[] = tab === "map" ? [
    { id: "locate", label: "Locate me", icon: <LocateFixed size={21} />, onPress: () => setLocate((n) => n + 1) },
    { id: "layers", label: "Layers", icon: <Layers size={21} />, onPress: () => {
      const next = layer === "transit" ? "explore" : "transit";
      setLayer(next); setToast(next === "transit" ? "Transit map" : "Explore map");
    } },
  ] : [];
  const back = tab === "map" && selected ? { label: "Close station", onPress: () => setSelected(null) }
    : tab === "map" && focusLine ? { label: "Show all lines", onPress: () => setFocusLine(null) } : false;

  return (
    <Duet
      back={back}
      leading={leading}
      tabs={{ items: tabs, selected: tab, onSelect: setTab, search: { id: "search", label: "Search", icon: <Search size={24} />, tint: ACCENT } }}
    >
      {tab === "map" && (
        <MapView selected={selected} focusLine={focusLine} layer={layer} locate={locate} toast={toast} saved={saved}
          onStation={setSelected} onToggleSave={toggleSave} onSearch={() => setTab("search")} />
      )}
      {tab === "lines" && <LinesPage onLine={openLine} />}
      {tab === "saved" && <SavedPage saved={saved} onStation={openStation} />}
      {tab === "search" && <SearchPage onStation={openStation} onLine={openLine} />}
    </Duet>
  );
}

function LinesPage({ onLine }: { onLine: (id: string) => void }) {
  return (
    <main className="page duet-column">
      <h1>Lines</h1>
      {LINES.filter((l) => l.alert).map((l) => (
        <div key={l.id} className="alert"><LineBadge line={l} size={22} /><div><strong>{l.name}: {l.status}</strong><p>{l.alert}</p></div></div>
      ))}
      <ul className="list">
        {LINES.map((l) => (
          <li key={l.id}>
            <button className="row" onClick={() => onLine(l.id)}>
              <LineBadge line={l} />
              <div className="row-text wrap">
                <strong>{l.name}</strong>
                <span className={`status${l.alert ? " warn" : ""}`}>{l.alert ? <TriangleAlert size={14} /> : <CircleCheck size={14} />}{l.status}</span>
                <span>{l.loop ? "Loop via Foundry and Exchange" : `${station(l.stations[0]).name} to ${station(l.stations.at(-1)!).name}`}, every {l.headway} min</span>
              </div>
              <ChevronRight size={18} className="chev" />
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

function SavedPage({ saved, onStation }: { saved: string[]; onStation: (id: string) => void }) {
  return (
    <main className="page duet-column">
      <h1>Saved</h1>
      {saved.length === 0 && <p className="empty">Stations you save with the star appear here.</p>}
      <ul className="list">
        {saved.map((id) => {
          const next = departures(id)[0];
          return (
            <li key={id}>
              <button className="row" onClick={() => onStation(id)}>
                <Star size={20} className="row-icon" fill="currentColor" />
                <div className="row-text">
                  <strong>{station(id).name}</strong>
                  {next && <span>{next.line.loop ? next.to : `To ${next.to}`} {next.mins[0] === 0 ? "now" : `in ${next.mins[0]} min`}</span>}
                </div>
                <span className="badges">{linesAt(id).map((l) => <LineBadge key={l.id} line={l} size={20} />)}</span>
                <ChevronRight size={18} className="chev" />
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function SearchPage({ onStation, onLine }: { onStation: (id: string) => void; onLine: (id: string) => void }) {
  const [q, setQ] = useState("");
  const m = (s: string) => s.toLowerCase().includes(q.trim().toLowerCase());
  const stations = STATIONS.filter((s) => m(s.name)).sort((a, b) => a.name.localeCompare(b.name));
  const lines = q.trim() ? LINES.filter((l) => m(l.name)) : [];
  return (
    <main className="page duet-column">
      <h1>Search</h1>
      <label className="field"><Search size={17} strokeWidth={2.2} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Stations and lines" enterKeyHint="search" /></label>
      <ul className="list">
        {lines.map((l) => (
          <li key={l.id}><button className="row" onClick={() => onLine(l.id)}><LineBadge line={l} /><div className="row-text"><strong>{l.name}</strong><span>Line · {l.stations.length} stations</span></div><ChevronRight size={18} className="chev" /></button></li>
        ))}
        {stations.map((s) => (
          <li key={s.id}>
            <button className="row" onClick={() => onStation(s.id)}>
              <span className="pin"><TrainFront size={16} /></span>
              <div className="row-text"><strong>{s.name}</strong><span>{linesAt(s.id).map((l) => l.name).join(", ")}</span></div>
              <span className="badges">{linesAt(s.id).map((l) => <LineBadge key={l.id} line={l} size={20} />)}</span>
            </button>
          </li>
        ))}
        {stations.length + lines.length === 0 && <p className="empty">No stations match “{q}”.</p>}
      </ul>
    </main>
  );
}
