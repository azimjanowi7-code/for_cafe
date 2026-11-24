import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {getFirestore} from 'firebase-admin/firestore';
import {businessOptions,localOnly,id,digest,audit,cents} from './businessCore.js';
function localized(value:unknown,allowEmpty=false){if(!value||typeof value!=='object')return null;const data=value as Record<string,unknown>;if(typeof data.ky!=='string'||typeof data.ru!=='string'||data.ky.length>2000||data.ru.length>2000||(!allowEmpty&&(!data.ky.trim()||!data.ru.trim())))return null;return {ky:data.ky,ru:data.ru}}
// Read current state in a transaction: delayed/reordered events cannot republish an old item.
export async function syncMenuItem(cafeId:string,itemId:string,eventId:string){localOnly();id(cafeId);id(itemId);const db=getFirestore(),cafe=db.doc(`cafes/${cafeId}`),source=cafe.collection('menuItems').doc(itemId),target=db.doc(`publicMenu/${cafeId}/items/${itemId}`),log=cafe.collection('audit').doc(`menu-${digest(eventId)}`);
 await db.runTransaction(async tx=>{const [item,logged]=await Promise.all([tx.get(source),tx.get(log)]);if(logged.exists)return;const data=item.data(),name=localized(data?.name),description=localized(data?.description,true);let valid=!!data&&data.visible===true&&data.soldOut===false&&!!name&&!!description;try{cents(data?.price);id(data?.categoryId)}catch{valid=false}const category=valid?await tx.get(cafe.collection('menuCategories').doc(data!.categoryId)):null;if(!category?.exists)valid=false;const photo=data?.photo??null;if(photo!==null&&(typeof photo!=='string'||photo.length>2048||!/^https:\/\//.test(photo)))valid=false;
 if(valid)tx.set(target,{name,description,price:data!.price,categoryId:data!.categoryId,order:Number.isInteger(data!.order)?data!.order:0,categoryOrder:Number.isInteger(category!.data()!.order)?category!.data()!.order:0,photo});else tx.delete(target);
 tx.create(log,audit('publishMenuItem','system',itemId,{published:valid,eventId}));
 });
}
export const publishMenuItem=onDocumentWritten({...businessOptions,document:'cafes/{cafeId}/menuItems/{itemId}',retry:true},event=>event.data?syncMenuItem(event.params.cafeId,event.params.itemId,event.id):Promise.resolve());
