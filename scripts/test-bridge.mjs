import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHmac, webcrypto } from 'node:crypto';
import { handleApi, signPayload } from '../worker/api.mjs';
globalThis.crypto ??= webcrypto;
const secret='abcdef01'.repeat(8),env={AUTH_MODE:'sites',MANAGER_EMAILS:'owner@example.test',RENTAL_APPS_SCRIPT_URL:'https://script.google.com/macros/s/DEMO/exec',RENTAL_BRIDGE_SECRET:secret};
const origin='https://rent.test';
function request(path='/api/tenant-rpc',body={action:'getTenantData',args:[]},extra={}){
 const headers={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test','origin':origin,'content-type':'application/json',...extra};
 for(const k of Object.keys(headers))if(headers[k]===null)delete headers[k];
 return new Request(origin+path,body===null?{headers}:{method:'POST',headers,body:JSON.stringify(body)});
}
let calls=0,cache=new Map(),locked=false;
const ctx={Date,JSON,Number,String,Array,Object,Math,Error,
 PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='RENTAL_BRIDGE_SECRET'?secret:key==='BILLING_SPREADSHEET_ID_2026'?'demo-sheet':null,getProperties:()=>({BILLING_SPREADSHEET_ID_2026:'demo-sheet',BILLING_SPREADSHEET_ID_2027:'',OTHER:'not-an-id'})})},
 LockService:{getScriptLock:()=>({waitLock(){assert(!locked);locked=true},releaseLock(){locked=false}})},
 CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},
 Utilities:{Charset:{UTF_8:'utf8'},computeHmacSha256Signature:(value,key)=>createHmac('sha256',key).update(value).digest(),base64EncodeWebSafe:v=>Buffer.from(v).toString('base64url')},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>text})},
 SpreadsheetApp:{openById:()=>({getSheets:()=>['9','10','11','12','備註'].map(n=>({getName:()=>n}))})},
 getMonthlyAccounts:()=>[{year:2026,month:11,room:'401',rent:0,totalDue:0,meter:null}],
 saveMonthlyAccountField:(year,month,room,field,value)=>({value:field==='currentReading'?(value===''?null:Number(value)):value}),
 getPaymentPhoto:()=>({dataUrl:'data:image/jpeg;base64,'+'A'.repeat(1100000)}),
 getRoomNoticeData:()=>({room:'401'}),
 getTenantData(){calls++;assert(!locked);return [{room:'401',name:'測試',phone:'0912345678',rent:0,defaultTransferLastFive:'01234'}]},
 saveTenantField(...args){calls++;assert(!locked);return {room:args[0],field:args[1],value:args[2]}},
 saveTenantNote(){throw Error('資料已被更新，請重新讀取。')},saveTenantContract:()=>({links:[]})};
