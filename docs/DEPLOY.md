> ARCHIVED: backend deployment is deferred by the owner. Use [DEMO.md](DEMO.md) for the current static demo. Do not execute this historical cloud deployment procedure.

# Deployment — staging first

## Current state: preparation only

No Firebase account was accessed, no project created, no billing enabled and nothing deployed. Both deployment scripts fail closed while `deployment/runtime-status.json` says `cloudRuntimeReady: false`. An empty example file or a successful fixture build does **not** make the cloud runtime ready.

The approved F1–F6 implementation is emulator-only. After the owner confirms that the staging project exists and Blaze is active, a separate implementation/review must replace the emulator-only Auth/business/health adapters, configure real App Check, finish trusted-proxy rate limiting and protected first-admin provisioning, and validate cloud staff integration. Never remove the emulator seed guards or simply flip the readiness flag. The full remaining blockers are in `deployment/runtime-status.json`.

## Commands the owner runs

Run locally; never paste credentials, API keys, tokens, passwords or service-account files into chat. Browser-based CLI login is sufficient; do not create a service-account key for this workflow.

```sh
cd /Users/macbook/Documents/for_cafe
npm ci
npm --prefix functions ci
npm run firebase -- login
npm run firebase -- projects:list
npm run firebase -- use --add
# Select your existing STAGING project; enter alias: staging
npm run firebase -- use staging
cp .env.staging.example .env.staging.local
```

In Firebase Console, confirm **Blaze**, a Web App, the intended Firestore location **asia-south2**, and ownership/IAM. Database location is a durable choice: stop if an existing database has a different location. Fill `.env.staging.local` locally using that Web App's config. Set `VITE_DATA_SOURCE=firebase`, `VITE_FIREBASE_ENV=staging`, region `asia-south2`, the cafe ID and real HTTPS Hosting origin. Use `recaptcha-enterprise` (preferred) or `recaptcha-v3` and that provider's public site key. Every checked-in cloud `.env.example` value is empty. Functions' example documents future settings, not working bypass switches.

**Then stop and confirm only that the project exists and Blaze is active. Do not run deployment yet.** Real provider/domain registration, enforcement (including anonymous QR reads), billing alerts, backup setup and runtime activation remain owner-reviewed follow-up work. No secret is needed in chat.

After that implementation is complete and approved, these are the exact release commands. Replace the example project ID locally with the real staging ID; it must match `.firebaserc` and the local environment file:

```sh
STAGING_PROJECT_ID='your-real-staging-project-id'
npm run prepare:deploy
npm run build:staging
npm run deploy:staging -- --confirm-project "$STAGING_PROJECT_ID" --confirm-blaze
```

`--confirm-blaze` records the owner's confirmation; it does not inspect billing. A deployment requires a reviewed ready runtime, explicit real project ID, matching alias/environment and no emulator host variables. It deploys rules, indexes, functions and classic Hosting; it can partially succeed. Review CLI output and Console releases. Do not bypass the wrapper with a direct deploy.

For production, use a **different** Firebase project and Web App. Preview channels share their project's backend and do not isolate production data ([Firebase preview deployments](https://firebase.google.com/docs/hosting/test-preview-deploy)). After staging phone/browser, offline three-order replay, two-device realtime, App Check/rules and report checks pass:

```sh
npm run firebase -- use --add
# Select the separate production project; enter alias: production
cp .env.production.example .env.production.local
# Fill locally for production; VITE_FIREBASE_ENV=production
cp deployment/staging-acceptance.example.json deployment/staging-acceptance.local.json
# Record staging project, accepted sourceHash, URL, date and actual check results.
PRODUCTION_PROJECT_ID='your-real-production-project-id'
npm run build:prod
npm run deploy:prod -- --confirm-project "$PRODUCTION_PROJECT_ID" --confirm-blaze
```

Production is blocked unless the accepted staging source hash matches the current source and all required acceptance checks are true. Rebuild with production config; do not upload the staging bundle into production. `.env.*.local`, acceptance receipts and release archives are ignored. The active CLI alias cannot override the scripts' explicit project selection.

## Hosting and QR sheets

