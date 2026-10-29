"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { Duo3D } from "../duo3d/duo3d";
import { DUO_PORT } from "../duo3d/shared";
import { WebDuo } from "./web-duo";

// The simulator: the 3D Duo where doan-labs/duo runs beside this site (tools/duo3d/setup.sh, which needs Apple's
// model, so only on a machine that has it and never in production), the 2D web Duo everywhere else.
export function Duo(props: ComponentProps<typeof WebDuo>) {
  const [three, setThree] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 1500);
    fetch(`${location.protocol}//${location.hostname}:${DUO_PORT}/`, { mode: "no-cors", signal: ctl.signal }).then(() => setThree(true), () => {}).finally(() => clearTimeout(t));
    return () => ctl.abort();
  }, []);
  return three ? <Duo3D embed={props.embed} /> : <WebDuo {...props} />;
}
