// Scenario relay for the installed Home Screen app, whose start URL is fixed: the harness POSTs a
// scenario string, the page polls GET. Lab plumbing for tools/simulator.
// Default: a full Music-style layout so a fresh install shows something.
let current = "tabs=4,searchTab=1,back=1,actions=3,accessory=1,list=1,minimize=1,title=1";

export async function GET() {
  return Response.json({ scenario: current }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  current = (await req.text()).trim();
  return Response.json({ scenario: current });
}
