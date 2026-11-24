import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {osEnvironment} from './deployment-policy.mjs';
const args=process.argv.slice(2),allowed=['login','logout','projects:list','use'];
if(!allowed.includes(args[0])){console.error('Owner helper permits login/logout/project selection only. Use the guarded deploy scripts for release.');process.exitCode=1}else{const root=fileURLToPath(new URL('..',import.meta.url)),runtime=resolve(root,'node_modules/node/bin/node'),child=spawnSync(runtime,[resolve(root,'node_modules/firebase-tools/lib/bin/firebase.js'),...args],{cwd:root,stdio:'inherit',env:{...osEnvironment(),PATH:`${dirname(runtime)}:${process.env.PATH}`}});process.exitCode=child.status??1}
