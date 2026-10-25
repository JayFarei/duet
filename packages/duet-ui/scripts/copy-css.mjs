// tsc does not copy stylesheets; the compiled modules import them by the same relative paths.
import { cpSync } from "node:fs";
cpSync("src/duet.css", "dist/duet.css");
cpSync("src/glassyui/styles", "dist/glassyui/styles", { recursive: true });
