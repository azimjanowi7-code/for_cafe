# F4 — Firestore security rules

Status: implemented and tested locally. No rules or functions deployed. `firestore.rules` is the deployment candidate; `firebase/emulator.firestore.rules` contains identical bytes, with equality asserted by the tests. The separate emulator configuration remains isolated from cloud aliases. F5 reporting is now documented separately in STATISTICS.md; F6 work has not started.

## Authorization and collection policy

Default deny applies to every unmatched document and subcollection. Helpers `isSignedIn`, `cafeId`, `role`, `sameCafe`, `isAdmin`, `isWaiter` and `isCook` use token claims **and** the same-cafe active staff profile. A role mismatch or inactive profile immediately denies private access. Knowing a document ID, passing another cafe ID, or querying a collection group cannot grant access to another cafe. An own-profile single get is the sole inactive-account exception, allowing the existing KY/RU deactivation error; it grants no business access.

| Collection | Admin | Waiter | Cook | Anonymous |
|---|---|---|---|---|
| `cafes/{cafe}` | Get; update validated name/settings | Get | Get | Denied |
| `menuCategories` | Read, create, update, delete | Read | Read | Denied |
| `menuItems` | Read, validated create/update, delete | Read | Read; update **soldOut only**, boolean | Denied |
| `menuItems/.../priceHistory` | Read | Denied | Denied | Denied |
| `tables` | Read; create/delete/renumber free tables; open atomically with a session | Read; atomic opening only | Read | Denied |
| `tableSessions` | Read; create an initial open session atomically | Own sessions read; create own open session atomically | Denied | Denied |
| `orders` | Read; fulfillment or soft cancel on an open session | Read own tickets or tickets in a session they opened | Read; fulfillment only | Denied |
| `dailyStats/{day}` | Get/list | Denied | Single get for today's Asia/Bishkek date only | Denied |
| `dailyStats/.../waiters/{uid}` | Get/list | Own UID single get only | Denied | Denied |
| `staff/{uid}` | Own single get; administration through callables | Own single get | Own single get | Denied |
| `publicMenu/{cafe}` | Public single get | Public single get | Public single get | Public single get |
| `publicMenu/{cafe}/items` | Public read | Public read | Public read | Public read |
| `cafeCodes` | Direct access denied; F2 gateway only | Same | Same | Same |
| Audit/operations/locks/receipts/processing/loginNames/bootstrap/unknown paths | Direct access denied | Denied | Denied | Denied |

No client may create or delete orders, update/delete sessions, write statistics, write public projections, change staff records, or write price history. Admin may soft-cancel an unpaid session's ticket; paid history cannot be cancelled or erased through client rules. Every snapshot field remains immutable, including the complete `items` array. The F2-approved callable code lookup intentionally supersedes the original public Firestore single-get proposal, preventing a rate-limit bypass.

Staff administration **including listing** remains server-only. F3 already supplies create/reset/activation callables; a minimal admin-only list endpoint will be needed when the prototype Staff screen is connected in F6. There is no broad staff read permission hidden behind an admin wildcard.

## Callable-only orders and authoritative prices

User-approved F4 decision: all client order creation uses `submitOrder`. Its input is now:

```ts
{
  clientOrderId: string, // Generate once, retain across retries.
  tableId: string,
  sessionId: string,
  items: Array<{ itemId: string; qty: number }>,
  note: string
}
```

Client-supplied cafe/owner/name/price/snapshot/status fields are rejected. The server derives cafe/role/UID from Auth, checks the active profile and open session, then transactionally reads every menu item. Each must exist, be visible, not be sold out, and have valid bilingual names and a price. It stores the **current server menu names and prices**, sets waiterId from auth.uid, and writes `orders/{clientOrderId}` plus a trusted receipt and audit atomically. Qty remains integer 1–99, at most 100 unique items. This supersedes F3's earlier caller-price snapshot contract.

The receipt now has separate hashes for submitted intent and stored immutable snapshots. A retry matches intent before consulting current availability/prices or session state. It returns the existing order without repricing, even if the item later becomes hidden/sold out, the staff display name changes, or the session closes. Conflicting quantities/owner/session/note with the same ID are rejected. Only the server can write receipts or validation/processing markers. Raw Admin SDK imports remain trusted infrastructure, outside the direct-client rule boundary.

## Cook serving without snapshot edits

New orders store `servedItems: boolean[]` aligned with immutable snapshot items, plus `servedAt: null`. The original `items[].served` field is retained in old snapshots for compatibility but is **not writable** by clients. F6 must render fulfillment from the separate flags, not mutate snapshot arrays.

Cook (and admin) may update only `status`, `servedItems`, `servedAt`, on an accepted order currently new/served. Flags must be booleans and match the snapshot length. Fully served means status served, all flags true and a server timestamp; new/partial/Undo means at least one false flag and servedAt null. Cooks cannot cancel, add/delete/change items, change prices/names/quantities, move an order to another table/session, edit notes/owner, or forge validation. Rejected/cancelled/pending tickets cannot be served. The UI's five-second Undo timing remains its existing interaction contract; the rules protect allowed fields/state rather than implementing a toast deadline.

## Safe opening and authoritative closing

Waiter/admin can create an initial open session **only** in a write batch that simultaneously changes the matching free table to open with that new activeSessionId. Ownership must equal auth.uid; initial total/payment/closedAt must be null and openedAt must be a server timestamp. `getAfter` validates both sides. Orphan sessions, hijacking an existing session, opening an occupied table, and impersonating another waiter are denied. Admin can maintain free table numbers but cannot free an occupied table directly.

