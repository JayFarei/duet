// Duet, added to any page the 3D Duo's Safari loads through /duo3d/web. No children: in Safari's column Duet
// places the page beside the controls itself, so a site built without Duet needs nothing of its own. The host's
// "Without Duet" takes it away again (the same skeleton:duet message the skeleton page answers).
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, RotateCw, Share } from "lucide-react";
import { Duet } from "duet-ui";

// Duet's own pages keep text and buttons clear of the controls by the insets (column(), bleed()); a page built
// without Duet knows nothing of them, so it is held beside the controls whole. In Safari's column real Safari does
// that itself; the 3D Duo's emulated frame spans the column, so it is done here in every mode.
const BESIDE = `html[data-duet-mode] { margin-right: var(--duet-inset-right, 0px) !important; margin-left: var(--duet-inset-left, 0px) !important; }`;

// The page's own scheme, from its background: a light site on a dark system keeps light glass, not white glyphs.
function scheme(): "light" | "dark" {
  for (const el of [document.body, document.documentElement]) {
    const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
    if (m && (m[3] === undefined || +m[3] > 0.5)) return 0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2] > 128 ? "light" : "dark";
  }
  return "light";
}

function Shell() {
  const [on, setOn] = useState(true);
  const [appearance] = useState(scheme);
  useEffect(() => {
    const msg = (e: MessageEvent) => { if (e.source === parent && e.data?.type === "skeleton:duet") setOn(!!e.data.on); };
    addEventListener("message", msg);
    if (parent !== window) parent.postMessage({ type: "skeleton:ready" }, "*");
    return () => removeEventListener("message", msg);
  }, []);
  if (!on) return null;
  return (
    <>
    <style>{BESIDE}</style>
    <Duet
      appearance={appearance}
      back={{ onPress: () => history.back() }}
      actions={[
        { id: "forward", label: "Forward", icon: <ArrowRight size={22} />, onPress: () => history.forward() },
        { id: "reload", label: "Reload", icon: <RotateCw size={20} />, onPress: () => location.reload() },
        { id: "share", label: "Share", icon: <Share size={22} />, onPress: () => navigator.clipboard?.writeText((window as unknown as { __duo3dUrl: string }).__duo3dUrl) },
      ]}
    />
    </>
  );
}

const mount = () => { const el = document.createElement("div"); el.id = "duo3d-duet"; document.body.appendChild(el); createRoot(el).render(<Shell />); };
if (document.body) mount(); else addEventListener("DOMContentLoaded", mount);
