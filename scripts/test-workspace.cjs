const fs = require('node:fs'), assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const wait = async fn => { const start = Date.now(); while (!fn()) { if (Date.now() - start > 4000) throw Error('timeout'); await new Promise(r => setTimeout(r, 5)); } };
const click = (d, text) => { const b = [...d.querySelectorAll('button')].find(b => b.textContent.trim() === text); assert(b, 'missing button ' + text); b.click(); };
(async () => {
  let logo={version:'',dataUrl:''},logoSaveFails=false;
  const logoPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==';
  const properties={revision:0,workspaceName:'測試工作區',items:[{id:'default',name:'測試房產',archived:false,folderUrl:''}]};
  const calls = [], errors = []; let writes = 0, conflict = false, propertyReadFailures = 1;
  const rows = [{ room:'401',version:'v1',name:'測試甲', phone:'0912345678', rent:5800, endDate:'2027-01-01', notes:'',contractLinks:[] },
    {room:'506',name:'',phone:'',rent:0,notes:'',contractLinks:[]},{room:'408',name:'',rent:null,vacant:true,contractLinks:[]}];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const html = fs.readFileSync('public/index.html','utf8').replace(/<script[^>]+src=[^>]+><\/script>/g,'');
  const dom = new JSDOM(html,{url:'https://rent.test/',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){
    w.Storage.prototype.setItem=()=>{writes++};
    w.fetch=async (url,options)=>{
      if(url==='/api/session')return {ok:true,status:200,json:async()=>({ok:true,data:{authenticated:true,canWrite:true,role:'manager',email:'owner@example.test',provider:'sites',logoutPath:'/signout-with-chatgpt'}})};
      const call=JSON.parse(options.body);calls.push({url,...call}); let data;
      if(call.action==='getWorkspaceLogo')data=logo;
      else if(call.action==='saveWorkspaceLogo'){assert.equal(call.args[1],logo.version);logo={version:'a'.repeat(43),dataUrl:call.args[0]};if(logoSaveFails){logoSaveFails=false;throw Error('Synthetic result unknown');}data=logo;}
      else if(call.action==='getRentalProperties'){if(propertyReadFailures-->0)return {ok:false,status:503,json:async()=>({ok:false,error:{code:'GOOGLE_UNAVAILABLE',message:'測試：房產清單連線中斷'}})};data=properties;}
 else if(call.action==='saveRentalProperty'){const [mode,id,name,workspace,folder,revision]=call.args;assert.equal(revision,properties.revision);if(mode==='workspace')properties.workspaceName=workspace;else if(mode==='create')properties.items.push({id,name,archived:false,folderUrl:folder});else if(mode==='delete')properties.items.find(p=>p.id===id).archived=true;else throw Error('unexpected property write');properties.revision++;data=properties;}
 else if(call.action==='getRoomSetupState')data={confirmed:true,count:3,version:'setup',rooms:[]};
 else if(call.action==='getTenantData') data=call.propertyId==='default'?rows:[];
      else if(call.action==='saveTenantChanges') {
        if(conflict)return {ok:false,json:async()=>({ok:false,error:{message:'其他人已更新，請重新讀取'}})};
        const row=rows.find(t=>t.room===call.args[0]);assert.equal(call.args[2],row.version);Object.assign(row,call.args[1]);row.version+='x';data=row;
      } else if(call.action==='getAvailableBillingYears')data=[2026];
      else if(call.action==='getAvailableBillingMonths')data=[10,11,12];
      else if(call.action==='getMonthlyAccounts')data=[{year:call.args[0],month:call.args[1],room:'401',name:'測試甲',rent:5800,electricityFee:600,totalDue:6400,transferDate:'',transferLastFive:'01234',notes:'',meter:call.args[1]%2?{previousReading:1000,currentReading:1120,previousReadingDate:'2026-09-01',currentReadingDate:'2026-11-01',usage:120,calculatedFee:600}:null}];
      else if(call.action==='saveMonthlyAccountField')data={value:call.args[4]};
      else throw Error('unexpected '+call.action);
      return {ok:true,json:async()=>JSON.parse(JSON.stringify({ok:true,data}))};
    };
  }}); const w=dom.window,d=w.document;
  for(const file of ['tenant-vue.global.prod.js','access-session.js','workspace-transport.js','native-tenant.js','photo-preview.js', 'meter-worksheet.js','notice-renderer.js','notice-zip.js','notice-batch.js','payment-worksheet.js','native-billing.js','report-data.js','report-charts.js','rental-reports.js','workspace.js'])w.eval(fs.readFileSync('public/'+file,'utf8'));
  await wait(()=>d.querySelectorAll('.room-card').length===3);assert(d.querySelector('nav button').textContent.includes('房間總覽'),'Home defaults to overview');
  assert(d.body.textContent.includes('房產清單讀取失敗：測試：房產清單連線中斷'));assert(!d.body.textContent.includes('請更新 Apps Script'));assert(d.querySelector('#property-select').textContent.includes('清單暫不可用'));assert([...d.querySelectorAll('button')].find(b=>b.textContent==='管理房產與工作區').disabled);
  await wait(()=>[...d.querySelectorAll('button')].some(b=>b.textContent==='重讀房產清單'&&!b.disabled));click(d,'重讀房產清單');await wait(()=>d.querySelector('#property-select').textContent.includes('測試房產'));assert.equal(calls.filter(c=>c.action==='getRentalProperties').length,2);assert(!d.body.textContent.includes('房產清單讀取失敗：'));assert(![...d.querySelectorAll('button')].some(b=>b.textContent==='重讀房產清單'));
  assert.equal(d.querySelectorAll('nav button').length,4); assert(!d.querySelector('iframe'));
  assert(!d.body.textContent.includes('青禾'));assert(!d.body.textContent.includes('示範'));
  assert(d.querySelector('.stats').textContent.includes('408 房'));assert(!d.querySelector('.stats').textContent.includes('合約資料夾'));
  const zeroCard=d.querySelector('[aria-label="查看 506 房"]');assert(zeroCard.textContent.includes('NT$ 0'));assert.equal(d.querySelector('.stats article:last-child div').textContent.trim(),'1間');
  zeroCard.click();await wait(()=>d.querySelector('#tenant-506-rent'));
  assert.equal(d.querySelector('#tenant-506-rent').value,'0');
  d.querySelector('[aria-label="選擇 401 房"]').click();await wait(()=>d.querySelector('#tenant-401-phone'));
  let phone=d.querySelector('#tenant-401-phone');assert.equal(phone.value,'0912-345-678');phone.value='0987654321';phone.dispatchEvent(new w.Event('input',{bubbles:true}));
  await wait(()=>d.querySelector('.draft-notice'));
  d.querySelector('nav button').click();await wait(()=>d.body.textContent.includes('有未儲存的修改'));assert(d.querySelector('#tenant-401-phone'));
  click(d,'儲存全部修改');await wait(()=>d.querySelector('.status').textContent.includes('全部修改已儲存'));phone=d.querySelector('#tenant-401-phone');
  assert.deepEqual(calls.find(c=>c.action==='saveTenantChanges'),{url:'/api/tenant-rpc',propertyId:'default',action:'saveTenantChanges',args:['401',{phone:'0987-654-321',identity:'一般'},'v1']});
  // Conflict leaves the user's draft present and blocks navigation until restore.
  conflict=true;phone.value='0900000000';phone.dispatchEvent(new w.Event('input',{bubbles:true}));await wait(()=>d.querySelector('.draft-notice'));click(d,'儲存全部修改');await wait(()=>d.querySelector('.status').textContent.includes('其他人已更新'));assert.equal(phone.value,'0900000000');click(d,'還原全部未儲存');await wait(()=>!d.querySelector('.draft-notice'));
  const accountNav=[...d.querySelectorAll('nav button')].find(b=>b.textContent.includes('每月帳務'));accountNav.click();
  await wait(()=>d.querySelector('.billing-native')?.textContent.includes('已讀取 1 筆帳務'));
  assert(!d.querySelector('iframe'));assert(calls.some(c=>c.url==='/api/billing-rpc'&&c.action==='getMonthlyAccounts'));
  let month=d.querySelector('#month');month.value='11';month.dispatchEvent(new w.Event('change',{bubbles:true}));
  await wait(()=>d.querySelector('.billing-native')?.textContent.includes('11 月｜已讀取'));
  assert(d.querySelector('.billing-native').textContent.includes('電表抄錄與通知'));assert(!d.querySelector('[aria-label="401 房本期電表"]'));
  assert(!d.querySelector('.billing-native a[href*="notice.html"]'));click(d,'電表抄錄與通知');await wait(()=>d.querySelector('.meter-sheet'));assert(d.querySelector('.meter-sheet a[href*="notice.html"]').href.includes('room=401'));click(d,'帳務資料');await w.Vue.nextTick();
  click(d,'實際對帳');await wait(()=>d.querySelector('.payment-sheet'));await wait(()=>!d.querySelector('[aria-label="401 房轉帳後五碼"]').disabled);
  const bank=d.querySelector('[aria-label="401 房轉帳後五碼"]');assert(bank);assert.equal(bank.value,'01234');
  bank.value='00001';bank.dispatchEvent(new w.Event('input',{bubbles:true}));await wait(()=>d.querySelector('.draft-notice'));click(d,'儲存對帳資料');await wait(()=>!d.querySelector('.reconciliation-dialog'));
  assert.deepEqual(calls.find(c=>c.action==='saveMonthlyAccountField'&&c.args[3]==='transferLastFive').args,[2026,11,'401','transferLastFive','00001','01234']);
  await wait(()=>![...d.querySelectorAll('button')].find(b=>b.textContent==='管理房產與工作區').disabled);click(d,'管理房產與工作區');await w.Vue.nextTick();assert(d.querySelector('#property-select').disabled);
  const workspaceInput=d.querySelector('[aria-label="工作區名稱"]');workspaceInput.value='我的管理工作區';workspaceInput.dispatchEvent(new w.Event('input',{bubbles:true}));await w.Vue.nextTick();click(d,'儲存工作區名稱');await wait(()=>properties.workspaceName==='我的管理工作區');assert(!d.querySelector('.property-picker label'),'Workspace title removed; property selector keeps its accessible name');
  await wait(()=>!d.querySelector('[aria-label="選擇工作區 Logo 圖片"]').disabled);
  w.createImageBitmap=async()=>({width:1000,height:300,close(){}});w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});w.HTMLCanvasElement.prototype.toDataURL=()=>logoPng;
  const logoInput=d.querySelector('[aria-label="選擇工作區 Logo 圖片"]');Object.defineProperty(logoInput,'files',{configurable:true,value:[new w.File(['synthetic logo'],'logo.png',{type:'image/png'})]});logoInput.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>d.querySelector('[alt="尚未儲存的 Logo 預覽"]'));assert(!d.querySelector('.brand img'),'Draft does not replace the shared logo');assert(!calls.some(c=>c.action==='saveWorkspaceLogo'));
  logoSaveFails=true;click(d,'上傳並套用 Logo');await wait(()=>d.querySelector('.workspace-logo-editor').textContent.includes('未能確認'));assert.equal(calls.filter(c=>c.action==='saveWorkspaceLogo').length,1);assert([...d.querySelectorAll('button')].find(b=>b.textContent==='上傳並套用 Logo').disabled);click(d,'重新讀取共用 Logo');await wait(()=>d.querySelector('.brand img'));assert.equal(d.querySelector('.brand img').src,logoPng);assert(d.querySelector('[alt="尚未儲存的 Logo 預覽"]'),'Readback preserves draft after uncertainty');click(d,'上傳並套用 Logo');await wait(()=>!d.querySelector('[alt="尚未儲存的 Logo 預覽"]'));assert.equal(calls.filter(c=>c.action==='saveWorkspaceLogo').length,2);
  await wait(()=>!d.querySelector('[aria-label="新增房產名稱"]').disabled);const propertyName=d.querySelector('[aria-label="新增房產名稱"]');propertyName.value='第二處測試房產';propertyName.dispatchEvent(new w.Event('input',{bubbles:true}));await w.Vue.nextTick();click(d,'新增房產');await wait(()=>d.querySelector('#property-select').options.length===2);const createdId=properties.items[1].id;assert(/^p-/.test(createdId));click(d,'關閉房產設定');await w.Vue.nextTick();
  const propertySelect=d.querySelector('#property-select');propertySelect.value=createdId;propertySelect.dispatchEvent(new w.Event('change',{bubbles:true}));await w.Vue.nextTick();await wait(()=>![...d.querySelectorAll('button')].find(b=>b.textContent==='管理房產與工作區').disabled);[...d.querySelectorAll('nav button')].find(b=>b.textContent.includes('房間總覽')).click();await wait(()=>d.querySelector('.overview-status')?.textContent.includes('已讀取 0 間'));assert.equal(d.querySelectorAll('.room-card').length,0);assert(calls.some(c=>c.action==='getTenantData'&&c.propertyId===createdId));
  click(d,'管理房產與工作區');await w.Vue.nextTick();const propertyRows=[...d.querySelectorAll('.property-editor article')];[...propertyRows[1].querySelectorAll('button')].find(b=>b.textContent==='刪除房產').click();await w.Vue.nextTick();click(d,'確認刪除並封存');await wait(()=>d.querySelectorAll('.room-card').length===3);assert.equal(d.querySelector('#property-select').value,'default');assert.equal(properties.items[1].archived,true);
  assert.equal(d.querySelector('.brand img').src,logoPng,'Logo persists across property switch/archive');assert.equal(calls.filter(c=>c.action==='getWorkspaceLogo').length,2,'Property changes reuse one workspace logo');
  assert.equal(writes,0); assert.equal(d.querySelector('#workspace-error').hidden,true);assert.deepEqual(errors,[]);
  dom.window.close();
  // No duplicate UI, and old editor bookmarks route back to this workspace.
  const worker=fs.readFileSync('worker/index.js','utf8');assert(worker.includes('Response.redirect'));assert(!html.includes('app.js'));assert(!html.includes('青禾'));
  for(const file of ['style.css','native-editors.css','workspace.css'])for(const match of fs.readFileSync('public/'+file,'utf8').matchAll(/font-size\s*:\s*([\d.]+)(px|rem)/g))assert(Number(match[1])>=(match[2]==='px'?16:1),file+' small font '+match[0]);
  console.log('PASS: native original workspace, one Google source, zero rent, selected room, optimistic saves, conflicts and dirty navigation, live billing/meter/notice, leading zeros, no localStorage, no duplicate iframe editors, minimum 16px.');
})().catch(e=>{console.error(e);process.exit(1)});
