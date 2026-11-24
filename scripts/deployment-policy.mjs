import {readFileSync,readdirSync,statSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import {createHash} from 'node:crypto';
export const stages=['staging','production'];
export const envKeys=['VITE_DATA_SOURCE','VITE_FIREBASE_ENV','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_APP_ID','VITE_FIREBASE_CAFE_ID','VITE_FIREBASE_REGION','VITE_PUBLIC_ORIGIN','VITE_APP_CHECK_PROVIDER','VITE_APP_CHECK_SITE_KEY'];
export function readEnv(text){const result={};for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#'))continue;const match=/^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);if(!match||!envKeys.includes(match[1])||Object.hasOwn(result,match[1]))throw Error('Invalid/unknown/duplicate deployment environment field');let value=match[2];if(value.startsWith('"')&&value.endsWith('"')||value.startsWith("'")&&value.endsWith("'"))value=value.slice(1,-1);if(/[\r\n\x00]/.test(value)||value.includes('${'))throw Error('Environment interpolation is not supported');result[match[1]]=value}return result}
export function validProject(value){return typeof value==='string'&&/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value)&&!value.startsWith('demo-')}
export function validateEnvironment(stage,env,aliases){
 if(!stages.includes(stage))throw Error('Use staging or production');
 const project=aliases[stage];if(!validProject(project))throw Error(`Set a real ${stage} project alias locally; demo/placeholder IDs cannot deploy`);
 if(env.VITE_FIREBASE_PROJECT_ID!==project)throw Error('Project alias and environment project ID do not match');
 if(env.VITE_FIREBASE_ENV!==stage||env.VITE_DATA_SOURCE!=='firebase')throw Error('Deployment stage/data source mismatch');
 if(aliases.staging===aliases.production)throw Error('Staging and production must be separate projects');
 for(const key of envKeys)if(typeof env[key]!=='string'||!env[key]||/[\[\]]/.test(env[key]))throw Error(`Missing local configuration: ${key}`);
 if(env.VITE_FIREBASE_REGION!=='asia-south2')throw Error('Region must match the existing asia-south2 model');
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(env.VITE_FIREBASE_CAFE_ID))throw Error('Invalid cafe ID');
 if(!['recaptcha-enterprise','recaptcha-v3'].includes(env.VITE_APP_CHECK_PROVIDER))throw Error('Choose the real App Check provider locally');
 const origin=new URL(env.VITE_PUBLIC_ORIGIN);if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||['localhost','127.0.0.1','[::1]'].includes(origin.hostname)||origin.hostname.endsWith('.invalid'))throw Error('Public origin must be a real HTTPS origin, without path/credentials/query');
 if(!/^[a-zA-Z0-9.-]+$/.test(env.VITE_FIREBASE_AUTH_DOMAIN)||env.VITE_FIREBASE_AUTH_DOMAIN.includes('localhost'))throw Error('Invalid Auth domain');
 return {stage,project,origin:origin.origin,region:env.VITE_FIREBASE_REGION};
}
export function sourceHash(root){const files=[];const walk=directory=>{for(const entry of readdirSync(directory).sort()){const path=join(directory,entry),stat=statSync(path);if(stat.isDirectory())walk(path);else files.push(path)}};for(const directory of ['src','public','functions/src','scripts','deployment'])walk(resolve(root,directory));for(const file of ['firebase.json','firebase.staging.json','firebase.production.json','firestore.rules','firestore.indexes.json','package.json','package-lock.json','functions/package.json','functions/package-lock.json','vite.config.ts'])files.push(resolve(root,file));const hash=createHash('sha256');for(const path of [...new Set(files)].sort()){if(path.endsWith('.local.json'))continue;hash.update(relative(root,path));hash.update('\0');hash.update(readFileSync(path));hash.update('\0')}return hash.digest('hex')}
export function assertDeployAllowed({stage,project,confirmProject,confirmBlaze,runtime,acceptance,source}){
 if(!stages.includes(stage)||!validProject(project))throw Error('Real, explicitly pinned project required');
 if(confirmProject!==project||confirmBlaze!==true)throw Error('Owner must confirm the exact existing project and active Blaze plan; no cloud command was run');
 if(runtime.cloudRuntimeReady!==true||runtime.blockers.length)throw Error('Preparation only: cloud runtime/App Check activation and release checks are still blocked; see docs/DEPLOY.md');
 if(stage==='production'&&(!acceptance||acceptance.projectId===project||!validProject(acceptance.projectId)||acceptance.sourceHash!==source||!acceptance.realPhonePassed||!acceptance.reconnectAndTwoDevicePassed||!acceptance.appCheckAndRulesPassed||!acceptance.approvedForProduction||!/^https:\/\//.test(acceptance.url)||!Number.isFinite(Date.parse(acceptance.acceptedAt))))throw Error('Production requires recorded staging phone/security/reconnect acceptance for this exact source hash');
}
export function osEnvironment(){const names=['HOME','USER','LOGNAME','SHELL','TMPDIR','LANG','LC_ALL','JAVA_HOME','TERM','PATH','XDG_CONFIG_HOME'];return Object.fromEntries(names.filter(key=>process.env[key]).map(key=>[key,process.env[key]]))}
