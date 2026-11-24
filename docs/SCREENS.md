# Step 4 — Screens

| Screen | Purpose | Sections in order | Primary action | Feeling |
|---|---|---|---|---|
| QR Menu `/qr` | Find available dishes and prices in two taps | Logo, cafe and KY/RU → category chips → dishes grouped by category → cafe/address footer | Scroll and read | Welcoming, appetizing, fast |
| Cafe Code `/login`, step 1 | Select the cafe | Code input → Continue → helper and demo credentials; localized unknown-code error | Continue | Simple and safe |
| Login `/login`, step 2 | Enter staff session | Name → password with visibility toggle → demo role → Login; language switch in header | Login | Clear and reassuring |
| Waiter Tables | Choose a table | Waiter name → All/Mine/Open filters → TableTile grid → bottom navigation | Tap a table | Calm and quick |
| Take Order | Build and send a new ticket | Table and back → category chips → search → menu rows → draft and note → read-only previous tickets, waiting/served → running total; fixed count/total/send bar | Send to kitchen | Focused and responsive |
| Table Bill | Finish a table visit | Snapshot ticket lines → total → cash/card → Close table → confirmation | Confirm payment | Clear and trustworthy |
| My Stats | Review today's work | Waiter name and date → dish quantity → closed table visits → table amounts | Read today’s results | Rewarding and transparent |

Sending saves a new local queued ticket, clears the draft, and keeps the table open for additions. Additions always create separate tickets. Closure records a local payment and archives the current visit; historical tickets remain available for daily dish counts. My Stats uses Asia/Bishkek dates. Tables include waiting and served tickets until payment confirmation.

The public entry exposes no staff navigation, login, cart, or ordering controls. Sold-out dishes are excluded. Photos are optional; provided assets should be optimized WebP, with lazy loading and fixed dimensions. Cold slow-3G performance requires deployment measurement; the two-second target is not yet verified.

Login validation is a documented demo fixture, not real authentication. Kitchen delivery and real payment recording require backend integration.


## Cook and admin screens (4.7–4.10)

| Screen | Purpose | Sections in order | Primary action | Feeling |
|---|---|---|---|---|
| Cook Orders Board | Prepare the oldest waiting tickets | Served count and average wait → sound toggle → searchable Бүттү manager → filters → stable ticket grid, oldest first | Бердим | Clear and calm under pressure |
| Admin Menu | Maintain bilingual menu information | Categories → dishes with photo, KY/RU names and descriptions → price confirmation and history → edit, visibility and sold-out controls | Save menu changes | Precise and organized |
| Admin QR | Give guests access to the public menu | Published menu URL → cafe/table mode → download/print → QR sheet | Download or print | Simple and practical |
| Admin Staff | Manage waiter/cook access | Connection state → add/refresh → staff list → reset/deactivate confirmation | Add staff through Cloud Function | Controlled and clear |
| Admin Reports | Inspect paid sales over a calendar period | Day/week/month → revenue and paid visits → per table → per waiter with “sold dishes total, not salary” → top three → cash/card | Change reporting period | Transparent and trustworthy |

Step 5 replaces the earlier arrival effect: new tickets slide in from the top over 200 ms and highlight fades over 2 s. Timer color changes never move or flash tickets. Sound starts disabled and requires a click to enable browser audio. Completion records servedAt; older tickets with no known completion timestamp are excluded from average wait. Payment confirmation does not mark cooking as complete.

Admin report revenue, waiter totals, dish names, top quantities and payment split derive from paid visits' ticket snapshots. The stored payment amount is not used to reconstruct sales. Legacy payments link by table and exact closure timestamp; unlinked payments are visibly excluded. Day, Monday-based week, and month use Asia/Bishkek calendar boundaries. Tables served counts paid visits, including repeat visits to the same table.

QR sheets download as self-contained printable HTML. They encode the supplied public URL; table mode adds a table query parameter and does not enable customer ordering. Printed localhost codes cannot open a developer machine from guest phones.

The staff UI contains real callable request wiring but remains disconnected until Firebase authentication and a deployed function are configured. No local fake accounts are added. See STAFF_BACKEND.md for the integration boundary.


Step 6 responsive rules and the five-width Safari verification are documented in [RESPONSIVE.md](RESPONSIVE.md).
