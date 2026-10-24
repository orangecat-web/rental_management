const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM,VirtualConsole}=require('jsdom');
const wait=async f=>{const start=Date.now();while(!f()){if(Date.now()-start>5000)throw Error('timeout');await new Promise(r=>setTimeout(r,3))}};
(async()=>{
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<div id="app"><meter-sheet v-if="visible" :accounts="rows" :year="2026" :month="9"></meter-sheet><payment v-if="visible" :accounts="rows" :year="2026" :month="9"></payment></div>',{url:'https://rental.test',runScripts:'dangerously',virtualConsole:vc});
 const w=dom.window,d=w.document;w.Storage.prototype.setItem=()=>{throw Error('no private persistence')};w.RentalPropertyContext={id:'default',name:'假房產'};w.open=()=>{throw Error('No browser popup or Drive navigation')};
 for(const f of ['tenant-vue.global.prod.js','photo-preview.js','meter-worksheet.js','payment-worksheet.js'])w.eval(fs.readFileSync('public/'+f,'utf8'));
 let meterCalls=0,paymentCalls=0,selectionCalls=0,listCalls=0,referenceCalls=0,fail=false,pending=null,date='2026-09-01',photoDate=date;
 const api={drivePreview:true,meterPhoto:async()=>{meterCalls++;return {found:true,readingDate:photoDate,dataUrl:'data:image/png;base64,eA=='}},meterPhotoReference:async()=>{referenceCalls++;return {found:true,id:'fake-meter',readingDate:date}},photos:async()=>{listCalls++;return [{id:'fake',name:'401.jpg'},{id:'second',name:'401-1.png'}]},selection:async()=>{selectionCalls++;return {fileIds:['fake'],value:'https://drive.google.com/file/d/fake/view'}},photo:async(y,m,id)=>{paymentCalls++;if(pending)return pending;if(fail)throw Error('測試讀取失敗');return {dataUrl:'data:image/png;base64,eA=='}}};
 let state;const row=()=>({year:2026,month:9,room:'401',name:'假房客',rent:1000,electricityFee:100,totalDue:1100,receiptSuggestedAmount:1100,receiptRecordedAmount:null,actualPaid:1000,isReceived:false,paymentScreenshot:'https://drive.google.com/file/d/fake/view',meter:{previousReading:100,currentReading:120,currentReadingDate:date}});
 const app=w.Vue.createApp({components:{MeterSheet:w.RentalComponents.meterWorksheet(api),Payment:w.RentalComponents.paymentWorksheet(api)},setup(){state={visible:w.Vue.ref(true),rows:w.Vue.ref([row()])};return state}});app.mount('#app');
 const button=t=>[...d.querySelectorAll('button')].find(b=>b.textContent===t),close=()=>d.querySelector('[aria-label="關閉圖片預覽"]').click();
 await w.Vue.nextTick();assert.equal(meterCalls+paymentCalls+listCalls+selectionCalls+referenceCalls,0,'No photo RPCs on initial render');assert.equal(d.querySelectorAll('img,iframe,dialog').length,0);assert.equal(d.querySelector('.meter-row-photo a').textContent,'本期電表照片');assert(d.querySelector('.payment-selected a'));
 // A selected link requests one image, not the other rooms, gallery or selections.
 const receiptLink=d.querySelector('.payment-selected a');receiptLink.focus();receiptLink.click();await wait(()=>d.querySelector('dialog img'));assert.equal(paymentCalls,1);assert.equal(meterCalls+listCalls+selectionCalls+referenceCalls,0);assert.equal(d.querySelectorAll('img').length,1);assert.equal(d.querySelector('dialog').getAttribute('open'),'');
 close();assert.equal(d.querySelector('dialog'),null);assert.equal(d.activeElement,receiptLink);
 // Metadata buttons never fetch image bytes or create hidden images.
 button('讀取圖片連結清單').click();await wait(()=>d.querySelector('.payment-status').textContent.includes('已讀取 2 個'));assert.equal(paymentCalls,1);assert.equal(listCalls,1);assert.equal(selectionCalls,1);assert.equal(d.querySelectorAll('.payment-photo-grid a').length,2);assert.equal(d.querySelectorAll('img,iframe').length,0);
 button('更新照片連結').click();await wait(()=>d.querySelector('.meter-batch-status').textContent.includes('照片連結處理完成'));assert.equal(referenceCalls,1);assert.equal(meterCalls,0);
 d.querySelector('.meter-row-photo a').click();await wait(()=>d.querySelector('dialog img'));assert.equal(meterCalls,1);assert.equal(paymentCalls,1);d.querySelector('dialog').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(!d.querySelector('dialog'));
 // Date mismatch never displays the wrong cycle's photo.
 photoDate='2026-09-02';d.querySelector('.meter-row-photo a').click();await wait(()=>d.querySelector('dialog')?.textContent.includes('照片日期與本期抄表日不一致'));assert(!d.querySelector('dialog img'));close();photoDate=date;
 // A read failure stays in the dialog and explicit reopening can retry.
 fail=true;d.querySelector('.payment-selected a').click();await wait(()=>d.querySelector('dialog')?.textContent.includes('測試讀取失敗'));assert(!d.querySelector('dialog img'));close();fail=false;
 // Closing an in-flight request must discard its result; no hidden cache or late dialog.
 let resolve;pending=new Promise(r=>resolve=r);d.querySelector('.payment-selected a').click();assert(d.querySelector('dialog'));close();resolve({dataUrl:'data:image/png;base64,eA=='});await new Promise(r=>setTimeout(r,5));assert.equal(d.querySelectorAll('dialog,img').length,0);pending=null;
 // Switching images discards the previous in-flight response.
 pending=new Promise(r=>resolve=r);d.querySelector('.payment-selected a').click();pending=null;d.querySelector('.meter-row-photo a').click();await wait(()=>d.querySelector('dialog img'));assert(d.querySelector('dialog img').alt.includes('本期電表照片'));resolve({dataUrl:'data:image/png;base64,bGF0ZQ=='});await new Promise(r=>setTimeout(r,5));assert.equal(d.querySelector('dialog img').getAttribute('src'),'data:image/png;base64,eA==');close();
 // Property changes, page exit, and component unmount remove previews and late results.
 pending=new Promise(r=>resolve=r);d.querySelector('.payment-selected a').click();w.RentalPropertyContext.id='other';resolve({dataUrl:'data:image/png;base64,eA=='});await wait(()=>!d.querySelector('dialog'));pending=null;
 d.querySelector('.payment-selected a').click();await wait(()=>d.querySelector('dialog img'));w.dispatchEvent(new w.Event('pagehide'));assert(!d.querySelector('dialog'));
 d.querySelector('.payment-selected a').click();await wait(()=>d.querySelector('dialog img'));state.visible.value=false;await w.Vue.nextTick();assert.equal(d.querySelectorAll('dialog,img').length,0);
 const counts=[meterCalls,paymentCalls];state.visible.value=true;await w.Vue.nextTick();assert.deepEqual([meterCalls,paymentCalls],counts,'Remount must not request any images');
 // Previewing images never changes cash drafts. Explicit confirmation still proposes total due.
 const confirm=d.querySelector('[aria-label="401 房已確認收款"]');assert(!confirm.checked);confirm.click();await w.Vue.nextTick();assert.equal(d.querySelector('[aria-label="401 房實際對帳金額"]').value,'1100');
 assert.deepEqual(errors,[]);app.unmount();w.close();console.log('PASS: link-only initial render; metadata-only refresh; single-image modal on click; date validation; errors/retry; Escape/focus return; stale response, property, unmount and pagehide cleanup; no cache, embeds, navigation or private persistence; cash drafts preserved.');
})().catch(e=>{console.error(e);process.exit(1)});
