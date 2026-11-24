import {readFileSync,existsSync,mkdirSync,writeFileSync,cpSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertDeployAllowed,readEnv,validateEnvironment,sourceHash,osEnvironment} from './deployment-policy.mjs';
import {buildCloud} from './build-cloud.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
try{
 const [stage,...args]=process.argv.slice(2);if(!['staging','production'].includes(stage))throw Error('Use staging or production');
 let confirmProject,confirmBlaze=false;for(let i=0;i<args.length;i++){if(args[i]==='--confirm-project')confirmProject=args[++i];else if(args[i]==='--confirm-blaze')confirmBlaze=true;else throw Error('Unknown deployment option')}
 const aliases=JSON.parse(readFileSync(resolve(root,'.firebaserc'),'utf8')).projects,runtime=JSON.parse(readFileSync(resolve(root,'deployment/runtime-status.json'),'utf8')),acceptPath=resolve(root,'deployment/staging-acceptance.local.json'),acceptance=existsSync(acceptPath)?JSON.parse(readFileSync(acceptPath,'utf8')):null,source=sourceHash(root),project=aliases[stage];
 assertDeployAllowed({stage,project,confirmProject,confirmBlaze,runtime,acceptance,source});
 if(stage==='production'&&acceptance.projectId!==aliases.staging)throw Error('Staging acceptance project must match the pinned staging alias');
 const env=readEnv(readFileSync(resolve(root,`.env.${stage}.local`),'utf8'));validateEnvironment(stage,env,aliases);
 if(Object.keys(process.env).some(key=>key.endsWith('EMULATOR_HOST')||key==='FIREBASE_EMULATOR_HUB'))throw Error('Unset emulator host variables before a real deployment');
 const directory=buildCloud(stage),release=JSON.parse(readFileSync(resolve(root,directory,'release.json'),'utf8'));if(!release.deployable||release.fixture||release.projectId!==project||release.sourceHash!==source)throw Error('Release manifest mismatch');
 const archive=resolve(root,'releases',`${stage}-${source.slice(0,12)}`);mkdirSync(archive,{recursive:true});for(const path of [directory,'functions/src','functions/package.json','functions/package-lock.json','firestore.rules','firestore.indexes.json',`firebase.${stage}.json`])cpSync(resolve(root,path),resolve(archive,path),{recursive:true});
 const runtimePath=resolve(root,'node_modules/node/bin/node'),cliPath=resolve(root,'node_modules/firebase-tools/lib/bin/firebase.js'),child=spawnSync(runtimePath,[cliPath,'deploy','--project',project,'--config',`firebase.${stage}.json`,'--only','firestore:rules,firestore:indexes,functions,hosting','--message',`cafe ${stage} source ${source}`],{cwd:root,stdio:'inherit',env:{...osEnvironment(),PATH:`${dirname(runtimePath)}:${process.env.PATH}`}});
 if(child.status!==0)throw Error('Deployment failed or partially completed; inspect the project and use docs/DEPLOY.md rollback, do not assume atomicity');
 writeFileSync(resolve(archive,'deployment.json'),JSON.stringify({stage,project,source,at:new Date().toISOString()},null,2)+'\n');
}catch(error){console.error(`Deployment refused/stopped: ${error.message}`);process.exitCode=1}
