import type { App } from "../duo/web-duo";

export { Phases, Rule, Segmented, TOUR, Tool, control, fit, group, hardware, rotate, sameView, type State, type Turn } from "../duo/web-duo";
/** Split View exists open and upright only (web-duo's ONLY). */
export const ONLY_OPEN = (app: App) => app === "split";
