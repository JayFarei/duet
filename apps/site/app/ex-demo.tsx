import { Archive, Check, CreditCard, Ellipsis, File, Inbox, Maximize2, PanelLeft, Send, Star, Trash2, X } from "lucide-react";

/** A small looping demo on each example card, in the spirit of anime.js's documentation previews: a page, the
 *  controls Duet draws beside it, and what they do, in CSS keyframes (site.css, "Example demos"). Still under
 *  prefers-reduced-motion. */
export function ExDemo({ name }: { name: "inbox" | "checkout" | "reader" }) {
  if (name === "inbox") return (
    <div className="exd" data-demo="inbox" aria-hidden>
      <span className="exd-label">Navigation</span>
      <span className="exd-page" />
      <span className="exd-step exd-s1">
        <span className="exd-group exd-tabs">
          <span className="exd-sel" />
          <Inbox size={14} /><Send size={14} /><Star size={14} /><File size={14} /><Archive size={14} /><Trash2 size={14} />
        </span>
      </span>
      <span className="exd-step exd-s2">
        <span className="exd-group"><Inbox size={14} /><Send size={14} /><Star size={14} /></span>
        <span className="exd-group exd-one"><Ellipsis size={14} /></span>
      </span>
      <span className="exd-step exd-s3"><span className="exd-group exd-one"><PanelLeft size={14} /></span></span>
      <span className="exd-cap exd-s1">Tabs</span>
      <span className="exd-cap exd-s2">Tabs + More</span>
      <span className="exd-cap exd-s3">Sidebar</span>
    </div>
  );
  if (name === "checkout") return (
    <div className="exd" data-demo="checkout" aria-hidden>
      <span className="exd-label">Primary</span>
      <span className="exd-page" />
      <span className="exd-pay">
        <span className="exd-pay-icon"><CreditCard size={15} /></span>
        <span className="exd-pay-text">Pay $24</span>
        <span className="exd-pay-done"><Check size={16} strokeWidth={3} /></span>
      </span>
      <span className="exd-tap" />
      <span className="exd-cap exd-c1">Tap Pay</span>
      <span className="exd-cap exd-c2">Confirm</span>
      <span className="exd-cap exd-c3">Paid</span>
    </div>
  );
  return (
    <div className="exd" data-demo="reader" aria-hidden>
      <span className="exd-label">Pane bar</span>
      <span className="exd-page" />
      <span className="exd-pane" />
      <span className="exd-group exd-panebar"><X size={13} /><Maximize2 size={13} /></span>
      <span className="exd-cap exd-r1">Second pane</span>
      <span className="exd-cap exd-r2">Full screen</span>
      <span className="exd-cap exd-r3">Close</span>
    </div>
  );
}
