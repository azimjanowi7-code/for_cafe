import type {Ticket} from './model';
export type OrderTransport=(ticket:Readonly<Ticket>,idempotencyKey:string)=>Promise<{id:string}>;
export type QueueScope={cafeId:string;uid:string};
export type OrderIntent={clientOrderId:string;tableId:string;sessionId:string;items:{itemId:string;qty:number}[];note:string};
export type QueueStore=Pick<Storage,'getItem'|'setItem'|'removeItem'|'key'|'length'>;
let transport:OrderTransport|null=null;
export function configureOrderTransport(value:OrderTransport|null){transport=value;if(typeof window!=='undefined')window.dispatchEvent(new Event('cafe-transport-ready'))}
export const configuredOrderTransport=()=>transport;
export class OrderOutbox{
 private running:Promise<string[]>|null=null;
 private prefix:string;private ackPrefix:string;
 constructor(private storage:QueueStore,private scope?:QueueScope){const suffix=scope?`v2:${encodeURIComponent(scope.cafeId)}:${encodeURIComponent(scope.uid)}:`:'';this.prefix=`cafe-outbox:${suffix}`;this.ackPrefix=`cafe-order-ack:${suffix}`}
 pending():Ticket[]{const tickets:Ticket[]=[];for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(!key?.startsWith(this.prefix)||(!this.scope&&key.startsWith('cafe-outbox:v2:')))continue;try{const ticket=JSON.parse(this.storage.getItem(key)!);if(!this.scope||(ticket.cafeId===this.scope.cafeId&&ticket.waiterId===this.scope.uid&&ticket.tableId&&ticket.sessionId))tickets.push(ticket)}catch{}}return tickets.sort((a,b)=>a.receivedAt-b.receivedAt||a.id.localeCompare(b.id))}
 enqueue(ticket:Ticket){if(this.scope)orderIntent(ticket,ticket.id,this.scope);if(this.storage.getItem(this.ackPrefix+ticket.id)||this.storage.getItem(this.prefix+ticket.id))return;this.storage.setItem(this.prefix+ticket.id,JSON.stringify(ticket))}
 flush(send:OrderTransport,onStatus?:(id:string,status:Ticket['sync'])=>void,canSend:()=>boolean=()=>true,onError?:(id:string,error:unknown)=>void,shouldSend:(ticket:Ticket)=>boolean=()=>true):Promise<string[]>{
  if(this.running)return this.running;
  this.running=(async()=>{const sent:string[]=[];for(const ticket of this.pending()){
   if(!canSend())break;if(!shouldSend(ticket))continue;
   if(this.storage.getItem(this.ackPrefix+ticket.id)){this.storage.removeItem(this.prefix+ticket.id);onStatus?.(ticket.id,'sent');continue}
   onStatus?.(ticket.id,'sending');try{const result=await send(structuredClone(ticket),ticket.id);if(result.id!==ticket.id)throw Error('invalid-ack');if(!canSend()){onStatus?.(ticket.id,'queued');break}this.storage.setItem(this.ackPrefix+ticket.id,'1');this.storage.removeItem(this.prefix+ticket.id);sent.push(ticket.id);onStatus?.(ticket.id,'sent')}catch(error){onStatus?.(ticket.id,'queued');onError?.(ticket.id,error);break}
  }return sent})().finally(()=>{this.running=null});return this.running;
 }
}
export function orderIntent(ticket:Readonly<Ticket>,key:string,scope:QueueScope):OrderIntent{
 if(ticket.id!==key||ticket.cafeId!==scope.cafeId||ticket.waiterId!==scope.uid||!ticket.tableId||!ticket.sessionId)throw Error('wrong-order-owner-or-session');
 if(!/^[A-Za-z0-9_-]{8,128}$/.test(key)||![ticket.tableId,ticket.sessionId].every(value=>/^[A-Za-z0-9_-]{1,128}$/.test(value))||!ticket.lines.length||ticket.lines.length>100||ticket.lines.some(line=>!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>99)||typeof ticket.note!=='string'||ticket.note.length>500)throw Error('invalid-order-draft');
 return {clientOrderId:key,tableId:ticket.tableId,sessionId:ticket.sessionId,items:ticket.lines.map(line=>({itemId:line.dishId,qty:line.quantity})),note:ticket.note};
}
export function createOrderTransport(scope:QueueScope,submit:(intent:OrderIntent)=>Promise<{clientOrderId:string}>,isCurrent:()=>boolean=()=>true):OrderTransport{return async(ticket,key)=>{if(!isCurrent())throw Error('signed-out');const result=await submit(orderIntent(ticket,key,scope));if(!isCurrent())throw Error('signed-out');if(result.clientOrderId!==key)throw Error('invalid-ack');return {id:result.clientOrderId}}}
// Kept for callers that use the callable HTTP envelope rather than the Firebase SDK.
export function callableOrderTransport(endpoint:string,cafeId:string,getIdToken:()=>Promise<string>,authenticatedWaiterId:string):OrderTransport{return createOrderTransport({cafeId,uid:authenticatedWaiterId},async data=>{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await getIdToken()}`},body:JSON.stringify({data})});const result=await response.json();if(!response.ok||result.error)throw Error(result.error?.status||'delivery-failed');return result.result})}
