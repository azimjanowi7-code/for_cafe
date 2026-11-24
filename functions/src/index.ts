import {getFirestore} from 'firebase-admin/firestore';
import {initializeApp} from 'firebase-admin/app';
initializeApp();
import {onRequest} from 'firebase-functions/v2/https';
import {setGlobalOptions} from 'firebase-functions/v2';
setGlobalOptions({region:'asia-south2',maxInstances:2,timeoutSeconds:10});
// Retain the F1 health contract used by the guarded local launcher.
export const health=onRequest({cors:true},async(request,response)=>{
 response.set('Cache-Control','no-store');
 const emulator=process.env.FUNCTIONS_EMULATOR==='true'&&process.env.GCLOUD_PROJECT==='demo-for-cafe';
 let timer:ReturnType<typeof setTimeout>|undefined,healthy=false;
 if(emulator)try{healthy=await Promise.race([getFirestore().doc('_emulatorHealth/ping').get().then(()=>true,()=>false),new Promise<boolean>(resolve=>{timer=setTimeout(()=>resolve(false),1800)})])}finally{clearTimeout(timer)}
 response.status(healthy?200:503).json({service:'cafe-functions',step:'F1',region:'asia-south2',emulator,healthy});
});

export {lookupCafeCode,denyPublicSignup} from './authentication.js';
export {createStaff,resetStaffPassword,setStaffActive} from './staffFunctions.js';
export {publishMenuItem} from './menuFunctions.js';
export {submitOrder,onOrderCreate,closeTable} from './orderFunctions.js';

export {onOrderStatsWrite,onSessionStatsWrite,recomputeStats} from './statisticsFunctions.js';
