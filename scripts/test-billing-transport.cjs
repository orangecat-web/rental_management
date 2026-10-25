const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const source=fs.readFileSync('public/google-accounts.html','utf8').replace(/<script[^>]+src=[^>]+><\/script>/g,'');
const vue=fs.readFileSync('public/tenant-vue.global.prod.js','utf8'),transport=fs.readFileSync('public/billing-transport.js','utf8');
const wait=async test=>{const t=Date.now();while(!test()){if(Date.now()-t>3000)throw Error('timeout');await new Promise(r=>setTimeout(r,5));}};
function open(old){let nextReply;const calls=[],errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(source,{url:'https://rent.test/google-accounts.html',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){w.eval(vue);w.fetch=async(url,options)=>{
 assert.equal(url,'/api/billing-rpc');assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');
 const call=JSON.parse(options.body);calls.push(call);if(nextReply){const reply=nextReply;nextReply=null;return reply;}const a=call.args;let data;
 if(old)return {ok:false,json:async()=>({ok:false,error:{message:'請更新 SiteBridge.gs'}})};
 if(call.action==='getRentalSiteCapabilities')data={version:2,billing:true};
 else if(call.action==='getAvailableBillingYears')data=[2026];
 else if(call.action==='getAvailableBillingMonths')data=[10,11];
 else if(call.action==='getMonthlyAccounts')data=[{year:2026,month:11,room:'506',name:'測試',rent:0,electricityFee:null,totalDue:null,transferDate:'',transferLastFive:'01234',notes:'',meter:null}];
 else if(call.action==='saveMonthlyAccountField')data={value:a[4]};
 return {ok:true,json:async()=>({ok:true,data})};};w.eval(transport);}});return {dom,calls,errors,replyOnce:r=>{nextReply=r;}};}
(async()=>{
 const old=open(true),od=old.dom.window.document;await wait(()=>!od.querySelector('#bridge-upgrade').hidden);assert.equal(old.calls.length,1);assert(od.querySelector('#boot-status').textContent.includes('更新'));assert.equal(od.querySelector('#billing-app').getAttribute('v-cloak'),'');old.dom.window.close();
 const live=open(false),d=live.dom.window.document;await wait(()=>d.querySelector('#status').textContent.includes('已讀取'));
 assert.equal(d.querySelector('#month').value,'11');assert.equal(d.querySelector('a.notice-link')?.getAttribute('href').split('?')[0],'https://rent.test/notice.html');
 const el=d.querySelector('[aria-label="11 月 506 房轉帳後五碼"]');assert.equal(el.value,'01234');el.value='00000';el.dispatchEvent(new live.dom.window.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,0));[...el.closest('.editor').querySelectorAll('button')].find(b=>b.textContent==='儲存').click();await wait(()=>el.closest('.editor').textContent.includes('已寫回'));
 assert.deepEqual(live.calls.at(-1),{propertyId:'default',action:'saveMonthlyAccountField',args:[2026,11,'506','transferLastFive','00000','01234']});el.value='11111';el.dispatchEvent(new live.dom.window.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,0));
 live.replyOnce({ok:false,status:502,headers:{get:()=> 'text/html'},json:async()=>{throw SyntaxError('PRIVATE HTML');}});const beforeFailure=live.calls.length;[...el.closest('.editor').querySelectorAll('button')].find(b=>b.textContent==='儲存').click();await wait(()=>el.closest('.editor').textContent.includes('勿重複送出'));assert.equal(el.value,'11111');assert.equal(live.calls.length,beforeFailure+1);assert(!el.closest('.editor').textContent.includes('PRIVATE'));assert(d.querySelector('#reload').disabled,'dirty input still guards reload');
 assert.deepEqual(live.errors,[]);live.dom.window.close();
 console.log('PASS: billing fetch transport; v1 upgrade prompt without data reads; v2 mount; exact year/month/room/expected value; leading zeros; same-origin notice URL; no-store.');
})().catch(e=>{console.error(e);process.exit(1)});
