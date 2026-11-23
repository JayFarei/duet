/** The examples, in the order the home page, the index and each example's "Other examples" show them. Each has its
 *  one source file at app/examples/<id>/app.tsx. */
export const EXAMPLES = [
  { id: "inbox", title: "Inbox", line: "Navigation in all three fits, Actions, More, and Close over a message." },
  { id: "checkout", title: "Checkout", line: "A Primary with a confirm box, and the Primary folded into More when the device turns." },
  { id: "reader", title: "Reader", line: "Two panes, the Pane bar with Close and Full screen, and a Primary with no confirm box." },
  { id: "inspector", title: "Inspector", line: "Cards that open in an inspector beside the overview, and figures in a viewer group." },
] as const;
export type ExampleId = (typeof EXAMPLES)[number]["id"];
