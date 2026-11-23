"use client";

import { useSyncExternalStore } from "react";
import { ChevronLeft } from "lucide-react";
import "../../examples/examples.css";

const topNow = () => window.top === window;

/** The way back from an example opened on its own: a small chip to its page. Not inside a frame (the device stage's
 *  screens load this route too), and not before hydration, so the screens never show it. */
export function PlainBack({ name, title }: { name: string; title: string }) {
  const top = useSyncExternalStore(() => () => {}, topNow, () => false);
  if (!top) return null;
  return <a className="ex-plain-back" href={`/examples/${name}`} data-testid="plain-back"><ChevronLeft size={18} aria-hidden />{title}</a>;
}
