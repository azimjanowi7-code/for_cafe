export function assertEmulatorSeedEnvironment(env){
 if(env.GCLOUD_PROJECT!=='demo-for-cafe'||!['127.0.0.1:8080','localhost:8080'].includes(env.FIRESTORE_EMULATOR_HOST))throw Error('Seed refused: requires GCLOUD_PROJECT=demo-for-cafe and loopback Firestore emulator on port 8080');
 if(env.AUTH_EMULATOR_HOST||env.FIREBASE_AUTH_EMULATOR_HOST){const host=env.FIREBASE_AUTH_EMULATOR_HOST||env.AUTH_EMULATOR_HOST;if(!['127.0.0.1:9099','localhost:9099'].includes(host))throw Error('Seed refused: non-local Auth emulator')}
}
