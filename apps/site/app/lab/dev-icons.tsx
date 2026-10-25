// Filled tab icons for a developer app. Like Apple News, every icon is one solid colour (the current text colour:
// ink at rest, the app's single accent when selected), with details cut through the glyph as holes.
import { useId, type ReactNode } from "react";

/** `body` is the glyph, `cut` its details, punched out of it. */
function Svg({ body, cut }: { body: ReactNode; cut?: ReactNode }) {
  const id = useId();
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" fill="currentColor" style={{ display: "block", overflow: "visible" }} aria-hidden>
      {cut && <defs><mask id={`${id}m`}><rect width="24" height="24" fill="#fff" /><g fill="#000">{cut}</g></mask></defs>}
      <g mask={cut ? `url(#${id}m)` : undefined}>{body}</g>
    </svg>
  );
}

/** House with a doorway. */
export const HomeIcon = () => (
  <Svg cut={<rect x="9.4" y="13.2" width="5.2" height="8.3" rx="1.6" />}
    body={<path d="M10.6 2.6a2.2 2.2 0 0 1 2.8 0l7.3 6.1c.5.4.8 1 .8 1.7v8.9a2.2 2.2 0 0 1-2.2 2.2H4.7a2.2 2.2 0 0 1-2.2-2.2v-8.9c0-.7.3-1.3.8-1.7z" />} />
);

/** Speech bubble with typing dots. */
export const ChatIcon = () => (
  <Svg cut={[7.6, 12, 16.4].map((x) => <circle key={x} cx={x} cy="11" r="1.55" />)}
    body={<path d="M12 2.8c5.4 0 9.6 3.6 9.6 8.2s-4.2 8.2-9.6 8.2c-1 0-2-.1-2.9-.4l-4.3 2.3c-.6.3-1.2-.2-1-.8l1-3.4C3.2 15.4 2.4 13.3 2.4 11c0-4.6 4.2-8.2 9.6-8.2z" />} />
);

/** Terminal window with a prompt. */
export const CodeIcon = () => (
  <Svg cut={<>
    <path d="M6.3 9.1a1 1 0 0 1 1.4-.2l3.3 2.5a1 1 0 0 1 0 1.6l-3.3 2.5a1 1 0 1 1-1.2-1.6l2.2-1.7-2.2-1.7a1 1 0 0 1-.2-1.4z" />
    <rect x="12" y="14.4" width="6" height="2" rx="1" />
  </>} body={<rect x="2" y="3.5" width="20" height="17" rx="4.2" />} />
);

/** Avatar: a disc with the person cut out. */
export const ProfileIcon = () => (
  <Svg cut={<>
    <circle cx="12" cy="9.6" r="3.6" />
    <path d="M5.6 18.4c1.2-2.4 3.6-3.8 6.4-3.8s5.2 1.4 6.4 3.8A9.9 9.9 0 0 1 12 21.9a9.9 9.9 0 0 1-6.4-3.5z" />
  </>} body={<circle cx="12" cy="12" r="10" />} />
);

/** App grid. */
export const MenuIcon = () => (
  <Svg body={<>
    <rect x="2.8" y="2.8" width="8.2" height="8.2" rx="2.6" />
    <circle cx="17.1" cy="6.9" r="4.2" />
    <rect x="2.8" y="13" width="8.2" height="8.2" rx="2.6" />
    <rect x="13" y="13" width="8.2" height="8.2" rx="2.6" />
  </>} />
);

/** Magnifier. */
export const SearchIcon = () => (
  <Svg body={
    <path fillRule="evenodd" d="M10.5 2.5a8 8 0 0 1 6.4 12.8l4.4 4.4a1.4 1.4 0 0 1-2 2l-4.4-4.4A8 8 0 1 1 10.5 2.5zm0 2.6a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8z" />
  } />
);
