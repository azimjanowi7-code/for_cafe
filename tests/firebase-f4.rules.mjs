import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails,withFunctionTriggersDisabled} from '@firebase/rules-unit-testing';
import {doc,collection,collectionGroup,getDoc,getDocs,setDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp,Timestamp,query,where,deleteField,setLogLevel} from 'firebase/firestore';
import {assertEmulatorSeedEnvironment} from '../functions/scripts/seed-guard.mjs';
assertEmulatorSeedEnvironment(process.env);
setLogLevel('silent'); // Expected permission denials are asserted, not emitted as SDK warning noise.
const rules=fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8');
assert.equal(rules,fs.readFileSync(new URL('../firebase/emulator.firestore.rules',import.meta.url),'utf8'),'Emulator and deployment candidate must use identical rules');
const cafeA='rules-a',cafeB='rules-b',at=Timestamp.now(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bishkek',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),past='2020-01-01';
const names={ky:'Тамак',ru:'Блюдо'},category={name:names,order:0},menu={name:names,description:{ky:'Даамдуу',ru:'Вкусно'},price:100,categoryId:'main',order:0,visible:true,soldOut:false,photo:null,createdAt:at,updatedAt:at};
const item={itemId:'meal',nameKy:'Тамак',nameRu:'Блюдо',price:100,qty:2,served:false};
const order={clientOrderId:'ticket-own',tableId:'open',sessionId:'session-own',waiterId:'waiter-a',waiterName:'Официант',status:'new',items:[item],note:'',createdAt:at,clientCreatedAt:at,servedItems:[false],servedAt:null,validation:{state:'accepted',reason:null}};
const session={tableId:'open',openedBy:'waiter-a',openedAt:at,closedAt:null,status:'open',paymentType:null,total:null};
const cafeData={name:names,code:'RULES-001',settings:{warnAfterMinutes:10,lateAfterMinutes:20,currency:'KGS',timeZone:'Asia/Bishkek'},createdAt:at};
const stats={dateKey:day,timeZone:'Asia/Bishkek',currency:'KGS',revenue:200,tablesServed:1,ordersServed:1,cashTotal:200,cardTotal:0,waitTotalMs:1000,tableTotals:{open:200},dishTotals:{meal:{name:names,qty:2}},updatedAt:at};
const actors=[{key:'admin',uid:'admin-a',role:'admin'},{key:'waiter',uid:'waiter-a',role:'waiter'},{key:'cook',uid:'cook-a',role:'cook'},{key:'anonymous',uid:'anonymous'},{key:'inactive',uid:'inactive-a',role:'waiter'},{key:'unclaimed',uid:'unclaimed-a'},{key:'forged-role',uid:'waiter-a',role:'admin'}];
const active=actor=>['admin','waiter','cook'].includes(actor.key);
const admin=actor=>actor.key==='admin';
const owner=actor=>actor.key==='waiter';
let env,serial=0,assertions=0;
async function expectAllowed(allowed,promise){assertions++;return allowed?assertSucceeds(promise):assertFails(promise)}
async function seed(path,data){await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),path),data))}
async function opening(db,cafe,uid,token){const tableId=`free-${token}`,sessionId=`new-${token}`;await seed(`cafes/${cafe}/tables/${tableId}`,{number:1,status:'free',activeSessionId:null});const batch=writeBatch(db);batch.set(doc(db,`cafes/${cafe}/tableSessions/${sessionId}`),{tableId,openedBy:uid,openedAt:serverTimestamp(),closedAt:null,status:'open',paymentType:null,total:null});batch.update(doc(db,`cafes/${cafe}/tables/${tableId}`),{status:'open',activeSessionId:sessionId});return batch.commit()}

