import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import {assertEmulatorSeedEnvironment} from './seed-guard.mjs';
import {syntheticEmail} from '../lib/identity.js';
import {orderFingerprint} from '../lib/orderFunctions.js';
import {rebuildStatsDay} from '../lib/statisticsStore.js';
import {reportDate} from '../lib/reportMath.js';
assertEmulatorSeedEnvironment(process.env);if(process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw Error('Report seed requires Auth emulator');initializeApp({projectId:'demo-for-cafe'});
const db=getFirestore(),cafe=db.doc('cafes/demo-cafe'),user=await getAuth().getUserByEmail(await syntheticEmail('Айжан','demo-cafe')),now=Date.now(),stamp=Timestamp.fromMillis(now),batch=db.batch();
const sessionId='f5-preview-paid',specs=[{id:'f5-preview-ticket-1',created:now-600000,served:now-300000,items:[{itemId:'d1',nameKy:'Бешбармак',nameRu:'Бешбармак',price:450,qty:2,served:false},{itemId:'d6',nameKy:'Көкөмерен чайы',nameRu:'Чай с чабрецом',price:150,qty:1,served:false}]},{id:'f5-preview-ticket-2',created:now-300000,served:now-180000,items:[{itemId:'d5',nameKy:'Жаңы жашылча салаты',nameRu:'Салат из свежих овощей',price:180,qty:2,served:false}]}];
// Reserved disposable imported fixtures, never real payments or kitchen activity.
batch.set(cafe.collection('tableSessions').doc(sessionId),{tableId:'9',tableNumber:9,status:'closed',openedBy:user.uid,openedAt:Timestamp.fromMillis(now-660000),closedAt:stamp,total:1410,paymentType:'cash',fixture:true});
for(const spec of specs){const data={clientOrderId:spec.id,tableId:'9',sessionId,waiterId:user.uid,waiterName:'Айжан',status:'served',createdAt:Timestamp.fromMillis(spec.created),clientCreatedAt:Timestamp.fromMillis(spec.created),servedAt:Timestamp.fromMillis(spec.served),servedItems:spec.items.map(()=>true),items:spec.items,note:'',validation:{state:'accepted',reason:null},fixture:true};batch.set(cafe.collection('orders').doc(spec.id),data);batch.set(cafe.collection('orderProcessing').doc(spec.id),{accepted:true,reason:null,fingerprint:orderFingerprint(data),processedAt:stamp});}
await batch.commit();for(const day of new Set([reportDate(now),...specs.flatMap(spec=>[reportDate(spec.created),reportDate(spec.served)])]))await rebuildStatsDay('demo-cafe',day);
console.log('F5 disposable report fixtures ready: paid 1410 KGS, 5 dishes, 1 table; 2 served orders, 3.5-minute average.');await db.terminate();
