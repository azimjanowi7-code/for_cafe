import {getFirestore,Timestamp,FieldValue,type DocumentData} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {localOnly,id,audit,digest} from './businessCore.js';
import {computeDay,dayBounds,type ReportOrder,type PaidSession} from './reportMath.js';
const MAX_ORDERS=500,MAX_SESSIONS=100,MAX_WAITERS=100;
const millis=(value:unknown)=>value instanceof Timestamp?value.toMillis():NaN;
function order(id:string,data:DocumentData):ReportOrder{return {id,sessionId:data.sessionId,tableId:data.tableId,waiterId:data.waiterId,waiterName:data.waiterName,createdAt:millis(data.createdAt),servedAt:data.servedAt instanceof Timestamp?data.servedAt.toMillis():null,status:data.status,accepted:data.validation?.state==='accepted',items:Array.isArray(data.items)?data.items:[]}}
// Every writer reads this day's stats document in the transaction. Concurrent close/recompute
// operations conflict and retry rather than overwriting each other's newer aggregates.
export async function rebuildStatsDay(cafeId:string,key:string,operation?:{id:string;actor:string}){
 localOnly();id(cafeId);const {start,end}=dayBounds(key),db=getFirestore(),cafe=db.doc(`cafes/${cafeId}`),statsRef=cafe.collection('dailyStats').doc(key),lower=Timestamp.fromMillis(start),upper=Timestamp.fromMillis(end);
 return db.runTransaction(async tx=>{
  const [old,created,served,closed,existingWaiters]=await Promise.all([
   tx.get(statsRef),tx.get(cafe.collection('orders').where('createdAt','>=',lower).where('createdAt','<',upper).limit(MAX_ORDERS+1)),
   tx.get(cafe.collection('orders').where('servedAt','>=',lower).where('servedAt','<',upper).limit(MAX_ORDERS+1)),
   tx.get(cafe.collection('tableSessions').where('closedAt','>=',lower).where('closedAt','<',upper).limit(MAX_SESSIONS+1)),
   tx.get(statsRef.collection('waiters').limit(MAX_WAITERS+1))]);
  if(created.size>MAX_ORDERS||served.size>MAX_ORDERS||closed.size>MAX_SESSIONS||existingWaiters.size>MAX_WAITERS)throw new HttpsError('resource-exhausted','Daily rebuild limit exceeded; no partial aggregate written');
  const sessionIds=closed.docs.filter(doc=>doc.data().status==='closed').map(doc=>doc.id),paidDocs=new Map<string,DocumentData>();
  for(let index=0;index<sessionIds.length;index+=30){const tickets=await tx.get(cafe.collection('orders').where('sessionId','in',sessionIds.slice(index,index+30)).limit(MAX_ORDERS+1));for(const doc of tickets.docs)paidDocs.set(doc.id,doc.data());if(paidDocs.size>MAX_ORDERS)throw new HttpsError('resource-exhausted','Paid ticket rebuild limit exceeded')}
  if(operation){const actor=await tx.get(cafe.collection('staff').doc(operation.actor));if(actor.data()?.active!==true||actor.data()?.role!=='admin')throw new HttpsError('permission-denied','Admin no longer active')}
  const sessions:PaidSession[]=closed.docs.map(doc=>{const data=doc.data();return {id:doc.id,tableId:data.tableId,tableNumber:data.tableNumber,closedAt:millis(data.closedAt),status:data.status,paymentType:data.paymentType,total:data.total}});
  let result;try{result=computeDay(key,created.docs.map(doc=>order(doc.id,doc.data())),served.docs.map(doc=>order(doc.id,doc.data())),sessions,[...paidDocs].map(([id,data])=>order(id,data)))}catch(error){throw new HttpsError('failed-precondition',`Invalid report source: ${(error as Error).message}`)}
  if(Object.keys(result.waiters).length>MAX_WAITERS||Object.keys(result.stats.dishTotals).length>1000)throw new HttpsError('resource-exhausted','Daily aggregate size limit exceeded');
  const salesVersion=digest([key,result.stats.revenue,result.stats.tablesServed,result.stats.cashTotal,result.stats.cardTotal,result.stats.tableTotals,result.stats.tableNames,result.stats.dishTotals,result.waiters]),waiterCount=Object.keys(result.waiters).length;
  // Avoid noisy writes on duplicated/reordered triggers. Canonical values exclude metadata.
  const canonical=old.exists?Object.fromEntries(Object.keys(result.stats).map(key=>[key,old.data()![key]])):null;
  if(old.data()?.schemaVersion!==2||old.data()?.salesVersion!==salesVersion||old.data()?.waiterCount!==waiterCount||Object.keys(old.data()||{}).some(key=>!['updatedAt','schemaVersion','salesVersion','waiterCount',...Object.keys(result.stats)].includes(key))||JSON.stringify(canonical)!==JSON.stringify(result.stats))tx.set(statsRef,{...result.stats,salesVersion,waiterCount,updatedAt:FieldValue.serverTimestamp(),schemaVersion:2});
  for(const doc of existingWaiters.docs)if(!result.waiters[doc.id])tx.delete(doc.ref);
  for(const [uid,value]of Object.entries(result.waiters)){id(uid);const previous=existingWaiters.docs.find(doc=>doc.id===uid)?.data();if(!previous||previous.salesVersion!==salesVersion||JSON.stringify(Object.fromEntries(Object.keys(value).map(key=>[key,previous[key]])))!==JSON.stringify(value))tx.set(statsRef.collection('waiters').doc(uid),{...value,salesVersion,updatedAt:FieldValue.serverTimestamp()})}
  if(operation){tx.set(cafe.collection('audit').doc(`recompute-${operation.id}-${key}`),audit('recomputeStats.day',operation.actor,key));tx.set(cafe.collection('operations').doc(operation.id),{completedDays:FieldValue.arrayUnion(key)},{merge:true})}
  return {dateKey:key,revenue:result.stats.revenue,tablesServed:result.stats.tablesServed};
 });
}
