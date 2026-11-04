import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highlight } from "sugar-high";
import { clips } from "../clip";

/** An example's one source file, highlighted at build time for its Code view. */
export const source = (name: string) => highlight(readFileSync(join(process.cwd(), "app/examples", name, "app.tsx"), "utf8"));
/** The examples, as block.tsx lists them. */
const EXAMPLES = ["inbox", "checkout", "reader"];
/** Which examples' recorded loops are in public/media/clip (tools/media/record.mjs records them), by example name. */
export const loops = () => Object.fromEntries(Object.entries(clips(EXAMPLES.map((n) => `example-${n}`))).map(([k, v]) => [k.slice(8), v]));
