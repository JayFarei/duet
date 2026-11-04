import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { highlight } from "sugar-high";

/** An example's one source file, highlighted at build time for its Code view. */
export const source = (name: string) => highlight(readFileSync(join(process.cwd(), "app/examples", name, "app.tsx"), "utf8"));
/** Whether the example's recorded loop is in public/media (tools/media records it). */
export const hasLoop = (name: string) => ["light", "dark"].every((t) => existsSync(join(process.cwd(), "public/media/clip", `example-${name}-${t}.mp4`)));
