"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { Duo3D } from "../duo3d/duo3d";
import { WebDuo } from "./web-duo";

// The simulator: the 3D Duo (doan-labs/duo, built into public/duo3d/app by tools/duo3d/build.sh) where the browser
// has WebGL 2, the 2D web Duo where it has not and before hydration.
export function Duo(props: ComponentProps<typeof WebDuo>) {
  const [three, setThree] = useState(false);
  useEffect(() => setThree(!!document.createElement("canvas").getContext("webgl2")), []);
  return three ? <Duo3D embed={props.embed} /> : <WebDuo {...props} />;
}
