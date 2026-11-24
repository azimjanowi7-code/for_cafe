# F6 — offline queue, persistent cache and realtime workspace

Status: implemented and verified only in local `demo-for-cafe` emulators. No production access/deployment, real keys or App Check provider changes. F7 still requires separate approval.

## F5 visual review retry

Reports: unavailable; the native computer-use service failed to start and the browser access host was unavailable.
My Stats: no browser was available for layout inspection.
Cook today: layout remains unverified; no new layout issue could be confirmed.

No Safari screenshots, browser keyboard walkthrough or rendered-width audit are claimed for this step. The exact SDK readers, compiled UI and data behaviors have automated coverage. Browser procedures below are explicit manual tests, not falsely reported as executed.

## Persistent data and account boundaries

`initializeCafeFirestore` uses `persistentLocalCache({tabManager:persistentMultipleTabManager()})`. The same app/database initialization is reused by staff and public-menu readers, with emulator connections attached before use. Browsers with IndexedDB can retain document/query data and pending session-opening batches across reloads. The SDK's multiple-tab manager coordinates its local database. Environments without IndexedDB explicitly use memory cache; they cannot promise offline document/session-opening persistence across reloads. The durable order queue remains separately stored in localStorage.

The Firebase workspace now reads actual menu items, tables, own sessions and own/session-scoped tickets. It does not load local sample tickets or send legacy demo outboxes. Cache reads can show last-known menu/table/order data while offline; the server independently validates every order on submission. Price estimates in a queued draft are not authoritative.

F2's session restore now retains a last-validated `{uid,cafeId,role,name,home}` record for an **existing persisted Auth UID**. It stores no password or token in that record, rejects UID/cafe/role mismatches, and does not invent a login without an Auth session. Network failures do not silently sign out an existing offline user. Reconnection refreshes Auth; disabled/revoked/inactive users are rejected by the Auth/backend checks before any new server order can be created. Offline UI cannot detect a revocation until connectivity returns. Logout removes its offline session record, stops workspace/report subscriptions and queue workers, and retains unsent records under the original account's namespace.

## Durable callable delivery

Firebase queue/ack keys are versioned and scoped by cafeId **and UID**. Each draft stores its fixed UUID, actual tableId/sessionId, cafe/owner, quantities, note and display estimate. It is persisted before the cart clears. Failure to save leaves the draft intact. A reload reconstructs the same records/UUIDs; sending state returns to queued rather than claiming an interrupted request succeeded. Legacy demo records remain isolated and are never migrated into real sessions automatically.

The transport calls `submitOrder({clientOrderId,tableId,sessionId,items:[{itemId,qty}],note})` through the authenticated Firebase callable. Owner/name/price fields are omitted; waiterId and cafe come from Auth on the server. `{clientOrderId}` acknowledgments map to the queue's `{id}` contract. Server snapshots replace client estimates in the displayed tickets. The F4/F5-approved pricing rule remains: current server price at **first successful submission**, original accepted snapshots on every retry.

One outbox instance coalesces overlapping flushes. Browsers with Web Locks serialize cafe/UID delivery across tabs. Other environments still rely on the deterministic server document/intent receipt to prevent duplicate effects. Status changes queued → sending → sent require an acknowledgment with the same UUID; failed requests or failed acknowledgment persistence retain the record for retry. A lost response after a committed callable therefore repeats the same intent rather than creating another ticket. There can be multiple HTTP attempts: “exactly once” means **one committed order per clientOrderId**, not an impossible guarantee of one network request.

A connectivity monitor combines browser online/offline events with a timed, no-cache loopback Functions/Firestore health probe. Initial checking is distinct from confirmed offline. It probes on reconnect and periodically, retries delivery when reachable, and does not let a late successful probe override a newer offline/logout state. SDK/business errors preserve queued tickets with KY/RU review/retry feedback. Missing/hidden/sold-out dishes or changed sessions are never silently replaced, rebound or given new UUIDs. Another staff account/cafe cannot flush the retained queue. An already-started request can finish after logout; its original UUID remains safe for later acknowledgment retry, and the worker starts no further requests.

