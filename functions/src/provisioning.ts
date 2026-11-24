import {randomUUID} from 'node:crypto';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {nameKey,normalizeName,syntheticEmail,type ClaimRole} from './identity.js';
// Internal primitive only; not a public callable. F3 will add authorized staff administration.
export async function provisionStaff(cafeId:string,name:string,role:ClaimRole,password:string,options:{bootstrap?:boolean}={}){
 if(!['admin','waiter','cook'].includes(role)||password.length<12||password.length>128||(role==='admin'&&!options.bootstrap))throw Error('invalid-provisioning');
 const normalized=normalizeName(name),email=await syntheticEmail(name,cafeId),key=await nameKey(name),uid=randomUUID(),db=getFirestore(),auth=getAuth(),cafe=db.doc(`cafes/${cafeId}`),reservation=cafe.collection('loginNames').doc(key),bootstrap=cafe.collection('system').doc('bootstrapAdmin');
 await db.runTransaction(async tx=>{const cafeDoc=await tx.get(cafe),existing=await tx.get(reservation),marker=options.bootstrap?await tx.get(bootstrap):null;if(!cafeDoc.exists)throw Error('unknown-cafe');if(existing.exists)throw Error('duplicate-name');if(marker?.exists)throw Error('admin-already-bootstrapped');if(options.bootstrap){const admins=await tx.get(cafe.collection('staff').where('role','==','admin').where('active','==',true).limit(1));if(!admins.empty)throw Error('admin-already-exists')}tx.create(reservation,{uid,normalized,state:'creating',createdAt:FieldValue.serverTimestamp()});if(options.bootstrap)tx.create(bootstrap,{uid,state:'creating',createdAt:FieldValue.serverTimestamp()})});
 let created=false;
 try{await auth.createUser({uid,email,password,displayName:name.trim(),disabled:true});created=true;await auth.setCustomUserClaims(uid,{cafeId,role});const batch=db.batch();batch.create(cafe.collection('staff').doc(uid),{name:name.trim(),normalizedName:normalized,role,active:true,createdAt:FieldValue.serverTimestamp()});batch.update(reservation,{state:'active'});if(options.bootstrap)batch.update(bootstrap,{state:'complete'});await batch.commit();await auth.updateUser(uid,{disabled:false});return {uid,email,cafeId,role}}
 catch(error){
  // Fail closed. Incomplete creations stay disabled; a committed record is retained for repair.
  const staff=await cafe.collection('staff').doc(uid).get();if(!staff.exists){if(created)await auth.deleteUser(uid);await db.runTransaction(async tx=>{const record=await tx.get(reservation),marker=options.bootstrap?await tx.get(bootstrap):null;if(record.data()?.uid===uid)tx.delete(reservation);if(marker?.data()?.uid===uid)tx.delete(bootstrap)})}throw error;
 }
}
