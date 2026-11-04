"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "./theme";

/** A recorded clip of the 3D Duo (tools/media writes public/media/clip/<name>-<light|dark>.{mp4,webp}): silent,
 *  looping, its poster first. It plays only while a quarter of it is on screen and never under reduced motion. Before
 *  the clip is recorded (`available` false, checked on the server) it keeps the same box as a plain placeholder, and
 *  with preload="none" and no play() the browser never asks for the missing file. `counter`: a line under the video with
 *  the free space Duet measured at that moment, read from the clip's .cues.json against the video's currentTime. */
export function LoopVideo({ name, available, label, className, counter }: { name: string; available: boolean; label: string; className?: string; counter?: boolean }) {
  const dark = useTheme().dark;
  const ref = useRef<HTMLVideoElement>(null);
  const base = `/media/clip/${name}-${dark ? "dark" : "light"}`;
  const [free, setFree] = useState<number | null>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v || !available || !counter) return;
    let cues: { t: number; free: number }[] = [], gone = false;
    fetch(`${base}.cues.json`).then((r) => r.json()).then((j) => { if (!gone) { cues = j.cues; tick(); } }).catch(() => {});
    const tick = () => setFree(cues.filter((c) => c.t <= v.currentTime).at(-1)?.free ?? cues[0]?.free ?? null);
    v.addEventListener("timeupdate", tick);
    return () => { gone = true; v.removeEventListener("timeupdate", tick); };
  }, [available, base, counter]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !available) return;
    const calm = matchMedia("(prefers-reduced-motion: reduce)");
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !calm.matches) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, [available, base]);

  return (
    <div className={`loop${className ? ` ${className}` : ""}`} data-loop={name} data-ready={available || undefined}>
      <video key={base} ref={ref} src={`${base}.mp4`} poster={available ? `${base}.webp` : undefined} preload="none" muted loop playsInline aria-label={label} />
      {counter && available && free !== null && <p className="loop-count" aria-live="off">Free space: {free} pt</p>}
    </div>
  );
}
