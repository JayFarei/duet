"use client";

import { useEffect, useState } from "react";
import { BookOpen, Download, LayoutGrid, Moon, Play, Sun } from "lucide-react";
import { Duet, isDuo, readSignals, watchSignals, type DuetMenuItem } from "duet-ui";
import { GitHub, REPO } from "./site-nav";
import { useTheme } from "./theme";

/** The home sections, as Duet's places. */
const PLACES = [
  { id: "simulator", label: "Try it", icon: <Play size={22} /> },
  { id: "how", label: "How it works", icon: <BookOpen size={22} /> },
  { id: "examples", label: "Examples", icon: <LayoutGrid size={22} /> },
  { id: "install", label: "Install", icon: <Download size={22} /> },
] as const satisfies readonly DuetMenuItem[];
type Place = (typeof PLACES)[number]["id"];

/** On a Duo the home page wears Duet's own side controls in place of the top bar's links: the sections as places,
 *  GitHub and the theme as actions. No children, so the document still scrolls and Duet places the page beside
 *  Safari's column. Everywhere else it renders nothing and the top bar stays. */
export function SiteDuet() {
  const theme = useTheme();
  const [duo, setDuo] = useState(false);
  const [place, setPlace] = useState<Place>("simulator");
  // Signals can change after load: a web Duo host sends its own once the page says it is ready.
  useEffect(() => { const read = () => setDuo(isDuo(readSignals())); read(); return watchSignals(read); }, []);
  // The place follows the section under the top third of the window.
  useEffect(() => {
    if (!duo) return;
    const els = PLACES.map((p) => document.getElementById(p.id)).filter((e): e is HTMLElement => !!e);
    const spy = () => {
      const line = innerHeight / 3;
      const at = els.filter((e) => e.getBoundingClientRect().top <= line).pop() ?? els[0];
      if (at) setPlace(at.id as Place);
    };
    spy();
    addEventListener("scroll", spy, { passive: true });
    return () => removeEventListener("scroll", spy);
  }, [duo]);
  if (!duo) return null;
  const go = (id: Place) => { setPlace(id); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); };
  return (
    <Duet
      menu={{ items: [...PLACES], selected: place, onSelect: go, tabs: true }}
      actions={[
        { id: "github", label: "GitHub", icon: <GitHub />, onPress: () => window.open(REPO, "_blank", "noreferrer") },
        { id: "theme", label: theme.dark ? "Light mode" : "Dark mode", icon: theme.dark ? <Sun size={22} /> : <Moon size={22} />, onPress: theme.toggle },
      ]}
      appearance={theme.appearance}
    />
  );
}
