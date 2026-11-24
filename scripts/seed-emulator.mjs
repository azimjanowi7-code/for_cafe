import {spawnSync} from 'node:child_process';
for(const file of ['functions/scripts/seed-emulator.mjs','functions/scripts/seed-auth-emulator.mjs','functions/scripts/seed-reports-emulator.mjs']){const result=spawnSync(process.execPath,[file],{stdio:'inherit',env:process.env});if(result.status!==0)process.exit(result.status??1)}
