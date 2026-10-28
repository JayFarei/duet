// The "With Duet" preview of any site: the shell sends the page's header links and buttons, and TypeSafe's Jev
// decision model says which Duet control each would be in a native app (a tab, the primary button, a toolbar action,
// search, or none) and which icon it takes. Both questions for every candidate go in one request, answered in
// parallel. Answers are cached per page in memory. Local only: the key is TYPESAFE_KEY in apps/site/.env.local.
import { ICONS, ROLES, type Candidate, type Optimized, type Role, type Icon } from "../../../duo3d-web/spec";

const cache = new Map<string, Optimized>();

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const key = process.env.TYPESAFE_KEY;
  if (!key) return Response.json({ error: "TYPESAFE_KEY is not set" }, { status: 503 });
  const { url, title, candidates } = (await req.json()) as { url: string; title: string; candidates: Candidate[] };
  if (!Array.isArray(candidates) || !candidates.length) return Response.json({});
  const id = url + "\n" + JSON.stringify(candidates);
  const hit = cache.get(id);
  if (hit) return Response.json(hit);

  const questions: Record<string, object> = {};
  candidates.forEach((c, i) => {
    questions[`role${i}`] = {
      type: "choice",
      instructions: `\`candidates[${i}]\` is a link or button in this website's header, listed with its siblings in \`candidates\`. If the website were a native iPhone app, which control would \`candidates[${i}]\` become? An app has at most one primary action and a handful of tabs.`,
      criteria: ROLES,
    };
    questions[`icon${i}`] = {
      type: "choice",
      instructions: `Which icon best shows what \`candidates[${i}]\` leads to or does, as a tab bar or toolbar icon?`,
      criteria: Object.fromEntries(ICONS.map((n) => [n, null])),
    };
  });
  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "jev-latest", state: { site: new URL(url).host, title, candidates }, questions }),
  });
  if (!res.ok) return Response.json({ error: `TypeSafe ${res.status}: ${(await res.text()).slice(0, 300)}` }, { status: 502 });
  type Answer = { choice: string; probabilities: Record<string, number> };
  const { answers } = (await res.json()) as { answers: Record<string, Answer> };
  const out: Optimized = {};
  candidates.forEach((c, i) => {
    const role = answers[`role${i}`], icon = answers[`icon${i}`];
    if (role && icon) out[c.id] = { role: role.choice as Role, p: role.probabilities[role.choice] ?? 0, icon: icon.choice as Icon };
  });
  cache.set(id, out);
  return Response.json(out);
}
