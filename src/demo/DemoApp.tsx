import {useSyncExternalStore} from 'react';
import App from '../App';
import {getDemoStore} from './store';
import type {LiveWorkspace} from '../workspace';
export default function DemoApp(){const store=getDemoStore(),data=useSyncExternalStore(store.subscribe,store.getSnapshot);
 const workspace:LiveWorkspace={...store,dishes:data.dishes,tickets:data.tickets,tables:Array.from({length:12},(_,i)=>({id:String(i+1),number:i+1,status:data.tickets.some(t=>t.table===i+1&&!t.closedAt)?'open':'free',activeSessionId:null,mine:data.tickets.some(t=>t.table===i+1&&!t.closedAt&&t.waiterId==='demo')})),online:true,checking:false,loading:false,error:null,issue:null,retry:()=>{},selectTable:()=>{}};
 return <App workspace={workspace} demo={{store,data}}/>}
