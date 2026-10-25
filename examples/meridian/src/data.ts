// A fictional city. World coordinates: 1200 x 1000 units, north up.
export const WORLD = { width: 1200, height: 1000 };

export interface Station { id: string; name: string; x: number; y: number; label?: "left" | "right" | "above" | "below" | "aboveLeft" | "aboveRight" | "belowLeft" | "belowRight" }
export interface Line {
  id: string; name: string; short: string; color: string; headway: number; loop?: boolean;
  stations: string[]; status: string; alert?: string;
}

const s = (id: string, name: string, x: number, y: number, label: Station["label"] = "right"): Station => ({ id, name, x, y, label });
export const STATIONS: Station[] = [
  s("westgate", "Westgate", 110, 330, "above"),
  s("millbrook", "Millbrook", 250, 330, "above"),
  s("foundry", "Foundry", 390, 330, "aboveLeft"),
  s("central", "Central", 560, 450, "belowRight"),
  s("exchange", "Exchange", 720, 450, "belowRight"),
  s("lantern", "Lantern Row", 880, 450, "above"),
  s("eastgate", "Eastgate", 1060, 400, "above"),
  s("northfield", "Northfield", 560, 70, "right"),
  s("observatory", "Observatory", 560, 200, "left"),
  s("southbank", "Southbank", 560, 720, "belowLeft"),
  s("mercer", "Mercer Square", 560, 850, "belowRight"),
  s("southgate", "Southgate", 560, 960, "right"),
  s("gardens", "Linden Gardens", 740, 250, "right"),
  s("docklands", "Docklands", 720, 720, "aboveRight"),
  s("canal", "Canal Street", 400, 700, "left"),
  s("willow", "Willow", 110, 860, "above"),
  s("elmrow", "Elm Row", 300, 820, "above"),
  s("saltmarsh", "Saltmarsh", 900, 790, "below"),
  s("eastpier", "East Pier", 1080, 720, "above"),
];
export const station = (id: string) => STATIONS.find((x) => x.id === id)!;

// Line colours are data, like a real transit map: slightly desaturated, distinct in light and dark.
export const LINES: Line[] = [
  { id: "harbour", name: "Harbour Line", short: "H", color: "#c25a48", headway: 6, status: "Good service",
    stations: ["westgate", "millbrook", "foundry", "central", "exchange", "lantern", "eastgate"] },
  { id: "meridian", name: "Meridian Line", short: "M", color: "#c99a3c", headway: 4, status: "Good service",
    stations: ["northfield", "observatory", "central", "southbank", "mercer", "southgate"] },
  { id: "circle", name: "Circle Line", short: "C", color: "#8562a0", headway: 8, loop: true, status: "Part closed",
    alert: "No service between Docklands and Canal Street this weekend. Use the Meridian Line via Southbank.",
    stations: ["foundry", "observatory", "gardens", "exchange", "docklands", "southbank", "canal"] },
  { id: "willow", name: "Willow Line", short: "W", color: "#4d7fae", headway: 10, status: "Minor delays",
    alert: "Trains are running up to 6 minutes late after a signal fault at Elm Row.",
    stations: ["willow", "elmrow", "mercer", "docklands", "saltmarsh", "eastpier"] },
];
export const linesAt = (id: string) => LINES.filter((l) => l.stations.includes(id));
export const alerts = LINES.filter((l) => l.alert).length;

export const YOU = { x: 470, y: 520 };

export interface Departure { line: Line; to: string; mins: number[] }

// Deterministic fake timetable: every line/direction/station has a fixed phase within the headway.
function phase(key: string, h: number) {
  let n = 7;
  for (const c of key) n = (n * 31 + c.charCodeAt(0)) % 9973;
  return (n % (h * 10)) / 10;
}
export function departures(id: string, now = new Date()): Departure[] {
  const t = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const out: Departure[] = [];
  for (const line of linesAt(id)) {
    const i = line.stations.indexOf(id), last = line.stations.length - 1;
    const dirs = line.loop ? [["Clockwise", 1], ["Anticlockwise", -1]] as const
      : ([i < last && [station(line.stations[last]).name, 1], i > 0 && [station(line.stations[0]).name, -1]].filter(Boolean) as [string, number][]);
    for (const [to, d] of dirs) {
      const h = line.headway, first = (((phase(id + line.id + d, h) - t) % h) + h) % h;
      out.push({ line, to, mins: [0, 1, 2].map((k) => Math.round(first + k * h)) });
    }
  }
  return out.sort((a, b) => a.mins[0] - b.mins[0]);
}
export const clock = (mins: number, now = new Date()) =>
  new Date(now.getTime() + mins * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
