import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {assertEmulatorSeedEnvironment} from './seed-guard.mjs';
import {provisionStaff} from '../lib/provisioning.js';
import {syntheticEmail} from '../lib/identity.js';
assertEmulatorSeedEnvironment(process.env);
if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw Error('Auth seed requires loopback Auth emulator');
initializeApp({projectId:'demo-for-cafe'});
// Explicit disposable emulator fixture password; never a cloud account or real secret.
const password='EmulatorOnly!2026';
for(const [name,role]of [['Администратор','admin'],['Айжан','waiter'],['Ашпозчу','cook'],['Өмүрбек Үсөн','waiter'],['Өчүрүлгөн','waiter']]){
 const email=await syntheticEmail(name,'demo-cafe');let user;try{user=await getAuth().getUserByEmail(email)}catch(error){if(error.code!=='auth/user-not-found')throw error;const created=await provisionStaff('demo-cafe',name,role,password,{bootstrap:role==='admin'});user=await getAuth().getUser(created.uid)}
 if(name==='Өчүрүлгөн'){await getAuth().updateUser(user.uid,{disabled:true});await getFirestore().doc(`cafes/demo-cafe/staff/${user.uid}`).update({active:false})}
}
console.log('F2 emulator Auth fixtures ready: admin, waiter, cook, Kyrgyz-name waiter, disabled waiter. Password is documented as a disposable fixture.');
process.exit(0);
