const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const {validateSnapshot}=require('./demo-numbers-schema.cjs');
const root=path.resolve('dist/pages-demo'),source='demo/production-numbers.json';
const wait=async fn=>{const start=Date.now();while(!fn()){if(Date.now()-start>10000)throw Error('Numeric Demo UI timeout');await new Promise(r=>setTimeout(r,5));}};
(async()=>{
 if(!fs.existsSync(source)){console.log('SKIP: no production numerical snapshot in this checkout.');return;}
 const snapshot=validateSnapshot(JSON.parse(fs.readFileSync(source,'utf8'))),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert(html.indexOf('production-numbers.js')<html.indexOf('pages-demo.js'));
 const files=[...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)].map(m=>m[1]);
 let demoImages=0;const errors=[],external=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html.replace(/<script[^>]+src=[^>]+><\/script>/g,''),{url:'https://demo.test/rental_management/',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){w.Response=Response;w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},fillText(){}});w.HTMLCanvasElement.prototype.toDataURL=()=>{demoImages++;return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==';};w.fetch=async url=>{external.push(String(url));throw Error('Unexpected external request');};w.Storage.prototype.setItem=()=>{throw Error('Demo must not persist data');};}});
 try{
  const w=dom.window,d=w.document;
  for(const file of files)w.eval(fs.readFileSync(path.join(root,file.replace(/^\.\//,'')),'utf8'));
  await wait(()=>d.querySelector('.today-summary'));const workspace=d.querySelector('#app')._vnode.component.proxy;workspace.navigate('rooms');await wait(()=>d.querySelectorAll('.room-card').length===snapshot.tenants.length);
  const rpc=async(action,args=[],scope='billing')=>{const response=await w.fetch('/api/'+scope+'-rpc',{method:'POST',body:JSON.stringify({action,args})});return {status:response.status,...await response.json()};};
  assert.equal(w.RentalAccess.canWrite,false);
  const publishedYear=Number(snapshot.capturedAt.slice(0,4));assert.equal(snapshot.periods.filter(p=>p.year===publishedYear).length,12,'Published current-year snapshot includes all months');
  assert.deepEqual((await rpc('getAvailableBillingYears')).data,[...new Set(snapshot.periods.map(p=>p.year))].sort((a,b)=>b-a));
  const tenants=(await rpc('getTenantData',[],'tenant')).data;
  for(const t of tenants){assert(!t.name||(/^[\u4e00-\u9fff]{3}$/.test(t.name)&&!t.name.includes('示範')));assert(t.registeredAddress.includes('示範'));}
  assert.equal(tenants.find(t=>t.room==='401').name,'郝開心');assert.equal(new Set(tenants.filter(t=>t.name).map(t=>t.name)).size,tenants.filter(t=>t.name).length);assert.equal(tenants[0].guarantorName,'包安心');assert.deepEqual(tenants[0].emergencyContacts.map(c=>c.name),['郝照應','常聯絡']);
  assert.equal(tenants[0].cohabitant,'何睦睦');assert.equal(tenants[0].cohabitantId,'DEMO-COHABITANT-INVALID');assert.equal(tenants[0].cohabitantBirthDate,'2000-02-29');assert(tenants[0].cohabitantAddress.includes('非真實地址'));assert(tenants.slice(1).every(t=>!t.cohabitantId&&!t.cohabitantBirthDate));
  const historicalNames=new Map();
  for(const period of snapshot.periods){
   const rows=(await rpc('getMonthlyAccounts',[period.year,period.month])).data;assert.equal(rows.length,period.accounts.length);
   for(const original of period.accounts){const row=rows.find(a=>a.room===original.room);for(const [key,value] of Object.entries(original))assert.deepEqual(row[key],value,'Snapshot field differs: '+key);if(original.vacant)assert.equal(row.name,'空房');else{assert(/^[\u4e00-\u9fff]{3}$/.test(row.name));const current=tenants.find(t=>t.room===row.room);if(current?.name)assert.equal(row.name,current.name);if(historicalNames.has(row.room))assert.equal(row.name,historicalNames.get(row.room));historicalNames.set(row.room,row.name);}assert.equal(row.paymentScreenshot,'');}
  }
  for(const report of snapshot.reports){const actual=(await rpc('getXingwuCollectionReport',[report.year])).data;for(const [key,value] of Object.entries(report)){if(['knownCashTotal','cashTotal'].includes(key)){const excluded=report.signing.reduce((sum,s)=>{const a=snapshot.periods.find(p=>p.year===report.year&&p.month===s.month)?.accounts.find(a=>a.room===s.room);return sum+(typeof s.cash==='number'?Math.max(0,s.cash-(typeof a?.effectivePaid==='number'?a.effectivePaid:0)):0);},0);assert.equal(actual[key],value===null?null:Math.max(0,value-excluded));}else assert.deepEqual(actual[key],value);} }
  workspace.navigate('deposits');await wait(()=>d.querySelector('.deposit-summary'));assert(d.querySelector('.deposit-summary').textContent.includes('12,000'));
  const depositRpc=await rpc('getDepositWorkspace');assert.equal(depositRpc.data.items.length,2);assert.equal(depositRpc.data.items[0].name,tenants[0].name);assert.equal(depositRpc.data.items[1].name,'曾住過');assert.equal((await rpc('saveDepositChange',[{},'x','x'])).status,403);assert.equal((await rpc('confirmDepositCheckout',[{},'x','x'])).status,403);
  for(const button of d.querySelectorAll('.deposit-actions button'))assert(button.disabled,'Deposit writes stay visible but disabled');
  const depositSelect=d.querySelector('.deposit-toolbar select');depositSelect.value=depositSelect.options[1].value;depositSelect.dispatchEvent(new w.Event('change',{bubbles:true}));await w.Vue.nextTick();assert(d.querySelector('.deposit-history').textContent.includes('末期電費小計 NT$ 250'));assert(d.querySelector('.deposit-history').textContent.includes('其他扣款小計 NT$ 200'));
  workspace.navigate('rooms');await wait(()=>d.querySelector('.room-card'));
  assert.equal((await rpc('saveMonthlyAccountField',[2026,1,'401','actualPaid','1',null])).status,403);
  assert.equal((await rpc('saveTenantChanges',['401',{name:'changed'},'demo-401'],'tenant')).status,403);
  const nav=label=>workspace.navigate(label);
  const visibleDisabled=label=>{const b=[...d.querySelectorAll('button')].find(b=>b.textContent.trim()===label);assert(b,'Missing control '+label);assert(!b.hidden);assert(b.disabled,'Mutation must stay disabled '+label);};
  assert(d.querySelector('.access-identity form button').disabled);
  nav('more');await w.Vue.nextTick();await workspace.openSettings('property');await wait(()=>d.querySelector('.property-editor'));for(const label of ['儲存工作區名稱','上傳並套用 Logo','儲存房產','新增房產'])visibleDisabled(label);await workspace.toggleSettings();
  await workspace.openSettings('rooms');await wait(()=>d.querySelector('.room-settings'));visibleDisabled('儲存房號／房型');await workspace.toggleSettings();
  const occupied=snapshot.tenants.find(t=>!t.vacant);assert(occupied);workspace.navigate('tenants',occupied.room);await wait(()=>d.querySelector('.tenant-summary'));
  [...d.querySelectorAll('button')].find(b=>b.textContent.trim()==='編輯房客').click();await wait(()=>d.querySelector('#tenant-'+occupied.room+'-rent'));
  for(const label of ['儲存全部修改','還原全部未儲存','退租','確認入住與更新帳務','同步帳務姓名'])visibleDisabled(label);
  const cohabitantGroup=d.querySelector('[aria-label="同居人資料"]');assert.equal(cohabitantGroup.querySelectorAll('.editor').length,6);for(const el of cohabitantGroup.querySelectorAll('input'))assert(el.disabled||el.readOnly);assert(!d.querySelector('#tenant-'+occupied.room+'-cohabitantAddress-city'));
  [...d.querySelectorAll('button')].find(b=>b.textContent==='返回資料摘要').click();await w.Vue.nextTick();[...d.querySelectorAll('.tenant-detail-tabs button')].find(b=>b.textContent==='租約').click();await w.Vue.nextTick();assert(d.querySelector('.renewal-notice button')&&!d.querySelector('.renewal-notice button').disabled);
  workspace.closeTenant();await w.Vue.nextTick();nav('accounts');await wait(()=>d.querySelector('.billing-native')?.textContent.includes('已讀取'));
  assert(!d.querySelector('#initializeMonth')||d.querySelector('#initializeMonth').hidden);assert(!d.querySelector('#toggleCreation')||d.querySelector('#toggleCreation').hidden);
  const open=d.querySelector('.reconciliation-action-cell button');assert(open&&!open.disabled);open.click();await wait(()=>d.querySelector('.reconciliation-dialog'));visibleDisabled('儲存對帳資料');assert(d.querySelector('.reconciliation-dialog [aria-label$="實際對帳金額"]').readOnly);d.querySelector('[aria-label="關閉實際對帳"]').click();await wait(()=>!d.querySelector('.reconciliation-dialog'));
  const originalImages=demoImages;nav('expenses');await wait(()=>d.querySelector('.expense-status')?.textContent.includes('已讀取'));
  assert.equal(d.title,'租屋管理 | 每月支出');assert(d.querySelector('.expense-manager').textContent.includes('展示用支出與收據皆為虛構'));assert(d.querySelector('.expense-total').textContent.includes('1,103'));visibleDisabled('新增支出');assert.equal(demoImages,originalImages);
  const expenseYear=Number(d.querySelector('.expense-controls select').value),expenseMonth=Number(d.querySelectorAll('.expense-controls select')[1].value),fakeExpenses=(await rpc('getExpenses',[expenseYear,expenseMonth])).data;
  assert.equal(fakeExpenses.rows.length,4);assert.equal(fakeExpenses.total,1103);assert(fakeExpenses.rows.every(r=>r.notes.includes('虛構')));assert.equal((await rpc('saveExpense',[])).status,403);
  d.querySelector('.expense-table tbody tr').click();await w.Vue.nextTick();visibleDisabled('編輯');visibleDisabled('作廢支出');[...d.querySelectorAll('.expense-detail button')].find(b=>b.textContent.includes('查看收據')).click();await wait(()=>d.querySelector('dialog img'));assert.equal(demoImages,originalImages+1);d.querySelector('[aria-label="關閉圖片預覽"]').click();await wait(()=>!d.querySelector('dialog[open]'));
  [...d.querySelectorAll('.expense-detail button')].find(b=>b.textContent==='檢視明細').click();await wait(()=>d.querySelector('.expense-form'));for(const e of d.querySelectorAll('.expense-fields input,.expense-fields textarea'))assert(e.disabled);visibleDisabled('預覽儲存');visibleDisabled('作廢這筆支出');
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log('PASS: actual published snapshot artifact shows management controls disabled rather than hidden, opens readonly property/reconciliation views; original snapshot retained with deposit-free monthly cash/report projections; null/zero and meter records retained; synthetic people/expenses only; readonly expense details and on-click gallery; no external API/image requests or writes.');
 }finally{dom.window.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
