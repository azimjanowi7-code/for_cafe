# F3 — callable functions and triggers

Status: F3 implemented for `demo-for-cafe` emulators only. Nothing deployed; F4 rules are now implemented locally (see [F4](SECURITY_RULES.md)); reporting UI/recompute remain F5, client transport/realtime remain F6. The frontend staff form still has its old, disconnected prototype adapter; it is not presented as an integrated staff administration flow. The active Functions entry is `functions/lib/index.js`, built from TypeScript in `functions/src`; the old top-level JavaScript files are inactive historical drafts.

## Run and API

Run `npm run test:firebase:f3`. It builds Functions and the emulator frontend, starts fresh Auth/Firestore/Functions/Hosting emulators, seeds disposable fixtures, runs F1–F3 checks sequentially, and shuts down. No cloud credentials are forwarded. The new business entry points require project `demo-for-cafe` and exact loopback Auth/Firestore emulator hosts; running against a real project fails closed. Every function uses asia-south2, maxInstances 2, timeout 30 seconds and concurrency 10. Triggers retry transient failures. The existing Auth blocking hook retains its seven-second limit.

All callables require Firebase Auth ID tokens, exact lowercase claims `{cafeId, role}`, a matching active staff profile, and a live Auth user whose claims still match. Disabled users and revoked sessions are denied. Cafe identity comes from claims, never a caller-supplied cafeId. Transactional writes recheck the actor profile. Schemas reject unknown fields, invalid IDs, wrong types and oversized values.

| Function | Input | Authorization/result |
|---|---|---|
| `createStaff` | `{name, role, password, requestId}` | Admin; role waiter/cook only; returns `{uid}`. Normalization and cafe-scoped name reservation match F2. Creates Auth identity, sets claims, commits staff profile. |
| `resetStaffPassword` | `{uid, newPassword, requestId}` | Admin; same-cafe waiter/cook target; returns `{uid}`. Changes password and revokes refresh tokens. |
| `setStaffActive` | `{uid, active, requestId}` | Admin; same-cafe waiter/cook target; returns `{uid}`. Sets Auth disabled and profile active consistently; deactivation revokes tokens. |
| `submitOrder` | `{clientOrderId, tableId, sessionId, items, note}` | Waiter/admin; waiter owns the open session. Returns `{clientOrderId}`. Creates `orders/{clientOrderId}` once. |
| `closeTable` | `{sessionId, paymentType:'cash'|'card'}` | Waiter owns the session or caller is admin. Returns `{sessionId,total,paymentType}`. No client total accepted. |

Passwords are 12–128 characters and never stored or logged in Firestore/audit. IDs are ASCII letters/digits/underscore/hyphen, max 128; retry IDs and clientOrderId have a minimum of eight characters. Generate a UUID **before** the first attempt and retain it for every retry. Order lines are 1–100 unique itemIds, qty integer 1–99, nonnegative price ≤1,000,000 with at most two decimals, nameKy/nameRu ≤200 characters, initial served false. Note ≤500 characters. F4 supersedes the initial F3 caller-price contract: submitOrder now accepts only item IDs/qty and copies current server menu names/prices. Existing committed snapshots remain immutable. Money arithmetic uses integer hundredths and converts to KGS for storage.

## Idempotency and partial failures

Staff `requestId` is a required extension to the original input signatures. An operation is bound to actor/action/retry ID and non-secret target metadata. Changing metadata with the same ID is rejected; reusing a completed ID returns its original result. Never reuse an ID for a different password or intent. Passwords and password-derived hashes are deliberately excluded from operation documents.

`operations/{hash}` and `staffLocks/{uid}` serialize mutations per staff identity. The same pending operation can resume after its sixty-second execution lease expires, or immediately after a caught failure; a different operation cannot overtake it. This exceeds the function's thirty-second timeout. A deterministic Auth UID and name reservation allow interrupted creation to resume. Profiles are committed only when the Auth steps succeeded; an incomplete new identity is disabled on caught failures, and without an active profile it cannot enter the app. Started/completed audit IDs are deterministic. Auth and Firestore are separate services, so this is a resumable workflow, not an atomic cross-service transaction. If the original password is unavailable after an interrupted reset/create, a trusted local operator must repair the pending operation; do not delete locks blindly or submit a new operation ID.

`submitOrder` transactionally reads the session/table, membership and current menu availability, then creates the order, trusted `orderReceipts/{id}` and audit together. A repeated ID with identical immutable content returns the existing order, including after closure; conflicting content/owner is rejected. This is the recommended transport for F6. A concurrent close reads/updates the same session, so it serializes with submission. New items require a new clientOrderId/ticket. Server functions do not rewrite old snapshot lines.

## Trigger behavior