// Every row asserts get/list/create/update/delete, including explicitly denied operations.
const rows=[
 {name:'cafe',path:c=>`cafes/${c}`,data:cafeData,get:active,list:()=>false,create:()=>false,update:admin,delete:()=>false,patch:()=>({name:{ky:'Жаңы',ru:'Новое'}})},
 {name:'categories',path:c=>`cafes/${c}/menuCategories/main`,data:category,get:active,list:active,create:admin,update:admin,delete:admin,patch:()=>({order:1})},
 {name:'menuItems',path:c=>`cafes/${c}/menuItems/meal`,data:menu,get:active,list:active,create:admin,update:a=>admin(a)||a.key==='cook',delete:admin,newData:()=>({...menu,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}),patch:a=>a.key==='cook'?{soldOut:true}:{price:120,updatedAt:serverTimestamp()}},
 {name:'priceHistory',path:c=>`cafes/${c}/menuItems/meal/priceHistory/change`,data:{oldPrice:90,newPrice:100,changedAt:at,changedBy:'admin-a'},get:admin,list:admin},
 {name:'staff',path:(c,a)=>`cafes/${c}/staff/${a.uid}`,data:{name:'Сотрудник',role:'waiter',active:true,createdAt:at},get:a=>a.key!=='anonymous'&&a.key!=='unclaimed',list:()=>false,skipSeed:true},
 {name:'tables',path:c=>`cafes/${c}/tables/free`,data:{number:1,status:'free',activeSessionId:null},get:active,list:active,create:admin,update:admin,delete:admin,patch:()=>({number:2})},
 {name:'tableSessions',path:c=>`cafes/${c}/tableSessions/session-own`,data:session,get:a=>admin(a)||owner(a),list:a=>admin(a)||owner(a),create:a=>admin(a)||owner(a),customCreate:true,filters:a=>owner(a)?[where('openedBy','==',a.uid)]:[]},
 {name:'orders',path:c=>`cafes/${c}/orders/ticket-own`,data:order,get:active,list:active,update:a=>admin(a)||a.key==='cook',filters:a=>owner(a)?[where('waiterId','==',a.uid)]:[],patch:()=>({status:'served',servedItems:[true],servedAt:serverTimestamp()})},
 {name:'dailyStats-today',path:c=>`cafes/${c}/dailyStats/${day}`,data:stats,get:a=>admin(a)||a.key==='cook',list:admin},
 {name:'dailyStats-history',path:c=>`cafes/${c}/dailyStats/${past}`,data:{...stats,dateKey:past},get:admin,list:admin},
 {name:'waiterStats-own',path:c=>`cafes/${c}/dailyStats/${day}/waiters/waiter-a`,data:{waiterId:'waiter-a',soldDishesTotal:200},get:a=>admin(a)||owner(a),list:admin},
 {name:'waiterStats-other',path:c=>`cafes/${c}/dailyStats/${day}/waiters/other`,data:{waiterId:'other',soldDishesTotal:400},get:admin,list:admin},
 {name:'publicMenu',path:c=>`publicMenu/${c}`,data:{name:names,address:names,categories:[],publishedAt:at},get:()=>true,list:()=>false},
 {name:'publicItems',path:c=>`publicMenu/${c}/items/meal`,data:{name:names,description:names,price:100,categoryId:'main',order:0,categoryOrder:0,photo:null},get:()=>true,list:()=>true},
 {name:'cafeCodes',path:()=>`cafeCodes/RULES-001`,data:{cafeId:cafeA}},
 ...['audit','operations','staffLocks','orderReceipts','orderProcessing','loginNames','system','unknown'].map(name=>({name,path:c=>`cafes/${c}/${name}/private`,data:{value:1}})),
 {name:'unknown-nested',path:c=>`cafes/${c}/orders/ticket-own/unknown/private`,data:{value:1}},
 {name:'unknown-root',path:()=>`unrecognized/private`,data:{value:1}}
];

