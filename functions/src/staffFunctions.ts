import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {onCall,HttpsError,type CallableRequest} from 'firebase-functions/v2/https';
import {normalizeName,nameKey,syntheticEmail} from './identity.js';
import {authorize,businessOptions,object,text,id,requestId,password,digest,audit} from './businessCore.js';
// A durable per-person lock serializes Auth+Firestore changes. Failed operations are resumed
// with the same retry ID; a different operation cannot overtake an unfinished credential change.
async function mutate(request:CallableRequest,action:'createStaff'|'resetStaffPassword'|'setStaffActive'){
 const caller=await authorize(request,['admin']),db=getFirestore(),auth=getAuth(),cafe=db.doc(`cafes/${caller.cafeId}`);
 const data=object(request.data,action==='createStaff'?['name','role','password','requestId']:action==='resetStaffPassword'?['uid','newPassword','requestId']:['uid','active','requestId']);
 const retryId=requestId(data.requestId);let normalized='',key='',email='',name='',role='';
 if(action==='createStaff'){name=text(data.name,80).trim();try{normalized=normalizeName(name);key=await nameKey(name);email=await syntheticEmail(name,caller.cafeId)}catch{throw new HttpsError('invalid-argument','Invalid name')}role=String(data.role);if(!['waiter','cook'].includes(role))throw new HttpsError('invalid-argument','Invalid staff role');password(data.password)}
 if(action==='resetStaffPassword')password(data.newPassword);
 if(action==='setStaffActive'&&typeof data.active!=='boolean')throw new HttpsError('invalid-argument','Invalid active state');
 const opId=digest([caller.uid,action,retryId]),uid=action==='createStaff'?`staff-${digest([caller.cafeId,opId]).slice(0,40)}`:id(data.uid),op=cafe.collection('operations').doc(opId),staff=cafe.collection('staff').doc(uid),lock=cafe.collection('staffLocks').doc(uid),registry=key?cafe.collection('loginNames').doc(key):null;
 const metadata=action==='createStaff'?{name:normalized,role}:action==='setStaffActive'?{uid,active:data.active}:{uid};const fingerprint=digest(metadata),now=Date.now();
 const completed=await db.runTransaction(async tx=>{const [operation,profile,locked,actor]=await Promise.all([tx.get(op),tx.get(staff),tx.get(lock),tx.get(cafe.collection('staff').doc(caller.uid))]);const reservation=registry?await tx.get(registry):null;const old=operation.data();if(actor.data()?.active!==true||actor.data()?.role!=='admin')throw new HttpsError('permission-denied','Admin no longer active');if(old&&old.fingerprint!==fingerprint)throw new HttpsError('already-exists','Retry ID reused for a different operation');if(old?.state==='complete')return true;if(locked.exists&&locked.data()?.operationId!==opId)throw new HttpsError('failed-precondition','Another staff operation must finish first');if(old&&old.leaseUntil>now)throw new HttpsError('aborted','Operation in progress; retry later');
 if(action==='createStaff'){if(reservation?.exists&&reservation.data()?.uid!==uid)throw new HttpsError('already-exists','Duplicate staff name');if(!reservation?.exists)tx.create(registry!,{uid,normalized,state:'creating',createdAt:FieldValue.serverTimestamp()})}else if(!profile.exists||!['waiter','cook'].includes(profile.data()!.role))throw new HttpsError('permission-denied','Same-cafe waiter or cook required');
 if(action==='setStaffActive'&&data.active===false)tx.update(staff,{active:false,updatedAt:FieldValue.serverTimestamp()});
 tx.set(op,{action,actor:caller.uid,uid,fingerprint,state:'pending',leaseUntil:now+60000,updatedAt:FieldValue.serverTimestamp()});tx.set(lock,{operationId:opId});tx.set(cafe.collection('audit').doc(`${opId}-started`),audit(`${action}.started`,caller.uid,uid));return false});
 if(completed)return {uid};
 try{
  if(action==='createStaff'){
   let user;try{user=await auth.getUser(uid)}catch(error){if((error as {code?:string}).code!=='auth/user-not-found')throw error;user=await auth.createUser({uid,email,password:password(data.password),displayName:name,disabled:true})}
   if(user.email!==email)throw new HttpsError('failed-precondition','Identity conflict');
   await auth.setCustomUserClaims(uid,{cafeId:caller.cafeId,role});
   // A crash before the active profile commit still cannot grant application access.
   await auth.updateUser(uid,{disabled:false});
  }else{const target=await auth.getUser(uid);if(target.customClaims?.cafeId!==caller.cafeId||!['waiter','cook'].includes(target.customClaims?.role))throw new HttpsError('permission-denied','Target identity mismatch');if(action==='resetStaffPassword'){await auth.updateUser(uid,{password:password(data.newPassword)});await auth.revokeRefreshTokens(uid)}else{await auth.updateUser(uid,{disabled:!data.active});if(!data.active)await auth.revokeRefreshTokens(uid)}}
  await db.runTransaction(async tx=>{const operation=await tx.get(op);if(operation.data()?.state==='complete')return;const actor=await tx.get(cafe.collection('staff').doc(caller.uid));if(actor.data()?.active!==true||actor.data()?.role!=='admin')throw new HttpsError('permission-denied','Admin no longer active');
   if(action==='createStaff'){tx.set(staff,{name,normalizedName:normalized,role,active:true,createdAt:FieldValue.serverTimestamp()});tx.update(registry!,{state:'active'})}else if(action==='setStaffActive')tx.update(staff,{active:data.active,updatedAt:FieldValue.serverTimestamp()});
   tx.update(op,{state:'complete',leaseUntil:0,updatedAt:FieldValue.serverTimestamp()});tx.delete(lock);tx.create(cafe.collection('audit').doc(opId),audit(action,caller.uid,uid,action==='setStaffActive'?{active:data.active}:{}))});
  return {uid};
 }catch(error){if((await op.get()).data()?.state==='complete')return {uid};if(action==='createStaff')await auth.updateUser(uid,{disabled:true}).catch(()=>{});await op.update({leaseUntil:0}).catch(()=>{});if(error instanceof HttpsError)throw error;throw new HttpsError('unavailable','Staff operation incomplete; retry with the same requestId')}
}
export const createStaff=onCall(businessOptions,request=>mutate(request,'createStaff'));
export const resetStaffPassword=onCall(businessOptions,request=>mutate(request,'resetStaffPassword'));
export const setStaffActive=onCall(businessOptions,request=>mutate(request,'setStaffActive'));
