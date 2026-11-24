# F1 — Firebase project setup and data model

Status: F1 local setup verified on 2026-11-07. F2–F6 authentication, functions, rules, statistics and offline/realtime behavior are implemented locally; F7–F8 require separate approval. See [F6](OFFLINE_REALTIME.md). See [statistics](STATISTICS.md). See [F4 security rules](SECURITY_RULES.md). See [F3 functions](CLOUD_FUNCTIONS.md). See [F2 authentication](AUTHENTICATION.md). No cloud resources have been created or deployed, and no real Firebase project IDs or credentials were provided.

## Environments and region

| Environment | Project | Configuration | Access |
|---|---|---|---|
| Dev | `demo-for-cafe` | `firebase.emulators.json`; loopback endpoints | Local emulators only; reserved `demo-` prefix cannot represent a live Firebase project |
| Staging | `[FIREBASE_STAGING_PROJECT_ID]` | `firebase.json`; `.env.staging.example` | Unconfigured; separate cloud project required |
| Production | `[FIREBASE_PRODUCTION_PROJECT_ID]` | `firebase.json`; `.env.production.example` | Unconfigured; separate cloud project required |

Chosen region: **asia-south2 (Delhi)** for Firestore Standard edition and second-generation Functions. Delhi is geographically close to Kyrgyzstan and both products support the region; keeping them together avoids an unnecessary cross-region hop. This is a geographic choice, not a measured latency claim. Existing project/database locations and the owner's acceptance must be checked before provisioning: a Firestore database location cannot simply be moved later. Authentication and Hosting do not share a global project location setting. Region-specific cost and real-network latency checks remain later deployment work.

