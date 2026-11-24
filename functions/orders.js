import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {createHash} from 'node:crypto';
// Exported from index.js after Firebase Admin initialization.
export const submitTicket=onCall(async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Sign in required');
 const {cafeId,idempotencyKey,ticket}=request.data||{};
 if(typeof cafeId!=='string'||!/^[\w-]{1,80}$/.test(cafeId)||typeof idempotencyKey!=='string'||!/^[\w-]{8,80}$/.test(idempotencyKey)||ticket?.id!==idempotencyKey||!Number.isInteger(ticket.table)||ticket.table<1||ticket.table>999||!Array.isArray(ticket.lines)||!ticket.lines.length||ticket.lines.length>100||typeof ticket.note!=='string'||ticket.note.length>500)throw new HttpsError('invalid-argument','Invalid ticket');
 const ids=new Set();for(const line of ticket.lines){if(typeof line.dishId!=='string'||!/^[\w-]{1,80}$/.test(line.dishId)||ids.has(line.dishId)||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>999||!Number.isFinite(line.priceSnapshot)||line.priceSnapshot<0)throw new HttpsError('invalid-argument','Invalid lines');ids.add(line.dishId)}
 const fingerprint=createHash('sha256').update(JSON.stringify({table:ticket.table,note:ticket.note,lines:ticket.lines.map(l=>({id:l.dishId,q:l.quantity,p:l.priceSnapshot}))})).digest('hex');
 const db=getFirestore(),cafe=db.collection('cafes').doc(cafeId),target=cafe.collection('tickets').doc(idempotencyKey);
 // Revocation and membership are authoritative; a client demo role never grants access.
 const user=await getAuth().getUser(request.auth.uid);if(user.disabled)throw new HttpsError('permission-denied','Inactive user');
 await db.runTransaction(async tx=>{
  const membership=await tx.get(cafe.collection('members').doc(request.auth.uid));const member=membership.data();
  if(!member?.active||!['Waiter','Admin/Chef'].includes(member.role))throw new HttpsError('permission-denied','Waiter membership required');
  const existing=await tx.get(target);if(existing.exists){if(existing.data().waiterId!==request.auth.uid||existing.data().fingerprint!==fingerprint)throw new HttpsError('already-exists','Key conflict');return}
  const lines=[];for(const line of ticket.lines){const dish=(await tx.get(cafe.collection('menu').doc(line.dishId))).data();if(!dish||dish.visible===false||dish.soldOut||dish.price!==line.priceSnapshot)throw new HttpsError('failed-precondition','Menu changed; review queued order');lines.push({dishId:line.dishId,name:dish.name,quantity:line.quantity,priceSnapshot:dish.price,served:false})}
  tx.create(target,{id:idempotencyKey,table:ticket.table,lines,note:ticket.note,receivedAt:Date.now(),status:'open',sync:'sent',waiterId:request.auth.uid,fingerprint});
 });
 return {id:idempotencyKey};
});
