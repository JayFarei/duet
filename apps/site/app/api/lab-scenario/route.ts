// Scenario relay for the installed Home Screen app, whose start URL is fixed: the harness POSTs a
// scenario string, the page polls GET. Lab plumbing for tools/simulator, dev only.
// Default: a full Music-style layout so a fresh install shows something.
let current = "menu=4,searchTab=1,back=1,actions=3,primary=1,list=1,title=1";

const dev = process.env.NODE_ENV !== "production";

export async function GET() {
  if (!dev) return new Response(null, { status: 404 });
  return Response.json({ scenario: current }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  if (!dev) return new Response(null, { status: 404 });
  current = (await req.text()).trim();
  return Response.json({ scenario: current });
}