`firebase.staging.json` and `firebase.production.json` use separate output folders. Each environment has one Hosting site: public `/m/{cafeId}` (legacy `/qr`) and staff `/login`, `/waiter`, `/cook`, `/admin`; `/` redirects to login. Unknown paths use Hosting's 404. Authentication and rules enforce roles; routes alone do not protect data.

Firebase Hosting provides HTTPS; HSTS and CSP are configured. HTML, manifest and service workers revalidate; hashed assets are immutable for one year. Security headers also include frame denial, nosniff and restricted permissions. Production CSP excludes emulator endpoints. Cloud headers are intentionally separate from the HTTP emulator configuration. Review real provider domains and CSP in staging before accepting a release ([Hosting configuration](https://firebase.google.com/docs/hosting/full-config)).

Generate a sample without any network access:

```sh
npm run qr:sheet -- --sample --out qa/qr-preview
```

After a real Hosting URL and cafe exist, generate actual print sheets locally:

```sh
npm run qr:sheet -- --origin https://YOUR-PROJECT.web.app --cafe YOUR_CAFE_ID --tables 12 --name 'Your cafe' --out qr-output
```

Open `qr-output/qr-sheet.html` and print or save as PDF. SVGs and a URL manifest are included. Sample sheets are marked as samples and point to the reserved example.invalid domain. Table numbers are display hints, never authorization or an ordering capability. Scan every final printed QR on a real phone before distribution; verify cafe, language and offline notice.

## Budgets, quotas and operating cost

Planning estimate for one small cafe: **USD 5–25/month**, excluding tax, domain registration and unexpected traffic. This is not a measured quote. Assumptions: 100 tickets and 50 paid table sessions/day, 6 staff tabs for 10 hours, 250 QR visits/day at 2 MiB each, 50 dishes. `scripts/cost-model.mjs` makes assumptions explicit; `deployment/cost-estimate.json` records the plan. Check current regional SKUs before enabling services ([Firebase pricing](https://firebase.google.com/pricing), [Firestore pricing](https://cloud.google.com/firestore/pricing), [Cloud Run pricing](https://cloud.google.com/run/pricing)).

The current rebuild-heavy stats implementation estimates 600 rebuilds/day at 200 reads each; together with other reads, about 180,950 reads and 5,350 writes/day. Five-second health probes across six tabs imply **1,296,000 monthly invocations**. These require measurement and tuning in staging. Illustrative operation rates of $0.03/$0.09 per 100k reads/writes are not a Delhi SKU quote; with otherwise unused free allowances they yield roughly $1.18/month for operations and $0.74 Hosting transfer. CPU, storage, backups/PITR, restore, builds, registry and shared billing-account allowances can change the total substantially.

Owner setup: separate $10 staging and $40 production monthly alert budgets with 50%, 80%, 100% notifications; verify recipients and daily usage for the first week. This file does not create budgets. Budget alerts are not general spending caps and can arrive late. Where the current Console offers service-specific spend caps, review availability and the consequence of stopping kitchen traffic; Firestore/classic Hosting are not covered by a universal cap ([billing guidance](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills)).

Check Functions request/CPU/memory/instance limits, Firestore daily reads/writes and storage, Hosting transfer/storage, App Check assessment counts, Artifact Registry retention and log volume. Set reviewed maxInstances/concurrency after measuring staging; these reduce concurrency, not all charges. Avoid repeated backfills. Current reporting safety limits include 500 relevant orders and 100 paid sessions/day; raising them needs load/cost review.

reCAPTCHA Enterprise pricing is shared at organization level: current documentation lists 10k free monthly assessments, $8 for 10,001–100k and additional usage pricing thereafter. QR visits plus token refresh and other projects can exceed the free tier; verify the account's actual provider billing ([reCAPTCHA billing](https://docs.cloud.google.com/recaptcha/docs/billing-information), [App Check setup](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)).

## Backups and PITR — owner actions after confirmation

Nothing here enables backups. Budget for retained backup copies, PITR storage, restores and exports. Establish a daily backup retained 14 days and weekly backup retained 8 weeks; enable deletion protection and PITR for each real database. PITR provides up to seven days, only since enabled, at minute granularity. These are separate from app-level history ([backups](https://firebase.google.com/docs/firestore/backups), [PITR](https://firebase.google.com/docs/firestore/use-pitr)).

The installed Firebase CLI supports these commands. Run yourself only against the confirmed project with appropriate IAM:

```sh
FIREBASE_NODE="$PWD/node_modules/node/bin/node"
FIREBASE_CLI="$PWD/node_modules/firebase-tools/lib/bin/firebase.js"
PROJECT_ID='your-confirmed-project-id'
"$FIREBASE_NODE" "$FIREBASE_CLI" firestore:databases:update '(default)' --point-in-time-recovery ENABLED --delete-protection ENABLED --project "$PROJECT_ID"
"$FIREBASE_NODE" "$FIREBASE_CLI" firestore:backups:schedules:create --database '(default)' --recurrence DAILY --retention 14d --project "$PROJECT_ID"
"$FIREBASE_NODE" "$FIREBASE_CLI" firestore:backups:schedules:create --database '(default)' --recurrence WEEKLY --day-of-week SUNDAY --retention 8w --project "$PROJECT_ID"
"$FIREBASE_NODE" "$FIREBASE_CLI" firestore:backups:schedules:list --database '(default)' --project "$PROJECT_ID"
```

Before production, practice a restore into a **new named database**, never overwrite `(default)`:

```sh
"$FIREBASE_NODE" "$FIREBASE_CLI" firestore:databases:clone '(default)' 'restore-check-YYYYMMDD' --snapshot-time 'YYYY-MM-DDTHH:MM:00Z' --project "$PROJECT_ID"
# Alternative: use the full backup resource returned by the Console/CLI.
"$FIREBASE_NODE" "$FIREBASE_CLI" firestore:databases:restore --database 'restore-check-YYYYMMDD' --backup 'FULL_BACKUP_RESOURCE_NAME' --project "$PROJECT_ID"
```

Use an isolated validation tool explicitly targeting that named database: normal app clients use `(default)`. Compare paid sessions, order snapshots, receipt deduplication IDs and report totals. Firestore backups do not back up Auth users/claims, Hosting, functions, Storage or rules. Plan separately for encrypted Auth exports and provisioning recovery, protected source/release archives and Storage retention; keep sensitive exports outside this repository/chat. Agree retention/access with the cafe owner. Delete a test restore only after verifying and recording the drill.

## Rollback procedure

1. Record the failed release/project/source hash and whether Hosting, functions, rules or indexes succeeded. Deployment across services is not atomic. Preserve data and the durable client queues; do not clear browser storage, reset databases or delete dedupe receipts.
2. For frontend-only failure, use Firebase Console → Hosting → release history → rollback to the known good release. CLI alternative below uses exact IDs from that project's release history. Hosting rollback does not roll back functions, rules or data ([Hosting release management](https://firebase.google.com/docs/hosting/manage-hosting-resources)).
3. For backend/rules failure, restore the matching known good archived source/config into a separate working folder, install locked dependencies, compile functions, then have the owner deploy only affected services with explicit project/config. Review schema and queued-order compatibility first. Retain new indexes during incident recovery; do not force-delete functions or undo paid data. Back up before any necessary data repair.
4. Check login, a new ticket, cook serve, payment/report snapshots and stable retry IDs on two devices. Service workers can retain old code until online refresh/activation: verify the served release rather than clearing unsent orders. Record the incident and re-run staging before another production attempt.

```sh
# Owner only: exact version/site from the confirmed project's Hosting history.
"$FIREBASE_NODE" "$FIREBASE_CLI" hosting:clone 'PROJECT:SITE@KNOWN_GOOD_VERSION' 'PROJECT:SITE:live' --project "$PROJECT_ID"
# In the restored release folder, after compatibility review/build:
"$FIREBASE_NODE" "$FIREBASE_CLI" deploy --only functions,firestore:rules --project "$PROJECT_ID" --config firebase.staging.json
# Use firebase.production.json only for a separately confirmed production recovery.
```

No restore, rollback or cloud release has been executed by the agent. Open decisions: owner project/Blaze confirmation; final provider/domain and cloud activation; budget recipients and retention approval; real staging acceptance before production.
