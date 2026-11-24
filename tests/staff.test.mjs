import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/staffApi.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const api=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('staff operations require a connection and use authenticated callable envelopes',async()=>{
 await assert.rejects(api.staffRequest('list'),/not-connected/);
 api.configureStaffConnection({endpoint:'https://example.test/manageStaff',cafeId:'test-cafe',getIdToken:async()=>'test-token'});
 const original=globalThis.fetch;let request;
 globalThis.fetch=async(url,options)=>{request={url,...options};return {ok:true,json:async()=>({result:{staff:[{uid:'u',name:'Test',role:'Cook',active:true}]}})}};
 try{const staff=await api.staffRequest('create',{name:'Test',role:'Cook',password:'test-pass'});assert.equal(staff[0].uid,'u');assert.equal(request.headers.Authorization,'Bearer test-token');assert.deepEqual(JSON.parse(request.body),{data:{action:'create',cafeId:'test-cafe',name:'Test',role:'Cook',password:'test-pass'}});
 globalThis.fetch=async()=>({ok:true,json:async()=>({error:{status:'PERMISSION_DENIED'}})});await assert.rejects(api.staffRequest('deactivate',{uid:'u'}),/PERMISSION_DENIED/);
 }finally{globalThis.fetch=original}
});
