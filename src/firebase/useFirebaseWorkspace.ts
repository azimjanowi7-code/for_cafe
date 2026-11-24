import {useEffect,useMemo,useRef,useState} from 'react';
import {collection,doc,onSnapshot,query,where,orderBy,type DocumentData} from 'firebase/firestore';
import {httpsCallable} from 'firebase/functions';
import {firebaseClients} from './client';
import {watchCookOrders,toDish,toTicket,openTable,persistServing,saveDish,type SessionData} from './workspaceApi';
import {OrderOutbox,createOrderTransport,type OrderIntent} from '../outbox';
import {startConnectivity} from '../connectivity';
import type {StaffSession} from './staffAuth';
import type {LiveWorkspace,LiveTable} from '../workspace';
import type {Dish,Ticket} from '../model';
import type {Completion} from '../serving';
type Raw={id:string;data:DocumentData};
function issueFor(error:unknown):LiveWorkspace['issue']{const code=(error as {code?:string})?.code;if(['functions/failed-precondition','functions/invalid-argument','functions/not-found'].includes(code||''))return 'unavailable';if(['functions/permission-denied','functions/unauthenticated','permission-denied','unauthenticated'].includes(code||''))return 'permission';if((error as Error)?.message==='table-not-owned')return 'session';return 'connection'}
export function useFirebaseWorkspace(identity:StaffSession):LiveWorkspace{
 const {db,auth,functions}=firebaseClients(),scope=useMemo(()=>({cafeId:identity.cafeId,uid:identity.uid}),[identity.cafeId,identity.uid]),outbox=useMemo(()=>new OrderOutbox(localStorage,scope),[scope]);
 const raw=useRef({menu:[] as Raw[],tables:[] as Raw[],sessions:new Map<string,SessionData>(),own:[] as Raw[],view:[] as Raw[],open:[] as Raw[],served:[] as Raw[]});
 const [,render]=useState(0),[online,setOnline]=useState(false),[checking,setChecking]=useState(navigator.onLine),[loading,setLoading]=useState(true),[issue,setIssue]=useState<LiveWorkspace['issue']>(null),[selected,setSelected]=useState(1);
 const connected=useRef(false),closed=useRef(false),statuses=useRef(new Map<string,Ticket['sync']>()),bindings=useRef(new Map<string,string>()),blocked=useRef(new Set<string>()),pulse=useRef<()=>void>(()=>{}),errors=useRef<unknown>(null);
 const refresh=()=>render(value=>value+1);
 useEffect(()=>{
  let stopped=false;closed.current=false;connected.current=false;setOnline(false);setChecking(navigator.onLine);setLoading(true);setIssue(null);raw.current={menu:[],tables:[],sessions:new Map(),own:[],view:[],open:[],served:[]};
  const stops:(()=>void)[]=[],ready=new Set<string>();const first=identity.role==='cook'?['menu','tables','open','served']:identity.role==='waiter'?['menu','tables','sessions','own']:['menu','tables'];
  const fail=(error:unknown)=>{if(stopped||closed.current)return;errors.current=error;setIssue(issueFor(error));setLoading(false)};
  const changed=(name:string)=>{if(stopped||closed.current)return;ready.add(name);if(first.every(key=>ready.has(key)))setLoading(false);refresh()};
  const current=()=>!stopped&&!closed.current&&auth.currentUser?.uid===identity.uid;
  const send=createOrderTransport(scope,async data=>(await httpsCallable<OrderIntent,{clientOrderId:string}>(functions,'submitOrder')(data)).data,current);
  const flush=async()=>{
   if(!connected.current||!current()||identity.role!=='waiter')return;
   const run=async()=>{if(!connected.current||!current())return;await outbox.flush(send,(id,status)=>{if(!current())return;statuses.current.set(id,status);if(status==='sent'){blocked.current.delete(id);if(!blocked.current.size)setIssue(null)}refresh()},()=>connected.current&&current(),(id,error)=>{fail(error);const kind=issueFor(error);if(kind==='connection'){connected.current=false;setOnline(false)}else blocked.current.add(id)},ticket=>!blocked.current.has(ticket.id));};
   try{if(navigator.locks)await navigator.locks.request(`cafe-orders:${identity.cafeId}:${identity.uid}`,{ifAvailable:true},async lock=>{if(lock)await run()});else await run()}catch(error){fail(error)}
  };
  pulse.current=()=>{void flush()};
  const monitor=startConnectivity({url:`http://127.0.0.1:5001/demo-for-cafe/asia-south2/health`,isOnline:()=>navigator.onLine,target:window,onChange:value=>{if(stopped||closed.current)return;connected.current=value;setChecking(false);setOnline(value);if(value)void flush()}});
  stops.push(()=>monitor.stop());
  const listen=(name:'menu'|'tables'|'own'|'sessions',source:ReturnType<typeof collection>|ReturnType<typeof query>)=>{stops.push(onSnapshot(source,{includeMetadataChanges:true},snapshot=>{
   if(stopped||closed.current)return;if(name==='sessions'){raw.current.sessions=new Map(snapshot.docs.map(doc=>[doc.id,doc.data() as SessionData]));blocked.current.clear();pulse.current()}else{const value=snapshot.docs.map(doc=>({id:doc.id,data:doc.data() as DocumentData}));if(name==='menu')raw.current.menu=value;else if(name==='tables'){raw.current.tables=value;blocked.current.clear();pulse.current()}else raw.current.own=value;}
   if(!snapshot.metadata.fromCache||snapshot.docs.length||!navigator.onLine)changed(name);
  },fail))};
  listen('menu',collection(db,'cafes',identity.cafeId,'menuItems'));listen('tables',collection(db,'cafes',identity.cafeId,'tables'));
  if(identity.role==='waiter'){listen('sessions',query(collection(db,'cafes',identity.cafeId,'tableSessions'),where('openedBy','==',identity.uid)));listen('own',query(collection(db,'cafes',identity.cafeId,'orders'),where('waiterId','==',identity.uid),orderBy('createdAt','asc')))}
  if(identity.role==='cook'){stops.push(watchCookOrders(db,identity.cafeId,false,value=>{if(stopped||closed.current)return;raw.current.open=value;changed('open')},fail),watchCookOrders(db,identity.cafeId,true,value=>{if(stopped||closed.current)return;raw.current.served=value;changed('served')},fail))}
  const update=()=>{if(!current())return;refresh();void flush()},retry=()=>void flush();window.addEventListener('storage',update);window.addEventListener('cafe-outbox-updated',update);const timer=setInterval(retry,5000),timeout=setTimeout(()=>{if(!closed.current&&!first.every(key=>ready.has(key))){setLoading(false);setIssue('connection')}},10000);
  return()=>{stopped=true;closed.current=true;connected.current=false;clearInterval(timer);clearTimeout(timeout);stops.forEach(stop=>stop());window.removeEventListener('storage',update);window.removeEventListener('cafe-outbox-updated',update);pulse.current=()=>{}};
 },[identity.cafeId,identity.uid,identity.role,outbox,scope,db,auth,functions]);
 const selectedTable=raw.current.tables.find(table=>table.data.number===selected),selectedSession=selectedTable?.data.activeSessionId as string|undefined,viewSession=selectedSession&&raw.current.sessions.get(selectedSession)?.openedBy===identity.uid?selectedSession:undefined;
 useEffect(()=>{raw.current.view=[];if(identity.role!=='waiter'||!viewSession)return;let stopped=false;const stop=onSnapshot(query(collection(db,'cafes',identity.cafeId,'orders'),where('sessionId','==',viewSession),orderBy('createdAt','asc')),snapshot=>{if(!stopped&&!closed.current){raw.current.view=snapshot.docs.map(doc=>({id:doc.id,data:doc.data() as DocumentData}));refresh()}},()=>{if(!stopped&&!closed.current)setIssue('permission')});return()=>{stopped=true;stop()}},[db,identity.cafeId,identity.uid,identity.role,viewSession]);
 const numbers=new Map(raw.current.tables.map(table=>[table.id,Number(table.data.number)]));
 const tickets=new Map<string,Ticket>();for(const order of [...raw.current.own,...raw.current.view,...raw.current.open,...raw.current.served])tickets.set(order.id,toTicket(order.id,order.data,identity.cafeId,numbers,raw.current.sessions));
 for(const draft of outbox.pending()){const server=tickets.get(draft.id);tickets.set(draft.id,{...(server||draft),sync:statuses.current.get(draft.id)||'queued'})}
 const tables:LiveTable[]=raw.current.tables.map(table=>({id:table.id,number:Number(table.data.number),status:table.data.status,activeSessionId:table.data.activeSessionId,mine:raw.current.sessions.get(table.data.activeSessionId)?.openedBy===identity.uid})).sort((a,b)=>a.number-b.number);
 const begin=(number:number)=>{
  setSelected(number);const table=raw.current.tables.find(table=>table.data.number===number);if(!table){setIssue('session');return}
  if(table.data.status==='open'){if(raw.current.sessions.get(table.data.activeSessionId)?.openedBy===identity.uid)bindings.current.set(table.id,table.data.activeSessionId);return}
  const existing=bindings.current.get(table.id);if(existing&&raw.current.sessions.get(existing)?.status!=='closed')return;if(existing)bindings.current.delete(table.id);const sessionId=crypto.randomUUID();bindings.current.set(table.id,sessionId);try{localStorage.setItem(`cafe-session:${identity.cafeId}:${identity.uid}:${table.id}`,sessionId)}catch{setIssue('storage');bindings.current.delete(table.id);return}
  void openTable(db,identity,table.id,sessionId).then(()=>{blocked.current.clear();pulse.current()}).catch(error=>{bindings.current.delete(table.id);errors.current=error;setIssue('session')});
 };
 const enqueue=(ticket:Ticket)=>{const table=raw.current.tables.find(table=>table.data.number===ticket.table);if(!table)throw Error('table-not-owned');let sessionId=table.data.activeSessionId as string|null;if(table.data.status==='free'){sessionId=bindings.current.get(table.id)||null;if(!sessionId){begin(ticket.table);sessionId=bindings.current.get(table.id)||null}}if(!sessionId)throw Error('table-not-owned');if(table.data.status==='open'&&raw.current.sessions.get(sessionId)?.openedBy!==identity.uid&&bindings.current.get(table.id)!==sessionId)throw Error('table-not-owned');const queued={...ticket,cafeId:identity.cafeId,tableId:table.id,sessionId,waiterId:identity.uid};try{outbox.enqueue(queued)}catch(error){errors.current=error;setIssue('storage');throw error}statuses.current.set(queued.id,'queued');refresh();window.dispatchEvent(new Event('cafe-outbox-updated'));return queued};
 return {dishes:raw.current.menu.map(item=>toDish(item.id,item.data)),tickets:[...tickets.values()].sort((a,b)=>a.receivedAt-b.receivedAt||a.id.localeCompare(b.id)),tables,online,checking,loading,issue,error:issue?String((errors.current as {code?:string})?.code||issue):null,
  retry:()=>{blocked.current.clear();setIssue(null);pulse.current();window.dispatchEvent(new Event(navigator.onLine?'online':'offline'))},selectTable:begin,enqueue,
  updateDish:(id,update)=>{void saveDish(db,identity,id,update).catch(error=>{errors.current=error;setIssue(issueFor(error))})},addDish:dish=>{void saveDish(db,identity,dish.id,dish,true).catch(error=>{errors.current=error;setIssue(issueFor(error))})},
  closeTable:async(number,payment)=>{if(!connected.current)throw Error('offline');if(outbox.pending().some(ticket=>ticket.table===number))throw Error('queued-orders');const table=raw.current.tables.find(table=>table.data.number===number);if(!table?.data.activeSessionId)throw Error('table-not-owned');await httpsCallable(functions,'closeTable')({sessionId:table.data.activeSessionId,paymentType:payment});bindings.current.delete(table.id);localStorage.removeItem(`cafe-session:${identity.cafeId}:${identity.uid}:${table.id}`)},
  persistServing:async(action,completion,index)=>{if(!connected.current)throw Error('offline');return persistServing(db,identity,action,completion,numbers,index)}
 };
}
