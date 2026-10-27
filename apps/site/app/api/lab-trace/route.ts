// Trace sink for the scroll lab (?trace): the page POSTs per-frame samples, appended to $DUET_TRACE. Dev only.
import { appendFile } from "node:fs/promises";

const dev = process.env.NODE_ENV !== "production";

export async function POST(req: Request) {
  if (!dev || !process.env.DUET_TRACE) return new Response(null, { status: 404 });
  await appendFile(process.env.DUET_TRACE, (await req.text()) + "\n");
  return new Response(null, { status: 204 });
}
