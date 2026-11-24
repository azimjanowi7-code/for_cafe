import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {deploymentConfig} from './hosting-config.mjs';
for(const stage of ['staging','production'])writeFileSync(`firebase.${stage}.json`,JSON.stringify(deploymentConfig(stage),null,2)+'\n');
writeFileSync('firebase.json',JSON.stringify(deploymentConfig('staging'),null,2)+'\n');
mkdirSync('qa/results',{recursive:true});const runtime=JSON.parse(readFileSync('deployment/runtime-status.json','utf8'));
writeFileSync('qa/results/deployment-preparation.json',JSON.stringify({localOnly:true,deployed:false,cloudRuntimeReady:runtime.cloudRuntimeReady,blockers:runtime.blockers,hostingConfigs:['firebase.staging.json','firebase.production.json'],ownerGuide:'docs/DEPLOY.md'},null,2)+'\n');
console.log('Local Hosting configs prepared. No login, project lookup, billing change or deployment performed. Cloud runtime remains blocked.');
