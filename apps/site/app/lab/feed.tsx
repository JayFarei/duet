// A loud product landing page for the lab demo: saturated gradient hero, feature bands, colour swatches,
// pricing and CTAs that run under the strip, so the glass controls always have bright colour to blur.
// No images: every visual is layered gradients. Bands use bleed() so colour runs under the strip while text stays beside it.
import { bleed } from "duet-ui";

const HERO = "radial-gradient(90% 60% at 85% 10%, #ffe259 0%, transparent 55%), radial-gradient(80% 70% at 10% 90%, #00f2fe 0%, transparent 60%), linear-gradient(150deg, #7f00ff 0%, #e100ff 45%, #ff4e50 100%)";
const FEATURES = [
  ["Two screens. One flow.", "Unfold and your app follows, from strip to split view without a single reload.", "linear-gradient(135deg, #ff512f, #dd2476)", "◐"],
  ["Glass that breathes", "Controls float over your content and borrow its colour, light or dark.", "linear-gradient(135deg, #00c6ff, #0072ff)", "◎"],
  ["Elastic menus", "Every button stretches into an island and snaps back like a rubber band.", "linear-gradient(135deg, #f7971e, #ffd200)", "⟷"],
  ["Either hand", "Drag the controls to the side you hold. We remember.", "linear-gradient(135deg, #11998e, #38ef7d)", "✋"],
];
const COLORS = [
  ["Sunset", "linear-gradient(160deg, #ff9a8b, #ff6a88 55%, #ff99ac)"],
  ["Lagoon", "linear-gradient(160deg, #43e97b, #38f9d7)"],
  ["Ultraviolet", "linear-gradient(160deg, #8e2de2, #4a00e0)"],
  ["Citrus", "linear-gradient(160deg, #f6d365, #fda085)"],
  ["Midnight", "linear-gradient(160deg, #232526, #414345)"],
];
const STATS = [["2×", "screen"], ["0", "reloads"], ["120Hz", "glass"]];
const PLANS = [
  ["Starter", "$0", "For side projects", "linear-gradient(160deg, #e0eafc, #cfdef3)", "#000"],
  ["Pro", "$12", "Everything, unfolded", "linear-gradient(160deg, #ff0080, #7928ca)", "#fff"],
  ["Team", "$29", "Shared themes and analytics", "linear-gradient(160deg, #0f2027, #2c5364)", "#fff"],
];
const QUOTES = [
  ["“Feels native. Our users never noticed it was a website.”", "Priya, Product lead", "#ff3b30"],
  ["“The rubber-band menus are pure joy.”", "Marco, Designer", "#007aff"],
  ["“We shipped Duo support in an afternoon.”", "Lena, Engineer", "#34c759"],
];

const pad = { padding: "0 24px" } as const;
const btn = (bg: string, fg: string) => ({ display: "inline-block", padding: "13px 24px", borderRadius: 999, background: bg, color: fg, font: "700 16px -apple-system" }) as const;
const eyebrow = (c: string) => ({ font: "800 13px -apple-system", letterSpacing: 1.2, textTransform: "uppercase", color: c }) as const;

