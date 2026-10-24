const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const source=fs.readFileSync('public/google-accounts.html','utf8');
const vue=fs.readFileSync('public/tenant-vue.global.prod.js','utf8');
new vm.Script(source.match(/<script>\s*([\s\S]*?)<\/script>/)[1]);
const errors=[],virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e.message));
function mock(){
  const base={year:2026,room:'401',name:'demo',dueDate:'',rent:5800,electricityFee:600,totalDue:6400,
    transferDate:'',transferLastFive:'01234',paymentScreenshot:'',notes:'',meter:null};
  const state=window.mockState={calls:[],years:[2026],monthsByYear:{},otherEntries:{},months:[9,10,11,12],count:0,fail:null,hold:null,waiting:[],
    photos:[{id:'photo1',name:'401.jpg'}],selection:{fileIds:['missing'],value:'https://drive.google.com/file/d/missing/view'},
    entries:{10:{...base,month:10,electricityFee:null,totalDue:5800},
      11:{...base,month:11,meter:{previousReadingDate:'2026-09-01',previousReading:1000,
        currentReadingDate:'2026-11-01',currentReading:1120,usage:120,calculatedFee:600}},
      12:{...base,month:12,rent:0,electricityFee:'',totalDue:0,meter:undefined}}};
  const summary=(year,month)=>({year,month,rooms:1,names:0,rents:state.count,zeroRents:0,defaults:0,meters:0,
    missingTenants:0,missingRents:0,missingDefaults:0,missingMeters:0,preservedCells:0,warnings:[]});
  function getAccount(year,month){
    if(year===2026)return state.entries[month];
    if(!state.otherEntries[year])state.otherEntries[year]={};
    return state.otherEntries[year][month] ||= {...base,year,month,electricityFee:month%2?600:null,
      totalDue:month%2?6400:5800,meter:month%2?{...state.entries[11].meter}:null};
  }
  function runner(success=()=>{},failure=()=>{}){
    const out={withSuccessHandler:cb=>runner(cb,failure),withFailureHandler:cb=>runner(success,cb)};
    ['getRentalSiteCapabilities','getAvailableBillingYears','previewMonthlyAccountsSheetCreation','createMonthlyAccountsSheet','getAvailableBillingMonths','getMonthlyAccounts','saveMonthlyAccountField','previewMonthlyInitialization',
      'initializeMonthlyAccounts','getMonthlyPaymentPhotos','getRoomPaymentPhotoSelection','saveRoomPaymentPhotoSelection',
      'getPaymentPhoto','getMeterPhoto'].forEach(name=>out[name]=(...args)=>{
      state.calls.push({name,args});
      const respond=()=>{
        if(state.fail===name){failure({message:'DEMO failure'});return;}
        let result;
        if(name==='getRentalSiteCapabilities')result={version:2,billing:true};
        else if(name==='previewMonthlyAccountsSheetCreation'){
          if((state.monthsByYear[args[0]]||state.months).includes(args[1])){failure({message:'分頁已存在'});return;}
          result={year:args[0],month:args[1],rooms:1,odd:args[1]%2===1};
        }else if(name==='createMonthlyAccountsSheet'){
          if((state.monthsByYear[args[0]]||state.months).includes(args[1])){failure({message:'分頁已存在'});return;}
          (state.monthsByYear[args[0]]||state.months).push(args[1]);
          if(args[0]===2026)state.entries[args[1]]={...base,month:args[1],rent:null,totalDue:null};
          else {if(!state.otherEntries[args[0]])state.otherEntries[args[0]]={};state.otherEntries[args[0]][args[1]]={...base,year:args[0],month:args[1],rent:null,totalDue:null};}
          result={year:args[0],month:args[1],rooms:1};
        }else if(name==='getAvailableBillingYears')result=state.years;
        else if(name==='getAvailableBillingMonths')result=state.monthsByYear[args[0]]||state.months;
        else if(name==='getMonthlyAccounts')result=[{...getAccount(args[0],args[1]),...(state.wrongYear?{year:2000}:{})}];
        else if(name==='previewMonthlyInitialization'||name==='initializeMonthlyAccounts')result=summary(args[0],args[1]);
        else if(name==='saveMonthlyAccountField'){
          const a=getAccount(args[0],args[1]),key=args[3];
          const value=key==='currentReading'?(args[4]===''?null:Number(args[4])):args[4].trim();
          if(['currentReading','currentReadingDate'].includes(key)){
            a.meter[key]=value;
            a.meter.usage=a.meter.currentReading===null?null:a.meter.currentReading-a.meter.previousReading;
            a.electricityFee=a.meter.usage===null?null:a.meter.usage*5;
            a.meter.calculatedFee=a.electricityFee;a.totalDue=a.electricityFee===null?null:a.rent+a.electricityFee;
          }else a[key]=value;
          result={value};
        } else if(name==='getMonthlyPaymentPhotos')result=state.photos;
        else if(name==='getRoomPaymentPhotoSelection')result=state.selection;
        else if(name==='saveRoomPaymentPhotoSelection'){
          state.selection={fileIds:args[3],value:args[3].map(id=>'https://drive.google.com/file/d/'+id+'/view').join('\n')};result=state.selection;
        }else if(name==='getPaymentPhoto')result={name:'401.jpg',dataUrl:'data:image/jpeg;base64,dGVzdA=='};
        else result={found:true,readingDate:'2026-11-01',dataUrl:'data:image/jpeg;base64,dGVzdA=='};
        success(JSON.parse(JSON.stringify(result)));
      };
      if(state.hold===name)state.waiting.push(respond);else setTimeout(respond,5);
    });return out;
  }
  window.google={script:{}};Object.defineProperty(window.google.script,'run',{get:()=>runner()});
}
const dom=new JSDOM(source.replaceAll('<?= appUrl ?>','https://example.test/exec')
  .replace(/<script[^>]+src=[^>]+><\/script>/g,''),{
  runScripts:'dangerously',url:'https://example.test/exec',virtualConsole,
  beforeParse(w){w.eval(vue);w.eval('('+mock.toString()+')()');}});
