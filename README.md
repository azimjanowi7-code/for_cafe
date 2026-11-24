# Дасторкон — local demo

Current mode is a static presentation demo with **no backend**. Run `npm ci && npm run dev`; build `npm run build:demo` and serve `dist/` with `npm run preview`. Accounts, three-minute walkthrough and static hosting instructions: [docs/DEMO.md](docs/DEMO.md). Nothing has been deployed.

The default entry always uses `src/demo/DemoApp.tsx`, including when an old Firebase environment variable exists. Previous Firebase/emulator implementation and deployment material below are historical and inactive in the demo bundle.

---

# [Product Name] — cafe app prototype

React, Vite, TypeScript and Tailwind with self-hosted Inter Variable, Lucide icons, an espresso/saffron theme and an offline-cached PWA. Implements the frontend screens, motion, responsive layouts, accessibility improvements and local workflows from Steps 1–8. Firebase production integration is not configured. F1 now adds isolated emulator setup, a guarded DEMO-001 seed, and a Firestore-backed QR read path; see [F1 setup and data model](docs/DATA_MODEL.md). F2 adds emulator-only staff authentication; see [authentication](docs/AUTHENTICATION.md). F3 adds guarded server callables/triggers; see [Cloud Functions](docs/CLOUD_FUNCTIONS.md). F4 adds tested tenant/role security rules and callable-only server-priced orders; see [security rules](docs/SECURITY_RULES.md). F5 connects emulator Reports/My Stats/Cook totals and adds safe backfill; see [statistics](docs/STATISTICS.md). F6 connects the scoped callable outbox, persistent multi-tab cache, realtime Cook/Waiter workspace and offline QR; see [offline/realtime](docs/OFFLINE_REALTIME.md). F7 deployment preparation adds guarded staging/production scripts, HTTPS/cache headers, empty cloud environment examples and printable QR sheets; see [owner deployment and rollback guide](docs/DEPLOY.md). No cloud release is authorized or ready: emulator-only runtime activation awaits project/Blaze confirmation. F8 remains pending.

## Run and verify

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

The default route is the dark Cook board. Russian is default; Kyrgyz is remembered per device. Demo login: cafe code `CAFE01`, any nonempty name, password `demo123`. Roles are explicit review controls, not authentication. To review F1, run `npm run emulators:start` and open `http://127.0.0.1:5080/qr`; this QR route reads the seeded Firestore public projection. In the emulator build, staff login uses Firebase Auth and claims; Waiter/Cook business flows use the emulator workspace and durable callable queue; the default non-Firebase build remains an isolated prototype.

## Screens

- `/qr`: separate read-only public menu; KY/RU switch; available dishes grouped by category; one phone column, two-card columns from 640 px; localized photo alt text and lazy loading; no staff navigation or ordering.
- `/login`: cafe code, then labelled name/password, visibility toggle and demo role choice; localized validation errors.
- `/waiter`: table filters, phone panes or tablet split from 768 px, per-table drafts, new immutable order tickets, running total, previous tickets and delivery status, local payment confirmation and own demo statistics.
- `/cook`: oldest-first tickets, stable late styling, served-time statistics, searchable Бүттү manager, sound toggle, new-ticket announcements, serving and five-second Undo.
- `/admin`: bilingual menu editing, visibility, availability, confirmed price editing and history; printable/downloadable QR sheets; staff forms and callable adapter; Day/Week/Month snapshot reports; settings. Navigation becomes a drawer below 1024 px.
- `/gallery` and `/guide`: developer component specimens and design tokens. Component/API identifiers remain invariant.

All app colors, spacing and radii use centralized CSS tokens. The Inter bundle includes only Cyrillic, Cyrillic Extended for Kyrgyz, and base Latin. Page titles and `html.lang` follow KY/RU. Motion respects reduced-motion preferences.

## Verification and review tools

- Production build passes; all **38 unit tests** pass. Tests cover theme contrast, stored prices, period boundaries, reports, serving/Undo, durable queue behavior, retry deduplication contracts and the staff adapter.
- Observed Safari axe-core 4.14.0 audits: QR, Cook dark and Cook light each had **36 passed rules, zero violations and zero incomplete checks**. Axe does not provide a numeric Lighthouse score.
- A keyboard-only local-demo walkthrough passed cafe code → login → table selection → add dish → queue ticket → Cook preview → Бердим. QR reflow was inspected at Safari's 200% zoom step, then zoom was restored.
- Step 6 rendered 14 screen states at 360, 390, 768, 1024 and 1440 px: 70 combinations passed overflow checks. Final accessibility target-size changes were not followed by another exhaustive 70-state sweep.

Open `/review.html?page=waiter%3Ftab%3Dmenu` to measure all five widths. Add `&width=768&interactive=1` for one interactive frame, or `&focus=1&height=520` for short-viewport visual review. `/qa/a11y.html?page=qr` runs axe in the development server; optional `page=cook&theme=light` audits the other theme. The axe runner and dependency are not in the production bundle.

Details: [screens](docs/SCREENS.md), [motion](docs/MOTION.md), [responsive review](docs/RESPONSIVE.md), [accessibility and polish checklist](docs/ACCESSIBILITY_REVIEW.md).

## Persistence and backend boundary

Local menu edits, tickets, payment records, language and demo waiter identities persist on the device. New orders enter a durable per-ticket outbox before the draft clears; storage failure preserves the draft. With a configured transport, delivery retries on reconnect and periodically using the same UUID idempotency key. Server acknowledgments are required before a ticket is marked sent.

`functions/src` is the active, emulator-tested TypeScript backend: staff administration, public menu projection, idempotent order submission/validation and snapshot-based table closing. Top-level `functions/index.js` and `functions/orders.js` are inactive historical drafts. `firestore.rules` is the F4 deployment candidate, identical to the tested emulator rules. Direct order creation and private server metadata writes are denied; scoped menu/fulfillment/session-opening permissions are covered by the rules matrix. No rules are deployed. The ordinary frontend demo roles do not secure data.

Production work remains: Firebase project configuration, real App Check attestation (reCAPTCHA Enterprise preferred; finalize F7), deployed functions/rules, live business subscriptions, serving operations and offline reconciliation. Local Auth/UID identity, bootstrap and F3 APIs are implemented. Keep demo queues separate from production. See [staff backend setup](docs/STAFF_BACKEND.md) and [final integration notes](docs/ACCESSIBILITY_REVIEW.md).

A numeric Lighthouse accessibility score ≥95, mid-range-phone LCP <2.5 s and slow-3G timing are **not measured**. Optional external photo URLs load lazily; their compression depends on the supplied assets. No real kitchen delivery, payment processing or deployed security guarantee is claimed.

Assumptions: waiters can read menu prices but cannot edit them; immutable ticket contents allow separate fulfillment/payment metadata; same demo waiter names map to the same local identity until Firebase UIDs replace it.
