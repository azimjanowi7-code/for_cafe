// Shared, SDK-free report math. Financial inputs are stored snapshots, never current menu data.
export type ReportPeriod='day'|'week'|'month';
export type Names={ky:string;ru:string};
export type SaleLine={itemId:string;nameKy:string;nameRu:string;price:number;qty:number};
export type ReportOrder={id:string;sessionId:string;tableId:string;waiterId:string;waiterName:string;createdAt:number;servedAt:number|null;status:string;accepted:boolean;items:SaleLine[]};
export type PaidSession={id:string;tableId:string;tableNumber?:string|number;closedAt:number;status:string;paymentType:string|null;total:number|null};
export type WaiterAggregate={waiterId:string;waiterName:string;dateKey:string;soldDishesTotal:number;dishesSold:number;tablesServed:number;tables:Record<string,{tableId:string;tableNumber:string;amount:number;closedAt:number}>;salesVersion?:string};
export type DayAggregate={dateKey:string;timeZone:'Asia/Bishkek';currency:'KGS';salesVersion?:string;waiterCount?:number;revenue:number;tablesServed:number;ordersPlaced:number;dishesOrdered:number;ordersServed:number;waitTotalMs:number;cashTotal:number;cardTotal:number;tableTotals:Record<string,number>;tableNames:Record<string,string>;dishTotals:Record<string,{name:Names;qty:number}>};
const DAY=86400000,OFFSET=6*3600000;
export function reportDate(at:number){return new Date(at+OFFSET).toISOString().slice(0,10)}
export function dayBounds(key:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(key))throw Error('invalid-day');const start=Date.parse(key+'T00:00:00+06:00');if(!Number.isFinite(start)||reportDate(start)!==key||key<'2000-01-01'||key>'2100-12-31')throw Error('invalid-day');return {start,end:start+DAY}}
export function reportBounds(now:number,period:ReportPeriod){const key=reportDate(now),{start:today}=dayBounds(key),local=new Date(today+OFFSET);let start=today,end=today+DAY;if(period==='week'){start-=((local.getUTCDay()+6)%7)*DAY;end=start+7*DAY}if(period==='month'){start=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),1)-OFFSET;end=Date.UTC(local.getUTCFullYear(),local.getUTCMonth()+1,1)-OFFSET}return {start,end,from:reportDate(start),to:reportDate(end-DAY),endKey:reportDate(end)}}
export function dayRange(from:string,to:string){const {start}=dayBounds(from),{start:last}=dayBounds(to);if(last<start||(last-start)/DAY>=31)throw Error('invalid-range');return Array.from({length:(last-start)/DAY+1},(_,index)=>reportDate(start+index*DAY))}
function pennies(value:number){if(!Number.isFinite(value)||value<0||!Number.isSafeInteger(Math.round(value*100))||Math.abs(value*100-Math.round(value*100))>0.00001)throw Error('invalid-money');return Math.round(value*100)}
const dictionary=<T>():Record<string,T>=>Object.create(null);
const amount=(value:number)=>value/100;
const addMoney=(a:number,b:number)=>amount(pennies(a)+pennies(b));
export function emptyDay(key:string):DayAggregate{return {dateKey:key,timeZone:'Asia/Bishkek',currency:'KGS',revenue:0,tablesServed:0,ordersPlaced:0,dishesOrdered:0,ordersServed:0,waitTotalMs:0,cashTotal:0,cardTotal:0,tableTotals:dictionary(),tableNames:dictionary(),dishTotals:dictionary()}}
export function computeDay(key:string,created:ReportOrder[],served:ReportOrder[],sessions:PaidSession[],paid:ReportOrder[]){
 const {start,end}=dayBounds(key),stats=emptyDay(key),waiters:Record<string,WaiterAggregate>=dictionary();
 for(const order of created)if(order.accepted&&order.createdAt>=start&&order.createdAt<end){stats.ordersPlaced++;stats.dishesOrdered+=order.items.reduce((n,line)=>n+line.qty,0)}
 for(const order of served)if(order.accepted&&order.status==='served'&&order.servedAt!==null&&order.servedAt>=start&&order.servedAt<end){if(!Number.isFinite(order.createdAt)||order.servedAt<order.createdAt)throw Error('invalid-serve-time');stats.ordersServed++;stats.waitTotalMs+=order.servedAt-order.createdAt}
 const sorted=[...paid].sort((a,b)=>a.createdAt-b.createdAt||a.id.localeCompare(b.id));
 for(const session of [...sessions].sort((a,b)=>a.closedAt-b.closedAt||a.id.localeCompare(b.id))){
  if(session.status!=='closed'||session.closedAt<start||session.closedAt>=end)continue;
  if(!['cash','card'].includes(session.paymentType||''))throw Error('invalid-payment');
  let total=0;const contributors=new Set<string>();
  for(const order of sorted.filter(order=>order.sessionId===session.id)){
   if(order.status==='cancelled'||!order.accepted)continue;
   if(order.tableId!==session.tableId||!order.items.length||order.items.length>100)throw Error('invalid-paid-order');
   let sold=0,qty=0;for(const line of order.items){if(!line.itemId||!Number.isInteger(line.qty)||line.qty<1||line.qty>99||!line.nameKy||!line.nameRu)throw Error('invalid-paid-line');sold+=pennies(line.price)*line.qty;qty+=line.qty;const dish=stats.dishTotals[line.itemId]||{name:{ky:line.nameKy,ru:line.nameRu},qty:0};dish.qty+=line.qty;stats.dishTotals[line.itemId]=dish}
   total+=sold;contributors.add(order.waiterId);const waiter=waiters[order.waiterId]||{waiterId:order.waiterId,waiterName:order.waiterName,dateKey:key,soldDishesTotal:0,dishesSold:0,tablesServed:0,tables:dictionary()};
   waiter.soldDishesTotal=addMoney(waiter.soldDishesTotal,amount(sold));waiter.dishesSold+=qty;
   const previous=waiter.tables[session.id];waiter.tables[session.id]={tableId:session.tableId,tableNumber:String(session.tableNumber??session.tableId),amount:addMoney(previous?.amount||0,amount(sold)),closedAt:session.closedAt};waiters[order.waiterId]=waiter;
  }
  if(session.total===null||pennies(session.total)!==total)throw Error('closed-total-mismatch');
  contributors.forEach(uid=>waiters[uid].tablesServed++);
  stats.tablesServed++;stats.revenue=addMoney(stats.revenue,amount(total));
  if(session.paymentType==='cash')stats.cashTotal=addMoney(stats.cashTotal,amount(total));else stats.cardTotal=addMoney(stats.cardTotal,amount(total));
  stats.tableTotals[session.tableId]=addMoney(stats.tableTotals[session.tableId]||0,amount(total));stats.tableNames[session.tableId]??=String(session.tableNumber??session.tableId);
 }
 return {stats:{...stats,tableTotals:{...stats.tableTotals},tableNames:{...stats.tableNames},dishTotals:{...stats.dishTotals}},waiters:Object.fromEntries(Object.entries(waiters).map(([id,value])=>[id,{...value,tables:{...value.tables}}]))};
}
export type ReportSummary={revenue:number;tables:number;byTable:Record<string,number>;tableNames:Record<string,string>;byWaiter:Record<string,number>;waiterNames:Record<string,string>;cash:number;card:number;top:{id:string;name:Names;quantity:number}[]};
export function combineDays(days:DayAggregate[],waiters:WaiterAggregate[]):ReportSummary{
 const result:ReportSummary={revenue:0,tables:0,byTable:dictionary(),tableNames:dictionary(),byWaiter:dictionary(),waiterNames:dictionary(),cash:0,card:0,top:[]},dishes:Record<string,{name:Names;quantity:number}>=dictionary();
 for(const day of [...days].sort((a,b)=>a.dateKey.localeCompare(b.dateKey))){result.revenue=addMoney(result.revenue,day.revenue);result.tables+=day.tablesServed;result.cash=addMoney(result.cash,day.cashTotal);result.card=addMoney(result.card,day.cardTotal);for(const [id,value]of Object.entries(day.tableTotals)){result.byTable[id]=addMoney(result.byTable[id]||0,value);result.tableNames[id]??=day.tableNames?.[id]||id}for(const [id,dish]of Object.entries(day.dishTotals)){const entry=dishes[id]||{name:dish.name,quantity:0};entry.quantity+=dish.qty;dishes[id]=entry}}
 for(const waiter of [...waiters].sort((a,b)=>a.dateKey.localeCompare(b.dateKey)||a.waiterId.localeCompare(b.waiterId))){result.byWaiter[waiter.waiterId]=addMoney(result.byWaiter[waiter.waiterId]||0,waiter.soldDishesTotal);result.waiterNames[waiter.waiterId]=waiter.waiterName}
 result.top=Object.entries(dishes).sort(([a,av],[b,bv])=>bv.quantity-av.quantity||a.localeCompare(b)).slice(0,3).map(([id,value])=>({id,...value}));return {...result,byTable:{...result.byTable},tableNames:{...result.tableNames},byWaiter:{...result.byWaiter},waiterNames:{...result.waiterNames}};
}