test('F4 comprehensive Firestore rules emulator suite',async t=>{
 env=await initializeTestEnvironment({projectId:'demo-for-cafe',firestore:{host:'127.0.0.1',port:8080,rules}});
 try{await withFunctionTriggersDisabled({host:'127.0.0.1',port:4400},async()=>{
  await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore(),batch=writeBatch(db);for(const cafe of [cafeA,cafeB]){batch.set(doc(db,`cafes/${cafe}`),cafeData);for(const [uid,role,enabled]of [['admin-a','admin',true],['waiter-a','waiter',true],['cook-a','cook',true],['inactive-a','waiter',false]])batch.set(doc(db,`cafes/${cafe}/staff/${uid}`),{name:uid,role,active:enabled,createdAt:at});batch.set(doc(db,`cafes/${cafe}/menuCategories/main`),category);batch.set(doc(db,`cafes/${cafe}/tableSessions/session-own`),session);batch.set(doc(db,`cafes/${cafe}/tableSessions/session-other`),{...session,openedBy:'other'});batch.set(doc(db,`cafes/${cafe}/orders/ticket-other`),{...order,clientOrderId:'ticket-other',sessionId:'session-other',waiterId:'other'});batch.set(doc(db,`cafes/${cafe}/orders/ticket-shared-session`),{...order,clientOrderId:'ticket-shared-session',waiterId:'other'});}await batch.commit()});
  const clients=new Map(actors.map(a=>[a.key,a.key==='anonymous'?env.unauthenticatedContext().firestore():env.authenticatedContext(a.uid,a.key==='unclaimed'?{}:{cafeId:cafeA,role:a.role}).firestore()]));
  for(const actor of actors)for(const row of rows)await t.test(`matrix ${actor.key} × ${row.name} × get/list/create/update/delete`,async()=>{
   const db=clients.get(actor.key),path=row.path(cafeA,actor),ref=doc(db,path),token=String(++serial),newRef=doc(db,path+'-new-'+token);
   if(!row.skipSeed)await seed(path,row.data);if(row.name==='menuItems')await seed(`cafes/${cafeA}/menuCategories/main`,category);
   await expectAllowed(!!row.get?.(actor),getDoc(ref));
   await expectAllowed(!!row.list?.(actor),getDocs(query(collection(db,path.split('/').slice(0,-1).join('/')),...(row.filters?.(actor)||[]))));
   const create=row.customCreate?opening(db,cafeA,actor.uid,token):setDoc(newRef,row.newData?.()||row.data);await expectAllowed(!!row.create?.(actor),create);
   await expectAllowed(!!row.update?.(actor),updateDoc(ref,row.patch?.(actor)||{active:false}));
   await expectAllowed(!!row.delete?.(actor),deleteDoc(ref));
  });
  for(const actor of actors.filter(active))await t.test(`cross-cafe ${actor.key}: every private collection and operation denied`,async()=>{
   const db=clients.get(actor.key);
   for(const row of rows.filter(r=>r.path(cafeB,actor).startsWith('cafes/'))){const path=row.path(cafeB,actor);if(!row.skipSeed)await seed(path,row.data);const ref=doc(db,path),token=String(++serial);await expectAllowed(false,getDoc(ref));await expectAllowed(false,getDocs(collection(db,path.split('/').slice(0,-1).join('/'))));await expectAllowed(false,row.customCreate?opening(db,cafeB,actor.uid,token):setDoc(doc(db,path+'-new-'+token),row.newData?.()||row.data));await expectAllowed(false,updateDoc(ref,row.patch?.(actor)||{active:false}));await expectAllowed(false,deleteDoc(ref))}
  });
  const waiterDb=clients.get('waiter'),cookDb=clients.get('cook'),adminDb=clients.get('admin'),anonymousDb=clients.get('anonymous'),orderPath=`cafes/${cafeA}/orders/ticket-own`,menuPath=`cafes/${cafeA}/menuItems/meal`;
  await t.test('attack: waiter edits price; cook edits any menu field except soldOut',async()=>{
   await seed(menuPath,menu);await expectAllowed(false,updateDoc(doc(waiterDb,menuPath),{price:1}));for(const patch of [{price:1},{name:{ky:'Алдоо',ru:'Подмена'}},{visible:false},{soldOut:true,price:1},{soldOut:'yes'},{updatedAt:serverTimestamp()},{description:deleteField()},{secret:true}])await expectAllowed(false,updateDoc(doc(cookDb,menuPath),patch));await expectAllowed(true,updateDoc(doc(cookDb,menuPath),{soldOut:true}));await expectAllowed(true,updateDoc(doc(cookDb,menuPath),{soldOut:false}));
  });
  await t.test('attack: no role can create orders, change snapshots or delete ticket history',async()=>{
   await seed(orderPath,order);for(const actor of actors){const db=clients.get(actor.key);await expectAllowed(false,setDoc(doc(db,`cafes/${cafeA}/orders/forged-${actor.key}`),order));for(const patch of [{items:[{...item,price:1}]},{items:[{...item,qty:99}]},{items:[{...item,nameRu:'Подмена'}]},{items:[{...item,served:true}]},{items:deleteField()},{waiterId:'attacker'},{tableId:'another'},{sessionId:'session-other'},{validation:{state:'accepted'}},{clientOrderId:'different'},{createdAt:serverTimestamp()},{note:'changed'}])await expectAllowed(false,updateDoc(doc(db,orderPath),patch));await expectAllowed(false,deleteDoc(doc(db,orderPath)))}
  });
  await t.test('cook serving supports partial/full/Undo but rejects arbitrary status, metadata and malformed flags',async()=>{
   await seed(orderPath,{...order,items:[item,{...item,itemId:'tea'}],servedItems:[false,false]});const ref=doc(cookDb,orderPath);await expectAllowed(true,updateDoc(ref,{servedItems:[true,false]}));await expectAllowed(true,updateDoc(ref,{status:'served',servedItems:[true,true],servedAt:serverTimestamp()}));await expectAllowed(true,updateDoc(ref,{status:'new',servedItems:[false,false],servedAt:null}));
   for(const patch of [{status:'cancelled'},{status:'paid'},{servedItems:[true]},{servedItems:[true,'yes']},{servedItems:[true,true]},{servedItems:{meal:true}},{servedAt:at},{status:'served',servedItems:[true,true],servedAt:at},{status:'served',servedItems:[true,true],servedAt:serverTimestamp(),note:'attack'}])await expectAllowed(false,updateDoc(ref,patch));
   await seed(orderPath,{...order,validation:{state:'pending'}});await expectAllowed(false,updateDoc(ref,{status:'served',servedItems:[true],servedAt:serverTimestamp()}));
   await seed(orderPath,{...order,status:'cancelled'});await expectAllowed(false,updateDoc(ref,{status:'served',servedItems:[true],servedAt:serverTimestamp()}));
  });
  await t.test('admin soft-cancels without deleting or changing immutable content; cook cannot cancel',async()=>{
   await seed(orderPath,order);const patch={status:'cancelled',cancelledAt:serverTimestamp(),cancelledBy:'admin-a'};await expectAllowed(false,updateDoc(doc(cookDb,orderPath),patch));await expectAllowed(true,updateDoc(doc(adminDb,orderPath),patch));await seed(orderPath,order);await seed(`cafes/${cafeA}/tableSessions/session-own`,{...session,status:'closed',closedAt:at,total:200,paymentType:'cash'});await expectAllowed(false,updateDoc(doc(adminDb,orderPath),patch));await seed(`cafes/${cafeA}/tableSessions/session-own`,session);
  });
  await t.test('waiter sees own tickets and own session tickets, never an arbitrary viewed table or broad order query',async()=>{
   await seed(orderPath,order);await expectAllowed(true,getDoc(doc(waiterDb,orderPath)));await expectAllowed(true,getDoc(doc(waiterDb,`cafes/${cafeA}/orders/ticket-shared-session`)));await expectAllowed(false,getDoc(doc(waiterDb,`cafes/${cafeA}/orders/ticket-other`)));await expectAllowed(false,getDocs(collection(waiterDb,`cafes/${cafeA}/orders`)));await expectAllowed(true,getDocs(query(collection(waiterDb,`cafes/${cafeA}/orders`),where('waiterId','==','waiter-a'))));await expectAllowed(true,getDocs(query(collection(waiterDb,`cafes/${cafeA}/orders`),where('sessionId','==','session-own'))));await expectAllowed(false,getDocs(query(collection(waiterDb,`cafes/${cafeA}/orders`),where('sessionId','==','session-other'))));
  });
  await t.test('attack: waiter reads another waiter stats; cook reads historical or waiter stats; anonymous writes',async()=>{
   await expectAllowed(false,getDoc(doc(waiterDb,`cafes/${cafeA}/dailyStats/${day}/waiters/other`)));await expectAllowed(false,getDocs(collection(waiterDb,`cafes/${cafeA}/dailyStats/${day}/waiters`)));await expectAllowed(false,getDoc(doc(cookDb,`cafes/${cafeA}/dailyStats/${past}`)));await expectAllowed(false,getDocs(collection(cookDb,`cafes/${cafeA}/dailyStats`)));await expectAllowed(false,getDoc(doc(cookDb,`cafes/${cafeA}/dailyStats/${day}/waiters/waiter-a`)));await expectAllowed(false,setDoc(doc(anonymousDb,`cafes/${cafeA}/orders/anonymous-create`),order));
  });
  await t.test('open session/table must be one atomic pair; no direct close, hijack, re-open or deletion',async()=>{
   await expectAllowed(true,opening(waiterDb,cafeA,'waiter-a','waiter-positive'));
   const sessionPath=`cafes/${cafeA}/tableSessions/new-waiter-positive`,tablePath=`cafes/${cafeA}/tables/free-waiter-positive`;
   for(const db of [waiterDb,adminDb,cookDb]){await expectAllowed(false,updateDoc(doc(db,sessionPath),{status:'closed',closedAt:serverTimestamp(),total:0,paymentType:'cash'}));await expectAllowed(false,deleteDoc(doc(db,sessionPath)));await expectAllowed(false,updateDoc(doc(db,tablePath),{status:'free',activeSessionId:null}));await expectAllowed(false,deleteDoc(doc(db,tablePath)))}
   await seed(`cafes/${cafeA}/tables/orphan`,{number:1,status:'free',activeSessionId:null});await expectAllowed(false,updateDoc(doc(waiterDb,`cafes/${cafeA}/tables/orphan`),{status:'open',activeSessionId:'session-own'}));await expectAllowed(false,setDoc(doc(waiterDb,`cafes/${cafeA}/tableSessions/orphan`),{...session,openedBy:'waiter-a',tableId:'orphan',openedAt:serverTimestamp()}));
   const bad=writeBatch(waiterDb);bad.set(doc(waiterDb,`cafes/${cafeA}/tableSessions/impersonation`),{...session,openedBy:'other',tableId:'orphan',openedAt:serverTimestamp()});bad.update(doc(waiterDb,`cafes/${cafeA}/tables/orphan`),{status:'open',activeSessionId:'impersonation'});await expectAllowed(false,bad.commit());
  });
  await t.test('inactive and changed-role membership block private operations immediately; own profile remains readable',async()=>{
   const ref=doc(waiterDb,`cafes/${cafeA}/staff/waiter-a`);await seed(`cafes/${cafeA}/staff/waiter-a`,{name:'Waiter',role:'waiter',active:false});await expectAllowed(true,getDoc(ref));await expectAllowed(false,getDoc(doc(waiterDb,menuPath)));await expectAllowed(false,getDocs(collection(waiterDb,`cafes/${cafeA}/orders`)));await seed(`cafes/${cafeA}/staff/waiter-a`,{name:'Waiter',role:'cook',active:true});await expectAllowed(false,getDoc(doc(waiterDb,menuPath)));await seed(`cafes/${cafeA}/staff/waiter-a`,{name:'Waiter',role:'waiter',active:true});
  });
  await t.test('malformed admin data, category privilege escalation and server marker forgery are denied',async()=>{
   await seed(menuPath,menu);for(const patch of [{price:-1,updatedAt:serverTimestamp()},{price:'10',updatedAt:serverTimestamp()},{price:1.001,updatedAt:serverTimestamp()},{soldOut:'yes',updatedAt:serverTimestamp()},{createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{categoryId:'missing',updatedAt:serverTimestamp()},{photo:'javascript:attack',updatedAt:serverTimestamp()},{secret:true,updatedAt:serverTimestamp()}])await expectAllowed(false,updateDoc(doc(adminDb,menuPath),patch));
   for(const name of ['audit','operations','staffLocks','orderReceipts','orderProcessing','loginNames','system'])await expectAllowed(false,setDoc(doc(adminDb,`cafes/${cafeA}/${name}/forged`),{active:true,accepted:true,role:'admin'}));await expectAllowed(false,updateDoc(doc(adminDb,`cafes/${cafeA}`),{code:'BYPASS'}));await expectAllowed(false,setDoc(doc(waiterDb,`cafes/${cafeA}/menuCategories/escalation`),category));
  });
  await t.test('cross-cafe collection-group queries cannot broaden any role to private data in another cafe',async()=>{
   for(const actor of actors)for(const name of ['orders','menuItems','staff','waiters'])await expectAllowed(false,getDocs(collectionGroup(clients.get(actor.key),name)));
  });
  fs.writeFileSync(new URL('../qa/results/firebase-f4-rules.json',import.meta.url),JSON.stringify({project:'demo-for-cafe',date:new Date().toISOString(),rulesFilesIdentical:true,actors:actors.map(a=>a.key),collections:rows.map(r=>r.name),operations:['get','list','create','update','delete'],permissionAssertions:assertions,crossCafeRoles:actors.filter(active).map(a=>a.key),cases:'Explicit allow/deny assertions; nested matrix plus attack and workflow cases'},null,2)+'\n');
  console.log(`F4_PERMISSION_ASSERTIONS=${assertions}`);
 });}finally{await env.cleanup()}
});
