import {collection,doc,documentId,onSnapshot,query,where,type Firestore} from 'firebase/firestore';
import {combineDays,emptyDay,reportBounds,type ReportPeriod,type DayAggregate,type WaiterAggregate,type ReportSummary} from '../../functions/src/reportMath';
export {combineDays,reportBounds};
export type {ReportPeriod,DayAggregate,WaiterAggregate,ReportSummary};
export function watchAdminReport(db:Firestore,cafeId:string,period:ReportPeriod,now:number,next:(value:ReportSummary)=>void,error:(reason:unknown)=>void){
 const bounds=reportBounds(now,period),waiters=new Map<string,WaiterAggregate[]>(),stops=new Map<string,()=>void>();let days:DayAggregate[]=[],closed=false,failed=false;
 const fail=(reason:unknown)=>{if(!closed){failed=true;error(reason)}};
 const emit=()=>{if(!closed&&!failed&&days.every(day=>{const rows=waiters.get(day.dateKey);return rows!==undefined&&(!day.salesVersion||(rows.length===day.waiterCount&&rows.every(row=>row.salesVersion===day.salesVersion)))}))try{next(combineDays(days,days.flatMap(day=>waiters.get(day.dateKey)||[])))}catch(reason){fail(reason)}};
 const stop=onSnapshot(query(collection(db,'cafes',cafeId,'dailyStats'),where(documentId(),'>=',bounds.from),where(documentId(),'<',bounds.endKey)),{includeMetadataChanges:true},snapshot=>{
  if(closed||failed||snapshot.metadata.fromCache)return;days=snapshot.docs.map(doc=>({...doc.data(),dateKey:doc.id}) as DayAggregate);const keys=new Set(days.map(day=>day.dateKey));
  for(const [key,unsubscribe]of stops)if(!keys.has(key)){unsubscribe();stops.delete(key);waiters.delete(key)}
  for(const day of days)if(!stops.has(day.dateKey)){const key=day.dateKey;stops.set(key,onSnapshot(collection(db,'cafes',cafeId,'dailyStats',key,'waiters'),{includeMetadataChanges:true},value=>{if(closed||failed||value.metadata.fromCache)return;waiters.set(key,value.docs.map(doc=>doc.data() as WaiterAggregate));emit()},fail))}emit();
 },fail);
 return()=>{closed=true;stop();stops.forEach(unsubscribe=>unsubscribe())};
}
export function watchOwnWaiterStats(db:Firestore,cafeId:string,uid:string,day:string,next:(value:WaiterAggregate|null)=>void,error:(reason:unknown)=>void){return onSnapshot(doc(db,'cafes',cafeId,'dailyStats',day,'waiters',uid),{includeMetadataChanges:true},snapshot=>{if(!snapshot.metadata.fromCache)next(snapshot.exists()?snapshot.data() as WaiterAggregate:null)},error)}
export function watchKitchenToday(db:Firestore,cafeId:string,day:string,next:(value:DayAggregate)=>void,error:(reason:unknown)=>void){return onSnapshot(doc(db,'cafes',cafeId,'dailyStats',day),{includeMetadataChanges:true},snapshot=>{if(!snapshot.metadata.fromCache)next(snapshot.exists()?snapshot.data() as DayAggregate:emptyDay(day))},error)}
