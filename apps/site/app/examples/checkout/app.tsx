"use client";

import { useState, type CSSProperties } from "react";
import { CreditCard, Pencil, Share, Trash2 } from "lucide-react";
import { Duet, column } from "duet-ui";
import { useTheme, useTint } from "../../theme";

// A cart with Share and Edit as actions, Remove folded into More, and Pay as the primary: it grows into a confirm
// box before it charges. Turned sideways the band holds one button, so Pay folds into More too: the first tap
// arms it, the second pays.
type Item = { id: string; name: string; note: string; price: number; qty: number };
const CART: Item[] = [
  { id: "case", name: "Leather case", note: "Midnight", price: 59, qty: 1 },
  { id: "cable", name: "Braided cable, 2 m", note: "White", price: 29, qty: 2 },
  { id: "stand", name: "Folding stand", note: "Aluminium", price: 49, qty: 1 },
];

const page: CSSProperties = { minHeight: "100dvh", background: "var(--bg)", color: "var(--ink)", font: "400 17px -apple-system, system-ui" };
const title: CSSProperties = { font: "700 32px/1.1 -apple-system, system-ui", letterSpacing: -0.4, margin: "0 0 12px" };
const line: CSSProperties = { display: "grid", gridTemplateColumns: "56px 1fr auto", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "0.5px solid var(--line)" };
const dim: CSSProperties = { color: "var(--dim)", font: "400 15px/1.35 -apple-system, system-ui" };
const usd = (n: number) => `$${n.toFixed(2)}`;

export function CheckoutApp() {
  const { appearance } = useTheme();
  const { tint } = useTint();
  const [cart, setCart] = useState(CART);
  const [editing, setEditing] = useState(false);
  const [paid, setPaid] = useState(false);
  const total = cart.reduce((a, i) => a + i.price * i.qty, 0);

  return (
    <Duet
      actions={[
        { id: "share", label: "Share", icon: <Share size={22} /> },
        { id: "edit", label: editing ? "Done" : "Edit", icon: <Pencil size={22} />, onPress: () => setEditing((e) => !e) },
        { id: "remove", label: "Remove last item", icon: <Trash2 size={22} />, destructive: true, folded: true, onPress: () => setCart((c) => c.slice(0, -1)) },
      ]}
      primary={paid || !cart.length ? undefined : { id: "pay", label: "Pay", icon: <CreditCard size={22} />, confirm: `Pay ${usd(total)}`, onPress: () => setPaid(true) }}
      appearance={appearance}
      tint={tint}
    >
      <main style={page}>
        <div style={{ ...column(640), paddingTop: "calc(24px + env(safe-area-inset-top))", paddingBottom: 120 }}>
          <h1 style={title}>Cart</h1>
          {cart.map((i) => (
            <div key={i.id} style={line}>
              <div aria-hidden style={{ width: 56, height: 56, borderRadius: 14, background: "var(--card)", boxShadow: "0 0 0 0.5px var(--line)" }} />
              <div><div>{i.name}</div><div style={dim}>{i.note}, {i.qty} × {usd(i.price)}</div></div>
              {editing
                ? <button onClick={() => setCart((c) => c.filter((x) => x.id !== i.id))} style={{ border: 0, background: "none", color: "#ff3b30", font: "inherit", cursor: "pointer" }}>Remove</button>
                : <span>{usd(i.price * i.qty)}</span>}
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", fontWeight: 600 }}><span>Total</span><span>{usd(total)}</span></div>
          {paid && <p data-testid="checkout-paid" role="status" style={{ padding: 16, borderRadius: 14, background: "var(--card)" }}>Paid {usd(total)}. Thank you.</p>}
          {!cart.length && <p style={dim}>The cart is empty.</p>}
        </div>
      </main>
    </Duet>
  );
}
