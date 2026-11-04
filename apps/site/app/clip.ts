import { existsSync } from "node:fs";
import { join } from "node:path";

/** Whether a recorded clip is on disk in both themes (tools/media writes public/media/clip/<name>-<light|dark>.mp4
 *  and its .webp poster). Read on the server at build time, so a page never asks for a clip that is not there. */
export const hasClip = (name: string) =>
  ["light", "dark"].every((t) => ["mp4", "webp"].every((x) => existsSync(join(process.cwd(), "public/media/clip", `${name}-${t}.${x}`))));

/** hasClip for a list of names, as a map a client component can take. */
export const clips = (names: readonly string[]) => Object.fromEntries(names.map((n) => [n, hasClip(n)]));
