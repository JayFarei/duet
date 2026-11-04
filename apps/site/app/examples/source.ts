import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highlight } from "sugar-high";
import { hasClip } from "../clip";

/** An example's one source file, highlighted at build time for its Code view. */
export const source = (name: string) => highlight(readFileSync(join(process.cwd(), "app/examples", name, "app.tsx"), "utf8"));
/** Whether the example's recorded loop is in public/media/clip (tools/media records it). */
export const hasLoop = (name: string) => hasClip(`example-${name}`);
