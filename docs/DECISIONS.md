# Scope and open decisions

[Product Name] includes a read-only public QR-menu and an internal staff app.
Customers browse menu prices and ask a waiter to order; QR ordering is excluded.
Admin/Chef manages menu, prices, accounts, reports, and timer thresholds.
Waiter selects tables, creates separate tickets, and sees their own daily sales.
Cook reads tickets, marks items/orders “Бердим,” toggles “Бүттү,” and sees today's statistics.
The target stack is React/Vite/TypeScript/Tailwind, Firebase Auth/Firestore/Functions/Hosting, and PWA.
Cafe-scoped permissions, immutable order contents, price snapshots, offline queues, and Russian/Kyrgyz are required.

## Implemented scope

Steps 1–4: design foundations, responsive role layouts, reusable core components, style guide, and interactive component gallery. These are a local frontend prototype, not a production ordering system. Placeholder names and example dishes/tickets are demonstration fixtures. No business activity, revenue, staff account, or real cafe has been inferred.

## Open questions

1. Does revenue count only on table closure/payment, or on serving? The prototype shows zero revenue and does not treat served tickets as paid.
2. Who may close tables? Can multiple waiters share a table, and how should their sales be attributed?
3. What is the approved correction/cancellation flow while keeping original tickets intact?
4. How are the initial Admin/Chef and forgotten-password resets provisioned? Are names unique within each cafe?
5. Are service charges, discounts, fractional som, or tax calculations needed? KGS formatting is now specified.
6. Which daily statistics may Cook see? The preview currently displays aggregate sample counts only.
7. Is a persistent local queue until reconnection sufficient, or is kitchen delivery required during internet outages?
8. Supply the Firebase project configuration and intended deployment environment before connecting authentication, Cloud Functions, Firestore, and Hosting.

## Deliberate boundaries

The role switcher and login screens are explicitly demonstration controls. Frontend visibility is not security enforcement. No passwords are stored. No server claims or production permissions are simulated.

Example tickets and availability changes persist in localStorage so role views share the same local preview state. LocalStorage is not the production durable outbox. New demo tickets remain queued, even when online, since there is no Firebase server to acknowledge them. Automatic sending, retry/deduplication, authenticated staff creation, tenant-scoped security rules, validated backend prices, authoritative timestamps, and payments remain backend work.

The Bill sheet uses immutable snapshot amounts, cash/card choice, and confirmation. Payment does not change served state; Cook records completion independently. Step 4 confirmation records a local demo payment, archives the table’s tickets, and releases the table. This is not a backend payment. Local stats attribute closed table visits to the demo waiter; production attribution rules remain open.

## Foundations

All supplied color values and aliases are defined in src/theme.css. Saturated success/warning colors serve as indicators rather than small foreground text. Labels use the text/text-muted tokens. Exact timer boundaries are green below 10, warning from 10 through 20 inclusive, late above 20. Admin can change thresholds in the local preview.

Inter Variable is bundled locally with @fontsource-variable/inter; no runtime font CDN is needed. Test Kyrgyz glyphs with the installed font coverage check described in README. All theme sizes, shadows, radius values, spacing primitives, and breakpoints are centralized. Layouts target 360, 768, and 1280 px, with a single-column mobile Cook board and four-column desktop board.

Cook tickets keep order contents fixed; only item and completion states change. Additional orders append a separate ticket with its own price snapshot. Sold-out dishes disappear from Waiter and QR-menu views and can be restored by Cook or Admin/Chef.

## Production data/security plan

Use /cafes/{cafeId}/members/{uid}, menu/{dishId}, tables/{tableId}, tickets/{ticketId}, and payments/{paymentId}. Membership and role must be derived from trusted authentication, never a client role selector. Public clients may read only a deliberately public menu projection; private tickets, staff, and reports must be inaccessible. Cook writes must allow only availability and served-state transitions. Waiter report reads must be restricted to their uid/day. Only Admin/Chef may change prices or call account provisioning. Provision accounts with an authenticated, cafe-scoped callable Cloud Function and Firebase Admin SDK; do not ship service-account credentials.

When integrating Firestore, enable IndexedDB persistence, use a durable idempotent outbox, and distinguish local pending writes from server acknowledgment. Queued orders must retain snapshots; backend validation must explicitly resolve stale offline prices and sold-out conflicts without silent data loss. This plan is documentation, not a claim that security rules have been deployed.

Cook/admin extension adds snapshot-based paid-visit reports, QR sheets, menu editing and callable staff management source. Staff integration remains unconfigured and undeployed; see STAFF_BACKEND.md. Existing staff-creation boundary statements refer to the disconnected live system, not the newly implemented forms and adapter.


Steps 7–8 add a durable outbox, idempotent submission function source, security rules source and an accessibility/polish audit. These supersede earlier statements that no outbox source exists, while production Firebase integration is still absent. See ACCESSIBILITY_REVIEW.md for verified results and unresolved deployment/performance checks.
