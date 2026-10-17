const fs=require('node:fs'),assert=require('node:assert/strict');const {JSDOM,VirtualConsole}=require('jsdom');
const wait=async f=>{const start=Date.now();while(!f()){if(Date.now()-start>5000)throw Error('timeout');await new Promise(r=>setTimeout(r,5))}};
const vue=fs.readFileSync('public/tenant-vue.global.prod.js','utf8'),source=fs.readFileSync('public/meter-worksheet.js','utf8');
(async()=>{
const errors=[],calls=[],photos=[];let active=0,maxActive=0,failRoom='',dirty=false;
const records=Array.from({length:15},(_,i)=>({year:2026,month:11,room:String(401+i),name:'示範 '+i,meter:{previousReading:1000+i*20,previousReadingDate:'2026-09-01',currentReading:1120+i*20,currentReadingDate:'2026-11-01'}}));
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM('<div id="test"><meter-sheet :accounts="records" :year="2026" :month="11" :blocked="busy" @busy-change="busy=$event" @dirty-change="onDirty" @field-saved="update" @reconciled="reconcile" @refresh-request="refresh"></meter-sheet></div>',{url:'https://rent.test/',runScripts:'dangerously',virtualConsole:vc});const w=dom.window,d=w.document;
w.Image=class{naturalWidth=4000;naturalHeight=3000;set src(v){if(v)queueMicrotask(()=>this.onload())}};
w.HTMLCanvasElement.prototype.getContext=()=>({fillStyle:'',fillRect(){},drawImage(){}});w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/jpeg;base64,VEhVTUI=';
w.eval(vue);w.eval(source);
let controller;
const api={accounts:async()=>JSON.parse(JSON.stringify(records)),saveField:async(year,month,room,field,value,expected)=>{calls.push([year,month,room,field,value,expected]);const entry=records.find(a=>a.room===room);assert.equal(entry.meter[field],expected);const next=field==='currentReading'?(value===''?null:Number(value)):value;entry.meter[field]=next;if(room===failRoom){failRoom='';throw Error('未收到儲存結果')}return {value:next}},meterPhoto:async(year,month,room)=>{photos.push(room);active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,2));active--;return room==='401'?{found:true,readingDate:records[0].meter.currentReadingDate,dataUrl:'data:image/png;base64,VElOWQ=='}:room==='402'?{found:true,readingDate:'2026-11-02',dataUrl:'data:image/png;base64,VElOWQ=='}:{found:false,message:'尚無照片'}}};
w.Vue.createApp({components:{MeterSheet:w.RentalComponents.meterWorksheet(api)},setup(){const busy=w.Vue.ref(false),items=w.Vue.ref(JSON.parse(JSON.stringify(records)));controller={items,busy};return {records:items,busy,onDirty:v=>dirty=v,update:({room,field,value})=>{items.value.find(a=>a.room===room).meter[field]=value},reconcile:r=>{items.value=r},refresh:()=>{items.value=JSON.parse(JSON.stringify(records))}}}}).mount('#test');
const button=text=>{const b=[...d.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert(b,text);return b};
const input=(label,value)=>{const el=d.querySelector('[aria-label="'+label+'"]');assert(el,label);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));return el};
await wait(()=>d.querySelectorAll('.meter-sheet-row').length===15);
input('本期共同抄表日','2026-11-03');records.forEach((a,i)=>input(a.room+' 房本期電表',String(a.meter.previousReading+200)));
await wait(()=>dirty);button('套用日期並載入全部照片').click();await wait(()=>d.querySelector('.meter-batch-status').textContent.includes('照片處理完成'));
assert.equal(calls.length,15);assert(calls.every(c=>c[3]==='currentReadingDate'&&c[4]==='2026-11-03'&&c[5]==='2026-11-01'));assert.equal(photos.length,15);assert.equal(maxActive,2);assert.equal(d.querySelectorAll('.meter-row-photo img').length,1);assert(d.querySelectorAll('.meter-sheet-row')[1].textContent.includes('照片日期與本期抄表日不一致'));assert(d.querySelectorAll('.meter-sheet-row')[2].textContent.includes('尚無照片'));assert(d.querySelector('[aria-label="401 房本期電表"]').value==='1200');assert(dirty,'date and photo action must keep degree drafts');
button('儲存全部抄表').click();await wait(()=>!dirty&&!controller.busy.value);assert.equal(calls.filter(c=>c[3]==='currentReading').length,15);assert(calls.slice(15).every(c=>typeof c[5]==='number'));assert(d.querySelector('.meter-batch-status').textContent.includes('已儲存 15 間'));
// Reject a lower reading before any write.
input('401 房本期電表','999');await wait(()=>dirty);const before=calls.length;button('儲存全部抄表').click();await wait(()=>d.querySelector('.meter-batch-status').textContent.includes('請先修正'));assert.equal(calls.length,before);button('還原全部未儲存輸入').click();await wait(()=>!dirty);
// Unknown outcome stops the remaining writes. Reconciliation retains pending drafts and detects other changes.
records.forEach(a=>input(a.room+' 房本期電表',String(a.meter.currentReading+5)));await wait(()=>dirty);failRoom='402';button('儲存全部抄表').click();await wait(()=>d.querySelector('.meter-batch-status').textContent.includes('其餘尚未確認'));assert.equal(calls.length,before+2);assert(button('儲存全部抄表').disabled);records[2].meter.currentReading=9999;
button('重新讀取核對，保留未完成輸入').click();await wait(()=>d.querySelector('.meter-batch-status').textContent.includes('已重新讀取。'));
assert(d.querySelector('[aria-label="403 房電表"]').textContent.includes('試算表已有其他修改'));assert.equal(d.querySelector('[aria-label="404 房本期電表"]').value,String(records[3].meter.currentReading+5));
input('本期共同抄表日','2026-11-03');await new Promise(r=>setTimeout(r,5));assert(d.querySelector('[aria-label="403 房電表"]').textContent.includes('試算表已有其他修改'));
d.querySelector('[aria-label="403 房電表"] button').click();await new Promise(r=>setTimeout(r,5));button('儲存全部抄表').click();await wait(()=>!dirty&&!controller.busy.value);assert.equal(calls.length,before+2+12,'do not resend already confirmed rooms');
assert.deepEqual(errors,[]);dom.window.close();
console.log('PASS: one date for 15 rooms, one-click all photos with 2 concurrent reads, missing/date-mismatched photos, degree drafts retained, 15-room save with original expected values, preflight lower-reading rejection, no write retry after uncertainty, reconciliation/conflict protection, resume pending rooms only.');
})().catch(e=>{console.error(e);process.exit(1)});
