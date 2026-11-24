import {getFirestore,FieldValue,Timestamp,type Transaction,type DocumentReference} from 'firebase-admin/firestore';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {onDocumentCreated} from 'firebase-functions/v2/firestore';
import {authorize,businessOptions,localOnly,object,id,text,lines,totalCents,dateKey,digest,audit,cents,type Line} from './businessCore.js';
import {rebuildStatsDay} from './statisticsStore.js';
const money=(value:number)=>value/100;
// Hash immutable fields only; serving metadata is intentionally excluded.
export const orderFingerprint=(order:Record<string,unknown>)=>digest([order.clientOrderId,order.tableId,order.sessionId,order.waiterId,order.waiterName,order.note,(order.items as Line[]).map(({itemId,nameKy,nameRu,price,qty})=>({itemId,nameKy,nameRu,price,qty}))]);
type IntentItem={itemId:string;qty:number};
function intentItems(value:unknown):IntentItem[]{
 if(!Array.isArray(value)||!value.length||value.length>100)throw new HttpsError('invalid-argument','Expected 1–100 items');
 const seen=new Set<string>();return value.map(entry=>{const data=object(entry,['itemId','qty']),itemId=id(data.itemId);if(seen.has(itemId)||!Number.isInteger(data.qty)||Number(data.qty)<1||Number(data.qty)>99)throw new HttpsError('invalid-argument','Invalid quantity or duplicate item');seen.add(itemId);return {itemId,qty:data.qty as number}});
}
async function available(tx:Transaction,cafe:DocumentReference,items:Pick<Line,'itemId'>[]){
 const docs=await tx.getAll(...items.map(line=>cafe.collection('menuItems').doc(line.itemId)));
 if(docs.some(item=>!item.exists||item.data()!.visible!==true||item.data()!.soldOut!==false))throw new HttpsError('failed-precondition','Missing, hidden or sold-out menu item');return docs;
}
export const submitOrder=onCall(businessOptions,async request=>{
 const caller=await authorize(request,['waiter','admin']),data=object(request.data,['clientOrderId','tableId','sessionId','items','note']),clientOrderId=id(data.clientOrderId),tableId=id(data.tableId),sessionId=id(data.sessionId),intent=intentItems(data.items);
 if(clientOrderId.length<8)throw new HttpsError('invalid-argument','Invalid clientOrderId');
 if(typeof data.note!=='string'||data.note.length>500)throw new HttpsError('invalid-argument','Invalid note');const note=data.note;
 const db=getFirestore(),cafe=db.doc(`cafes/${caller.cafeId}`),target=cafe.collection('orders').doc(clientOrderId),receipt=cafe.collection('orderReceipts').doc(clientOrderId);
 // Bind retries to immutable intent, not a future menu price/name or profile display name.
 const intentFingerprint=digest([caller.uid,clientOrderId,tableId,sessionId,note,[...intent].sort((a,b)=>a.itemId.localeCompare(b.itemId))]);
 await db.runTransaction(async tx=>{
  const [previous,accepted,session,table,actor]=await Promise.all([tx.get(target),tx.get(receipt),tx.get(cafe.collection('tableSessions').doc(sessionId)),tx.get(cafe.collection('tables').doc(tableId)),tx.get(cafe.collection('staff').doc(caller.uid))]);
  if(actor.data()?.active!==true||actor.data()?.role!==caller.role)throw new HttpsError('permission-denied','Membership changed');
  if(previous.exists){if(previous.data()!.waiterId!==caller.uid||accepted.data()?.intentFingerprint!==intentFingerprint)throw new HttpsError('already-exists','Order ID conflict');return}
  if(session.data()?.status!=='open'||session.data()?.tableId!==tableId||table.data()?.activeSessionId!==sessionId||table.data()?.status!=='open')throw new HttpsError('failed-precondition','Table session is not open');
  if(caller.role==='waiter'&&session.data()?.openedBy!==caller.uid)throw new HttpsError('permission-denied','Own table session required');
  const menu=await available(tx,cafe,intent);
  const items:Line[]=menu.map((doc,index)=>{const dish=doc.data()!;try{cents(dish.price);return {itemId:intent[index].itemId,qty:intent[index].qty,nameKy:text(dish.name?.ky,200),nameRu:text(dish.name?.ru,200),price:dish.price as number,served:false}}catch{throw new HttpsError('failed-precondition','Invalid current menu data')}});
  const order={clientOrderId,tableId,sessionId,items,note,waiterId:caller.uid,waiterName:caller.name},fingerprint=orderFingerprint(order);
  tx.create(target,{...order,status:'new',servedItems:items.map(()=>false),servedAt:null,createdAt:FieldValue.serverTimestamp(),clientCreatedAt:FieldValue.serverTimestamp(),validation:{state:'pending'}});
  tx.create(receipt,{fingerprint,intentFingerprint,acceptedAt:FieldValue.serverTimestamp(),actor:caller.uid});tx.create(cafe.collection('audit').doc(`submit-${clientOrderId}`),audit('submitOrder',caller.uid,clientOrderId));
 });return {clientOrderId};
});
// Trigger writes metadata only. It never rewrites snapshot lines, their prices or names.
export async function processOrder(cafeId:string,orderId:string){localOnly();id(cafeId);id(orderId);const db=getFirestore(),cafe=db.doc(`cafes/${cafeId}`),target=cafe.collection('orders').doc(orderId),marker=cafe.collection('orderProcessing').doc(orderId);
 const day=await db.runTransaction(async tx=>{const [snapshot,processed,receipt]=await Promise.all([tx.get(target),tx.get(marker),tx.get(cafe.collection('orderReceipts').doc(orderId))]);if(!snapshot.exists)return null;const order=snapshot.data()!;if(processed.exists)return order.createdAt instanceof Timestamp?dateKey(order.createdAt.toDate()):null;let reason='',items:Line[]=[];
 try{if(order.clientOrderId!==orderId||!['new','served'].includes(order.status))throw Error('invalid-order');id(order.tableId);id(order.sessionId);id(order.waiterId);text(order.waiterName,80);if(typeof order.note!=='string'||order.note.length>500||!(order.createdAt instanceof Timestamp))throw Error('invalid-order');items=lines(order.items.map((item:Line)=>({...item,served:false})));if(order.items.some((item:Line)=>typeof item.served!=='boolean'))throw Error('invalid-order')}catch{reason='invalid-order'}
 if(!reason){const trusted=receipt.exists&&receipt.data()!.fingerprint===orderFingerprint(order);if(!trusted){const [session,table,staff]=await Promise.all([tx.get(cafe.collection('tableSessions').doc(order.sessionId)),tx.get(cafe.collection('tables').doc(order.tableId)),tx.get(cafe.collection('staff').doc(order.waiterId))]);if(session.data()?.status!=='open'||session.data()?.tableId!==order.tableId||table.data()?.activeSessionId!==order.sessionId)reason='invalid-session';else if(staff.data()?.active!==true||!['waiter','admin'].includes(staff.data()?.role))reason='invalid-waiter';else try{await available(tx,cafe,items)}catch{reason='missing-or-sold-out-item'}}}
 const accepted=!reason,day=order.createdAt instanceof Timestamp?dateKey(order.createdAt.toDate()):dateKey(new Date());
 tx.create(marker,{accepted,reason:reason||null,processedAt:FieldValue.serverTimestamp(),fingerprint:accepted?orderFingerprint(order):null});tx.update(target,{validation:{state:accepted?'accepted':'rejected',reason:reason||null},...(!accepted?{status:'cancelled'}:{})});tx.create(cafe.collection('audit').doc(`order-${orderId}`),audit(accepted?'onOrderCreate.accepted':'onOrderCreate.rejected','system',orderId,{reason:reason||null}));
 return day;
 });
 if(day)await rebuildStatsDay(cafeId,day);
}
export const onOrderCreate=onDocumentCreated({...businessOptions,document:'cafes/{cafeId}/orders/{orderId}',retry:true},event=>event.data?processOrder(event.params.cafeId,event.params.orderId):Promise.resolve());

