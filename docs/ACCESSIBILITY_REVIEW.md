# Steps 7–8 — Accessibility and polish review

## Observed accessibility results

Safari ran axe-core **4.14.0**, with WCAG 2 A/AA, WCAG 2.1 A/AA and best-practice rules, against these 390 px frames:

| Screen | Passed rules | Violations | Incomplete checks |
|---|---:|---:|---:|
| QR menu, light | 36 | 0 | 0 |
| Cook board, dark | 36 | 0 | 0 |
| Cook board, light | 36 | 0 | 0 |

The developer runner is `/qa/a11y.html?page=qr` or `?page=cook`, with optional `&theme=light` and `&width=390`. It loads the installed development-only axe dependency into a same-origin frame. It is not shipped in the production bundle. The observed summaries are recorded in `qa/results/accessibility-summary.json`; these are not a raw axe export. A few final nonstructural changes to titles, icons and font subsets followed the runs.

**Axe does not produce a Lighthouse-style 0–100 score.** The requested numeric Lighthouse ≥95 acceptance check remains unmeasured; zero axe violations must not be reported as a fabricated Lighthouse score. Automated checks also do not establish complete WCAG conformance.

## Implemented accessibility behavior

- Light/dark text and critical UI colors meet the requested AA ratios. Contrast regression tests resolve actual theme tokens, including hover backgrounds and button foregrounds: 4.5:1 text, 3:1 indicators/borders. Decorative dividers do not communicate control boundaries.
- Focus uses a 2 px `color-primary` ring with 2 px offset; dark mode uses the theme's saffron primary so the ring remains visible.
- Buttons have 48 px targets; waiter/cook actions have 56 px targets. Labels enlarge checkbox targets. Controls wrap rather than shrink below their target sizes.
- Skip links, unique form IDs, explicit password labels, named show/hide controls, linked form errors, named dialogs, semantic buttons/groups, and descriptive notification dismissal labels are present.
- Timer states include icon and visible text, sold-out controls have text, and error messages are explicit. Completed-ticket content is no longer faded below readable contrast.
- New ticket arrivals have a persistent polite live region; toasts, counts and totals announce changes. Keyboard serving moves focus to Undo when its completion removes the focused ticket.
- `html.lang` and page titles follow KY/RU. Dish photos use the localized dish name as alt text and load lazily. The menu uses the same coffee icon family as the staff app.
- Font subsets are limited to Cyrillic, Cyrillic Extended (Kyrgyz), and base Latin, with font-display swap. Images retain fixed intrinsic dimensions.

## Keyboard and zoom verification

A keyboard-only Safari walkthrough passed: code `CAFE01` → name/password (`demo123`) → waiter home → table 1 → add a dish → save a new queued ticket → navigate to the Cook preview → activate Бердим. Input submission used Return, buttons used Safari's Option+Tab and Return. The password-saving browser prompt was dismissed without saving. This tests the local role preview, not authenticated Firebase role transitions or real kitchen delivery.

The QR menu was visually inspected after five Safari zoom-in steps from the default (the 200% step) and paged through. It reflowed to a single column with readable names, descriptions and prices. Browser zoom was restored afterward. Every route/modal at every text-only zoom setting has not been exhaustively tested.

## Polish checklist and limits

| Check | Result |
|---|---|
| Tokens and rhythm | Application CSS colors, spacing and radii centralized; normal spacing follows multiples of four. Two-pixel focus/strokes and screen-reader offsets are deliberate exceptions. Print QR black/white is encoder output. |
| Content and language | Product screens use KY/RU strings or bilingual labels. Only marked Cafe/Product/Logo placeholders remain in the product. Technical component/API names stay invariant in developer gallery/guide. Cafe address says it is awaiting confirmation, not a raw placeholder. |
| Role boundaries | Waiter/Cook have no price-editing controls; Cook availability updates are restricted to soldOut fields. Waiter stats filter the current demo identity. Firestore rules source and callable role checks are supplied, but are not deployed. The explicit role preview remains a review tool, not real access control. |
| Ticket integrity | Additions append a UUID ticket with copied names and stored price snapshots. Serving/Undo only change fulfillment fields; originals are not repriced or edited. Table payment adds closure metadata. |
| Reports | Historical totals, waiter sales and payment split use stored ticket snapshots; regression tests cover this. |
| Offline | A ticket is durably saved before clearing its draft. Storage failure preserves the draft and shows an error. Pending status is visible. Configured delivery retries on reconnect and periodically, keeping the same idempotency key. Tests cover reload, lost acknowledgments, concurrent calls and failed persistence. |
| No duplicate server tickets | `submitTicket` Cloud Function source uses a transaction and immutable idempotency document ID. Lost-ack retries return the original acknowledgment. It rejects changed prices, sold-out dishes, role violations and conflicting keys. This source has syntax checks, not deployed/emulator integration coverage. |
| Sold-out visibility | Both waiter and public menu filter soldOut and visibility. QR tabs also consume menu updates from same-origin browser storage. |
| Performance | Staff code stays off the public entry; irrelevant font subsets were removed. Default menu downloads no photos. Optional external image URLs are lazy; their compression cannot be guaranteed. Mid-range-phone LCP <2.5 s and slow-3G timing remain unmeasured. |
| Identity | Espresso surfaces, saffron focus/accents, consistent coffee/Lucide iconography and Kyrgyz cafe dishes retained. |

## Remaining production work

Firebase project configuration, actual authentication/UID identity, initial admin provisioning, function deployment, security-rule emulator checks, live menu/ticket subscriptions, trusted serving/payment callables and offline reconciliation need integration. Connect `configureOrderTransport(callableOrderTransport(endpoint, cafeId, getIdToken, authenticatedWaiterId))` only after authenticated UID identity is wired; mismatched demo/other-user queues are rejected. Keep demo queues separate from production.

The outbox cannot acknowledge a real kitchen while no backend is configured. A stable idempotency key and server transaction provide exactly-once ticket creation under retries; they do not imply exactly one network request. A lost acknowledgment must be retried. Stale offline prices/sold-out conflicts stay queued for an approved reconciliation flow.

Assumptions: waiters may **read** prices as specified by the order screens, but cannot edit them; Cook cannot alter ticket contents, but can update fulfillment; “old tickets never modified” permits fulfillment and payment metadata. Same demo waiter names map to the same local identity; Firebase UIDs must replace that convention in production.

References: [axe API](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md), [Lighthouse scoring](https://developer.chrome.com/docs/lighthouse/accessibility/scoring), [WCAG contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
