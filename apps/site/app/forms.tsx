"use client";

import { useState, type CSSProperties } from "react";
import { Calendar, Ellipsis, FileText, Folder, House, Image, Inbox, Map as Maps, Menu, Music, Share, SlidersHorizontal } from "lucide-react";

/** The skeleton app's nine places, as the stage's Duo shows them. */
const PLACES = [
  ["Home", House], ["Inbox", Inbox], ["Calendar", Calendar], ["Notes", FileText], ["Files", Folder],
  ["Photos", Image], ["Music", Music], ["Maps", Maps], ["Settings", SlidersHorizontal],
] as const;

/** One tap is 40pt of the strip, after 24pt of padding. A simplified model of duet-ui's fit, close enough to show
 *  the three forms at the Duo's real rooms: unfolded Safari (all nine), the closed Home Screen (seven and More) and
 *  closed Safari upright (a burger). */
export const SLOT = 40;
export type Form = "tabs" | "more" | "menu";
export function fit(room: number, places = PLACES.length): { slots: number; form: Form; tabs: number } {
  const slots = Math.max(0, Math.floor((room - 24) / SLOT));
  // Every place and More fit; else at least three tabs and More; else a burger.
  if (slots >= places + 1) return { slots, form: "tabs", tabs: places };
  if (slots >= 4) return { slots, form: "more", tabs: slots - 1 };
  return { slots, form: "menu", tabs: 0 };
}

export const FORMS: Record<Form, { k: string; h: string; p: string; moment: "fit" | "fold" | "burger" }> = {
  tabs: { k: "10 or more taps fit", h: "Every place is a tab", p: "Each place is one tap away. “…” holds your actions, here Share. Wide unfolded Safari holds all nine.", moment: "fit" },
  more: { k: "4 to 9 taps fit", h: "Tabs and More", p: "As many places as fit stay tabs, the rest go in “…” above your actions. The closed Home Screen shows seven, so put primary places first.", moment: "fold" },
  menu: { k: "Fewer than 4 taps fit", h: "A menu", p: "Fewer than three tabs would show, so one button opens a sidebar with every place. Closed Safari upright, and Split View.", moment: "burger" },
};

/** A phone screen with Duet's controls in the strip beside the page: the dashed outline is the room Duet measured,
 *  the capsule what it drew there. `open` shows More's list or the burger's sidebar. */
export function Device({ room, open = false, selected = 0 }: { room: number; open?: boolean; selected?: number }) {
  const { form, tabs } = fit(room);
  const hidden = form === "more" ? PLACES.slice(tabs) : [];
  const capH = (form === "menu" ? 2 : tabs + 1) * SLOT + 8;
  const Btn = ({ label, on, children }: { label: string; on?: boolean; children: React.ReactNode }) => (
    <span className="dev-b" data-on={on || undefined} aria-label={label} role="img">{children}</span>
  );
  return (
    <div className="dev" style={{ "--room": `${room}px` } as CSSProperties}>
      <div className="dev-page" aria-hidden>
        <p className="dev-title">{PLACES[selected][0]}</p>
        <i style={{ width: "70%" }} /><b /><i style={{ width: "85%" }} /><i style={{ width: "60%" }} /><b />
      </div>
      <div className="dev-strip">
        <span className="dev-room" aria-hidden />
        <span className="dev-cap">
          {form === "menu" ? <>
            <Btn label="Menu" on={open}><Menu size={20} /></Btn>
            <Btn label="Share"><Share size={19} /></Btn>
          </> : <>
            {PLACES.slice(0, tabs).map(([label, Icon], i) => <Btn key={label} label={label} on={i === selected}><Icon size={20} /></Btn>)}
            <Btn label="More" on={selected >= tabs}><Ellipsis size={20} /></Btn>
          </>}
        </span>
      </div>
      {open && form === "more" && (
        <div className="dev-more" style={{ bottom: Math.max(8, (room - capH) / 2) }}>
          {hidden.map(([label, Icon]) => <p key={label}><Icon size={16} />{label}</p>)}
          <hr />
          <p><Share size={16} />Share</p>
        </div>
      )}
      {open && form === "menu" && (
        <div className="dev-side">
          {PLACES.map(([label, Icon], i) => <p key={label} data-on={i === selected || undefined}><Icon size={16} /><span>{label}</span></p>)}
        </div>
      )}
    </div>
  );
}

/** Drag the room: the device's strip grows and shrinks, and the controls step through the three forms. */
const PRESETS: [string, number][] = [["Unfolded Safari", 470], ["Closed Home Screen", 350], ["Closed Safari upright", 150]];
export function RoomSlider() {
  const [room, setRoom] = useState(350);
  const { slots, form, tabs } = fit(room);
  const text = form === "more" ? `The first ${tabs} places are tabs. The other ${9 - tabs} sit in “…”, above Share.` : FORMS[form].p;
  return (
    <div className="room card">
      <div className="room-text">
        <h3 className="tile-h">Drag the room</h3>
        <p className="tile-p">Make the strip shorter and watch the controls step down. Nine places, one Share action.</p>
        <label className="room-label" htmlFor="room"><span>Room</span><span data-testid="room-value">{room} pt, {slots} taps</span></label>
        <input id="room" className="room-range" type="range" min={110} max={480} step={10} value={room} onChange={(e) => setRoom(Number(e.target.value))} />
        <div className="room-presets">
          {PRESETS.map(([label, h]) => <button key={label} className="moment" aria-pressed={room === h} onClick={() => setRoom(h)}>{label}</button>)}
        </div>
        <div className="room-result" aria-live="polite">
          <p className="tile-k">{slots} taps fit for 9 places</p>
          <p className="room-form" data-testid="room-form">{FORMS[form].h}</p>
          <p className="tile-p">{text}</p>
        </div>
      </div>
      <div className="room-device"><Device room={room} open={form !== "tabs"} /></div>
    </div>
  );
}
