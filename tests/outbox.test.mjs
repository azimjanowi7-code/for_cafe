import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync(new URL('../src/outbox.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {OrderOutbox}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
class MemoryStorage{data=new Map();get length(){return this.data.size}key(i){return [...this.data.keys()][i]??null}getItem(k){return this.data.get(k)??null}setItem(k,v){this.data.set(k,v)}removeItem(k){this.data.delete(k)}}
const ticket=()=>({id:'stable-id',table:1,receivedAt:0,lines:[{dishId:'d',name:{ru:'Original',ky:'Original'},quantity:2,priceSnapshot:100,served:false}],status:'open',sync:'queued',note:'',waiterId:'demo'});
test('queue survives reload and preserves original ticket content across repeated enqueue',()=>{const storage=new MemoryStorage(),first=new OrderOutbox(storage),t=ticket();first.enqueue(t);t.lines[0].priceSnapshot=999;first.enqueue(t);assert.equal(new OrderOutbox(storage).pending()[0].lines[0].priceSnapshot,100)});
test('lost acknowledgments retry one stable key and server deduplication accepts only once',async()=>{const storage=new MemoryStorage(),outbox=new OrderOutbox(storage);outbox.enqueue(ticket());const accepted=new Map();let attempts=0;const send=async(payload,key)=>{attempts++;if(!accepted.has(key))accepted.set(key,payload);if(attempts===1)throw Error('lost acknowledgment');return{id:key}};await outbox.flush(send);assert.equal(outbox.pending().length,1);await new OrderOutbox(storage).flush(send);assert.equal(attempts,2);assert.equal(accepted.size,1);assert.equal(outbox.pending().length,0);outbox.enqueue(ticket());assert.equal(outbox.pending().length,0)});
test('concurrent flush calls on one queue share the same delivery',async()=>{const outbox=new OrderOutbox(new MemoryStorage());outbox.enqueue(ticket());let calls=0;const send=async(_,id)=>{calls++;await Promise.resolve();return{id}};await Promise.all([outbox.flush(send),outbox.flush(send)]);assert.equal(calls,1)});
test('failed persistence does not claim an order was queued',()=>{const storage=new MemoryStorage();storage.setItem=()=>{throw Error('full')};assert.throws(()=>new OrderOutbox(storage).enqueue(ticket()),/full/)});
