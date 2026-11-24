import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import type {Ticket} from './model';
import {applyCompletion,completeTicket,undoCompletion,type Completion} from './serving';
import {MOTION,useReducedMotion} from './motion';
type Operation=Completion&{key:string;at:number;committed:boolean;dismissed:boolean;delay:number;working?:boolean;undoRequested?:boolean;expired?:boolean;index?:number};
export function useServing(tickets:Ticket[],setTickets:Dispatch<SetStateAction<Ticket[]>>,persist?:(action:'serve'|'undo',completion:Completion,index?:number)=>Promise<Completion|null>,onError?:(error:unknown)=>void){
 const reduced=useReducedMotion(),live=useRef(new Map<string,Operation>()),[operations,setOperations]=useState<Operation[]>([]),writer=useRef(persist),errorHandler=useRef(onError),mounted=useRef(true);writer.current=persist;errorHandler.current=onError;
 const refresh=()=>{if(mounted.current)setOperations([...live.current.values()])};
 function serve(id:string,index?:number){if([...live.current.values()].some(op=>op.before.id===id&&!op.committed))return;const ticket=tickets.find(t=>t.id===id);if(!ticket)return;const at=Date.now(),completion=completeTicket(ticket,at,index);if(!completion.changed.length)return;const op:Operation={...completion,key:crypto.randomUUID(),at,index,committed:false,dismissed:false,delay:reduced||completion.after.status!=='served'?0:MOTION.sheet};live.current.set(op.key,op);refresh()}
 async function remoteUndo(op:Operation){op.working=true;refresh();try{await writer.current!('undo',op,op.index)}catch(error){if(mounted.current)errorHandler.current?.(error)}finally{op.working=false;live.current.delete(op.key);refresh()}}
 function undo(key:string){const op=live.current.get(key);if(!op||Date.now()>=op.at+MOTION.undo)return;if(op.working){op.undoRequested=true;refresh();return}if(op.committed&&writer.current){void remoteUndo(op);return}live.current.delete(key);if(op.committed)setTickets(ts=>ts.map(t=>t.id===op.before.id?undoCompletion(t,op):t));refresh()}
 function dismiss(key:string){const op=live.current.get(key);if(op){op.dismissed=true;refresh()}}
 useEffect(()=>{const timers:ReturnType<typeof setTimeout>[]=[];for(const op of operations){
  if(!op.committed&&!op.working)timers.push(setTimeout(()=>{if(!live.current.has(op.key)||op.working)return;
   if(!writer.current){op.committed=true;setTickets(ts=>ts.map(t=>t.id===op.before.id?applyCompletion(t,op,op.at):t));refresh();return}
   op.working=true;refresh();void writer.current('serve',op,op.index).then(result=>{op.working=false;if(!result){live.current.delete(op.key);refresh();return}op.before=result.before;op.after=result.after;op.changed=result.changed;op.committed=true;if(op.undoRequested){void remoteUndo(op);return}if(Date.now()>=op.at+MOTION.undo)live.current.delete(op.key);refresh()}).catch(error=>{op.working=false;live.current.delete(op.key);if(mounted.current)errorHandler.current?.(error);refresh()});
  },Math.max(0,op.at+op.delay-Date.now())));
  if(!op.expired)timers.push(setTimeout(()=>{if(!live.current.has(op.key))return;op.expired=true;if(op.working)op.dismissed=true;else live.current.delete(op.key);refresh()},Math.max(0,op.at+MOTION.undo-Date.now())));
 }return()=>timers.forEach(clearTimeout)},[operations,setTickets]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 useEffect(()=>{if(!reduced)return;let changed=false;for(const op of live.current.values())if(!op.committed){op.delay=0;changed=true}if(changed)refresh()},[reduced]);
 return {serve,undo,dismiss,operations,exiting:operations.filter(op=>!op.committed&&op.after.status==='served').map(op=>op.before.id),pending:operations.filter(op=>!op.committed||op.working).map(op=>op.before.id)};
}
