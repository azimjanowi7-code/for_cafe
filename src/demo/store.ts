import {dishes,sampleTickets,ticketTotal,periodBounds,type Dish,type Ticket,type Payment,type Role} from '../model';
import {completeTicket,undoCompletion,type Completion} from '../serving';
export type DemoAccount={uid:string;name:string;role:Role;password:string;active:boolean};
export type DemoSnapshot={cafe:{id:string;name:{ky:string;ru:string}};dishes:Dish[];tickets:Ticket[];payments:Payment[];accounts:DemoAccount[]};
export interface DemoDataLayer{refresh:()=>void;getSnapshot:()=>DemoSnapshot;subscribe:(listener:()=>void)=>()=>void;enqueue:(ticket:Ticket)=>Ticket;updateDish:(id:string,patch:Partial<Dish>)=>void;addDish:(dish:Dish)=>void;closeTable:(table:number,payment:string)=>Promise<void>;persistServing:(action:'serve'|'undo',completion:Completion,index?:number)=>Promise<Completion|null>;authenticate:(name:string,password:string)=>DemoAccount|null;reset:()=>void}
export const DEMO_PREFIX='cafe-presentation-v1:';
const accounts:DemoAccount[]=[{uid:'admin',name:'Админ',role:'Admin/Chef',password:'admin123',active:true},{uid:'demo',name:'Айжан',role:'Waiter',password:'waiter123',active:true},{uid:'cook',name:'Бакыт',role:'Cook',password:'cook123',active:true}];
// One record per entity avoids replacing another window's unrelated new order.
// Writes are synchronous; broadcasts only invalidate snapshots, never echo writes.
export function createDemoStore(storage:Storage,notifyPeers:()=>void=()=>{},now:()=>number=Date.now):DemoDataLayer{
 const listeners=new Set<()=>void>();let snapshot:DemoSnapshot;
 const put=(kind:string,id:string,value:unknown)=>storage.setItem(`${DEMO_PREFIX}${kind}:${id}`,JSON.stringify(value));
 const rows=<T,>(kind:string):T[]=>{const result:T[]=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(`${DEMO_PREFIX}${kind}:`))result.push(JSON.parse(storage.getItem(key)!))}return result};
 const cafe={id:'demo-cafe',name:{ru:'Кафе «Дасторкон»',ky:'«Дасторкон» кафеси'}};
 const read=():DemoSnapshot=>({cafe:rows<DemoSnapshot['cafe']>('cafe')[0]||cafe,dishes:rows<Dish>('dish'),tickets:rows<Ticket>('ticket').sort((a,b)=>a.receivedAt-b.receivedAt),payments:rows<Payment>('payment'),accounts:rows<DemoAccount>('account')});
 const refresh=()=>{snapshot=read();listeners.forEach(fn=>fn())};
 const publish=()=>{refresh();notifyPeers()};
 function seed(){const at=now();put('cafe',cafe.id,cafe);for(const dish of dishes)put('dish',dish.id,dish);for(const account of accounts)put('account',account.uid,account);for(const ticket of sampleTickets()){const age=Date.now()-ticket.receivedAt;put('ticket',ticket.id,{...ticket,receivedAt:at-age})}
 const today=periodBounds(at,'day').start;for(let day=0;day<7;day++)for(let visit=0;visit<4;visit++){const closedAt=day===0?Math.min(at,today+(11+visit)*3600000):today-day*86400000+(11+visit)*3600000;const dish=dishes[(day+visit)%dishes.length],second=dish.id==='d6'?dishes[6]:dishes[5];const ticket:Ticket={id:`sample-${day}-${visit}`,table:visit+1,receivedAt:closedAt-25*60000,servedAt:closedAt-10*60000,closedAt,lines:[{dishId:dish.id,name:{...dish.name},quantity:2,priceSnapshot:dish.price,served:true},{dishId:second.id,name:{...second.name},quantity:1,priceSnapshot:second.price,served:true}],note:'',status:'served',sync:'sent',waiterId:'demo'};put('ticket',ticket.id,ticket);put('payment',ticket.id,{table:ticket.table,amount:ticketTotal(ticket),at:closedAt,waiterId:'demo',payment:visit%2?'card':'cash',ticketIds:[ticket.id]})}storage.setItem(`${DEMO_PREFIX}seed`,'1')}
 if(!storage.getItem(`${DEMO_PREFIX}seed`))seed();snapshot=read();
 return {refresh,getSnapshot:()=>snapshot,subscribe:listener=>{listeners.add(listener);return()=>{listeners.delete(listener)}},
 enqueue(ticket){const current=read();const existing=current.tickets.find(t=>t.id===ticket.id);if(existing)return existing;const lines=ticket.lines.map(line=>{const dish=current.dishes.find(d=>d.id===line.dishId);if(!dish||dish.soldOut||dish.visible===false||!Number.isInteger(line.quantity)||line.quantity<1)throw Error('Dish unavailable');return {...line,name:{...dish.name},priceSnapshot:dish.price,served:false}});if(!lines.length)throw Error('Empty ticket');const saved={...ticket,lines,status:'open' as const,sync:'sent' as const,waiterId:'demo'};put('ticket',ticket.id,saved);publish();return saved},
 updateDish(id,patch){const dish=read().dishes.find(d=>d.id===id);if(!dish)return;put('dish',id,{...dish,...patch,id,priceLog:patch.price!==undefined&&patch.price!==dish.price?[...(dish.priceLog||[]),{at:now(),from:dish.price,to:patch.price}]:dish.priceLog});publish()},
 addDish(dish){put('dish',dish.id,dish);publish()},
 async closeTable(table,payment){const active=read().tickets.filter(t=>t.table===table&&!t.closedAt&&!t.cancelled);if(!active.length)return;const at=now(),ids=active.map(t=>t.id).sort();put('payment',ids.join('_'),{table,amount:active.reduce((n,t)=>n+ticketTotal(t),0),at,waiterId:'demo',payment,ticketIds:ids});for(const ticket of active)put('ticket',ticket.id,{...ticket,closedAt:at});publish()},
 async persistServing(action,completion,index){const current=read().tickets.find(t=>t.id===completion.before.id);if(!current||current.closedAt)return null;const result=action==='serve'?completeTicket(current,now(),index):{before:current,after:undoCompletion(current,completion),changed:completion.changed};put('ticket',current.id,result.after);publish();return result},
 authenticate(name,password){return read().accounts.find(a=>a.active&&a.name.toLocaleLowerCase()===name.trim().toLocaleLowerCase()&&a.password===password)||null},
 reset(){for(const key of Array.from({length:storage.length},(_,i)=>storage.key(i)))if(key?.startsWith(DEMO_PREFIX))storage.removeItem(key);seed();publish()}};
}
let browserStore:DemoDataLayer|null=null;
export function getDemoStore(){if(browserStore)return browserStore;const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('cafe-presentation-v1');const store=createDemoStore(localStorage,()=>channel?.postMessage({type:'changed'}));
 const invalidate=()=>store.refresh();
 channel?.addEventListener('message',invalidate);window.addEventListener('storage',event=>{if(event.key===null||event.key.startsWith(DEMO_PREFIX))invalidate()});browserStore=store;return store}
