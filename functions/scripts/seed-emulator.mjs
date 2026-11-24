import {initializeApp} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import {assertEmulatorSeedEnvironment} from './seed-guard.mjs';
assertEmulatorSeedEnvironment(process.env);
initializeApp({projectId:'demo-for-cafe'});
const db=getFirestore(),cafeId='demo-cafe',at=Timestamp.now(),cafe=db.collection('cafes').doc(cafeId);
const categories=[
 {id:'main',name:{ky:'Ысык тамактар',ru:'Горячее'},order:0},
 {id:'soups',name:{ky:'Шорполор',ru:'Супы'},order:1},
 {id:'salads',name:{ky:'Салаттар',ru:'Салаты'},order:2},
 {id:'drinks',name:{ky:'Суусундуктар',ru:'Напитки'},order:3}
];
const items=[
 {id:'d1',name:{ky:'Бешбармак',ru:'Бешбармак'},description:{ky:'Үй кесмеси, уй эти, пияз',ru:'Домашняя лапша, говядина, лук'},price:450,categoryId:'main',order:0,visible:true,soldOut:false},
 {id:'d2',name:{ky:'Лагман',ru:'Лагман'},description:{ky:'Эт жана жашылча кошулган кесме',ru:'Тянутая лапша с мясом и овощами'},price:320,categoryId:'main',order:1,visible:true,soldOut:false},
 {id:'d3',name:{ky:'Манты',ru:'Манты'},description:{ky:'Уй эти менен, 5 даана',ru:'С говядиной, 5 штук'},price:300,categoryId:'main',order:2,visible:true,soldOut:false},
 {id:'d4',name:{ky:'Шорпо',ru:'Шорпо'},description:{ky:'Уй этинен жасалган шорпо',ru:'Наваристый бульон с говядиной'},price:280,categoryId:'soups',order:0,visible:true,soldOut:false},
 {id:'d5',name:{ky:'Жаңы жашылча салаты',ru:'Салат из свежих овощей'},description:{ky:'Помидор, бадыраң, көк чөп',ru:'Помидоры, огурцы, зелень'},price:180,categoryId:'salads',order:0,visible:true,soldOut:false},
 {id:'d6',name:{ky:'Көкөмерен чайы',ru:'Чай с чабрецом'},description:{ky:'Чайнек, 800 мл',ru:'Чайник, 800 мл'},price:150,categoryId:'drinks',order:0,visible:true,soldOut:false},
 {id:'d7',name:{ky:'Боорсок',ru:'Боорсок'},description:{ky:'Жаңы бышкан, чайга',ru:'Свежий, к чаю'},price:100,categoryId:'main',order:3,visible:true,soldOut:true},
 {id:'seed-hidden',name:{ky:'Жашыруун тамак',ru:'Скрытое блюдо'},description:{ky:'Текшерүү үчүн',ru:'Для проверки'},price:1,categoryId:'main',order:4,visible:false,soldOut:false}
];
const batch=db.batch();
batch.set(cafe,{name:{ky:'Демо кафе',ru:'Демо кафе'},code:'DEMO-001',settings:{warnAfterMinutes:10,lateAfterMinutes:20,currency:'KGS',timeZone:'Asia/Bishkek'},createdAt:at});
batch.set(db.doc('cafeCodes/DEMO-001'),{cafeId});
for(const {id,...data}of categories)batch.set(cafe.collection('menuCategories').doc(id),data);
for(const {id,...data}of items){batch.set(cafe.collection('menuItems').doc(id),{...data,createdAt:at,updatedAt:at});const publicRef=db.doc(`publicMenu/${cafeId}/items/${id}`);if(data.visible&&!data.soldOut){const {name,description,price,categoryId,order}=data;batch.set(publicRef,{name,description,price,categoryId,order,categoryOrder:categories.find(c=>c.id===categoryId).order,photo:null})}else batch.delete(publicRef)}
for(let number=1;number<=12;number++)batch.set(cafe.collection('tables').doc(String(number)),{number,status:number===1?'open':'free',activeSessionId:number===1?'seed-session-001':null});
// Data fixtures only: no Auth identities, passwords or claims are provisioned in F1.
for(const role of ['admin','waiter','cook'])batch.set(cafe.collection('staff').doc(`seed-${role}`),{name:{admin:'Администратор',waiter:'Айжан',cook:'Ашпозчу'}[role],role,active:false,createdAt:at,fixture:true});
batch.set(cafe.collection('tableSessions').doc('seed-session-001'),{tableId:'1',openedAt:at,closedAt:null,paymentType:null,total:null,status:'open',openedBy:'seed-waiter'});
batch.set(cafe.collection('orders').doc('seed-order-001'),{tableId:'1',sessionId:'seed-session-001',waiterId:'seed-waiter',waiterName:'Айжан',status:'new',createdAt:at,clientCreatedAt:at,items:[{itemId:'d1',nameKy:'Бешбармак',nameRu:'Бешбармак',price:450,qty:2,served:false},{itemId:'d6',nameKy:'Көкөмерен чайы',nameRu:'Чай с чабрецом',price:150,qty:1,served:false}],clientOrderId:'seed-order-001',note:''});
const dateKey=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bishkek',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
batch.set(cafe.collection('dailyStats').doc(dateKey),{dateKey,timeZone:'Asia/Bishkek',currency:'KGS',revenue:0,tablesServed:0,ordersServed:0,waitTotalMs:0,cashTotal:0,cardTotal:0,tableTotals:{},dishTotals:{},updatedAt:at});
batch.set(cafe.collection('dailyStats').doc(dateKey).collection('waiters').doc('seed-waiter'),{waiterId:'seed-waiter',waiterName:'Айжан',dateKey,soldDishesTotal:0,dishesSold:0,tablesServed:0,updatedAt:at});
batch.set(db.doc(`publicMenu/${cafeId}`),{name:{ky:'Демо кафе',ru:'Демо кафе'},address:{ky:'Бишкек · демо-маалыматтар',ru:'Бишкек · демонстрационные данные'},categories,publishedAt:at});
await batch.commit();
console.log('F1 emulator seed ready: demo-for-cafe / demo-cafe / DEMO-001; 8 private items, 6 sanitized public items, 12 tables, 1 order.');
await db.terminate();
