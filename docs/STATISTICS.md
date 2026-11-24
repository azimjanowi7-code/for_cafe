# F5 — statistics and reports

Implemented only in `demo-for-cafe` local emulators. No deployment, production access or real credentials. F6 ordering transport, offline/reconnect test and kitchen ticket subscriptions have not started. The approved first-successful-submission server-price policy remains unchanged.

## Accounting rules

Revenue comes **only from closed, paid tableSessions**, joined to accepted, non-cancelled order snapshots by sessionId. Open tickets and rejected/cancelled tickets never create revenue, top-dish quantities or waiter sold totals. Both cash and card count as paid. Stored qty × stored price is authoritative; current menu prices/names and client totals are never report inputs. A closed session whose recorded total disagrees with its snapshots fails rebuild explicitly rather than silently rewriting financial history.

Day boundaries are Asia/Bishkek (UTC+6). Financial activity belongs to the **closure day**, including tickets created/served on an earlier day. Calendar weeks start Monday; months start on the first local day. Start is inclusive and end exclusive. Reports combine whole calendar periods. Money is summed in integer hundredths, with KGS values stored/displayed to two decimals.

- `dailyStats/{YYYY-MM-DD}`: paid revenue; closed session count; cash/card totals; revenue per table; snapshot table labels; snapshot dish names/quantities; accepted orders placed/dishes ordered; served order count and total wait milliseconds.
- `dailyStats/{day}/waiters/{uid}`: that UID's snapshot sold-dishes amount (**not salary**), dish count, number of paid sessions with their sales, and each session's own attributed amount/table label/closure timestamp.
- A shared session counts once at cafe level and once for each contributing waiter in that waiter's private stats. Per-waiter table counts are therefore not additive. Repeated visits to the same table are separate served sessions, while cafe revenue per table sums them.
- Empty sessions can close for zero and count as a closed table; they do not invent a waiter sale.

Top three ranks **paid dish quantities**, combines by immutable itemId across days, and resolves equal quantities by itemId. Names come from stored snapshots with deterministic chronological selection. Changing or deleting current menu entries cannot change an old report. Table numbers are saved on closure; older imports without a saved number display their tableId instead of reading a newly renumbered table.

## Safe aggregate updates and serving

`statisticsStore.rebuildStatsDay` is the canonical writer. It transactionally reads a day's created/served orders, closed sessions, their linked snapshot orders, the existing aggregate, and existing private waiter aggregates. It replaces the cafe and waiter records together and removes stale waiter documents. Every rebuild reads the same daily aggregate document, so concurrent rebuild/closure follow-ups conflict and retry instead of overwriting a newer result. Duplicate or reordered triggers rebuild **current source state**, not increments from an old event payload; canonical values are compared to avoid unnecessary writes.

`onOrderCreate` still performs validation/quarantine, then refreshes the relevant day. `onOrderStatsWrite` handles validation, serving, Undo, cancellation and source-date changes; `onSessionStatsWrite` handles closure dates. A serve counts only an accepted order currently status served, using servedAt's day. Wait is servedAt − createdAt; partial serving is not a completed ticket. Undo removes its count/wait; a later serve is recalculated from the current state. The trigger considers before and after dates so cross-midnight changes repair both days. Served tickets can contribute kitchen activity before payment, but contribute zero revenue until closure.

`closeTable` atomically closes the session, frees the table and writes its one deterministic audit, then awaits the canonical rebuild. A retry after a committed closure reruns that safe follow-up without closing or charging twice. There is no intermediate independent cafe/waiter increment: the report reader waits for matching `salesVersion` and `waiterCount` metadata before publishing a joined view, so a listener cannot combine a newer cafe total with older waiter sales. Kitchen-only changes preserve the financial version. A failed aggregate follow-up leaves the committed paid session intact for the same callable retry, trigger retry or admin backfill.

All functions retain F1's asia-south2 region and maxInstances 2. Statistics triggers/recompute have timeout 120 seconds and concurrency 2; existing business functions retain their limits. This is a bounded local implementation: a day rebuild allows at most 500 created orders, 500 served orders, 500 linked paid orders, 100 paid sessions, 100 waiter aggregate documents and 1,000 paid dish IDs. Exceeding a bound fails without a partial day aggregate. High-volume batching/cost/load validation is deployment work, not a production capacity claim.

## Admin recompute/backfill

Callable `recomputeStats({from, to, requestId})`, where from/to are strict YYYY-MM-DD strings, inclusive, spanning at most 31 days. Generate and retain one UUID for retries. Claims derive the cafe; a supplied cafeId is rejected. Authorization checks the active admin profile/live Auth user; each daily rebuild rechecks admin membership. No waiter/cook or anonymous provisioning path is exposed.

The operation document binds actor/action/requestId to the date range. Completed calls return their existing result; reusing the ID for another range is rejected. A partial run records completed days and resumes the remaining days on retry. Each day commits atomically and is safe beside live source changes; a multi-day backfill is not one cross-month transaction. To intentionally recompute again after later repairs, use a new requestId. Started/day/completed audits have deterministic IDs and contain no passwords, tokens or raw request bodies. Backfill modifies aggregates only, never the original orders, sessions, payments, menu prices or names.

