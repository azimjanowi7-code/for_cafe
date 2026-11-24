import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/serving.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {completeTicket,undoCompletion,applyCompletion}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const fixture=()=>({id:'a',table:1,receivedAt:0,status:'open',sync:'sent',waiterId:'w',note:'Keep me',lines:[0,1,2].map(i=>({dishId:String(i),name:{ru:'a',ky:'a'},priceSnapshot:100,quantity:1,served:i===0}))});
test('serve all then undo preserves pre-existing partial serving, prices and ticket metadata',()=>{
 const before=fixture(),op=completeTicket(before,1000);assert.deepEqual(op.changed,[1,2]);assert.equal(op.after.status,'served');assert.equal(op.after.servedAt,1000);assert.equal(before.lines[1].served,false);
 const restored=undoCompletion({...op.after,note:'Updated note',closedAt:2000},op);assert.deepEqual(restored.lines.map(l=>l.served),[true,false,false]);assert.equal(restored.status,'open');assert.equal(restored.servedAt,undefined);assert.equal(restored.note,'Updated note');assert.equal(restored.closedAt,2000);assert.equal(restored.lines[1].priceSnapshot,100);
});
test('independent Undo actions can be applied out of order',()=>{
 const first=completeTicket(fixture(),100,1),second=completeTicket(first.after,200,2);
 const undoFirst=undoCompletion(second.after,first);assert.deepEqual(undoFirst.lines.map(l=>l.served),[true,false,true]);assert.equal(undoFirst.status,'open');
 const undoSecond=undoCompletion(undoFirst,second);assert.deepEqual(undoSecond.lines.map(l=>l.served),[true,false,false]);
});
test('pending completion merges safely when an earlier action is undone during collapse',()=>{
 const first=completeTicket(fixture(),100,1),second=completeTicket(first.after,200,2);
 const current=undoCompletion({...first.after,note:'New note'},first);
 const committed=applyCompletion(current,second,200);assert.deepEqual(committed.lines.map(l=>l.served),[true,false,true]);assert.equal(committed.status,'open');assert.equal(committed.servedAt,undefined);assert.equal(committed.note,'New note');
});
test('serving an already served line does not create an undoable change',()=>{
 assert.deepEqual(completeTicket(fixture(),100,0).changed,[]);
});
