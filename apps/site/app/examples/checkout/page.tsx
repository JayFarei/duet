import type { Metadata } from "next";
import { Block } from "../block";
import { hasLoop, source } from "../source";
import { CheckoutApp } from "./app";

export const metadata: Metadata = { title: "Checkout", description: "Pay as the Primary with a confirm box, Share and Edit as Actions." };

export default function Page() {
  return <Block name="checkout" title="Checkout" code={source("checkout")} loop={hasLoop("checkout")} app={<CheckoutApp />}
    intro="Pay is the Primary: it grows into a confirm box before it charges. Share and Edit are Actions, Remove waits in More. Turn the device Sideways and the band holds one button, so Pay folds into More: the first tap arms it, the second pays." />;
}