The Reports screen exposes “Пересчитать период / Мезгилди кайра эсептөө” for the selected calendar period. It retains the pending UUID on failure for a retry and has localized progress/result/error feedback. Financially inconsistent raw imports must be repaired by a trusted local operator before their backfill can succeed; the function does not guess or silently discard malformed paid source data.

## Connected UI and access

In the Firebase emulator build:

- **Admin Reports** subscribes to the selected period's daily aggregates and their private waiter subcollections. It shows revenue, paid tables, table revenue, per-waiter sold-dishes totals with the “not salary” label, top three dishes and cash/card split. Query subscriptions are added/removed as days change and wait for matching financial versions.
- **My Stats** subscribes only to the logged-in waiter's own current-day document. It shows name, sold dish count, paid table count, sold-dishes amount, and per-session own sales. It cannot read another waiter's private totals.
- **Cook today** header and expanded sheet subscribe to today's allowed cafe aggregate, showing served tickets and average wait in minutes. Missing data is a zero/empty state; it never falls back to local sample ticket totals.

All three have skeleton loading, localized KY/RU empty/error/retry states. Initial reads wait for server-confirmed snapshots: a cached subset of a newly selected period is never presented as its full total. A ten-second initial loading timeout exposes retry if the server cannot be reached. Listeners unsubscribe on unmount/logout, UID/cafe changes, period changes and local-day rollover. The SDK reader functions used by the UI are directly exercised in the emulator tests. Rules continue to deny direct client aggregate writes; cook reads only today's cafe document and waiter reads only their own private document. Root aggregates do not contain the per-waiter sales map.

The ordinary non-Firebase build remains the isolated local prototype. In Firebase mode, report surfaces are real; menu edits, order entry/fulfillment buttons and the kitchen ticket board remain the explicitly marked local preview until F6. Local preview actions do not pretend to change server statistics.

## Disposable preview fixtures

`npm run emulators:start` now seeds an explicitly disposable paid demo session for Айжан: table 9, 1,410 KGS cash, five dishes, two served tickets (nominal waits five and two minutes). Thus Admin Reports and My Stats show real Firestore values rather than local sample totals. Service counters allocate to the actual served day if seeded across midnight. Reserved `f5-preview-*` documents are local imports only, not real kitchen work or payments. Auth fixtures and password remain those documented in AUTHENTICATION.md. No real keys or passwords are required in chat.

## Verification

Run `npm test`, `npm run build`, and `npm run test:firebase:f5`. The latter builds Functions/emulator UI, seeds local fixtures, runs F1–F5 integration checks plus the entire F4 permission matrix, and shuts down. The same report reader module used in the UI is tested with real Auth/Firestore emulator clients.

Fixed anchor: 2026-11-07, with calendar day/week/month periods. Fixtures include the prior-month boundary, the first instant of November, Monday, a midnight closure with previous-day tickets, shared and repeated table visits, and a large unpaid/cancelled dish that must not appear in revenue or ranking.

| Period | Revenue KGS | Paid tables | Cash | Card | Top item IDs / quantities |
|---|---:|---:|---:|---:|---|
| Day | 725 | 2 | 625 | 100 | d:5, b:2, c:2 |
| Week | 1,075 | 3 | 625 | 450 | b:5, d:5, c:3 |
| Month | 1,325 | 4 | 875 | 450 | b:6, d:5, a:3 |

Tests prove these exact values and waiter attribution; menu repricing/renaming followed by recompute leaves reports unchanged; missing/corrupt aggregates are repaired; stale waiter rows are removed; raw history remains unchanged; invalid ranges/tenant overrides/non-admin calls are denied; duplicate requests are idempotent; SDK listeners enforce own/role access and unsubscribe; serving/Undo/reordered refreshes converge; concurrent close/recompute counts a payment once; and live Reports never mix cafe/waiter financial versions. The F4 cross-cafe and attack matrix remains part of the run.

Implementation references: [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [trigger delivery semantics](https://firebase.google.com/docs/functions/firestore-events), [snapshot listener errors and cleanup](https://firebase.google.com/docs/firestore/query-data/listen).

Open questions: none for F5. The accepted F6 queue behavior and required offline → reload → reconnect → lost-ack test are retained in SECURITY_RULES.md. Stop for approval before F6.

Visual review limitation for this handoff: the computer-use native service failed to start and the browser host was unavailable. No Safari screenshots or visual/keyboard QA are claimed for F5. TypeScript/Vite builds and the exact SDK readers for Day/Week/Month, My Stats and Cook today passed the real emulator checks.

## F6 update

The order queue, waiter workspace, Cook ticket listeners/fulfillment and offline QR are now connected in the emulator build. The F5 report readers remain unchanged and retain their server-confirmed financial-period behavior. Visual review was retried but no browser host was available. [F6 evidence and browser procedures](OFFLINE_REALTIME.md).
