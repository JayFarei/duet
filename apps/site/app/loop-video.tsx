"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "./theme";

/** A recorded clip of the 3D Duo (tools/media writes public/media/clip/<name>-<light|dark>.{mp4,webp}): silent,
 *  looping, its poster first. It plays only while a quarter of it is on screen and never under reduced motion. Before
 *  the clip is recorded (`available` false, checked on the server) it keeps the same box as a plain placeholder, and
 *  with preload="none" and no play() the browser never asks for the missing file. `still`: an image shown meanwhile. */
export function LoopVideo({ name, available, label, className, still }: { name: string; available: boolean; label: string; className?: string; still?: string }) {
  const dark = useTheme().dark;
  const ref = useRef<HTMLVideoElement>(null);
  const base = `/media/clip/${name}-${dark ? "dark" : "light"}`;

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
      {!available && still && <img className="loop-still" src={still} alt="" loading="lazy" />}
      <video key={base} ref={ref} src={`${base}.mp4`} poster={available ? `${base}.webp` : undefined} preload="none" muted loop playsInline aria-label={label} />
    </div>
  );
}
