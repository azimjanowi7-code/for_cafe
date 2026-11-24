import {collection,doc,getDocFromServer,getDocsFromServer,orderBy,query,type Firestore} from 'firebase/firestore';
import type {Dish} from '../model';
import type {Localized,MenuCategory} from './schema';
export type PublicMenuData={name:Localized;address:Localized;categories:(MenuCategory&{id:string})[];dishes:Dish[];outdated?:boolean};
function localized(value:unknown):Localized{if(!value||typeof value!=='object'||typeof (value as Localized).ky!=='string'||typeof (value as Localized).ru!=='string')throw Error('INVALID_PUBLIC_MENU');return value as Localized}
export async function readPublicMenu(db:Firestore,cafeId:string):Promise<PublicMenuData>{
 if(!/^[\w-]{1,80}$/.test(cafeId))throw Error('INVALID_CAFE_ID');
 const [info,items]=await Promise.all([getDocFromServer(doc(db,'publicMenu',cafeId)),getDocsFromServer(query(collection(db,'publicMenu',cafeId,'items'),orderBy('categoryOrder'),orderBy('order')))]);
 if(!info.exists())throw Error('PUBLIC_MENU_NOT_FOUND');
 const data=info.data();
 if(!Array.isArray(data.categories))throw Error('INVALID_PUBLIC_MENU');
 return {name:localized(data.name),address:localized(data.address),categories:data.categories.map(c=>({id:String(c.id),name:localized(c.name),order:Number(c.order)})),dishes:items.docs.map(snapshot=>{const item=snapshot.data();if(typeof item.price!=='number'||!Number.isFinite(item.price)||item.price<0||typeof item.categoryId!=='string')throw Error('INVALID_PUBLIC_MENU');return {id:snapshot.id,name:localized(item.name),description:localized(item.description),price:item.price,category:item.categoryId,visible:true,soldOut:false,...(typeof item.photo==='string'?{image:item.photo}:{})}})};
}
