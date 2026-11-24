# Дасторкон demo

No Firebase, Supabase, account setup, keys or backend is needed. This is a presentation for a relative, not a system for a real cafe. Earlier Firebase files/docs are inactive historical work.

## Run and build

```sh
npm ci
npm run dev
# Open the localhost URL printed by Vite.
npm run build:demo
npm run preview
# Static output: dist/
```

Open through the local HTTP server, not by double-clicking `index.html`. No `.env` file is required. `build:demo` isolates Vite from old local env files; the app entry always selects the demo adapter. To use the static output later, set build command `npm run build:demo`, output directory `dist`, Node 22. `netlify.toml`, `_redirects` and `_headers` are included; paths such as `/cook`, `/waiter`, `/admin`, `/login`, `/qr` and `/m/demo-cafe` resolve to the SPA. For Cloudflare Pages, use Direct Upload of the locally built `dist/` folder; do not point its Functions discovery at this repository's historical root `functions/` directory. For Netlify, `netlify.toml` explicitly selects an empty functions directory. Upload only `dist/`, not the repository/functions folder. Nothing has been deployed. See [Cloudflare React/Pages setup](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/) and [Netlify Vite setup](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/).

## Demo accounts

Cafe code: **CAFE01**. These deliberately public demo credentials are also shown on the login screen.

| Role | Name | Password |
| --- | --- | --- |
| Admin | Админ | admin123 |
| Waiter | Айжан | waiter123 |
| Cook | Бакыт | cook123 |

The role picker on login fills the matching demo account. The top bar switches roles immediately, bypassing login for presentations. Use **Сбросить демо / Демону тазалоо** to restore the initial menu, accounts, four waiting tickets and 28 paid table visits across seven days. This resets only this demo's local records, preserves unrelated browser storage and updates other tabs. Unsaved UI drafts in other tabs should be cleared before resetting.

## Present in three minutes

1. **0:00–0:30** — Open two tabs/windows in the **same browser profile and exact origin**: `/waiter` and `/cook`. Show DEMO, switch KY/RU, point out timer colors plus labels and the seeded late ticket.
2. **0:30–1:15** — In Waiter, select free table 9, add lagman and tea, send. Switch to the already-open Cook tab: the new ticket appears without refreshing. Press **Бердим**; demonstrate the five-second Undo if desired.
3. **1:15–2:00** — In Cook, open **Бүттү**, hide lagman. It disappears in the Waiter menu and `/qr`; restore it. Explain that the guest QR screen is read-only.
4. **2:00–3:00** — Return to table 9, close it, choose cash/card and confirm. Switch to Admin → Reports: inspect Day/Week/Month, Top 3 and payment split. Only paid/closed tables contribute. Change a current menu price and show that historic revenue stays unchanged. Finish with Reset demo data.

A phone, another browser/profile, private window or different URL/port has a separate dataset; a QR scan on another device does not share the presenter's orders. Use two windows side by side for the kitchen demonstration. Safari desktop waiter→Cook arrival/serve and seeded Reports/login were reviewed locally. A full five-width visual review was not performed this turn.

## Real and simulated

**Real locally:** KY/RU UI, role screens, timer/serve/Undo animation, sound after permission-by-click, sold-out menu filtering, per-line price/name snapshots, paid-only reports in Asia/Bishkek, price history, local persistence across reloads and BroadcastChannel updates with a storage-event fallback. Orders are deduplicated by ID; a later addition creates another ticket. Local delivery is immediate even without internet; “sent” means saved in this browser, not acknowledged by a server.

**Simulated:** cafe code/password authentication, roles, staff accounts, kitchen delivery, cash/card payment and historical sample sales. Demo passwords are intentionally plain text in localStorage. Staff is a read-only list of the three seeded accounts. No real payment, authorization enforcement, cloud sync, backups, shared devices or server guarantees exist. Browser storage can be cleared or run out of space. Refresh dates with Reset before presenting on a later day. UI cart drafts are temporary; sent orders persist. The service worker caches the static app after its first online load; offline content reflects this browser's data.

## Replaceable data layer

`src/demo/store.ts` exposes `DemoDataLayer`: snapshot/subscription, enqueue, serve/undo, menu edits, table payment, authentication and reset. `DemoApp.tsx` adapts it to the existing workspace UI. Domain entities use per-record localStorage keys under `cafe-presentation-v1:`; BroadcastChannel messages invalidate snapshots rather than re-saving received state. This avoids feedback loops and unrelated-order overwrites. It is not a transactional multi-user database: simultaneous edits to the same record can use last-write-wins. Language and timer preferences use existing local UI storage. A future backend can replace the adapter while keeping the screens.

Checks: `npm test` and `npm run build:demo`. Tests cover seeding/reload, invalidation without echo, stable ticket IDs, serve/Undo, sold-out validation, paid-only reports, unchanged historic prices and reset isolation.