`publishMenuItem` watches `cafes/{cafeId}/menuItems/{itemId}` writes. In a transaction it reads the **current** item/category rather than trusting an old event payload, replaces the public item with the exact sanitized whitelist (`name`, `description`, `price`, `categoryId`, `order`, `categoryOrder`, `photo`), or deletes it for hidden/sold-out/deleted/invalid data. Name/description maps copy only ky/ru; optional photo must be HTTPS. Event-derived audit IDs deduplicate delivery. Category ordering changes alone do not trigger this item watcher; category-wide republishing remains a later menu-management integration detail.

`onOrderCreate` validates shape, item existence and sold-out state. An accepted receipt from `submitOrder` proves availability was checked transactionally **at creation**, so later menu edits cannot invalidate an accepted queued ticket. For trusted Admin SDK writes without a receipt (fixtures/imports), availability is checked at trigger-processing time. A Firestore trigger is asynchronous and cannot undo the original create: invalid raw orders are quarantined with validation rejected/status cancelled, preserving the submitted snapshots and excluding them from aggregates. F4 must deny edits to receipt/processing/validation metadata and should require the callable path for strict availability-at-creation guarantees. This decision is now resolved by user approval in F4: all direct client order creates are denied.

`orderProcessing/{clientOrderId}` is the durable deduplication/validation marker. Duplicate trigger invocations cannot increment twice. Accepted orders increment only ordersPlaced/dishesOrdered, using Asia/Bishkek day keys. They do **not** create revenue or waiter sold totals. Raw invalid orders get one rejection audit and no aggregate contribution. UI listeners must show accepted tickets only once F6 is connected.

Firebase documents that Firestore events can arrive more than once and out of order; current-state reads and transactional markers address those cases. See [Firestore event delivery](https://firebase.google.com/docs/functions/firestore-events), [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), and [Admin user management](https://firebase.google.com/docs/auth/admin/manage-users).

## Closing and aggregation foundation

`closeTable` reads at most 200 session tickets in one transaction; sessions above that limit fail without writes. Pending validation blocks closure; rejected/cancelled tickets are excluded. Every included order must have an accepted processing marker whose immutable fingerprint still matches. The server sums snapshot qty×price, never current menu price or caller totals, closes the session and frees the matching table atomically. Repeating the same session/payment returns the stored result; changing payment after closure is rejected.

Only closed (paid) sessions contribute revenue, table totals, cash/card split, snapshot dish quantities and waiter sold-dishes totals. The closure timestamp/date key uses Asia/Bishkek (UTC+6); concurrent closures transact on the daily aggregate to avoid lost updates. Empty sessions can close with zero total and count as a closed table. These backend aggregate fields are the F3 foundation; F5 will add served/wait-time tracking, report subscriptions, period reports and backfill/recompute. No claim is made that the current prototype report UI consumes these records.

## Private server collections and auditing

Under each cafe: `audit/{deterministicId}`, `operations/{hash}`, `staffLocks/{uid}`, `orderReceipts/{clientOrderId}`, `orderProcessing/{clientOrderId}`, plus the existing F2 `loginNames` and bootstrap marker. All remain inaccessible to direct clients under F4 rules. Successful business changes have deterministic completion audits; staff mutations also write a started audit before external Auth work. No password, token or raw request body is audited. Order rejection reasons are safe fixed codes. The F1 seed's inactive staff-only sample order is now correctly quarantined by the new trigger; F3 tests create active Auth-backed fixtures separately.

## Verification and next boundary

The suite proves waiter/cook/anonymous denial, schema/role escalation rejection, duplicate names, cross-cafe staff protection, Auth disabling/restoring, password reset, interrupted creation/reset recovery, public projection sanitization/removal/restoration, order replay and trigger dedupe, invalid order quarantine, unchanged snapshot prices, exact paid totals, concurrent closure idempotency, ownership checks, tamper rejection and UTC+6 boundaries. F4 rules were subsequently implemented and tested locally; see SECURITY_RULES.md.

App Check decision recorded: reCAPTCHA Enterprise preferred (v3 fallback), final configuration at F7. Local F2 test provider remains unchanged; no production site key is needed for F3.

## F4 contract update

`submitOrder.items` now contains only `{itemId,qty}`. No caller price, name or owner field is accepted. Both visible=true and soldOut=false are required in the transaction. The receipt stores an intent fingerprint separately from the snapshot fingerprint, so an acknowledged or uncertain-ack retry cannot reprice old orders after menu changes. Separate `servedItems` flags protect immutable snapshot arrays while allowing cook fulfillment. F6 will connect the durable queue and add the required offline/reload/reconnect real-callable test; its detailed acceptance plan is in SECURITY_RULES.md.

## F5 statistics update

F5 supersedes the original incremental aggregate implementation: one transactional day rebuild now publishes cafe/private waiter totals together, driven by order/session write triggers and an admin-only recomputeStats callable. closeTable commits the paid session first and awaits that canonical follow-up; retries preserve one payment. Reports, own My Stats and Cook today now read real emulator aggregates. Details and explicit capacity limits: [STATISTICS.md](STATISTICS.md). F6 transport/board subscriptions remain deferred.
