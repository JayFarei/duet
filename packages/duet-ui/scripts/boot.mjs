// Bundles src/boot.ts into one inline script for the top of the page's <body> (duet-ui/boot): bootScript.
import { build } from "esbuild";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function bundle() {
  const out = await build({
    stdin: { contents: 'import { boot } from "./src/boot.ts"; try { boot(); } catch {}', resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts" },
    bundle: true, minify: true, format: "iife", target: "safari15", write: false,
  });
  return out.outputFiles[0].text.trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const code = await bundle();
  const doc = "/** Inline before the page paints (docs/server-rendering.md, Pre-paint boot). */\n";
  writeFileSync(new URL("../dist/boot-script.js", import.meta.url), `${doc}export const bootScript = ${JSON.stringify(code)};\n`);
  writeFileSync(new URL("../dist/boot-script.d.ts", import.meta.url), `${doc}export declare const bootScript: string;\n`);
  console.log(`boot-script.js: ${code.length} bytes`);
}