## Tables, serving and availability

Selecting a free table opens a real session with the atomic table/session batch enforced by F4. Offline batches are optimistic and durable in IndexedDB; their fixed session ID survives reload. The callable will not accept an order until that opening reaches the server. Competing openings can be rejected on reconnection; their queued drafts remain visible for review and are never silently moved into another session. Existing own open sessions work from cache; occupied sessions owned by another waiter do not grant access merely because the table was tapped.

Cook's open board subscribes to status=new, validation=accepted, ordered by createdAt ascending. A separate accepted-served listener supplies the latest 100 ready tickets; the F5 today widgets still use complete daily aggregates, not that history limit. Both subscriptions have explicit cleanup and are stopped on logout/unmount. Waiter queries remain own-UID or a session they opened, matching F4's minimal read policy. Matching composite indexes are included in the deployment candidate; nothing is deployed.

Cook serving uses a Firestore transaction on the current order, writes only status/servedItems/servedAt, and preserves snapshot arrays. Partial serving, full serving and the existing five-second Undo feed the actual server state and F5 aggregates. Duplicate full-serving attempts produce no extra completion. Offline serving is refused with a retry message rather than pretending the kitchen confirmed it. Pending/cancelled/rejected tickets cannot be served. Existing collapse/highlight/Undo motion and reduced-motion settings are preserved.

Cook availability updates only soldOut. Waiter menus filter both visibility and sold-out state; new submissions recheck both server-side. Admin menu edits use validated Firestore writes rather than a local sample store. Table closure calls the authoritative server closeTable and waits for queued orders to be acknowledged; local payment records are not treated as real closures. Prototype-only admin surfaces outside this step (such as the old Staff adapter/settings/price-history presentation) are not claimed as newly connected here.

## QR menu and service worker

Workbox precaches the application shell, fonts and route assets, with an index.html navigation fallback for offline `/qr` reloads. It has a GET-only CacheFirst route for `/__public-menu/{cafeId}.json` using the same `cafe-public-menu-v1` CacheStorage name as the public loader, plus a bounded dish-photo cache. Callable POSTs, Auth and private Firestore responses are **not** routed into these caches.

A successful server-confirmed public menu read saves its sanitized full snapshot in that public CacheStorage entry, with a cafe/version guard and a localStorage fallback. Offline or failed/timed-out reads return only that cafe's last complete saved snapshot; no local staff menu edits become a public fallback. A small KY/RU “Офлайн · меню может быть устаревшим / Офлайн · меню эскириши мүмкүн” note appears for offline/stale data. A first offline visit without a saved menu shows the existing localized error/retry state. Reconnecting refreshes the public projection and removes the stale note after success. External photos can only be cached after they were fetched; uncached assets are not guaranteed offline.

## Automated verification and evidence

Run `npm test`, `npm run build`, and `npm run test:firebase:f6`. A targeted `npm run test:firebase:f6:only` is also available. The full command starts fresh local Auth/Firestore/Functions/Hosting emulators, seeds disposable fixtures, runs F1–F6 plus the entire F4 permission matrix, and shuts down.

The required scenario is automated at the SDK/queue layer using the **real callable and real emulator database**:

1. Open an authenticated session online; disable the Firestore client's network and prohibit callable delivery.
2. Create three separately persisted drafts with three UUIDs; assert zero server orders.
3. Serialize/recreate the durable storage/outbox to simulate page reload; assert all three IDs survive unchanged.
4. Reconnect; commit the first callable but deliberately lose its acknowledgment.
5. Change the menu price, reload the pending records again and flush overlapping reconnect attempts.
6. Assert exactly three server orders, three processing markers and three submission audits, no duplicates, correct waiter UID, oldest-first realtime visibility, and an empty acknowledged queue. The first accepted price stays 123; the two first submitted later use 145. Four transport attempts produce three committed orders and zero unpaid revenue.

