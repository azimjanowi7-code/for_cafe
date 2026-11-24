import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/model.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const model=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('KGS prices use spaces and preserve fractional prices',()=>{assert.equal(model.formatPrice(1250),'1 250 сом');assert.equal(model.formatPrice(1250.5),'1 250,5 сом')});
test('timer thresholds include 10 and 20 minutes in warning',()=>{assert.equal(model.timerState(9),'ok');assert.equal(model.timerState(10),'warn');assert.equal(model.timerState(20),'warn');assert.equal(model.timerState(21),'late');assert.equal(model.timerState(6,5,15),'warn')});
test('sample tickets preserve historical price independently of menu changes',()=>{const tickets=model.sampleTickets();const original=tickets[0].lines[0].priceSnapshot;model.dishes[0].price=999;assert.equal(tickets[0].lines[0].priceSnapshot,original)});

test('paid reports use immutable snapshots and attribute each ticket to its waiter',()=>{
 const at=Date.parse('2026-11-06T08:00:00Z');
 const ticket=(id,waiterId,priceSnapshot,quantity=1)=>({id,table:1,receivedAt:at-60000,closedAt:at,waiterId,status:'served',sync:'sent',note:'',lines:[{dishId:'d1',name:{ru:'Старое имя',ky:'Эски аты'},quantity,priceSnapshot,served:true}]});
 const tickets=[ticket('a','w1',100,2),ticket('b','w2',150)];
 const payments=[{table:1,amount:999999,at,waiterId:'w1',payment:'cash',ticketIds:['a','b']}];
 const r=model.buildReport(tickets,payments,at,'day');
 assert.equal(r.revenue,350);assert.equal(r.byTable['1'],350);assert.deepEqual(r.byWaiter,{w1:200,w2:150});assert.equal(r.cash,350);assert.equal(r.card,0);assert.equal(r.tables,1);assert.equal(r.top[0].name.ru,'Старое имя');assert.equal(r.top[0].quantity,3);
});
test('repeated table visits and cash/card remain separate, legacy closures link by timestamp',()=>{
 const at=Date.parse('2026-11-06T08:00:00Z');
 const tickets=[0,1].map(i=>({id:String(i),table:1,receivedAt:at,closedAt:at+i,waiterId:'demo',lines:[{dishId:'d',name:{ru:'a',ky:'a'},quantity:1,priceSnapshot:100+i}]}));
 const payments=[{table:1,at,payment:'cash'},{table:1,at:at+1,payment:'card'},{table:2,at,payment:'cash'}];
 const r=model.buildReport(tickets,payments,at,'day');assert.equal(r.tables,2);assert.equal(r.revenue,201);assert.equal(r.cash,100);assert.equal(r.card,101);assert.equal(r.unlinked,1);
});
test('report calendar periods use Bishkek midnight, Monday weeks and exclusive ends',()=>{
 const now=Date.parse('2026-11-05T19:00:00Z'); // Nov 6, 01:00 Bishkek
 assert.deepEqual(model.periodBounds(now,'day'),{start:Date.parse('2026-11-05T18:00:00Z'),end:Date.parse('2026-11-06T18:00:00Z')});
 assert.equal(model.periodBounds(now,'week').start,Date.parse('2026-11-01T18:00:00Z'));
 assert.deepEqual(model.periodBounds(now,'month'),{start:Date.parse('2026-10-31T18:00:00Z'),end:Date.parse('2026-11-30T18:00:00Z')});
 const b=model.periodBounds(now,'day');const r=model.buildReport([],[{at:b.end,table:1}],now,'day');assert.equal(r.unlinked,0);
});
test('kitchen wait uses actual serve time, excludes legacy unknown completion and unpaid status',()=>{
 const now=Date.parse('2026-11-06T08:00:00Z');const r=model.kitchenStats([{receivedAt:now-600000,servedAt:now},{receivedAt:now-1200000,servedAt:now},{receivedAt:now,status:'served',closedAt:now}],now);assert.equal(r.served,2);assert.equal(r.average,15);
});
