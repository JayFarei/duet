"use client";

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { Duo3D, type Scene } from "../duo3d/duo3d";
import { WebDuo } from "./web-duo";

// The simulator: the 3D Duo (doan-labs/duo, built into public/duo3d/app by tools/duo3d/build.sh) where the browser
// has WebGL 2, the 2D web Duo where it has not. Until the probe has run, an empty box holds the place.
// fallback: what shows in place of the 2D web Duo without WebGL 2 (the tour's recorded loop of its step).
export function Duo({ scene, idle, chrome, fold, fallback, ...props }: ComponentProps<typeof WebDuo> & { scene?: Scene; idle?: boolean; chrome?: boolean; fold?: number; fallback?: ReactNode }) {
  const [three, setThree] = useState<boolean | null>(null);
  // The probe canvas is marked, so the tests count only the stage's own context, and gives its context back at once.
  useEffect(() => {
    const c = document.createElement("canvas");
    c.dataset.probe = "";
    const gl = c.getContext("webgl2");
    setThree(!!gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }, []);
  if (three === null) return <div className="duo-wait" aria-hidden />;
  if (three) return <Duo3D embed={props.embed} src={props.src} chrome={chrome} scene={scene} idle={idle} fold={fold} />;
  return fallback ?? <div className="web-duo" data-testid="web-duo"><WebDuo {...props} /></div>;
}