Sources: [Functions locations](https://firebase.google.com/docs/functions/locations), [Firestore locations](https://firebase.google.com/docs/firestore/locations), [per-resource location settings](https://firebase.google.com/docs/projects/locations).

## Canonical collections

All private data is under a cafe document. IDs are opaque strings unless a deterministic format is specified. Roles in the new Firebase schema are lowercase `admin`, `waiter`, `cook`; the old UI's `Admin/Chef`/`Waiter`/`Cook` labels are presentation values and are mapped in F2.

| Path | Fields and purpose |
|---|---|
| `cafes/{cafeId}` | `name:{ky,ru}`, `code`, `settings:{warnAfterMinutes,lateAfterMinutes,currency:'KGS',timeZone:'Asia/Bishkek'}`, `createdAt` |
| `cafes/{cafeId}/staff/{uid}` | Auth UID as document ID; `name`, `role`, `active`, `createdAt`. No password or synthetic email password data in Firestore. Provisioning, uniqueness and claims are F2/F3. |
| `cafes/{cafeId}/menuCategories/{id}` | `name:{ky,ru}`, integer `order` |
| `cafes/{cafeId}/menuItems/{id}` | `name:{ky,ru}`, `description:{ky,ru}`, `price`, `categoryId`, integer `order`, `visible`, `soldOut`, optional `photo` URL, `createdAt`, `updatedAt` |
| `cafes/{cafeId}/menuItems/{id}/priceHistory/{changeId}` | Append-only price audit: `oldPrice`, `newPrice`, `changedAt`, `changedBy`; authoritative write enforcement is F3/F4. |
| `cafes/{cafeId}/tables/{id}` | `number`, `status:'free'|'open'`, `activeSessionId:string|null` |
| `cafes/{cafeId}/orders/{clientOrderId}` | `tableId`, **`sessionId`**, `waiterId`, `waiterName`, `status:'new'|'served'|'cancelled'`, `createdAt`, `clientCreatedAt`, `items[]`, `clientOrderId`, `note`, optional `servedAt`. Document ID equals durable client UUID. |
| `cafes/{cafeId}/tableSessions/{sessionId}` | `tableId`, `openedBy`, `openedAt`, `closedAt:null|Timestamp`, `status:'open'|'closed'`, `paymentType:null|'cash'|'card'`, `total:null|number` |
| `cafes/{cafeId}/dailyStats/{YYYY-MM-DD}` | Cafe-only totals: `dateKey`, `timeZone`, `currency`, `revenue`, `tablesServed`, `ordersServed`, `waitTotalMs`, `cashTotal`, `cardTotal`, `tableTotals`, `dishTotals`, `updatedAt` |
| `cafes/{cafeId}/dailyStats/{YYYY-MM-DD}/waiters/{uid}` | Separately protected waiter-only document: `waiterId`, `waiterName`, `dateKey`, `soldDishesTotal`, `dishesSold`, `tablesServed`, `updatedAt`. Never put all waiters' private statistics in a client-readable shared document. |
| `cafeCodes/{NORMALIZED-CODE}` | Exactly `{cafeId}`. Server-only single-document lookup via the F2 App Check/rate-limited callable; all direct client reads/writes denied. |
| `publicMenu/{cafeId}` | Sanitized cafe display metadata only: `name:{ky,ru}`, `address:{ky,ru}`, `categories:[{id,name:{ky,ru},order}]`, `publishedAt` |
| `publicMenu/{cafeId}/items/{id}` | Exactly `name`, `description`, `price`, `categoryId`, `categoryOrder`, `order`, `photo`. Only visible, available dishes are published. No staff, price history, internal settings, orders, inventory notes or private identifiers. |

TypeScript contracts are in `src/firebase/schema.ts`. Document IDs are not duplicated as mutable fields except `clientOrderId`, retained for explicit retry checks. The public category metadata is necessary so the existing QR chips can read real KY/RU names/order without exposing private category documents.

### Amounts, snapshots and timestamps

- `price`, snapshot `price`, session `total`, and revenue fields are KGS numbers with no more than two decimal places. Future server calculations must accumulate integer tiyin internally and divide by 100 at the boundary, rather than summing binary floating point directly.
- Order items use the requested flat snapshot shape `{itemId,nameKy,nameRu,price,qty,served}`. Names, quantities and prices are immutable after creation. Only fulfillment/status fields can change; added items create a new order. Proposed quantity cap is 99 per line, to be enforced in F3/F4.
- `createdAt` is the accepted server timestamp; `clientCreatedAt` preserves offline creation time. The queue's UUID is kept across retries/reloads. Snapshot price is the price captured when the order was made, **not** forced to the current menu price when syncing; the earlier JavaScript draft's stricter behavior will not be reused in F3.
- `sessionId` is required because a table can have multiple visits. Closing a session must select its own orders, never all historical orders for a table. Totals are computed on the server from snapshots; revenue counts only closed/paid sessions.
- Daily keys use Asia/Bishkek (UTC+6). Paid revenue belongs to the closing day's key; cooking counts/wait metrics belong to the serving day's key. F5 will implement transactions/backfill.
- Trigger event deduplication/audit records may be added in F3/F5 under server-only collections; clients will never write aggregates.

## Index plan

`firestore.indexes.json` supplies collection-scoped composite indexes for category ordering; menu category + order; open orders by createdAt; waiter orders by createdAt; session orders by createdAt; active sessions per table; closed sessions by closedAt; public menu category/item ordering. Snapshot item arrays and menu descriptions have unnecessary automatic indexes disabled. Normal document-ID lookups need no composite index. Indexes for later report/reconciliation queries will be validated during their steps; emulator success does not prove that cloud composite indexes have finished building.

## Local commands

```sh
npm install
npm install --prefix functions
npm run emulators:start
```

This builds the TypeScript Functions entry and a **separate emulator web bundle**, starts all four services with the project-local Node 22 runtime, then seeds the reserved demo fixtures automatically once the F1 health endpoint responds.

- QR app: `http://127.0.0.1:5080/qr`
- Emulator UI: `http://127.0.0.1:4000`
- Auth: `127.0.0.1:9099`
- Firestore: `127.0.0.1:8080`
- Functions: `127.0.0.1:5001`
- Health: `http://127.0.0.1:5001/demo-for-cafe/asia-south2/health`

Hosting uses 5080 because another local service already occupied 5000; no unrelated process was stopped. CLI caches/config are isolated under ignored `.firebase-local/`. The local launcher passes only a small OS environment allowlist, excluding cloud credentials and unrelated API keys from emulator child processes/debug logs. Java is required; the local environment currently provides Java 27. The pinned CLI and local Node runtime avoid relying on the machine's global Node 26.

For Vite hot reload, keep the emulators running and run `npm run dev:emulator` in another terminal. Ordinary `npm run dev` / `npm run build` preserve the existing local prototype and do not contact Firebase. The emulator bundle lives in ignored `dist-emulator/`, while the ordinary bundle remains in `dist/`.

Repeatable checks:

```sh
npm test
npm run build
npm run build:functions
npm run test:firebase:f1
```

The last command starts fresh emulators, runs the guarded seed, checks all services/Hosting, executes the **same `readPublicMenu` implementation imported by the QR app** with the Firebase web SDK against the emulator, verifies safe projection and baseline denies, then shuts the suite down. It is not a replacement for the F4 role/security test matrix.

Manual reseed (only while the suite is running):

```sh
GCLOUD_PROJECT=demo-for-cafe FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed:emulator
```

Seed refuses missing/remote emulator endpoints and every non-demo project ID. It overwrites only deterministic reserved fixture document IDs; it does not flush the database or access cloud credentials. It creates one cafe, code `DEMO-001`, four categories, eight private menu items (including sold-out/hidden fixtures), six sanitized public dishes, 12 tables, one open session/order with a 1,050 KGS snapshot total, and zero-revenue daily fixtures. Three inactive staff **document fixtures** have no Auth accounts/passwords/claims; the F2 auth seed adds separate real emulator role accounts.

## F1 security boundary and migration

`firebase/emulator.firestore.rules` is an explicitly separate local-only read-only public preview policy: sanitized menu gets/lists and cafe-code gets are allowed; all private cafe access and all client writes are denied. `firebase.json` still references the separate existing `firestore.rules` source. No temporary allow-all rules are used, and no rules have been deployed. The full requested same-cafe/custom-claims policy and attack tests are F4, not implicitly approved during F1.

The new configured Functions entry is `functions/src/index.ts` → `functions/lib/index.js`. It exports only a non-sensitive F1 health check in asia-south2. Existing `functions/index.js` and `functions/orders.js` are retained as legacy drafts but **not loaded** by the new entry: they use obsolete members/menu/tickets paths and different snapshot assumptions. F3 will replace them after approval.

Only the QR data read is wired in F1. F2 now connects emulator staff identities/routing; F3 now supplies server write APIs; F5–F6 will connect reports and subscriptions. Existing queue, snapshots, i18n and visual classes are unchanged. An explicit Firebase-mode read failure shows a KY/RU error and Retry, not a silent mock-data fallback. LocalStorage menu changes cannot override the Firebase-mode QR catalog.

## Open inputs / questions before cloud setup

1. What are the actual staging and production project IDs and public web-app configuration values?
2. Do either projects/databases already exist, and what are their database locations? Are there organization location restrictions?
3. Is the selected asia-south2 region accepted for both new environments? No cloud location has been provisioned.

No real project IDs, API keys, admin credentials or secret values have been invented. Templates contain marked placeholders; actual `.env` files and local caches are ignored. F2 was explicitly approved and is documented in AUTHENTICATION.md; later steps still require approval.


## Recorded F1 checks

- `npm test`: **20 passed, 0 failed**.
- `npm run build` and `npm run build:functions`: passed.
- Fresh emulator execution: **5 integration checks passed**; final rerun against the automatically seeded running suite also passed all five (3,602.65 ms test-runner duration).
- Auth, Firestore, Functions and Hosting started successfully. The final Functions workspace uses firebase-functions 7.4.0 with the project-local Node 22.23.4 runtime.
- Safari rendered `http://127.0.0.1:5080/qr` with “Демо кафе”, six seeded available dishes and the demo address; sold-out Боорсок and the hidden fixture were absent.
- The local suite is left running for review. Stop its foreground process with Ctrl+C when finished. Nothing has been deployed.

Machine-readable summaries: `qa/results/firebase-f1.json` and `qa/results/firebase-f2.json`. F2 is implemented locally and awaits review.

## F3 server-owned metadata

Orders gain `validation:{state:pending|accepted|rejected,reason}`; `orderReceipts/{clientOrderId}` proves transaction-time availability and `orderProcessing/{clientOrderId}` deduplicates validation/aggregate updates. Staff mutations use `operations/{hash}` and `staffLocks/{uid}`; `audit/{deterministicId}` records server changes without passwords or tokens. All are private, server-only documents. `closeTable` adds closedBy/dateKey and computes paid snapshot totals; dailyStats gains ordersPlaced/dishesOrdered alongside existing paid aggregates. See [F3 contracts, limits and recovery](CLOUD_FUNCTIONS.md).

## F4 approved order and fulfillment boundary

Client creates on orders are denied for every role. `submitOrder` accepts item IDs/qty, validates current existence/visibility/availability and takes names/prices server-side. A separate intent fingerprint in the receipt makes retry IDs stable across later menu changes; the stored snapshot fingerprint still protects closing totals. Orders now have `servedItems:boolean[]` and `servedAt:null|Timestamp`; cook updates these plus status, never items arrays. Admin soft cancellation adds cancelledAt/cancelledBy only before session closure; deletion is denied. See [F4 policy, query requirements and offline impact](SECURITY_RULES.md).

## F5 aggregate records and live reports

Daily aggregates now include snapshot `tableNames`, `salesVersion`, `waiterCount` and schemaVersion 2. Private waiter records include `tables/{sessionId}`-shaped map entries with tableId/tableNumber/own amount/closedAt, plus matching salesVersion. The root never contains private per-waiter sales. Canonical day rebuilds publish cafe and waiter values transactionally; order/session write triggers and admin recompute use that same writer. closeTable snapshots tableNumber and awaits the rebuild after committing the closure. See [F5 accounting, limits, backfill and UI connections](STATISTICS.md).

## F6 client persistence and transport

Firestore now uses persistentLocalCache with persistentMultipleTabManager on IndexedDB-capable browsers. The separate v2 order outbox/ack namespace includes cafeId and UID; every stored intent retains actual tableId/sessionId and its stable clientOrderId. Only itemId/qty/note are sent through submitOrder. Cook new/accepted tickets stream oldest first, with explicit teardown; served history is bounded to the latest 100 while F5 statistics remain complete. Public QR snapshots are versioned/cafe-scoped in a dedicated CacheStorage route and marked potentially outdated offline. See [F6 implementation, verification and manual procedure](OFFLINE_REALTIME.md).
