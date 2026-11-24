import type {Ticket} from './model';
export type Completion={before:Ticket;after:Ticket;changed:number[]};
export function completeTicket(ticket:Ticket,at:number,index?:number):Completion{
 const changed=ticket.lines.flatMap((line,i)=>!line.served&&(index===undefined||index===i)?[i]:[]);
 const lines=ticket.lines.map((line,i)=>changed.includes(i)?{...line,served:true}:line);
 const served=lines.every(line=>line.served);
 return {before:ticket,changed,after:{...ticket,lines,status:served?'served':'open',servedAt:served?(ticket.servedAt??at):undefined}};
}
export function undoCompletion(current:Ticket,completion:Completion):Ticket{
 const lines=current.lines.map((line,i)=>completion.changed.includes(i)?{...line,served:completion.before.lines[i].served}:line);
 const served=lines.every(line=>line.served);
 return {...current,lines,status:served?'served':'open',servedAt:served?current.servedAt:undefined};
}
// Merge only this action's changed lines: an earlier Undo may run during the exit.
export function applyCompletion(current:Ticket,completion:Completion,at:number):Ticket{
 const lines=current.lines.map((line,i)=>completion.changed.includes(i)?{...line,served:true}:line);
 const served=lines.every(line=>line.served);
 return {...current,lines,status:served?'served':'open',servedAt:served?(current.servedAt??at):undefined};
}
