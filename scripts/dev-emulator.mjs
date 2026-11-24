import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'inherit',env:{...process.env,VITE_DATA_SOURCE:'firebase',VITE_FIREBASE_ENV:'dev',VITE_FIREBASE_PROJECT_ID:'demo-for-cafe',VITE_FIREBASE_CAFE_ID:'demo-cafe',VITE_FIREBASE_REGION:'asia-south2'}});
child.on('exit',code=>process.exit(code??1));
