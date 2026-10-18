const fs = require('node:fs'), assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const wait = async fn => { const start = Date.now(); while (!fn()) { if (Date.now() - start > 4000) throw Error('timeout'); await new Promise(r => setTimeout(r, 5)); } };
const click = (d, text) => { const b = [...d.querySelectorAll('button')].find(b => b.textContent.trim() === text); assert(b, 'missing button ' + text); b.click(); };
(async () => {
  const calls = [], errors = []; let writes = 0, conflict = false;
  const rows = [{ room:'401', name:'測試甲', phone:'0912345678', rent:5800, endDate:'2027-01-01', notes:'',contractLinks:[] },
    {room:'506',name:'',phone:'',rent:0,notes:'',contractLinks:[]}];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const html = fs.readFileSync('public/index.html','utf8').replace(/<script[^>]+src=[^>]+><\/script>/g,'');
  const dom = new JSDOM(html,{url:'https://rent.test/',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){
    w.Storage.prototype.setItem=()=>{writes++};
    w.fetch=async (url,options)=>{
      if(url==='/api/session')return {ok:true,status:200,json:async()=>({ok:true,data:{authenticated:true,canWrite:true,role:'manager',email:'owner@example.test',provider:'sites',logoutPath:'/signout-with-chatgpt'}})};
      const call=JSON.parse(options.body);calls.push({url,...call}); let data;
      if(call.action==='getTenantData') data=rows;
      else if(call.action==='saveTenantField') {
        if(conflict)return {ok:false,json:async()=>({ok:false,error:{message:'其他人已更新，請重新讀取'}})};
        const value=call.args[1]==='initialMeterReading'?(call.args[2]===''?null:Number(call.args[2])):call.args[2];rows.find(t=>t.room===call.args[0])[call.args[1]]=value; data={value};
      } else if(call.action==='getAvailableBillingYears')data=[2026];
      else if(call.action==='getAvailableBillingMonths')data=[10,11,12];
      else if(call.action==='getMonthlyAccounts')data=[{year:call.args[0],month:call.args[1],room:'401',name:'測試甲',rent:5800,electricityFee:600,totalDue:6400,transferDate:'',transferLastFive:'01234',notes:'',meter:call.args[1]%2?{previousReading:1000,currentReading:1120,previousReadingDate:'2026-09-01',currentReadingDate:'2026-11-01',usage:120,calculatedFee:600}:null}];
      else if(call.action==='saveMonthlyAccountField')data={value:call.args[4]};
      else throw Error('unexpected '+call.action);
      return {ok:true,json:async()=>JSON.parse(JSON.stringify({ok:true,data}))};
    };
  }}); const w=dom.window,d=w.document;
  for(const file of ['tenant-vue.global.prod.js','access-session.js','workspace-transport.js','native-tenant.js','meter-worksheet.js','notice-renderer.js','notice-zip.js','notice-batch.js','payment-worksheet.js','native-billing.js','report-data.js','report-charts.js','rental-reports.js','workspace.js'])w.eval(fs.readFileSync('public/'+file,'utf8'));
  await wait(()=>d.querySelectorAll('.room-card').length===2);
  assert.equal(d.querySelectorAll('nav button').length,4); assert(!d.querySelector('iframe'));
  assert(!d.body.textContent.includes('青禾'));assert(!d.body.textContent.includes('示範'));
  const zeroCard=d.querySelector('[aria-label="查看 506 房"]');assert(zeroCard.textContent.includes('NT$ 0'));assert(!zeroCard.textContent.includes('空房'));
  zeroCard.click();await wait(()=>d.querySelector('#tenant-506-rent'));
  assert.equal(d.querySelector('#tenant-506-rent').value,'0');
  d.querySelector('[aria-label="選擇 401 房"]').click();await wait(()=>d.querySelector('#tenant-401-phone'));
  let phone=d.querySelector('#tenant-401-phone');phone.value='0987654321';phone.dispatchEvent(new w.Event('input',{bubbles:true}));
  await wait(()=>d.querySelector('.draft-notice'));
  d.querySelector('nav button').click();await wait(()=>d.body.textContent.includes('有未儲存的修改'));assert(d.querySelector('#tenant-401-phone'));
  click(phone.closest('.editor'),'儲存');await wait(()=>phone.closest('.editor').textContent.includes('已儲存'));
  assert.deepEqual(calls.find(c=>c.action==='saveTenantField'),{url:'/api/tenant-rpc',action:'saveTenantField',args:['401','phone','0987654321','0912345678']});
  // Optional room type: explicit enum, original-value conflict check and overview refresh.
  const roomType=d.querySelector('#tenant-401-roomType');assert.equal(roomType.value,'');
  assert.deepEqual([...roomType.options].map(o=>o.value),['','套房','雅房']);
  roomType.value='套房';roomType.dispatchEvent(new w.Event('change',{bubbles:true}));
  await wait(()=>d.querySelector('.draft-notice'));click(roomType.closest('.editor'),'儲存');
  await wait(()=>roomType.closest('.editor').textContent.includes('已儲存'));
  assert.deepEqual(calls.find(c=>c.args?.[1]==='roomType'),{url:'/api/tenant-rpc',action:'saveTenantField',args:['401','roomType','套房','']});
  roomType.value='雅房';roomType.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>d.querySelector('.draft-notice'));
  click(roomType.closest('.editor'),'還原');await wait(()=>roomType.value==='套房'&&!d.querySelector('.draft-notice'));
  conflict=true;roomType.value='雅房';roomType.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>d.querySelector('.draft-notice'));
  click(roomType.closest('.editor'),'儲存');await wait(()=>roomType.closest('.editor').textContent.includes('其他人已更新'));
  assert.equal(roomType.value,'雅房');click(roomType.closest('.editor'),'還原');await wait(()=>!d.querySelector('.draft-notice'));
  conflict=false;
  const initial=d.querySelector('#tenant-401-initialMeterReading');assert(initial);assert.equal(initial.value,'');
  initial.value='0';initial.dispatchEvent(new w.Event('input',{bubbles:true}));await wait(()=>d.querySelector('.draft-notice'));click(initial.closest('.editor'),'儲存');await wait(()=>initial.closest('.editor').textContent.includes('已儲存'));
  assert.deepEqual(calls.find(c=>c.args?.[1]==='initialMeterReading').args,['401','initialMeterReading','0',null]);assert.equal(rows[0].initialMeterReading,0);
  const signing=d.querySelector('#tenant-401-contractDate');signing.value='2026-08-15';signing.dispatchEvent(new w.Event('input',{bubbles:true}));await wait(()=>d.querySelector('.draft-notice'));click(signing.closest('.editor'),'儲存');await wait(()=>signing.closest('.editor').textContent.includes('已儲存'));
  assert.deepEqual(calls.find(c=>c.args?.[1]==='contractDate').args,['401','contractDate','2026-08-15','']);
  // Conflict leaves the user's draft present and blocks navigation until restore.
  conflict=true;phone.value='0900000000';phone.dispatchEvent(new w.Event('input',{bubbles:true}));await wait(()=>phone.closest('.editor').textContent.includes('還原'));click(phone.closest('.editor'),'儲存');await wait(()=>phone.closest('.editor').textContent.includes('其他人已更新'));assert.equal(phone.value,'0900000000');click(phone.closest('.editor'),'還原');await wait(()=>!d.querySelector('.draft-notice'));
  [...d.querySelectorAll('nav button')].find(b=>b.textContent.includes('房間總覽')).click();
  await wait(()=>d.querySelector('[aria-label="查看 401 房"]')?.textContent.includes('套房'));
  const accountNav=[...d.querySelectorAll('nav button')].find(b=>b.textContent.includes('每月帳務'));accountNav.click();
  await wait(()=>d.querySelector('.billing-native')?.textContent.includes('已讀取 1 筆帳務'));
  assert(!d.querySelector('iframe'));assert(calls.some(c=>c.url==='/api/billing-rpc'&&c.action==='getMonthlyAccounts'));
  let month=d.querySelector('#month');month.value='11';month.dispatchEvent(new w.Event('change',{bubbles:true}));
  await wait(()=>d.querySelector('.billing-native')?.textContent.includes('11 月｜已讀取'));
  assert(d.querySelector('.billing-native').textContent.includes('電表抄錄表'));assert(!d.querySelector('[aria-label="401 房本期電表"]'));
  assert(d.querySelector('.billing-native a[href*="notice.html"]').href.includes('room=401'));
  click(d,'匯款截圖');await wait(()=>d.querySelector('.payment-sheet'));
  const bank=d.querySelector('[aria-label="401 房轉帳後五碼"]');assert(bank);assert.equal(bank.value,'01234');
  bank.value='00001';bank.dispatchEvent(new w.Event('input',{bubbles:true}));await wait(()=>d.querySelector('.draft-notice'));click(d,'儲存全部收款資料');await wait(()=>d.querySelector('.payment-status').textContent.includes('已儲存 1 間'));
  assert.deepEqual(calls.find(c=>c.action==='saveMonthlyAccountField'&&c.args[3]==='transferLastFive').args,[2026,11,'401','transferLastFive','00001','01234']);
  assert.equal(writes,0); assert.equal(d.querySelector('#workspace-error').hidden,true);assert.deepEqual(errors,[]);
  dom.window.close();
  // No duplicate UI, and old editor bookmarks route back to this workspace.
  const worker=fs.readFileSync('worker/index.js','utf8');assert(worker.includes('Response.redirect'));assert(!html.includes('app.js'));assert(!html.includes('青禾'));
  for(const file of ['style.css','native-editors.css','workspace.css'])for(const match of fs.readFileSync('public/'+file,'utf8').matchAll(/font-size\s*:\s*([\d.]+)(px|rem)/g))assert(Number(match[1])>=(match[2]==='px'?16:1),file+' small font '+match[0]);
  console.log('PASS: native original workspace, one Google source, zero rent, selected room, optimistic saves, conflicts and dirty navigation, live billing/meter/notice, leading zeros, no localStorage, no duplicate iframe editors, minimum 16px.');
})().catch(e=>{console.error(e);process.exit(1)});
