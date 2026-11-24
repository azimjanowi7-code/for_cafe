import {getFirestore,FieldValue,Timestamp} from 'firebase-admin/firestore';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {authorize,businessOptions,localOnly,object,requestId,digest,audit} from './businessCore.js';
import {dayRange,reportDate} from './reportMath.js';
import {rebuildStatsDay} from './statisticsStore.js';
const options={...businessOptions,timeoutSeconds:120,concurrency:2};
export async function refreshStatsDates(cafeId:string,records:Record<string,unknown>[]){localOnly();const dates=new Set<string>();for(const data of records)for(const field of ['createdAt','servedAt','closedAt'])if(data[field] instanceof Timestamp)dates.add(reportDate((data[field] as Timestamp).toMillis()));for(const key of dates)await rebuildStatsDay(cafeId,key)}
export const onOrderStatsWrite=onDocumentWritten({...options,document:'cafes/{cafeId}/orders/{orderId}',retry:true},async event=>{if(event.data)await refreshStatsDates(event.params.cafeId,[event.data.before.data()||{},event.data.after.data()||{}])});
export const onSessionStatsWrite=onDocumentWritten({...options,document:'cafes/{cafeId}/tableSessions/{sessionId}',retry:true},async event=>{if(event.data)await refreshStatsDates(event.params.cafeId,[{closedAt:event.data.before.data()?.closedAt},{closedAt:event.data.after.data()?.closedAt}])});
export const recomputeStats=onCall(options,async request=>{
 const caller=await authorize(request,['admin']),data=object(request.data,['from','to','requestId']),retry=requestId(data.requestId);let days:string[];if(typeof data.from!=='string'||typeof data.to!=='string')throw new HttpsError('invalid-argument','Date bounds must be strings');try{days=dayRange(String(data.from),String(data.to))}catch{throw new HttpsError('invalid-argument','Use valid YYYY-MM-DD bounds, at most 31 days')}
 const db=getFirestore(),cafe=db.doc(`cafes/${caller.cafeId}`),operationId=digest([caller.uid,'recomputeStats',retry]),operation=cafe.collection('operations').doc(operationId),fingerprint=digest([data.from,data.to]);
 const previous=await db.runTransaction(async tx=>{const snapshot=await tx.get(operation),old=snapshot.data();if(old&&old.fingerprint!==fingerprint)throw new HttpsError('already-exists','Retry ID reused for a different range');if(!old){tx.create(operation,{action:'recomputeStats',actor:caller.uid,fingerprint,state:'pending',completedDays:[],createdAt:FieldValue.serverTimestamp()});tx.create(cafe.collection('audit').doc(`${operationId}-started`),audit('recomputeStats.started',caller.uid,`${data.from}/${data.to}`))}return old});
 if(previous?.state==='complete')return previous.result;
 for(const key of days)if(!previous?.completedDays?.includes(key))await rebuildStatsDay(caller.cafeId,key,{id:operationId,actor:caller.uid});
 const result={from:data.from,to:data.to,days:days.length};
 await db.runTransaction(async tx=>{const [current,actor]=await Promise.all([tx.get(operation),tx.get(cafe.collection('staff').doc(caller.uid))]);if(actor.data()?.active!==true||actor.data()?.role!=='admin')throw new HttpsError('permission-denied','Admin no longer active');if(current.data()?.state!=='complete'){tx.update(operation,{state:'complete',result,completedAt:FieldValue.serverTimestamp()});tx.create(cafe.collection('audit').doc(operationId),audit('recomputeStats',caller.uid,`${data.from}/${data.to}`,{days:days.length}))}});return result;
});
