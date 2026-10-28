// Bundles duet-shell.tsx (React, duet-ui and its icons in one script) and duet-ui's CSS into public/duo3d-web,
// for /duo3d/web to add to the pages it loads. Generated, not committed: run `node apps/site/duo3d-web/build.mjs`.
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const { build } = createRequire(here("../../../packages/duet-ui/package.json"))("esbuild");
mkdirSync(here("../public/duo3d-web"), { recursive: true });
await build({
  entryPoints: [here("duet-shell.tsx")], outfile: here("../public/duo3d-web/duet.js"),
  bundle: true, minify: true, format: "iife", target: "safari16", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' }, logLevel: "info",
});
copyFileSync(here("../../../packages/duet-ui/dist/duet.css"), here("../public/duo3d-web/duet.css"));
