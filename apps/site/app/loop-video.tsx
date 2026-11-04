"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useTheme } from "./theme";

type Cue = { t: number; length?: number; free: number };

/** A recorded clip of the 3D Duo (tools/media writes public/media/clip/<name>-<light|dark>.{mp4,webp}): silent,
 *  looping, its poster first. The source is set only after mount, once the theme is known, so a dark viewer never
 *  fetches the light clip first. It plays only while a quarter of it is on screen. Under reduced motion it holds its
 *  poster and shows a play button instead. Before the clip is recorded (`available` false, checked on the server) it
 *  keeps the same box as a plain placeholder. `counter`: a line under the video with the free space and what is left
 *  over at that moment, read from the clip's .cues.json against the video's currentTime. */
export function LoopVideo({ name, available, label, className, counter }: { name: string; available: boolean; label: string; className?: string; counter?: boolean }) {
  const dark = useTheme().dark;
  const ref = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [calm, setCalm] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [cue, setCue] = useState<Cue | null>(null);
  const base = `/media/clip/${name}-${dark ? "dark" : "light"}`;
  const live = mounted && available;

  useEffect(() => {
    setMounted(true);
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setCalm(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v || !live || !counter) return;
    let cues: Cue[] = [], gone = false;
    fetch(`${base}.cues.json`).then((r) => r.json()).then((j) => { if (!gone) { cues = j.cues; tick(); } }).catch(() => {});
    const tick = () => setCue(cues.filter((c) => c.t <= v.currentTime).at(-1) ?? cues[0] ?? null);
    v.addEventListener("timeupdate", tick);
    return () => { gone = true; v.removeEventListener("timeupdate", tick); };
  }, [live, base, counter]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !live) return;
    const on = () => setPlaying(!v.paused), events = ["play", "pause"] as const;
    events.forEach((e) => v.addEventListener(e, on));
    // Under reduced motion only the play button starts it; otherwise it plays while on screen.
    const io = calm ? null : new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.25 });
    io?.observe(v);
    if (calm) v.pause();
    return () => { io?.disconnect(); events.forEach((e) => v.removeEventListener(e, on)); };
  }, [live, base, calm]);

  const toggle = () => { const v = ref.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); };

  return (
    <div className={`loop${className ? ` ${className}` : ""}`} data-loop={name} data-ready={available || undefined}>
      <video key={base} ref={ref} src={live ? `${base}.mp4` : undefined} poster={live ? `${base}.webp` : undefined} preload="none" muted loop playsInline aria-label={label} />
      {live && calm && (
        <button type="button" className="loop-play" data-testid="loop-play" aria-label={playing ? `Pause ${label}` : `Play ${label}`} onClick={toggle}>
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        </button>
      )}
      {counter && live && cue && (
        <p className="loop-count" aria-live="off">{cue.length ? `Free space ${cue.length} px · Left over ${cue.free} px` : `Left over ${cue.free} px`}</p>
      )}
    </div>
  );
}
