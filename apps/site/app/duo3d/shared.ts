import type { State, Turn } from "../duo/web-duo";

/** What the host tells both displays: the device state, the interface's turn once it has swung upright, and
 *  whether the page runs Duet (off: the same site as a plain mobile site, the before of a before and after). */
export interface Sync { s: State; upright: Turn; src: string; duet: boolean }
/** Host and displays are one origin, so a BroadcastChannel joins them through duo's frame. Each host
 *  page has its own, named by an id it hands its displays (`?id=`), so two tabs of it don't drive each other's. */
export const channel = (id: string) => `duo3d:${id}`;
/** doan-labs/duo's shell, built by tools/duo3d/build.sh into public/: served by this site, so one origin. */
export const DUO_APP = "/duo3d/app/index.html";
