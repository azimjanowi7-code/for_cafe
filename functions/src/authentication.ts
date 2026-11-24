import {createHash} from 'node:crypto';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import {beforeUserCreated} from 'firebase-functions/v2/identity';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {normalizeCafeCode} from './identity.js';
export const EMULATOR_APP_CHECK_TOKEN='f2-emulator-only-app-check';
export const lookupCafeCode=onCall({region:'asia-south2',maxInstances:2,timeoutSeconds:10,enforceAppCheck:false},async request=>{
 // No App Check emulator exists. This test-provider bypass can NEVER run in a cloud function.
 if(process.env.FUNCTIONS_EMULATOR!=='true'||process.env.GCLOUD_PROJECT!=='demo-for-cafe')throw new HttpsError('failed-precondition','F2 is emulator only');
 if(request.rawRequest.get('X-Firebase-AppCheck')!==EMULATOR_APP_CHECK_TOKEN)throw new HttpsError('unauthenticated','App Check required');
 const input=request.data;if(!input||typeof input.code!=='string'||input.code.length>128)throw new HttpsError('invalid-argument','Invalid code');
 const db=getFirestore(),peer=request.rawRequest.socket.remoteAddress||'unknown',key=createHash('sha256').update(peer).digest('hex'),limit=db.doc(`authRateLimits/${key}`),now=Date.now();
 await db.runTransaction(async tx=>{const snapshot=await tx.get(limit),previous=snapshot.data(),start=previous?.windowStartedAt??now,count=start+60000>now?(previous?.count??0):0;if(count>=10)throw new HttpsError('resource-exhausted','Too many cafe lookups',{retryAfterSeconds:Math.ceil((start+60000-now)/1000)});tx.set(limit,{windowStartedAt:start+60000>now?start:now,count:count+1,expiresAt:Timestamp.fromMillis(now+60000)})});
 let code:string;try{code=normalizeCafeCode(input.code)}catch{throw new HttpsError('not-found','Unknown cafe code')}
 const snapshot=await db.doc(`cafeCodes/${code}`).get(),cafeId=snapshot.data()?.cafeId;
 if(!snapshot.exists||typeof cafeId!=='string')throw new HttpsError('not-found','Unknown cafe code');
 return {cafeId};
});

// End-user password sign-up is blocked; trusted Admin SDK provisioning bypasses this hook.
export const denyPublicSignup=beforeUserCreated({region:'asia-south2',maxInstances:2,timeoutSeconds:7},()=>{throw new HttpsError('permission-denied','Public staff sign-up is disabled')});
