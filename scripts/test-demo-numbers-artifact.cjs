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
 const errors=[],external=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html.replace(/<script[^>]+src=[^>]+><\/script>/g,''),{url:'https://demo.test/rental_management/',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){w.Response=Response;w.fetch=async url=>{external.push(String(url));throw Error('Unexpected external request');};w.Storage.prototype.setItem=()=>{throw Error('Demo must not persist data');};}});
 try{
  const w=dom.window,d=w.document;
  for(const file of files)w.eval(fs.readFileSync(path.join(root,file.replace(/^\.\//,'')),'utf8'));
  await wait(()=>d.querySelectorAll('.room-card').length===snapshot.tenants.length);
  const rpc=async(action,args=[],scope='billing')=>{const response=await w.fetch('/api/'+scope+'-rpc',{method:'POST',body:JSON.stringify({action,args})});return {status:response.status,...await response.json()};};
  assert.equal(w.RentalAccess.canWrite,false);
  const publishedYear=Number(snapshot.capturedAt.slice(0,4));assert.equal(snapshot.periods.filter(p=>p.year===publishedYear).length,12,'Published current-year snapshot includes all months');
  assert.deepEqual((await rpc('getAvailableBillingYears')).data,[...new Set(snapshot.periods.map(p=>p.year))].sort((a,b)=>b-a));
  const tenants=(await rpc('getTenantData',[],'tenant')).data;
  for(const t of tenants){assert(!t.name||t.name.startsWith('示範房客'));assert(t.registeredAddress.includes('示範'));}
  for(const period of snapshot.periods){
   const rows=(await rpc('getMonthlyAccounts',[period.year,period.month])).data;assert.equal(rows.length,period.accounts.length);
   for(const original of period.accounts){const row=rows.find(a=>a.room===original.room);for(const [key,value] of Object.entries(original))assert.deepEqual(row[key],value,'Snapshot field differs: '+key);assert(['空房',''].includes(row.name)||row.name.startsWith('示範房客'));assert.equal(row.paymentScreenshot,'');}
  }
  for(const report of snapshot.reports){const actual=(await rpc('getXingwuCollectionReport',[report.year])).data;for(const [key,value] of Object.entries(report))assert.deepEqual(actual[key],value);}
  assert.equal((await rpc('saveMonthlyAccountField',[2026,1,'401','actualPaid','1',null])).status,403);
  assert.equal((await rpc('saveTenantChanges',['401',{name:'changed'},'demo-401'],'tenant')).status,403);
  const nav=label=>[...d.querySelectorAll('nav button')].find(b=>b.textContent.includes(label)).click();
  const visibleDisabled=label=>{const button=[...d.querySelectorAll('button')].find(b=>b.textContent.trim()===label);assert(button,'Missing management control: '+label);assert(!button.hidden,'Management control must remain visible: '+label);assert(button.disabled,'Demo mutation must stay disabled: '+label);};
  assert(d.querySelector('.access-identity form button').disabled);
  const manage=d.querySelector('.property-picker button');assert(!manage.hidden&&!manage.disabled);manage.click();await wait(()=>d.querySelector('.property-editor'));
  for(const label of ['儲存工作區名稱','上傳並套用 Logo','儲存房產','新增房產','儲存房號／房型'])visibleDisabled(label);
  const logo=d.querySelector('[aria-label="選擇工作區 Logo 圖片"]');assert(logo&&!logo.hidden&&logo.disabled);manage.click();await wait(()=>!d.querySelector('.property-editor'));
  nav('房客資料');await wait(()=>d.querySelector('.tenant-batch-actions'));
  const occupied=snapshot.tenants.find(t=>!t.vacant);if(occupied){const room=[...d.querySelectorAll('.room-button')].find(b=>b.textContent.trim().startsWith(occupied.room));assert(room);room.click();await wait(()=>d.querySelector('#tenant-'+occupied.room+'-rent'));}
  for(const label of ['儲存全部修改','還原全部未儲存','退租','確認入住與更新帳務','同步帳務姓名'])visibleDisabled(label);
  if(occupied)assert(d.querySelector('.renewal-controls button')&&!d.querySelector('.renewal-controls button').disabled);

  nav('每月帳務');await wait(()=>d.querySelector('.billing-native')?.textContent.includes('已讀取'));
  assert(!d.querySelector('#initializeMonth')||d.querySelector('#initializeMonth').hidden);assert(!d.querySelector('#toggleCreation')||d.querySelector('#toggleCreation').hidden);
  const open=d.querySelector('.reconciliation-action-cell button');assert(open&&!open.disabled);open.click();await wait(()=>d.querySelector('.reconciliation-dialog'));visibleDisabled('儲存對帳資料');assert(d.querySelector('.reconciliation-dialog [aria-label$="實際對帳金額"]').readOnly);d.querySelector('[aria-label="關閉實際對帳"]').click();await wait(()=>!d.querySelector('.reconciliation-dialog'));
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log('PASS: actual published snapshot artifact shows management controls disabled rather than hidden, opens readonly property/reconciliation views; all source numbers, null/zero, meter records and reports unchanged; synthetic people only; no API/image requests or writes.');
 }finally{dom.window.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
