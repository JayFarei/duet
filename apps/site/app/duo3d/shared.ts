import type { State, Turn } from "../duo/web-duo";

/** What the host tells both displays: the device state and the interface's turn once it has swung upright. */
export interface Sync { s: State; upright: Turn; src: string }
/** Host and displays are one origin, so a BroadcastChannel joins them through duo's cross-origin frame. */
export const CHANNEL = "duo3d";
/** duo's dev server: the same host as the page, so it works on localhost and over Tailscale alike. */
export const DUO_PORT = 3166;
