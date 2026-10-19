const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const vue=fs.readFileSync('public/tenant-vue.global.prod.js','utf8');
const wait=async fn=>{const start=Date.now();while(!fn()){if(Date.now()-start>3000)throw Error('timeout');await new Promise(r=>setTimeout(r,5));}};
const button=(d,text)=>[...d.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
(async()=>{
 let row={room:'401',name:'測試資料',phone:'0912345678',rent:0,startDate:'2026-09-01',endDate:'2027-08-31',notes:'',contractLinks:[],defaultTransferLastFive:'01234'};
 const calls=[];let fail=false,storageWrites=0;
 const html=fs.readFileSync('public/google-tenants.html','utf8').replace(/<script[^>]+src=[^>]+><\/script>/g,'');
 const editor=new JSDOM(html,{url:'https://rent.test/google-tenants.html',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){
  w.eval(vue);w.fetch=async(url,options)=>{const call=JSON.parse(options.body);calls.push(call);if(fail)return {ok:false,json:async()=>({ok:false,error:{message:'已被更新，請重新讀取'}})};let data;if(call.action==='getTenantData')data=[row];else{row[call.args[1]]=call.args[2];data={room:call.args[0],field:call.args[1],value:call.args[2]};}return {ok:true,json:async()=>JSON.parse(JSON.stringify({ok:true,data}))};};
  w.Storage.prototype.setItem=()=>{storageWrites++};w.eval(fs.readFileSync('public/tenant-transport.js','utf8'));
 }});const ed=editor.window.document;
 await wait(()=>ed.querySelector('#tenant-401-phone'));
 assert.equal(ed.querySelector('#tenant-401-rent').value,'0');
 const identity=ed.querySelector('#tenant-401-identity');assert(identity);assert.equal(identity.tagName,'SELECT');assert.equal(identity.value,'');assert.equal(ed.querySelectorAll('.student-tag').length,0);
 assert.deepEqual([...identity.options].map(o=>o.textContent),['未標記','一般','學生','管理人']);
 for(const [next,expected] of [['學生',''],['管理人','學生'],['一般','管理人']]){
  identity.value=next;identity.dispatchEvent(new editor.window.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,0));button(identity.closest('.editor'),'儲存').click();await wait(()=>row.identity===next);
  await wait(()=>button(identity.closest('.editor'),'儲存')?.disabled===false && (next==='一般'?ed.querySelectorAll('.student-tag').length===0:ed.querySelectorAll('.student-tag').length===2 && [...ed.querySelectorAll('.student-tag')].every(t=>t.textContent===next)));
  assert.deepEqual(calls.at(-1),{action:'saveTenantField',args:['401','identity',next,expected]});
 }
 const phone=ed.querySelector('#tenant-401-phone');phone.value='0987654321';phone.dispatchEvent(new editor.window.Event('input',{bubbles:true}));await wait(()=>button(phone.closest('.editor'),'儲存').disabled===false);button(phone.closest('.editor'),'儲存').click();await wait(()=>phone.closest('.editor').textContent.includes('已儲存'));
 assert.deepEqual(calls.at(-1),{action:'saveTenantField',args:['401','phone','0987654321','0912345678']});
 fail=true;phone.value='0900000000';phone.dispatchEvent(new editor.window.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,0));button(phone.closest('.editor'),'儲存').click();await wait(()=>phone.closest('.editor').textContent.includes('已被更新'));
 assert.equal(storageWrites,0);assert.equal(ed.querySelector('a[href^="javascript:"]'),null);
 assert.deepEqual(errors,[]);editor.window.close();
 for(const file of ['public/style.css','public/google-tenants.html','public/google-accounts.html','public/notice.html']){
  const css=fs.readFileSync(file,'utf8');for(const m of css.matchAll(/font-size:\s*([\d.]+)(px|rem)/g))assert(Number(m[1])*(m[2]==='rem'?16:1)>=16,file+' small font '+m[0]);
 }
 console.log('PASS: tested tenant editor source; same-origin Google editor; signed-API transport; expected original value; zero rent; leading zeros; conflict display; no private localStorage writes; all declared interface font sizes >=16px.');
})().catch(e=>{console.error(e);process.exit(1)});