Session closure stays exclusively in `closeTable`, preserving F3 snapshot totals, payment split and idempotent paid aggregation. Cooks cannot close tables or change payment data. Deactivation now marks the Firestore membership inactive before external Auth work, so an interrupted deactivation fails closed for existing tokens as well as future logins.

## Read scope and query requirements

Waiters can read their own orders across time and all tickets of a session they **opened**, including an admin-created ticket in that same session. Tapping an arbitrary table does not grant read access to its other waiter tickets. Use queries constrained by `waiterId == auth.uid` or by a sessionId whose openedBy is auth.uid; broad waiter order queries are denied. Session lists similarly need openedBy filtering. This is the minimal safe interpretation of “tables they are viewing.”

Cook gets today's aggregate document by date ID; listing all days or reading historical days is denied. The date comparison uses request.time shifted by UTC+6, matching Asia/Bishkek. Waiter stats require a direct own-UID document read; broad waiter-aggregate lists and other waiter IDs are denied. Admin period queries may list cafe aggregates. Client queries stay under their cafe path; private collection-group queries are denied.

## Offline impact and explicit F6 acceptance plan

The durable queue is retained and remains disconnected from Firebase business transport in this step. Its old draft price is a display estimate, not the eventual charge: **the first successful callable submission takes current server menu prices**. A later retry retains those accepted prices. Missing/hidden/sold-out items leave a draft queued/blocked for review; the client must not silently create a new ID to bypass rejection. F6 will show reconciled server totals and actionable availability errors.

F6 transport must persist actual cafe/table/session identity alongside the draft and keep `ticket.id` as clientOrderId. Convert lines to `{itemId,qty}` only, omit demo owner and price fields, and adapt `{clientOrderId}` acknowledgments to the outbox's existing `{id}` contract. Check cafe/UID ownership before flushing; never send another account's or legacy demo queue automatically. Old demo drafts with no real session binding require explicit review rather than guessing a current session.

Required F6 automated integration test (planned, **not claimed complete in F4**):

1. Disable connectivity; enqueue three drafts with three fixed UUIDs and bound real sessions.
2. Reload/recreate the durable queue; confirm all three UUIDs remain unchanged.
3. Reconnect and flush through the **real callable**, not a Firestore write or a fake server map.
4. Simulate a lost acknowledgment after a committed callable, then reload/retry; include overlapping reconnect/flush attempts.
5. Assert exactly three server orders, one processing/audit contribution per UUID, server snapshot prices, and an empty acknowledged queue. Recheck after a menu price/availability change and logout/cafe change.

“Exactly once” means exactly one committed server order per UUID; network delivery may make multiple callable attempts after an uncertain response. F4's callable tests already prove concurrent deduplication, post-menu-change/post-close retry stability and authoritative snapshots. The reconnect/reload queue test remains F6 as requested.

## Verification

`npm run test:rules` runs the isolated official `@firebase/rules-unit-testing` matrix. `npm run test:firebase:f4` runs the F1–F3 regression tests, new callable checks and the full rules suite in one local emulator lifecycle. Tests require the demo project and loopback hosts, suppress background function triggers only during the rules fixtures, then restore them. They assert byte equality of both rule files. No production credentials or resources are accessed.

The matrix covers get/list/create/update/delete for every canonical collection, public projections, private server metadata and unknown paths across admin/waiter/cook/anonymous/inactive/unclaimed/role-mismatched contexts. Separate checks cover every role's cross-cafe access, cross-cafe collection-group queries, safe atomic session opening, own/session-scoped order queries, today's cook stats, partial/full serving and Undo, malformed schemas and post-payment cancellation.

Explicit attack cases: waiter edits menu price; cook edits ticket items; waiter reads another waiter's stats; anonymous writes; every role changes snapshot price on an existing order; cook changes name/visibility/price while toggling soldOut; spoofed order ownership/price/validation; changed session/table/note; public projection/receipt/audit forgery; direct table close/hijack; malformed served flags; role escalation; and cross-cafe reads/writes.

Sources used for rule semantics and tests: [Firebase rules emulator testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator), [field restrictions and diff](https://firebase.google.com/docs/firestore/security/rules-fields), [Timestamp](https://firebase.google.com/docs/reference/rules/rules.Timestamp), [List](https://firebase.google.com/docs/reference/rules/rules.List), [numeric validation](https://firebase.google.com/docs/reference/rules/rules.math).

Open questions: none for F4. Reporting/backfill and served/wait-time aggregate integration remain F5; queue transport and its required reconnect test remain F6; reCAPTCHA Enterprise (or v3) is finalized at F7. Stop for approval before F5.

## F5 completed boundary

Reports, My Stats and Cook today are now connected to permitted aggregate reads, with live listener cleanup and localized states. Admin-only recomputeStats and canonical day/serving rebuilds are implemented without broadening F4 client rules. Per-waiter sales stay in own-UID subcollections. [F5 accounting and verification](STATISTICS.md). The F6 queue test above remains planned and has not been claimed complete.

## F6 queue test completed

The required three-order offline/persisted-reload/reconnect/lost-ack scenario now passes through the real emulator callable, with three orders and no duplicates. Real-browser UI replay is separately documented because browser tooling is unavailable. F4 rules were not broadened. [F6 details](OFFLINE_REALTIME.md).
