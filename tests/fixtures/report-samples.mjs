export const anchor=Date.parse('2026-11-07T14:00:00+06:00');
export function fixedReportSample(){
 const dish=(itemId,qty,price)=>({itemId,qty,price,nameKy:{a:'Аш',b:'Чай',c:'Манты',d:'Боорсок',z:'Эски'}[itemId],nameRu:{a:'Плов',b:'Чай',c:'Манты',d:'Боорсок',z:'Старое'}[itemId]});
 const sessions=[],orders=[];
 function visit(id,when,tableId,paymentType,parts){const closedAt=Date.parse(when);let total=0;for(const [index,[waiterId,items]]of parts.entries()){total+=items.reduce((n,line)=>n+Math.round(line.price*100)*line.qty,0);orders.push({id:`order-${id}-${index}`,sessionId:`session-${id}`,tableId,waiterId,waiterName:waiterId==='w1'?'Айжан':'Бакыт',createdAt:closedAt-600000,servedAt:closedAt-300000,status:'served',accepted:true,items})}sessions.push({id:`session-${id}`,tableId,tableNumber:tableId,closedAt,status:'closed',paymentType,total:total/100})}
 visit('previous','2026-10-31T23:59:59+06:00','4','card',[['w1',[dish('z',1,999)]]]);
 visit('a','2026-11-01T00:00:00+06:00','3','cash',[['w1',[dish('a',2,100),dish('b',1,50)]]]);
 visit('b','2026-11-02T12:00:00+06:00','2','card',[['w2',[dish('b',3,50),dish('c',1,200)]]]);
 visit('c','2026-11-07T00:00:00+06:00','1','cash',[['w1',[dish('a',1,100),dish('c',2,200)]],['w2',[dish('b',2,50),dish('d',1,25)]]]);
 visit('d','2026-11-07T12:00:00+06:00','1','card',[['w1',[dish('d',4,25)]]]);
 orders.push({id:'order-cancelled',sessionId:'session-c',tableId:'1',waiterId:'w1',waiterName:'Айжан',createdAt:anchor-3600000,servedAt:null,status:'cancelled',accepted:true,items:[dish('z',99,999)]});
 orders.push({id:'order-open',sessionId:'session-open',tableId:'5',waiterId:'w1',waiterName:'Айжан',createdAt:anchor-3600000,servedAt:null,status:'new',accepted:true,items:[dish('z',99,999)]});
 return {sessions,orders};
}
export const expected={day:{revenue:725,tables:2,cash:625,card:100,byWaiter:{w1:600,w2:125},top:[['d',5],['b',2],['c',2]]},week:{revenue:1075,tables:3,cash:625,card:450,byWaiter:{w1:600,w2:475},top:[['b',5],['d',5],['c',3]]},month:{revenue:1325,tables:4,cash:875,card:450,byWaiter:{w1:850,w2:475},top:[['b',6],['d',5],['a',3]]}};