ctx.getTenantDataWithRoomType_=()=>ctx.getTenantData();
ctx.saveTenantRoomType_=(...args)=>({...ctx.saveTenantField(...args),roomTypeRoute:true});
ctx.saveTenantStudent_=(...args)=>ctx.saveTenantField(...args);
ctx.getMonthlyAccountsWithSettlement_=(...args)=>ctx.getMonthlyAccounts(...args);
ctx.saveMonthlyActualPaid_=(...args)=>ctx.saveMonthlyAccountField(...args);
ctx.getRoomNoticeWithSettlement_=(...args)=>ctx.getRoomNoticeData(...args);
vm.createContext(ctx);vm.runInContext(fs.readFileSync('apps-script/SiteBridge.gs','utf8'),ctx);
const post=body=>JSON.parse(ctx.doPost({postData:{contents:body}}));
const signed=async(patch={})=>{const payload=JSON.stringify({version:1,id:crypto.randomUUID(),issuedAt:Date.now(),action:'getTenantData',args:[],...patch});return JSON.stringify({payload,signature:await signPayload(payload,secret)})};
let envelope=await signed();assert(post(envelope).ok);assert.equal(post(envelope).error.code,'REPLAY');
const count=calls;assert.equal(post(envelope.replace('getTenantData','saveTenantData')).error.code,'AUTH');assert.equal(calls,count);
assert.equal(post(await signed({issuedAt:Date.now()-121000})).error.code,'AUTH');
assert.equal(post(await signed({action:'setupBilling2026'})).error.code,'AUTH');
assert.equal(post(await signed({action:'saveTenantField',args:['401','unknown','abc','']})).error.code,'AUTH');
assert.equal(post(await signed({action:'saveTenantField',args:['401','phone','01234','']})).data.value,'01234');
const roomTypeResult=post(await signed({action:'saveTenantField',args:['401','roomType','套房','']}));assert.equal(roomTypeResult.data.value,'套房');assert.equal(roomTypeResult.data.roomTypeRoute,true);
assert.equal(post(await signed({action:'saveTenantField',args:['401','roomType','別墅','']})).error.code,'AUTH');
assert.equal(post(await signed({action:'saveTenantNote',args:['401','memo','']})).error.code,'BUSINESS');
assert.equal(JSON.parse(ctx.doGet()).ok,false);assert(!locked);
const fetchGoogle=async(url,options)=>{
 if(String(url).startsWith('https://script.google.com'))return new Response(null,{status:302,headers:{location:'https://script.googleusercontent.com/macros/echo?token=demo'}});
 assert.equal(options.method,'GET');assert.equal(options.body,undefined);
 return new Response(ctx.getTenantData()&&JSON.stringify({ok:true,data:ctx.getTenantData()}),{headers:{'content-type':'application/json'}});
};
assert.equal((await handleApi(request(undefined,undefined,{'oai-authenticated-user-id':null}),env,fetchGoogle)).status,401);
assert.equal((await handleApi(request(undefined,undefined,{origin:'https://other.test'}),env,fetchGoogle)).status,403);
assert.equal((await handleApi(request(),{},fetchGoogle)).status,503);
assert.equal((await handleApi(request(undefined,{action:'deleteAll',args:[]}),env,fetchGoogle)).status,400);
let captured;
const direct=async(url,options)=>{captured=options.body;return new Response(JSON.stringify(post(options.body)),{headers:{'content-type':'application/json'}})};
let r=await handleApi(request(),env,direct);assert.equal(r.status,200);let value=await r.json();assert.equal(value.data[0].rent,0);assert.equal(value.data[0].defaultTransferLastFive,'01234');assert(captured.includes('signature'));assert(!captured.includes(secret));assert.equal(r.headers.get('cache-control'),'private, no-store');
const status=await(await handleApi(request('/api/connection',null),env,direct)).text();assert(!status.includes(secret));assert(!status.includes(env.RENTAL_APPS_SCRIPT_URL));assert(status.includes('true'));
r=await handleApi(request(undefined,{action:'saveTenantNote',args:['401','memo','']}),env,direct);assert.equal(r.status,409);assert((await r.text()).includes('已被更新'));
assert.equal((await handleApi(request(),env,fetchGoogle)).status,200);
const evil=async()=>new Response(null,{status:302,headers:{location:'https://evil.test'}});
assert.equal((await handleApi(request(),env,evil)).status,502);
let attempts=0;const failure=async()=>{attempts++;throw Error('timeout secret '+secret)};
r=await handleApi(request(undefined,{action:'saveTenantField',args:['401','phone','01234','']}),env,failure);assert.equal(attempts,1);const failureText=await r.text();assert(!failureText.includes(secret));assert(failureText.includes('重新讀取確認'));
// Billing shares the same cryptographic boundary, with separate allowed routes.
const billingCall=(action,args=[])=>request('/api/billing-rpc',{action,args});
let billResult=await handleApi(billingCall('getRentalSiteCapabilities'),env,direct);
assert.equal((await billResult.json()).data.version,2);
assert.deepEqual(post(await signed({action:'getAvailableBillingYears',args:[]})).data,[2026]);
assert.deepEqual(post(await signed({action:'getAvailableBillingMonths',args:[2026]})).data,[9,10,11,12]);
assert.equal((await handleApi(billingCall('getMonthlyAccounts',[2026,11]),env,direct)).status,200);
assert.equal((await handleApi(billingCall('saveMonthlyAccountField',[2026,11,'401','currentReading','0',null]),env,direct)).status,200);
assert.equal((await handleApi(billingCall('saveMonthlyAccountField',[2026,10,'401','currentReading','0',null]),env,direct)).status,400);
assert.equal((await handleApi(billingCall('getRoomNoticeData',[2026,10,'401']),env,direct)).status,400);
assert.equal((await handleApi(billingCall('getRoomNoticeData',[2026,11,'401']),env,direct)).status,200);
assert.equal((await handleApi(billingCall('getPaymentPhoto',[2026,10,'image']),env,direct)).status,200);
assert.equal((await handleApi(billingCall('saveRoomPaymentPhotoSelection',[2026,10,'401',['id','id'],'']),env,direct)).status,400);
assert.equal((await handleApi(billingCall('getTenantData'),env,direct)).status,400);
assert.equal((await handleApi(request(undefined,{action:'getMonthlyAccounts',args:[2026,11]}),env,direct)).status,400);
const oldBridge=async()=>new Response(JSON.stringify({ok:false,error:{code:'AUTH'}}),{headers:{'content-type':'application/json'}});
assert.equal((await handleApi(billingCall('getRentalSiteCapabilities'),env,oldBridge)).status,426);
console.log('PASS: Worker ↔ Apps Script signed read/write; auth/origin/method allowlist; signature tamper/expiry/replay; lock release; conflict forwarding; safe Google redirects; no automatic write retry; zero/leading zeros; no-store and no secret disclosure.');
