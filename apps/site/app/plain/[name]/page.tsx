import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CheckoutApp } from "../../examples/checkout/app";
import { InboxApp } from "../../examples/inbox/app";
import { InspectorApp } from "../../examples/inspector/app";
import { ReaderApp } from "../../examples/reader/app";
import { PlainBack } from "./plain-back";

// An example's app alone, served at /examples/<name>?plain (proxy.ts rewrites it here). The device stage's
// screens load it, and so does "Open in new tab". A route of its own, so the server sends the app and nothing else:
// the screens never paint the example page first.
const APPS: Record<string, [string, () => ReactNode]> = {
  inbox: ["Inbox", () => <InboxApp />],
  checkout: ["Checkout", () => <CheckoutApp />],
  reader: ["Reader", () => <ReaderApp />],
  inspector: ["Inspector", () => <InspectorApp />],
};

export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(APPS).map((name) => ({ name }));

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  return { title: APPS[name]?.[0], robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const app = APPS[name];
  if (!app) notFound();
  return <>{app[1]()}<PlainBack name={name} title={app[0]} /></>;
}