export function Feed() {
  return (
    <div style={{ paddingBottom: 140 }}>
      <div style={{ padding: "8px 20px", background: "linear-gradient(90deg, #ff0080, #7928ca, #2afadf)", color: "#fff", font: "700 13px -apple-system", textAlign: "center", ...bleed(20) }}>
        ✨ Launch week: Pro is free for 3 months
      </div>

      <section style={{ background: HERO, color: "#fff", padding: "56px 24px 64px", ...bleed(24) }}>
        <div style={eyebrow("rgb(255 255 255 / 0.85)")}>Introducing Fold</div>
        <h1 style={{ font: "900 52px/0.98 -apple-system", letterSpacing: -1.5, margin: "12px 0 16px" }}>Your site,<br />unfolded.</h1>
        <p style={{ font: "500 19px/1.35 -apple-system", margin: "0 0 26px", maxWidth: 360, opacity: 0.92 }}>Native-feeling chrome for the iPhone Duo. Every screen, every posture, every hand.</p>
        <span style={btn("#fff", "#7f00ff")}>Get started</span>{" "}
        <span style={{ ...btn("rgb(255 255 255 / 0.18)", "#fff"), boxShadow: "inset 0 0 0 1.5px rgb(255 255 255 / 0.6)" }}>Watch film ▸</span>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", background: "#111", color: "#fff", textAlign: "center", padding: "22px 12px", ...bleed(12) }}>
        {STATS.map(([n, l]) => (
          <div key={l}><div style={{ font: "900 30px -apple-system", background: "linear-gradient(90deg, #f9d423, #ff4e50)", WebkitBackgroundClip: "text", color: "transparent" }}>{n}</div><div style={{ font: "600 13px -apple-system", opacity: 0.6 }}>{l}</div></div>
        ))}
      </div>

      {FEATURES.map(([t, d, bg, icon], i) => (
        <section key={t} style={{ ...pad, display: "flex", gap: 18, alignItems: "center", flexDirection: i % 2 ? "row-reverse" : "row", margin: "34px 0" }}>
          <div style={{ width: 112, height: 112, flex: "none", borderRadius: 30, background: bg, color: "#fff", display: "grid", placeItems: "center", font: "700 46px -apple-system", boxShadow: "0 14px 30px rgb(0 0 0 / 0.18)" }}>{icon}</div>
          <div>
            <div style={{ font: "800 23px/1.1 -apple-system", marginBottom: 6 }}>{t}</div>
            <div style={{ font: "400 16px/1.4 -apple-system", opacity: 0.7 }}>{d}</div>
          </div>
        </section>
      ))}

      <section style={{ background: "linear-gradient(180deg, #ff6a00, #ee0979)", color: "#fff", padding: "40px 0 34px", ...bleed() }}>
        <div style={{ ...pad, ...eyebrow("rgb(255 255 255 / 0.8)") }}>Five finishes</div>
        <div style={{ ...pad, font: "900 34px/1.05 -apple-system", margin: "8px 0 20px" }}>Pick your colour.</div>
        <div style={{ display: "flex", gap: 14, overflowX: "auto", padding: "0 24px", scrollbarWidth: "none" }}>
          {COLORS.map(([n, bg]) => (
            <div key={n} style={{ flex: "none", width: 140, height: 200, borderRadius: 26, background: bg, padding: 14, boxSizing: "border-box", display: "flex", alignItems: "flex-end", font: "800 18px -apple-system", boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.35)" }}>{n}</div>
          ))}
        </div>
      </section>

      <section style={{ ...pad, margin: "40px 0 10px" }}>
        <div style={eyebrow("#af52de")}>Loved by builders</div>
        {QUOTES.map(([q, who, c]) => (
          <blockquote key={who} style={{ margin: "16px 0", padding: "18px 20px", borderRadius: 22, background: `color-mix(in srgb, ${c} 14%, transparent)`, borderLeft: `5px solid ${c}` }}>
            <div style={{ font: "700 19px/1.3 -apple-system" }}>{q}</div>
            <div style={{ font: "600 14px -apple-system", color: c, marginTop: 8 }}>{who}</div>
          </blockquote>
        ))}
      </section>

      <section style={{ ...pad, margin: "36px 0" }}>
        <div style={{ font: "900 34px -apple-system", marginBottom: 16 }}>Simple pricing</div>
        {PLANS.map(([n, price, d, bg, fg]) => (
          <div key={n} style={{ background: bg, color: fg, borderRadius: 26, padding: "22px 22px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}><div style={{ font: "800 20px -apple-system" }}>{n}</div><div style={{ font: "500 14px -apple-system", opacity: 0.75 }}>{d}</div></div>
            <div style={{ font: "900 32px -apple-system" }}>{price}<span style={{ font: "600 14px -apple-system", opacity: 0.7 }}>/mo</span></div>
          </div>
        ))}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3, ...bleed(false) }}>
        {[...COLORS, ...FEATURES.map((f) => [f[0], f[2]]), ...COLORS.slice(0, 3)].map(([n, bg], i) => <div key={i} title={n} style={{ aspectRatio: "1", background: bg }} />)}
      </div>

      <section style={{ background: "radial-gradient(90% 120% at 90% 10%, #2afadf 0%, transparent 60%), linear-gradient(135deg, #4c00ff, #ff00c8)", color: "#fff", padding: "54px 24px", textAlign: "center", ...bleed(24) }}>
        <div style={{ font: "900 38px/1.02 -apple-system", letterSpacing: -1, marginBottom: 12 }}>Ready to unfold?</div>
        <div style={{ font: "500 17px -apple-system", opacity: 0.9, marginBottom: 22 }}>Free to start. No credit card.</div>
        <span style={btn("#fff", "#4c00ff")}>Start building</span>
      </section>
    </div>
  );
}
