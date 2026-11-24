import {spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readEnv,envKeys,validateEnvironment,osEnvironment,sourceHash} from './deployment-policy.mjs';
export function buildCloud(stage,{fixture=false}={}){
 if(!['staging','production'].includes(stage))throw Error('Use staging or production');
 const root=fileURLToPath(new URL('..',import.meta.url));let env;
 if(fixture){env=Object.fromEntries(envKeys.map(key=>[key,'']));Object.assign(env,{VITE_DATA_SOURCE:'firebase',VITE_FIREBASE_ENV:stage,VITE_FIREBASE_PROJECT_ID:`demo-preparation-${stage}`,VITE_FIREBASE_CAFE_ID:'demo-cafe',VITE_FIREBASE_REGION:'asia-south2',VITE_PUBLIC_ORIGIN:`https://${stage}.example.invalid`,VITE_APP_CHECK_PROVIDER:'recaptcha-enterprise'})}
 else{env=readEnv(readFileSync(resolve(root,`.env.${stage}.local`),'utf8'));validateEnvironment(stage,env,JSON.parse(readFileSync(resolve(root,'.firebaserc'),'utf8')).projects)}
 const directory=fixture?`dist-${stage}-fixture`:`dist-${stage}`,envDir=mkdtempSync(resolve(tmpdir(),'cafe-build-env-'));
 try{const child=spawnSync(process.execPath,[resolve(root,'node_modules/vite/bin/vite.js'),'build','--mode',stage,'--outDir',directory],{cwd:root,stdio:'inherit',env:{...osEnvironment(),...env,CAFE_ENV_DIR:envDir,NODE_ENV:'production'}});if(child.status!==0)throw Error('Cloud bundle build failed');rmSync(resolve(root,directory,'review.html'),{force:true});writeFileSync(resolve(root,directory,'release.json'),JSON.stringify({stage,projectId:env.VITE_FIREBASE_PROJECT_ID,sourceHash:sourceHash(root),deployable:!fixture&&JSON.parse(readFileSync(resolve(root,'deployment/runtime-status.json'),'utf8')).cloudRuntimeReady===true,fixture},null,2)+'\n');console.log(fixture?'Non-deployable fixture built; no real configuration or cloud access used.':`Local ${stage} bundle built; no deployment performed.`);return directory}finally{rmSync(envDir,{recursive:true,force:true})}
}
if(process.argv[1]===fileURLToPath(import.meta.url))try{if(process.argv.slice(3).some(arg=>arg!=='--fixture'))throw Error('Unknown build option');buildCloud(process.argv[2],{fixture:process.argv.includes('--fixture')})}catch(error){console.error(error.message);process.exitCode=1}
