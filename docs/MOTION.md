# Step 5 — Interactions and motion

All CSS motion is in `src/motion.css`; matching JavaScript deadlines are in `src/motion.ts`. Easing is cubic-bezier(.2,.8,.2,1).

| Interaction | Timing | Behavior |
|---|---|---|
| Button press | 100 ms | Scale 0.98; disabled buttons stay still |
| Micro feedback | 150 ms | Button colors, input focus, stepper count |
| Bottom total | 150 ms | Subtle opacity fade; amount changes immediately |
| Standard feedback | 200 ms | Toast entrance and theme changes |
| Ticket arrival | 200 ms + 2 s | Slide down from top; separate highlight fades for 2 s |
| Бердим completion | 250 ms | Ticket grid row collapses and fades, then stored status updates |
| Undo | 5 s | Independent action per serving change, measured from the click |
| Sheets | 250 ms | Enter, backdrop, close controls, Escape and backdrop dismissal |
| Timer thresholds | 300 ms | Smooth color/border/shadow changes; no flashing |
| Loading | 300 ms maximum spinner | Lists show static skeletons immediately; button and sync spinners become static skeletons at 300 ms |

Undo before commit cancels the pending completion. Undo after commit restores only lines changed by that action, preserving previously served dishes, historical prices and later metadata. Independent actions can be undone out of order. A pending completion merges changed lines so it cannot overwrite an earlier Undo. Closing a toast does not accelerate the ticket collapse. Deadlines use absolute timestamps and do not restart on unrelated renders.

Reduced-motion mode globally disables CSS animations and transitions, removes press scaling, and skips JavaScript serving/sheet exit delays. It also responds if the preference changes while an exit is pending. Data changes, skeletons, sound preference and the five-second Undo window remain usable.

Empty states show one friendly line and one action: clear a menu search, show all tables/orders, refresh staff, or open the menu from reports. No customer ordering action is added to the public QR menu.

## Verification

- Production TypeScript/Vite build passes.
- All 12 model, serving and adapter tests pass.
- Serving regression tests cover partial serving, independent Undo actions, earlier Undo during pending completion, metadata preservation and repeated completion of an already served line.
- Source review confirms motion declarations use the listed tokens; old flash/pulse animations were removed.
- Browser rendering, actual animation frames and an OS reduced-motion toggle have not been visually verified because the browser host was unavailable in this session. These remain manual visual acceptance checks.