export const closeTable=onCall(businessOptions,async request=>{
 const caller=await authorize(request,['waiter','admin']),data=object(request.data,['sessionId','paymentType']),sessionId=id(data.sessionId);
 if(data.paymentType!=='cash'&&data.paymentType!=='card')throw new HttpsError('invalid-argument','Invalid payment type');
 const paymentType=data.paymentType as 'cash'|'card',db=getFirestore(),cafe=db.doc(`cafes/${caller.cafeId}`),sessionRef=cafe.collection('tableSessions').doc(sessionId),closedAt=Timestamp.now(),day=dateKey(closedAt.toDate());
 const result=await db.runTransaction(async tx=>{
  const [sessionDoc,actor]=await Promise.all([tx.get(sessionRef),tx.get(cafe.collection('staff').doc(caller.uid))]),session=sessionDoc.data();
  if(actor.data()?.active!==true||actor.data()?.role!==caller.role)throw new HttpsError('permission-denied','Membership changed');
  if(!session)throw new HttpsError('not-found','Unknown session');
  if(caller.role==='waiter'&&session.openedBy!==caller.uid)throw new HttpsError('permission-denied','Own table session required');
  if(session.status==='closed'){if(session.paymentType!==paymentType)throw new HttpsError('already-exists','Session already closed with another payment type');return {sessionId,total:session.total,paymentType:session.paymentType}}
  if(session.status!=='open')throw new HttpsError('failed-precondition','Session not open');
  const tableRef=cafe.collection('tables').doc(id(session.tableId)),[table,orders]=await Promise.all([tx.get(tableRef),tx.get(cafe.collection('orders').where('sessionId','==',sessionId).limit(201))]);
  if(orders.size>200)throw new HttpsError('resource-exhausted','Session exceeds 200 tickets');
  if(table.data()?.activeSessionId!==sessionId)throw new HttpsError('failed-precondition','Table session changed');
  let amount=0;
  for(const doc of orders.docs){const order=doc.data();if(order.validation?.state==='rejected'||order.status==='cancelled')continue;if(order.validation?.state!=='accepted')throw new HttpsError('failed-precondition','Wait for order validation');
   const marker=await tx.get(cafe.collection('orderProcessing').doc(doc.id));if(marker.data()?.accepted!==true||marker.data()?.fingerprint!==orderFingerprint(order))throw new HttpsError('failed-precondition','Order snapshots changed');
   amount+=totalCents(lines(order.items.map((line:Line)=>({...line,served:false}))));
  }
  const total=money(amount);
  tx.update(sessionRef,{status:'closed',total,paymentType,closedAt,closedBy:caller.uid,dateKey:day,tableNumber:table.data()!.number});tx.update(tableRef,{status:'free',activeSessionId:null});
  tx.create(cafe.collection('audit').doc(`close-${sessionId}`),audit('closeTable',caller.uid,sessionId,{total,paymentType,dateKey:day}));return {sessionId,total,paymentType};
 });
 // One canonical writer publishes cafe and waiter totals together, with matching versions.
 // If this follow-up fails, the committed closure remains safe and the same call retries it.
 const closed=(await sessionRef.get()).data()!;await rebuildStatsDay(caller.cafeId,dateKey(closed.closedAt.toDate()));return result;
});
