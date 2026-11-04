"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme";

export const REPO = "https://github.com/JayFarei/duet";

export function DuetMark() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="3.5" width="11" height="17" rx="3" /><rect x="16" y="3.5" width="5.5" height="17" rx="2.75" />
      <circle cx="18.75" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function GitHub() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.31-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3" />
    </svg>
  );
}

/** The site's top bar: the name, the three pages, GitHub and the theme toggle. Plain links, no Duet: the site pages
 *  scroll the window. */
export function SiteNav() {
  const theme = useTheme();
  return (
    <header className="nav">
      <a href="/" className="nav-brand"><DuetMark />Duet</a>
      <nav className="nav-links" aria-label="Site">
        <a href="/components">Components</a>
        <a href="/examples">Examples</a>
        <a href="/#docs">Docs</a>
      </nav>
      <div className="nav-end">
        <a className="nav-icon" href={REPO} target="_blank" rel="noreferrer" aria-label="GitHub"><GitHub /></a>
        <button type="button" className="nav-icon" onClick={theme.toggle} aria-label={theme.dark ? "Light mode" : "Dark mode"}>{theme.dark ? <Sun size={18} /> : <Moon size={18} />}</button>
      </div>
    </header>
  );
}
