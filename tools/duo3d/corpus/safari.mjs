// A minimal WebDriver client for real Safari (safaridriver ships with macOS): Playwright's WebKit is not Safari, and
// some of Duet's paint (masks, backdrop filters) differs between them.
import { spawn } from "node:child_process";

export async function safari({ port = 4567, width = 400, height = 820 } = {}) {
  const drv = spawn("safaridriver", ["-p", String(port)], { stdio: "ignore" });
  const base = `http://localhost:${port}`;
  const call = async (method, path, body) => {
    const r = await fetch(base + path, { method, headers: { "content-type": "application/json" }, body: body && JSON.stringify(body) });
    const j = await r.json();
    if (j.value?.error) throw new Error(`${j.value.error}: ${j.value.message}`);
    return j.value;
  };
  for (let i = 0; ; i++) {
    try { await fetch(base + "/status"); break; } catch { if (i > 50) throw new Error("safaridriver did not start"); await new Promise((r) => setTimeout(r, 100)); }
  }
  const { sessionId } = await call("POST", "/session", {
    // As Playwright's domcontentloaded: a page with a slow asset is still read, within the script's own wait.
    capabilities: { alwaysMatch: { browserName: "safari", pageLoadStrategy: "eager", timeouts: { pageLoad: 30_000, script: 60_000 } } },
  });
  const s = `/session/${sessionId}`;
  await call("POST", `${s}/window/rect`, { width, height, x: 0, y: 0 });
  return {
    goto: (url) => call("POST", `${s}/url`, { url }),
    eval: (fn, ...args) => call("POST", `${s}/execute/async`, { script: `const done = arguments[arguments.length - 1]; Promise.resolve((${fn}).apply(null, Array.from(arguments).slice(0, -1))).then(done, (e) => done({ error: String(e) }));`, args }),
    /** Clicks the first element matching a CSS selector in the current frame. */
    click: async (css) => { const el = await call("POST", `${s}/element`, { using: "css selector", value: css }); await call("POST", `${s}/element/${Object.values(el)[0]}/click`, {}); },
    type: async (css, text) => { const el = await call("POST", `${s}/element`, { using: "css selector", value: css }); await call("POST", `${s}/element/${Object.values(el)[0]}/value`, { text }); },
    /** Into the nth iframe of the current frame (cross-origin too), or back to the top with null. */
    frame: (n) => n === null ? call("POST", `${s}/frame`, { id: null }) : call("POST", `${s}/frame`, { id: n }),
    screenshot: async () => Buffer.from(await call("GET", `${s}/screenshot`), "base64"),
    close: async () => { try { await call("DELETE", s); } finally { drv.kill(); } },
  };
}
