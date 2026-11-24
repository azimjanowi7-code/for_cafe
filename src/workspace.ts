import type {Dish,Ticket} from './model';
import type {Completion} from './serving';
export type LiveTable={id:string;number:number;status:'free'|'open';activeSessionId:string|null;mine:boolean};
export type LiveWorkspace={dishes:Dish[];tickets:Ticket[];tables:LiveTable[];online:boolean;checking:boolean;loading:boolean;error:string|null;issue:'connection'|'unavailable'|'session'|'permission'|'storage'|null;retry:()=>void;selectTable:(number:number)=>void;enqueue:(ticket:Ticket)=>Ticket;updateDish:(id:string,update:Partial<Dish>)=>void;addDish:(dish:Dish)=>void;closeTable:(number:number,payment:string)=>Promise<void>;persistServing:(action:'serve'|'undo',completion:Completion,index?:number)=>Promise<Completion|null>};