const w=dom.window,d=w.document,$=s=>d.querySelector(s),all=s=>[...d.querySelectorAll(s)];
const text=()=>d.body.textContent;
const btn=(parent,title)=>[...parent.querySelectorAll('button')].find(b=>b.textContent===title);
const input=(el,value)=>{el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
const byLabel=label=>d.querySelector('[aria-label="'+label+'"]');
async function wait(check){const started=Date.now();while(!check()){
  if(Date.now()-started>3000)throw new Error('timeout '+$('#boot-status').textContent+' / '+$('#status')?.textContent+' / '+$('#initialization-status')?.textContent);
  await new Promise(resolve=>setTimeout(resolve,5));}}
const ready=()=>$('#boot-status').hidden && !$('#previewInitialization').disabled;
async function month(value){$('#month').value=String(value);$('#month').dispatchEvent(new w.Event('change'));await wait(()=>$('#status').textContent.includes(value+' 月｜已讀取'));}
async function saveField(label,value){const el=byLabel(label);input(el,value);await wait(()=>btn(el.closest('.editor'),'還原'));btn(el.closest('.editor'),'儲存').click();return el;}
(async()=>{
  await wait(ready);assert.equal($('#month').value,'12');assert.equal($('#boot-status').hidden,true);
  assert(!d.querySelector('thead').textContent.includes('電費'));
  assert.equal(byLabel('12 月 401 房轉帳後五碼').value,'01234');
  assert(text().includes('0'));
  const normalName=w.mockState.entries[12].name;w.mockState.entries[12].vacant=true;w.mockState.entries[12].name='已退租的假姓名';$('#reload').click();await wait(()=>ready()&&d.querySelector('table tbody tr td').textContent.trim().startsWith('空房'));w.mockState.entries[12].vacant=false;w.mockState.entries[12].name=normalName;$('#reload').click();await wait(()=>ready()&&d.querySelector('table tbody tr td').textContent.trim().startsWith(normalName));
  $('#previewInitialization').click();await wait(()=>$('#initialization-status').textContent.includes('無需初始化'));
  assert.equal($('#initializeMonth').disabled,true);

  w.mockState.count=1;$('#previewInitialization').click();await wait(()=>!$('#initializeMonth').disabled);
  w.mockState.hold='initializeMonthlyAccounts';$('#initializeMonth').click();
  await wait(()=>$('#month').disabled);
  assert.equal(byLabel('12 月 401 房備註').disabled,true);
  w.mockState.hold=null;w.mockState.waiting.shift()();
  await wait(()=>$('#initialization-status').textContent==='初始化完成，帳務已重新讀取。');
  assert.equal(JSON.stringify(w.mockState.calls.find(c=>c.name==='initializeMonthlyAccounts').args),'[2026,12]');
  await month(11);
  assert(d.querySelector('thead').textContent.includes('電費通知'));
  const url=new URL($('.notice-link').href);assert.equal(url.searchParams.get('month'),'11');assert.equal(url.searchParams.get('room'),'401');

  let notes=byLabel('11 月 401 房備註');input(notes,'draft');
  await wait(()=>$('#month').disabled);assert.equal($('#reload').disabled,true);
  btn(notes.closest('.editor'),'還原').click();await wait(()=>!$('#month').disabled);

  // 保存抄表資料後，試算表公式結果會自動重新讀取。
  const readsBefore=w.mockState.calls.filter(c=>c.name==='getMonthlyAccounts').length;
  await saveField('11 月 401 房本期電表','1140');
  await wait(()=>w.mockState.calls.filter(c=>c.name==='getMonthlyAccounts').length>readsBefore&&ready());
  assert(d.querySelector('tbody').textContent.includes('6,500'));
  assert(d.querySelector('tbody').textContent.includes('700'));
  assert.equal(byLabel('11 月 401 房本期電表').value,'1140');

  // 其他草稿尚未儲存時不重載，不顯示舊金額作為有效金額。
  notes=byLabel('11 月 401 房備註');input(notes,'keep me');await wait(()=>$('#month').disabled);
  const beforeDraft=w.mockState.calls.filter(c=>c.name==='getMonthlyAccounts').length;
  await saveField('11 月 401 房本期電表','1160');
  await wait(()=>byLabel('11 月 401 房本期電表').closest('.editor').textContent.includes('已寫回'));
  assert.equal(w.mockState.calls.filter(c=>c.name==='getMonthlyAccounts').length,beforeDraft);
  assert.equal(byLabel('11 月 401 房備註').value,'keep me');
  assert.equal($('.notice-link'),null);assert(text().includes('待重新讀取'));
  btn(notes.closest('.editor'),'還原').click();await wait(()=>!$('#reload').disabled);
  $('#reload').click();await wait(()=>$('.notice-link')&&ready());assert($('.notice-link'));

  // 不可用的既有圖片仍列出，取消勾選後才會解除對應。
  btn(d,'讀取／管理匯款圖').click();await wait(()=>all('.photo-choice').length===2);
  let checks=all('.photo-choice input');assert.equal(checks[1].checked,true);
  assert.equal(btn(all('.photo-choice')[1],'預覽').disabled,true);
  checks[1].click();checks[0].click();await wait(()=>$('#month').disabled);
  btn(d,'儲存勾選結果').click();await wait(()=>!$('#month').disabled);
  assert.equal(w.mockState.calls.at(-1).name,'saveRoomPaymentPhotoSelection');
  assert.equal(w.mockState.calls.at(-1).args[4],'https://drive.google.com/file/d/missing/view');
  assert.equal(JSON.stringify(w.mockState.selection.fileIds),'["photo1"]');
  btn(d,'讀取／管理匯款圖').click();await wait(()=>all('.photo-choice').length===1&&!btn(d,'讀取／管理匯款圖').disabled&&$('.photo-picker .save-message').textContent.startsWith('當月圖片'));
  assert.equal($('.photo-choice input').checked,true);
  btn($('.photo-choice'),'預覽').click();await wait(()=>$('.photo-picker img'));
  assert($('.photo-picker .save-message').textContent.includes('自行核對'));

  btn(d,'載入照片').click();await wait(()=>$('.meter-photo img'));
  assert($('.meter-photo .save-message').textContent.includes('2026-11-01'));
  w.mockState.fail='saveMonthlyAccountField';
  await saveField('11 月 401 房轉帳後五碼','00123');
  await wait(()=>byLabel('11 月 401 房轉帳後五碼').closest('.editor').textContent.includes('DEMO failure'));
  assert.equal(byLabel('11 月 401 房轉帳後五碼').disabled,false);
  btn(byLabel('11 月 401 房轉帳後五碼').closest('.editor'),'還原').click();await wait(()=>!$('#month').disabled);
  w.mockState.fail=null;await month(10);
  assert(!d.querySelector('thead').textContent.includes('電費'));assert.equal($('.notice-link'),null);

  // 圖片勾選上限：第 21 張回復未勾選。
  w.mockState.selection={fileIds:[],value:''};w.mockState.photos=Array.from({length:21},(_,i)=>({id:'id'+i,name:'file'+i+'.jpg'}));
  btn(d,'讀取／管理匯款圖').click();await wait(()=>all('.photo-choice').length===21);
  checks=all('.photo-choice input');for(let i=0;i<21;i++)checks[i].click();
  await wait(()=>text().includes('最多選取 20'));
  assert.equal(all('.photo-choice input:checked').length,20);
  btn($('.photo-picker'),'還原').click();await wait(()=>!$('#reload').disabled);

  w.mockState.fail='previewMonthlyInitialization';$('#previewInitialization').click();
  await wait(()=>$('#initialization-status').textContent.includes('預覽失敗'));assert.equal($('#month').disabled,false);
  w.mockState.fail=null;$('#previewInitialization').click();await wait(()=>!$('#initializeMonth').disabled);
  w.mockState.fail='initializeMonthlyAccounts';$('#initializeMonth').click();
  await wait(()=>$('#initialization-status').textContent.includes('未能確認完成'));assert.equal($('#month').disabled,false);
  w.mockState.fail=null;$('#previewInitialization').click();await wait(()=>!$('#initializeMonth').disabled);
  w.mockState.fail='getMonthlyAccounts';$('#initializeMonth').click();
  await wait(()=>$('#initialization-status').textContent.includes('重新讀取失敗'));assert.equal($('#reload').disabled,false);
  w.mockState.fail='getAvailableBillingMonths';$('#reload').click();
  await wait(()=>$('#status').textContent.includes('讀取失敗')&&$('#month').value==='0'&&!$('#reload').disabled);assert.equal($('#reload').disabled,false);
  w.mockState.fail=null;$('#reload').click();await wait(ready);
  // Creation UI: explicit preview, existing months disabled, correct selected month after creation.
  $('#toggleCreation').click();await wait(()=>$('#new-month'));
  assert.equal($('#new-month').value,'0');
  assert.equal([...$('#new-month').options].find(option=>option.value==='12').disabled,true);
  assert.equal($('#createNewMonth').disabled,true);
  $('#new-month').value='8';$('#new-month').dispatchEvent(new w.Event('change'));
  await wait(()=>!$('#previewNewMonth').disabled);
  w.mockState.fail='previewMonthlyAccountsSheetCreation';$('#previewNewMonth').click();
  await wait(()=>$('#creation-status')?.textContent.includes('預覽失敗'));
  assert.equal($('#month').disabled,false);
  w.mockState.fail=null;$('#previewNewMonth').click();
  await wait(()=>!$('#createNewMonth').disabled);
  assert.equal(w.mockState.months.includes(8),false,'preview never creates');
  w.mockState.hold='createMonthlyAccountsSheet';$('#createNewMonth').click();
  await wait(()=>$('#month').disabled);
  assert.equal(byLabel('12 月 401 房備註').disabled,true);
  assert.equal($('#previewInitialization').disabled,true);
  w.mockState.hold=null;w.mockState.waiting.shift()();
  await wait(()=>$('#creation-status')?.textContent.includes('8 月已建立'));
  assert.equal($('#month').value,'8');assert.equal($('#creation-panel'),null);
  assert.equal(JSON.stringify(w.mockState.calls.find(call=>call.name==='createMonthlyAccountsSheet').args),'[2026,8]');
  $('#toggleCreation').click();await wait(()=>$('#new-month'));
  assert.equal([...$('#new-month').options].find(option=>option.value==='8').disabled,true);
  $('#new-month').value='7';$('#new-month').dispatchEvent(new w.Event('change'));
  await wait(()=>!$('#previewNewMonth').disabled);$('#previewNewMonth').click();
  await wait(()=>!$('#createNewMonth').disabled);
  // Changing the requested month invalidates the earlier preview.
  $('#new-month').value='6';$('#new-month').dispatchEvent(new w.Event('change'));
  await wait(()=>$('#createNewMonth').disabled);
  $('#previewNewMonth').click();await wait(()=>!$('#createNewMonth').disabled);
  w.mockState.fail='createMonthlyAccountsSheet';$('#createNewMonth').click();
  await wait(()=>$('#creation-status')?.textContent.includes('建立未能確認完成'));
  assert.equal($('#month').disabled,false);
  assert.equal($('#createNewMonth').disabled,true);
  assert.equal(w.mockState.calls.filter(call=>call.name==='createMonthlyAccountsSheet').length,2,'failed create is not automatically retried');
  // Newly registered years appear on reload without changing the current year.
  w.mockState.fail=null;w.mockState.years=[2026,2027];w.mockState.monthsByYear[2027]=[1,2];
  $('#reload').click();await wait(()=>$('#year').options.length===2&&ready());
  assert.equal($('#year').value,'2026');
  $('#year').value='2027';$('#year').dispatchEvent(new w.Event('change'));
  await wait(()=>$('#status').textContent.includes('2027 年 2 月｜已讀取'));
  assert.equal($('#month').value,'2');assert.equal($('#creation-panel'),null);
  assert.equal($('.photo-choice'),null,'old-year photo controls do not carry over');
  assert.equal(JSON.stringify(w.mockState.calls.filter(c=>c.name==='getMonthlyAccounts').at(-1).args),'[2027,2]');
  notes=byLabel('2 月 401 房備註');input(notes,'2027 note');
  await wait(()=>$('#year').disabled);btn(notes.closest('.editor'),'儲存').click();
  await wait(()=>!$('#year').disabled);
  assert.equal(w.mockState.calls.at(-1).args[0],2027,'save uses selected year');
  $('#toggleCreation').click();await wait(()=>$('#new-month'));
  $('#new-month').value='3';$('#new-month').dispatchEvent(new w.Event('change'));
  await wait(()=>!$('#previewNewMonth').disabled);$('#previewNewMonth').click();
  await wait(()=>!$('#createNewMonth').disabled);$('#createNewMonth').click();
  await wait(()=>$('#creation-status')?.textContent.includes('2027 年 3 月已建立'));
  assert.equal(JSON.stringify(w.mockState.calls.filter(c=>c.name==='createMonthlyAccountsSheet').at(-1).args),'[2027,3]');
  $('#previewInitialization').click();await wait(()=>!$('#initializeMonth').disabled);
  $('#initializeMonth').click();await wait(()=>$('#initialization-status').textContent==='初始化完成，帳務已重新讀取。');
  assert.equal(JSON.stringify(w.mockState.calls.filter(c=>c.name==='initializeMonthlyAccounts').at(-1).args),'[2027,3]');
  // The client rejects a response belonging to another year.
  w.mockState.wrongYear=true;$('#reload').click();
  await wait(()=>$('#status').textContent.includes('年份、月份或房號'));
  assert.equal($('#previewInitialization').disabled,true);
  w.mockState.wrongYear=false;w.mockState.fail='getAvailableBillingYears';$('#reload').click();
  await wait(()=>$('#year').value==='0'&&!$('#reload').disabled);
  assert.equal($('#toggleCreation').disabled,true);
  w.mockState.fail=null;w.mockState.years=[];$('#reload').click();
  await wait(()=>$('#status').textContent.includes('尚未設定年度'));
  assert.equal($('#reload').disabled,false);
  w.mockState.years=[2026,2027];$('#reload').click();
  await wait(()=>$('#status').textContent.includes('2027 年 3 月｜已讀取'));
  assert.equal($('#boot-status').hidden,true);assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('PASS: actual Vue mount; dynamic months; even/odd notice rules; zero/leading zeros; dirty/reset; initialization/locks/refresh/failures; correct RPC arguments; meter auto-refresh; other drafts preserved with stale amounts hidden; saved/missing photo selection; private image preview; 20-image limit; save conflicts; month-list recovery; creation preview; existing-month protection; creation locking; selected-month refresh; changed preview invalidation; failed creation recovery without retry; year discovery/switching; year-specific save/create/initialize; wrong-year response rejected; empty/failed year-list recovery; no DOM errors.');
  dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
