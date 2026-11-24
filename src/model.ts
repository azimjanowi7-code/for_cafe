export type Language='ru'|'ky';
export type Role='Admin/Chef'|'Waiter'|'Cook';
export type Dish={visible?:boolean;priceLog?:{at:number;from:number;to:number}[];image?:string;id:string;name:{ru:string;ky:string};description:{ru:string;ky:string};price:number;category:string;soldOut:boolean};
export type OrderLine={dishId:string;name:{ru:string;ky:string};quantity:number;priceSnapshot:number;served:boolean};
export type Ticket={cafeId?:string;tableId?:string;sessionId?:string;cancelled?:boolean;servedAt?:number;closedAt?:number;id:string;table:number;receivedAt:number;lines:OrderLine[];note:string;status:'open'|'served';sync:'queued'|'sending'|'sent';waiterId:string};
export const formatPrice=(amount:number)=>`${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(amount).replace(/[\u00a0\u202f]/g,' ')} сом`;
export function timerState(minutes:number,warn=10,late=20){return minutes<warn?'ok':minutes<=late?'warn':'late'}
export const dishes: Dish[]=[
{id:'d1',name:{ru:'Бешбармак',ky:'Бешбармак'},description:{ru:'Домашняя лапша, говядина, лук',ky:'Үй кесмеси, уй эти, пияз'},price:450,category:'main',soldOut:false},
{id:'d2',name:{ru:'Лагман',ky:'Лагман'},description:{ru:'Тянутая лапша с мясом и овощами',ky:'Эт жана жашылча кошулган кесме'},price:320,category:'main',soldOut:false},
{id:'d3',name:{ru:'Манты',ky:'Манты'},description:{ru:'С говядиной, 5 штук',ky:'Уй эти менен, 5 даана'},price:300,category:'main',soldOut:false},
{id:'d4',name:{ru:'Шорпо',ky:'Шорпо'},description:{ru:'Наваристый бульон с говядиной',ky:'Уй этинен жасалган шорпо'},price:280,category:'soups',soldOut:false},
{id:'d5',name:{ru:'Салат из свежих овощей',ky:'Жаңы жашылча салаты'},description:{ru:'Помидоры, огурцы, зелень',ky:'Помидор, бадыраң, көк чөп'},price:180,category:'salads',soldOut:false},
{id:'d6',name:{ru:'Чай с чабрецом',ky:'Көкөмерен чайы'},description:{ru:'Чайник, 800 мл',ky:'Чайнек, 800 мл'},price:150,category:'drinks',soldOut:false},
{id:'d7',name:{ru:'Боорсок',ky:'Боорсок'},description:{ru:'Свежий, к чаю',ky:'Жаңы бышкан, чайга'},price:100,category:'main',soldOut:false}];
export function sampleTickets():Ticket[]{const now=Date.now();return [
{id:'1042',table:4,receivedAt:now-24*60000,lines:[{dishId:'d1',name:dishes[0].name,quantity:2,priceSnapshot:450,served:false},{dishId:'d4',name:dishes[3].name,quantity:1,priceSnapshot:280,served:false},{dishId:'d7',name:dishes[6].name,quantity:1,priceSnapshot:100,served:false}],note:'Без лука / Пиязсыз',status:'open',sync:'sent',waiterId:'demo'},
{id:'1043',table:7,receivedAt:now-14*60000,lines:[{dishId:'d2',name:dishes[1].name,quantity:2,priceSnapshot:320,served:false},{dishId:'d5',name:dishes[4].name,quantity:1,priceSnapshot:180,served:false}],note:'',status:'open',sync:'sent',waiterId:'demo'},
{id:'1044',table:2,receivedAt:now-7*60000,lines:[{dishId:'d3',name:dishes[2].name,quantity:3,priceSnapshot:300,served:false},{dishId:'d6',name:dishes[5].name,quantity:1,priceSnapshot:150,served:false}],note:'Подать вместе / Чогуу бериңиз',status:'open',sync:'sent',waiterId:'demo'},
{id:'1045',table:11,receivedAt:now-3*60000,lines:[{dishId:'d4',name:dishes[3].name,quantity:2,priceSnapshot:280,served:false},{dishId:'d7',name:dishes[6].name,quantity:2,priceSnapshot:100,served:false}],note:'',status:'open',sync:'sent',waiterId:'demo'}]}

export type Payment={table:number;amount:number;at:number;waiterId:string;payment:string;ticketIds?:string[]};
export type Period='day'|'week'|'month';
export const ticketTotal=(ticket:Ticket)=>ticket.lines.reduce((sum,line)=>sum+line.quantity*line.priceSnapshot,0);
export function periodBounds(now:number,period:Period){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bishkek',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now);
 const get=(key:string)=>Number(parts.find(p=>p.type===key)?.value);
 let start=Date.UTC(get('year'),get('month')-1,period==='month'?1:get('day'))-6*3600000;
 if(period==='week'){const weekday=new Date(start+6*3600000).getUTCDay();start-=((weekday+6)%7)*86400000}
 const end=period==='month'?Date.UTC(get('year'),get('month'),1)-6*3600000:start+(period==='week'?7:1)*86400000;
 return {start,end};
}
export function buildReport(tickets:Ticket[],payments:Payment[],now:number,period:Period){
 const {start,end}=periodBounds(now,period);
 const paid=payments.filter(p=>p.at>=start&&p.at<end);
 const byTable:Record<string,number>={},byWaiter:Record<string,number>={},quantities:Record<string,{name:OrderLine['name'];quantity:number}>={};
 let cash=0,card=0,revenue=0,unlinked=0;
 for(const payment of paid){
  // Legacy payments are linked by visit closure timestamp, never by current menu prices.
  const visit=tickets.filter(t=>t.closedAt!==undefined&&!t.cancelled&&(payment.ticketIds?payment.ticketIds.includes(t.id):t.table===payment.table&&t.closedAt===payment.at));
  if(!visit.length){unlinked++;continue}
  const amount=visit.reduce((sum,t)=>sum+ticketTotal(t),0);revenue+=amount;
  byTable[payment.table]=(byTable[payment.table]||0)+amount;
  for(const ticket of visit){byWaiter[ticket.waiterId]=(byWaiter[ticket.waiterId]||0)+ticketTotal(ticket);for(const line of ticket.lines){const entry=quantities[line.dishId]||{name:line.name,quantity:0};entry.quantity+=line.quantity;quantities[line.dishId]=entry}}
  if(payment.payment==='cash')cash+=amount;else if(payment.payment==='card')card+=amount;
 }
 return {revenue,tables:paid.length-unlinked,byTable,byWaiter,cash,card,unlinked,top:Object.values(quantities).sort((a,b)=>b.quantity-a.quantity).slice(0,3)};
}
export function kitchenStats(tickets:Ticket[],now:number){const {start,end}=periodBounds(now,'day');const completed=tickets.filter(t=>t.servedAt!==undefined&&t.servedAt>=start&&t.servedAt<end);return {served:completed.length,average:completed.length?completed.reduce((sum,t)=>sum+Math.max(0,t.servedAt!-t.receivedAt),0)/completed.length/60000:0}}
