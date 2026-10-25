// Invented catalogue. Every album carries its own artwork recipe: two hues and a composition.

export type ArtStyle = "sun" | "rings" | "waves" | "blobs" | "dots" | "arches" | "bands" | "orbit";
export interface Track { id: string; title: string; seconds: number; albumId: string; n: number }
export interface Album {
  id: string; title: string; artist: string; year: number; genre: string;
  hues: [number, number]; style: ArtStyle; isNew?: boolean; tracks: Track[];
}

const raw: [string, string, number, string, [number, number], ArtStyle, string[], boolean?][] = [
  ["Paper Lanterns", "Mira Okafor", 2026, "Indie Pop", [18, 340], "sun", ["Harbour Lights", "Slow Tide", "Paper Lanterns", "Quiet Hours", "Salt and Sugar", "North Window", "Afterglow", "Lantern Reprise"], true],
  ["Glasshouse", "The Velvet Antlers", 2026, "Alternative", [168, 210], "rings", ["Glasshouse", "Greenroom", "Static Bloom", "Under Fern", "Weather Vane", "Condensation", "Hothouse Heart"], true],
  ["Low Orbit", "Sable & Finch", 2025, "Electronic", [250, 290], "orbit", ["Liftoff", "Low Orbit", "Perigee", "Satellite Hum", "Cold Light", "Reentry"], true],
  ["Coastline Theory", "Juno Hartwell", 2025, "Singer-Songwriter", [200, 30], "waves", ["Coastline Theory", "Driftwood", "Gulls at Noon", "Breakwater", "Fog Bell", "Tidal Map", "Long Way Home", "Sandbar"]],
  ["Velour", "Nightjar Club", 2026, "R&B", [320, 280], "blobs", ["Velour", "Midnight Errand", "Soft Focus", "Honey Static", "Taxi Light", "Slow Dance Ban"], true],
  ["Field Notes", "Odile Marsh", 2024, "Folk", [90, 40], "dots", ["Field Notes", "Hedgerow", "Barley", "The Stile", "Morning Frost", "Kestrel", "Evensong"]],
  ["Arcade Weather", "Polaroid Youth", 2025, "Synth Pop", [190, 330], "bands", ["Arcade Weather", "Neon Rain", "High Score", "Token", "Cabinet Glow", "Continue?", "Insert Coin"]],
  ["Small Cathedrals", "Ines Calloway", 2026, "Ambient", [35, 15], "arches", ["Nave", "Small Cathedrals", "Clerestory", "Candle Draft", "Vesper", "Cloister"], true],
  ["Parallel Summers", "Kit Delacroix", 2024, "Indie Rock", [45, 195], "sun", ["Parallel Summers", "Pool Light", "Bicycle Spokes", "July Forever", "Screen Door", "Sunburn Letter", "Last Ferry"]],
  ["Moss Phase", "Halden Grey", 2025, "Downtempo", [140, 100], "waves", ["Moss Phase", "Lichen", "Rain Gauge", "Understory", "Spore Print", "Canopy"]],
  ["Gold Hour Radio", "The Marigolds", 2026, "Soul", [38, 8], "rings", ["Gold Hour Radio", "Turntable Sun", "Brass and Velvet", "Sunday Pressing", "Warm Static", "Sign Off"], true],
  ["Blue Season", "Aiko Lindqvist", 2025, "Jazz", [215, 235], "blobs", ["Blue Season", "Late Set", "Brushes", "Smoke Ring", "Rain on Lenox", "Coda"]],
];

const dur = (i: number, j: number) => 150 + ((i * 37 + j * 53) % 140);

export const ALBUMS: Album[] = raw.map(([title, artist, year, genre, hues, style, names, isNew], i) => {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { id, title, artist, year, genre, hues, style, isNew, tracks: names.map((t, j) => ({ id: `${id}-${j}`, title: t, seconds: dur(i, j), albumId: id, n: j + 1 })) };
});
export const album = (id: string) => ALBUMS.find((a) => a.id === id)!;
export const TRACKS = ALBUMS.flatMap((a) => a.tracks);
export const track = (id: string) => TRACKS.find((t) => t.id === id)!;
export const NEW = ALBUMS.filter((a) => a.isNew);

export const MIXES = [
  { id: "m1", title: "Morning Mix", sub: "Updated today", hues: [30, 350] as [number, number], style: "sun" as ArtStyle },
  { id: "m2", title: "Focus", sub: "Calm and steady", hues: [190, 220] as [number, number], style: "waves" as ArtStyle },
  { id: "m3", title: "Discovery", sub: "New to you", hues: [270, 320] as [number, number], style: "orbit" as ArtStyle },
  { id: "m4", title: "Late Night", sub: "Soft and low", hues: [235, 280] as [number, number], style: "blobs" as ArtStyle },
  { id: "m5", title: "Replay 2026", sub: "Your top songs", hues: [350, 20] as [number, number], style: "rings" as ArtStyle },
];

export const STATIONS = [
  { id: "s1", title: "Encore One", sub: "Live now: The Weekend Session", hues: [350, 15] as [number, number], style: "rings" as ArtStyle, seed: "paper-lanterns" },
  { id: "s2", title: "Chill Signal", sub: "Downtempo, all day", hues: [170, 205] as [number, number], style: "waves" as ArtStyle, seed: "moss-phase" },
  { id: "s3", title: "Velvet Hour", sub: "Soul and R&B classics", hues: [30, 330] as [number, number], style: "blobs" as ArtStyle, seed: "velour" },
  { id: "s4", title: "Night Drive", sub: "Synths for the road", hues: [250, 300] as [number, number], style: "bands" as ArtStyle, seed: "arcade-weather" },
];

export const GENRES: [string, number][] = [
  ["Pop", 345], ["Indie", 20], ["Electronic", 255], ["R&B", 300], ["Folk", 80], ["Jazz", 215], ["Ambient", 35], ["Soul", 15],
];

export const time = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
