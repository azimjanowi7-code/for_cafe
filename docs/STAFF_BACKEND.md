# Staff Cloud Function integration

`functions/index.js` implements the callable `manageStaff`: list, create, reset password, deactivate. It checks Firebase authentication and active Admin/Chef membership in `cafes/{cafeId}/members/{uid}` on every request. Only Waiter/Cook accounts can be managed. Passwords are handled by Firebase Auth, never written into Firestore or browser storage. Reset and deactivation revoke refresh tokens.

This function has not been deployed or integration-tested against Firebase. No Firebase project, deployment configuration, admin session or initial admin membership was provided. The frontend remains explicitly disconnected and displays an error rather than pretending account creation succeeded.

Integration steps:

1. Install function dependencies in `functions/`, select the intended Firebase project and configure a Functions source in Firebase deployment configuration.
2. Provision the first administrator through a trusted administrative process, with an active Admin/Chef membership document. Apply tenant-scoped Firestore rules before using real data.
3. Deploy `manageStaff` to the intended region. Set allowed origins and App Check policy appropriate for the deployment.
4. Connect Firebase Auth to the existing demo login. From that integration, call `configureStaffConnection` from `src/staffApi.ts` with `{endpoint, cafeId, getIdToken: () => authenticatedUser.getIdToken()}`. The adapter sends Firebase callable JSON and an Authorization bearer token. Never use the demo role selector as authorization.
5. Implement trusted cafe/name-to-UID login resolution or an approved account identifier flow; current demo name/password login is not connected to the provisioned Firebase users.
6. Test unauthorized and cross-cafe denial, account creation, reset, deactivation, session revocation, and retries in the Firebase emulator before deployment to production.

The backend returns only UID, name, role and active state. The UI never stores passwords or authentication tokens. Password minimum is eight characters. Admin Auth changes and Firestore membership writes span services; creation rolls back Auth if membership creation fails. List reload lets the administrator recover the UI after a successful write followed by a network response failure; creation retries should be given an idempotency key before production use.

References: [Firebase Admin user management](https://firebase.google.com/docs/auth/admin/manage-users), [callable protocol](https://firebase.google.com/docs/functions/callable-reference), [QR encoder](https://github.com/soldair/node-qrcode).
