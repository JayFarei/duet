"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { Duo3D, type Scene } from "../duo3d/duo3d";
import { WebDuo } from "./web-duo";

// The simulator: the 3D Duo (doan-labs/duo, built into public/duo3d/app by tools/duo3d/build.sh) where the browser
// has WebGL 2, the 2D web Duo where it has not. Until the probe has run, an empty box holds the place.
export function Duo({ scene, idle, chrome, ...props }: ComponentProps<typeof WebDuo> & { scene?: Scene; idle?: boolean; chrome?: boolean }) {
  const [three, setThree] = useState<boolean | null>(null);
  // The probe canvas is marked, so the tests count only the stage's own context.
  useEffect(() => { const c = document.createElement("canvas"); c.dataset.probe = ""; setThree(!!c.getContext("webgl2")); }, []);
  if (three === null) return <div className="duo-wait" aria-hidden />;
  return three
    ? <Duo3D embed={props.embed} src={props.src} chrome={chrome} scene={scene} idle={idle} />
    : <div className="web-duo" data-testid="web-duo"><WebDuo {...props} /></div>;
}
