# F2 — authentication (local emulators only)

F2 implements authentication only. F3 business callables are now implemented and tested in the emulators; F4 role rules are enabled in the local emulator, with no deployment. See [F4](SECURITY_RULES.md). See [F3](CLOUD_FUNCTIONS.md). The authenticated screens still use cafe-scoped local prototype data. The ordinary `npm run dev` build retains its separate demo login; use `npm run emulators:start` and http://127.0.0.1:5080/login to review Firebase authentication.

## Code lookup and App Check

`lookupCafeCode` in asia-south2 reads `cafeCodes/{NORMALIZED-CODE}` with Admin SDK and returns exactly `{cafeId}`. Direct Firestore code reads are denied, preventing bypass of the gateway. Codes use NFKC, trim and uppercase. A Firestore transaction allows ten lookups per minute per hashed socket peer; forwarded IP headers are ignored. Expiry is stored for future cleanup; this is basic local abuse control, not a production distributed proxy policy.

Firebase has no App Check emulator. The client uses the App Check SDK CustomProvider with an explicitly disposable local token; the callable rejects missing/wrong tokens. The bypass requires BOTH `FUNCTIONS_EMULATOR=true` and project `demo-for-cafe`; it refuses cloud execution. This verifies the client/header/gateway contract, **not real device attestation**. A real App Check provider and `enforceAppCheck` must be configured and reviewed before cloud use. No production keys or services were used.

## Identity and access

Names are NFKC-normalized, whitespace-collapsed and lowercased. Cyrillic and Kyrgyz ң/ө/ү transliterate into a readable slug, with a hash suffix to avoid transliteration collisions. Synthetic email is `<slug>-<hash>@<cafeId>.internal`. Names reserve a full SHA-256 key transactionally under `cafes/{cafeId}/loginNames/{hash}`; duplicate normalized names are rejected within that cafe, including concurrent requests. Names in different cafes remain separate accounts.

The internal provisioning primitive creates users disabled, sets exactly `{cafeId, role}`, commits the active staff profile, then enables Auth. A failed final enable leaves a disabled account for explicit repair. No password is stored in Firestore. There is no public provisioning endpoint or sign-up UI; the Auth before-create blocking hook rejects end-user password signup, while trusted Admin SDK provisioning bypasses the hook. Unprovisioned identities have no claims/profile and cannot enter the app.

Login uses session persistence, validates token claims against the active own staff profile, then routes waiter → Tables, cook → Orders board, admin → Reports. Authenticated navigation does not offer role switching. Restored sessions are validated; periodic forced token refresh detects disabled Auth users. Deactivation must disable the Auth account and mark the staff profile inactive; F3 now owns that operation via setStaffActive. Existing sessions can take up to sixty seconds to be removed locally; F4 independently enforces active membership on private data; F3 deactivation marks that membership inactive before external Auth work.

Wrong code, wrong password and deactivated-user messages are distinct and provided in KY and RU in `src/firebase/authErrors.ts`. Errors never display raw Firebase responses.

## Review and bootstrap

Run `npm run test:firebase:f2` for fresh Auth/Firestore/Functions/Hosting emulators, guarded fixtures and integration checks. `npm test` covers normalization, collisions, claims and localized errors. All scripts refuse real project IDs or remote emulator endpoints.

Disposable fixtures: cafe code `DEMO-001`; names `Администратор` (admin), `Айжан` (waiter), `Ашпозчу` (cook), `Өмүрбек Үсөн` (waiter), `Өчүрүлгөн` (disabled waiter). The test-only password is `EmulatorOnly!2026`. These are seeded local test accounts, never production credentials.

For an unbootstrapped local cafe, set `GCLOUD_PROJECT=demo-for-cafe`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, and supply `F2_BOOTSTRAP_PASSWORD` privately in the local shell environment. Run `npm run bootstrap:admin:emulator -- <cafeId> '<name>'`. A cafe must already exist. The transaction reserves `cafes/{cafeId}/system/bootstrapAdmin` and rejects a repeat or an existing active admin. The seeded demo cafe is already bootstrapped. Never paste a real password/key into chat. `.env.example` contains empty configuration values; bootstrap reads the shell environment, not a committed password.

Recorded provider decision: reCAPTCHA Enterprise preferred, with v3 as fallback; finalize provider configuration and the Identity Platform blocking hook at F7. No cloud deployment is authorized by F2.
