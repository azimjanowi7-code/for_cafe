import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
initializeApp();
// Provision the first admin out of band. Client role controls never authorize this function.
export const manageStaff=onCall(async request=>{
 const db=getFirestore(),auth=getAuth(),data=request.data||{};
 if(!request.auth)throw new HttpsError('unauthenticated','Sign in required');
 if(typeof data.cafeId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(data.cafeId))throw new HttpsError('invalid-argument','Invalid cafe');
 const members=db.collection('cafes').doc(data.cafeId).collection('members');
 const admin=(await members.doc(request.auth.uid).get()).data();
 if(!admin?.active||admin.role!=='Admin/Chef')throw new HttpsError('permission-denied','Admin required');
 if(!['list','create','reset','deactivate'].includes(data.action))throw new HttpsError('invalid-argument','Invalid action');
 if(data.action==='create'){
  if(typeof data.name!=='string'||!data.name.trim()||data.name.trim().length>80||!['Waiter','Cook'].includes(data.role)||typeof data.password!=='string'||data.password.length<8||data.password.length>128)throw new HttpsError('invalid-argument','Invalid staff fields');
  const user=await auth.createUser({displayName:data.name.trim(),password:data.password});
  try{await members.doc(user.uid).create({name:data.name.trim(),role:data.role,active:true})}catch(error){await auth.deleteUser(user.uid);throw error}
 }
 if(data.action==='reset'||data.action==='deactivate'){
  if(typeof data.uid!=='string'||!data.uid||data.uid.includes('/'))throw new HttpsError('invalid-argument','Invalid user');
  const member=(await members.doc(data.uid).get()).data();
  if(!member||!['Waiter','Cook'].includes(member.role))throw new HttpsError('permission-denied','Staff member required');
  if(data.action==='reset'){
   if(typeof data.password!=='string'||data.password.length<8||data.password.length>128)throw new HttpsError('invalid-argument','Invalid password');
   await auth.updateUser(data.uid,{password:data.password});await auth.revokeRefreshTokens(data.uid);
  }else{
   await auth.updateUser(data.uid,{disabled:true});await auth.revokeRefreshTokens(data.uid);await members.doc(data.uid).update({active:false});
  }
 }
 const snapshot=await members.get();
 return {staff:snapshot.docs.filter(doc=>['Waiter','Cook'].includes(doc.data().role)).map(doc=>({uid:doc.id,name:doc.data().name,role:doc.data().role,active:doc.data().active===true}))};
});
export {submitTicket} from './orders.js';
