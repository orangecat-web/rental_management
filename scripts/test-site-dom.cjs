const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM,VirtualConsole}=require('jsdom');
const wait=async fn=>{const start=Date.now();while(!fn()){if(Date.now()-start>4000)throw Error('timeout');await new Promise(r=>setTimeout(r,5));}};
const button=(d,text)=>[...d.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
(async()=>{
 const errors=[],calls=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));let fail=false,storageWrites=0;
 let row={room:'401',version:'v1',name:'測試資料',identity:'一般',phone:'0912345678',rent:0,roomType:'套房',initialReading:0,signingDate:'2026-08-15',startDate:'2026-09-01',endDate:'2027-08-31',contractKind:'',emergencyContacts:[],notes:'',maintenance:'保留維修',contractLinks:[],defaultTransferLastFive:'01234'};
 const html=fs.readFileSync('public/google-tenants.html','utf8').replace(/<script[^>]+src=[^>]+><\/script>/g,'');
 const editor=new JSDOM(html,{url:'https://rent.test/google-tenants.html',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){
  w.eval(fs.readFileSync('public/tenant-vue.global.prod.js','utf8'));w.Storage.prototype.setItem=()=>storageWrites++;
  w.fetch=async(url,options)=>{const c=JSON.parse(options.body);calls.push(c);if(fail)return {ok:false,json:async()=>({ok:false,error:{message:'已被更新，請重新讀取'}})};let data;
   if(c.action==='getTenantData')data=[row];
   else if(c.action==='saveTenantChanges'){assert.equal(c.args[0],'401');assert.equal(c.args[2],row.version);for(const [key,v] of Object.entries(c.args[1]))row[key]=['rent','initialReading'].includes(key)?v===''?null:Number(v):v;row.version+='x';data=row;}
   else if(c.action==='previewTenantCheckout')data={year:c.args[1].year,month:c.args[1].month,rent:0,electricityFee:0,netDue:0,version:'quote-1'};
   else if(c.action==='checkoutTenant'){assert.equal(c.args[1],row.version);row={room:row.room,roomType:row.roomType,maintenance:row.maintenance,version:row.version+'x',name:'',rent:null,contractLinks:[],emergencyContacts:[]};data=row;}
   else if(c.action==='getRoomSettings')data=[{room:'401',roomType:'套房',version:row.version,occupied:!!row.name,inactive:false}];
   else throw Error('unexpected action '+c.action);
   return {ok:true,json:async()=>JSON.parse(JSON.stringify({ok:true,data}))};};w.eval(fs.readFileSync('public/tenant-transport.js','utf8'));
 }});const w=editor.window,d=w.document;
 const input=async(selector,value,event='input')=>{const el=d.querySelector(selector);assert(el,selector);el.value=value;el.dispatchEvent(new w.Event(event,{bubbles:true}));await w.Vue.nextTick();};
 await wait(()=>d.querySelector('#tenant-401-phone'));assert.equal(d.querySelector('#tenant-401-rent').value,'0');assert.equal(d.querySelector('#tenant-401-initialReading').value,'0');
 assert.deepEqual([...d.querySelectorAll('[name=tenant-401-roomType]')].map(i=>i.value),['套房','雅房']);assert.deepEqual([...d.querySelectorAll('[name=tenant-401-identity]')].map(i=>i.value),['一般','學生','管理人']);
 await input('#tenant-401-phone','0955987168');d.querySelector('#tenant-401-phone').dispatchEvent(new w.Event('blur'));await w.Vue.nextTick();assert.equal(d.querySelector('#tenant-401-phone').value,'0955-987-168');
 d.querySelector('[name=tenant-401-identity][value=管理人]').click();await w.Vue.nextTick();await input('#tenant-401-phone','000123');await input('#tenant-401-initialReading','20.5');
 button(d,'新增緊急聯絡人').click();await w.Vue.nextTick();await input('[aria-label="緊急聯絡人 1 姓名"]','甲');await input('[aria-label="緊急聯絡人 1 電話"]','00123');button(d,'新增緊急聯絡人').click();await w.Vue.nextTick();await input('[aria-label="緊急聯絡人 2 姓名"]','乙');await input('[aria-label="緊急聯絡人 2 電話"]','00456');
 d.querySelector('[aria-label="401 房續約"]').click();await w.Vue.nextTick();d.querySelector('[aria-label="401 房新約"]').click();await w.Vue.nextTick();assert(!d.querySelector('[aria-label="401 房續約"]').checked);assert(d.querySelector('[aria-label="401 房新約"]').checked);
 assert.equal(calls.filter(c=>c.action.startsWith('save')).length,0,'drafts never autosave');button(d,'儲存全部修改').click();await wait(()=>d.querySelector('.status').textContent.includes('全部修改已儲存'));
 const saved=calls.find(c=>c.action==='saveTenantChanges');assert.equal(saved.args[2],'v1');assert.equal(saved.args[1].identity,'管理人');assert.equal(saved.args[1].phone,'000123');assert.equal(saved.args[1].emergencyContacts.length,2);assert.equal(saved.args[1].contractKind,'新約');assert.equal(row.initialReading,20.5);assert(d.querySelector('.tenant-heading .student-tag').textContent.includes('管理人'));
 await input('#tenant-401-startDate','2027-01-01');await w.Vue.nextTick();assert.equal(d.querySelector('#tenant-401-endDate').value,'2027-12-31');button(d,'還原全部未儲存').click();await w.Vue.nextTick();
 fail=true;await input('#tenant-401-phone','0900000000');button(d,'儲存全部修改').click();await wait(()=>d.querySelector('.status').textContent.includes('已被更新'));const attempts=calls.length;await new Promise(r=>setTimeout(r,50));assert.equal(calls.length,attempts,'uncertain writes are not automatically retried');assert.equal(d.querySelector('#tenant-401-phone').value,'0900000000');assert.equal(row.phone,'000123');
 fail=false;button(d,'還原全部未儲存').click();await w.Vue.nextTick();button(d,'退租').click();await w.Vue.nextTick();assert.equal(calls.filter(c=>c.action==='checkoutTenant').length,0,'checkout requires concrete confirmation');assert(button(d,'確認退租並清空').disabled);button(d,'預覽退租帳務').click();await wait(()=>d.querySelector('[aria-label="退租帳務月份"]')&&!button(d,'確認退租並清空').disabled);button(d,'確認退租並清空').click();await wait(()=>d.querySelector('.status').textContent.includes('已退租'));assert.equal(row.maintenance,'保留維修');assert.equal(row.roomType,'套房');assert.equal(d.querySelector('#tenant-401-phone').value,'');assert.equal(d.querySelector('[name=tenant-401-identity]:checked').value,'一般');
 assert.equal(storageWrites,0);assert(!d.querySelector('a[href^="javascript:"]'));assert.deepEqual(errors,[]);editor.window.close();
 for(const file of ['public/style.css','public/google-tenants.html','public/google-accounts.html','public/notice.html'])for(const m of fs.readFileSync(file,'utf8').matchAll(/font-size:\s*([\d.]+)(px|rem)/g))assert(Number(m[1])*(m[2]==='rem'?16:1)>=16,file+' small font '+m[0]);
 console.log('PASS: actual Vue whole-draft save, radio choices/default, independent contract checkboxes, one-year dates, multiple contacts, revision conflict, no automatic retry, confirmed checkout, zero readings/rent, leading zeros, no private storage, 16px minimum.');
})().catch(e=>{console.error(e);process.exit(1)});