Additional tests prove scoped owner/cafe isolation, stopped delivery after logout, acknowledgment-storage failure recovery, real Cook listener cleanup and transactional serving/Undo, and IndexedDB document/pending-session persistence across SDK termination/recreation. Persistence tests use the official SDK's Node mock-persistence hook with fake-indexeddb/localStorage, explicitly **not** a claim of real-browser multi-tab/SW execution. The generated service worker's shell and shared cache names are checked. Unit tests exercise the public cache snapshot/stale/cafe isolation and connectivity races. F1–F5 accounting, price stability, claims and all 1,394 F4 allow/deny assertions remain regression coverage.

Machine evidence: `qa/results/firebase-f6-offline.json` and `qa/results/firebase-f6.json`.

## Clear manual browser test — required scenario

Prerequisites: run `npm run emulators:start`; use only http://127.0.0.1:5080. Auth fixtures/password are documented in AUTHENTICATION.md. Use a single Waiter tab for this scenario; another online tab signed into the same UID is allowed to drain its shared queue and would change the timing of the test.

1. Sign in as Айжан using cafe code DEMO-001. Wait for menus/tables to load and the connection check to finish. Visit `/qr` online once as well. In browser DevTools Application/Storage, verify the service worker is activated; reload online once so it controls the page.
2. In the Waiter tab select a free table (for example table 2), while online. Wait for the table/session opening to be acknowledged. Optionally open a **different-role Cook tab** as Ашпозчу; it will not drain the waiter's queue.
3. Put the Waiter tab into DevTools Network Offline. Confirm OfflineBanner is shown. Add one available dish and send. Repeat twice, making **three separate tickets**, not one ticket with quantity three. Confirm three queued entries in the table history and three scoped localStorage records with distinct, unchanged IDs.
4. Reload the Waiter page while still offline. It must load its cached shell, restore the same Auth UID from the existing session, and retain the three drafts. Select the same table again if the home route returns to Tables. Verify each UUID/table/session binding is unchanged and status is queued.
5. Return Network to Online. Wait for the backend check and queue flush. Each entry must progress sending → sent. The Cook tab must receive exactly three new tickets, oldest first. Inspect the emulator's orders collection for those three UUIDs: exactly one document for each. Do not count the separate reserved served demo fixtures.
6. Reload online again, then wait through another reconnect/retry interval. The order count must remain three; scoped pending keys must be empty and acknowledgment keys present. Opening another same-UID tab must not create another order for any of those IDs.
7. Optionally close the table through the Bill sheet. It must be online with all queue entries acknowledged; the amount must use server snapshots. F5 revenue changes only after that confirmed closure, once.

## Additional manual browser checks

- Multi-tab: sign into the same waiter UID in two tabs; queue/send one stable ID and trigger simultaneous reconnects. One server order must result. Log out one tab: it must stop its listeners/workers; a different UID must not drain the previous user's queue.
- Offline opening: cache a free table, go offline, select it, queue a ticket, reload, then reconnect. Its persisted opening/session must be accepted before the callable can accept the ticket. If another waiter acquired it first, show a session conflict and retain the draft for review.
- Cook: serve/partially serve/Undo online, watch F5 today counters converge, and verify immutable prices/items. Log out, create an order from another tab, and verify the logged-out tab receives no ticket/sound. Try serving offline: it must report unavailable connectivity and not claim confirmed delivery.
- QR: visit online and allow the public snapshot/assets to cache; reload `/qr` offline. The saved menu and stale note must appear, with no order/login buttons. Test a fresh storage profile offline: show an error, never another cafe's or local staff menu data. Reconnect and confirm a sold-out projection disappears after refresh.
- F5 visual follow-up when the browser host is available: inspect Reports Day/Week/Month and recompute, My Stats, and Cook today at 360/390/768/1024/1440 plus keyboard/text zoom. This review remains unexecuted in the current unavailable-browser environment.

References: [Firestore offline/multiple-tab cache](https://firebase.google.com/docs/firestore/manage-data/enable-offline), [listener cleanup](https://firebase.google.com/docs/firestore/query-data/listen), [Workbox routing](https://developer.chrome.com/docs/workbox/modules/workbox-routing).

Open questions: none for the F6 requirements. Browser layout/SW UI review remains an explicit verification limitation. ReCAPTCHA Enterprise/v3 and production configuration remain F7; no such work was started.
