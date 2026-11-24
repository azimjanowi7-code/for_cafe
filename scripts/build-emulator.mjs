import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir','dist-emulator'],{stdio:'inherit',env:{...process.env,VITE_DATA_SOURCE:'firebase',VITE_FIREBASE_ENV:'dev',VITE_FIREBASE_PROJECT_ID:'demo-for-cafe',VITE_FIREBASE_CAFE_ID:'demo-cafe',VITE_FIREBASE_REGION:'asia-south2'}});
process.exit(result.status??1);
