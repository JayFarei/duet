import { createReadStream, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { enabled, reportsRoot } from "../../reports";

// The reports' screenshots, contact sheets and videos for the workbench (dev only), with byte ranges so videos seek.
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".json": "application/json", ".html": "text/html; charset=utf-8", ".txt": "text/plain; charset=utf-8",
};
const missing = () => new Response("Not found", { status: 404 });

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!enabled()) return missing();
  let root: string, file: string;
  try {
    root = realpathSync(reportsRoot());
    file = realpathSync(path.resolve(root, ...(await params).path));
  } catch {
    return missing();
  }
  if (!file.startsWith(root + path.sep)) return missing();
  const st = statSync(file);
  if (!st.isFile()) return missing();
  const headers: Record<string, string> = { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream", "Accept-Ranges": "bytes", "Cache-Control": "no-cache" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${st.size}` } });
    const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(body, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": String(end - start + 1) } });
  }
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers: { ...headers, "Content-Length": String(st.size) } });
}
