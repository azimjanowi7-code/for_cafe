import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const runtime=resolve(root,'node_modules/node/bin/node');
const scratch=resolve(root,'.firebase-local');
mkdirSync(scratch,{recursive:true});
const args=process.argv.slice(2);
// This launcher is deliberately local-only throughout F1. No cloud commands.
if(!['emulators:start','emulators:exec'].includes(args[0]))throw Error('F1 launcher supports local emulators only');
if(args.some(arg=>arg==='--project'||arg.startsWith('--project=')))throw Error('F1 project is fixed to demo-for-cafe');
const inherited=Object.fromEntries(['HOME','USER','LOGNAME','SHELL','TMPDIR','LANG','LC_ALL','JAVA_HOME','TERM'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
// Do not forward cloud credentials, agent API keys or unrelated environment secrets to emulator children/logs.
const env={...inherited,PATH:`${dirname(runtime)}:${process.env.PATH}`,XDG_CONFIG_HOME:resolve(scratch,'config'),FIREBASE_EMULATORS_PATH:resolve(scratch,'emulators'),CI:'true',GCLOUD_PROJECT:'demo-for-cafe'};
const child=spawn(runtime,[resolve(root,'node_modules/firebase-tools/lib/bin/firebase.js'),...args,'--project','demo-for-cafe','--config','firebase.emulators.json'],{cwd:root,env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
let seeding=false;
const seedTimer=args[0]==='emulators:start'?setInterval(async()=>{if(seeding)return;try{const response=await fetch('http://127.0.0.1:5001/demo-for-cafe/asia-south2/health');if(!response.ok)return;const result=await response.json();if(result.emulator!==true||result.step!=='F1')return;seeding=true;clearInterval(seedTimer);const seed=spawn(runtime,['scripts/seed-emulator.mjs'],{cwd:root,env:{...env,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'},stdio:'inherit'});seed.on('exit',code=>{if(code!==0){console.error('F1 seed failed');child.kill('SIGTERM')}})}catch{}},1000):null;
child.on('exit',code=>{if(seedTimer)clearInterval(seedTimer);process.exit(code??1)});child.on('error',error=>{console.error(error.message);process.exitCode=1});
