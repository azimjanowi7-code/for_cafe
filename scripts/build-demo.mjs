import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const empty=mkdtempSync(join(tmpdir(),'cafe-static-demo-'));
try{const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-b'],{stdio:'inherit'});if(result.status)process.exitCode=result.status;else{const build=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{stdio:'inherit',env:{...process.env,CAFE_ENV_DIR:empty,VITE_DATA_SOURCE:'demo'}});process.exitCode=build.status||0}}finally{rmSync(empty,{recursive:true,force:true})}
