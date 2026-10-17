const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let id=0;const sheets=[];
function sheet(name,headers,rows,formulas={}){
 const s={name,id:++id,data:[headers,...rows],formulas,getName(){return name},getSheetId(){return this.id},getDataRange(){return {getDisplayValues:()=>s.data.map(r=>r.map(v=>String(v??''))),getValues:()=>s.data,getFormulas:()=>s.data.map((r,ri)=>r.map((_,ci)=>formulas[(ri+1)+':'+(ci+1)]||'')),getMergedRanges:()=>[]}},getRange(row,col,height=1,width=1){return {setValues:rows=>{rows[0].forEach((v,i)=>{s.data[row-1][col-1+i]=v;if(typeof v==='string'&&v.startsWith('='))formulas[row+':'+(col+i)]=v})},getValue:()=>s.data[row-1][col-1]??'',getFormula:()=>formulas[row+':'+col]||'',isPartOfMerge:()=>false,setFormula:v=>{formulas[row+':'+col]=v;s.data[row-1][col-1]=v},setValue:v=>{s.data[row-1][col-1]=v},setRichTextValue:v=>{s.data[row-1][col-1]=v.text},setNumberFormat:()=>{}}}};sheets.push(s);return s;
}
const th=['房號','居住者','連絡電話','目前房租','起租日','到期日','基本介紹','備註','預設轉帳後五碼'];
const tenant=sheet('房客資料',th,[['401','既有房客','',5800,'','','','','01234'],['506','','',0,'','','','','']],{'2:8':'=""'});
const bh=['房號','簽約人','應繳日期','房租','電費','應繳金額','轉帳日期','轉帳後五碼','匯款截圖','備註','電表紀錄','前期抄表日期','前期電表','本期抄表日期','本期電表','使用電度','需繳電費'];
const make=(month)=>sheet(String(month),bh,['401','506'].map(room=>bh.map((_,i)=>i===0?room:'')));
const sep=make(9),nov=make(11),dec=make(12);sep.data[1][14]=1000;nov.data[1][12]=1000;nov.data[1][14]=1120;
const book={getName:()=> 'rental_accounts_2026',getId:()=> '14X3qR9kYE6m7aqea3GNoO7n2hq3kYgRVXaRK9rjhyAE',getSpreadsheetTimeZone:()=> 'Asia/Taipei',getSheets:()=>[sep,nov,dec]};
const ctx={Date,Map,Set,console:{log(){}},getTenantSpreadsheet_:()=>({getName:()=> 'tenant_data',getSheetByName:()=>tenant,getSpreadsheetTimeZone:()=> 'Asia/Taipei'}),getBillingSpreadsheet_:()=>book,Utilities:{parseDate:s=>new Date(s+'T00:00:00+08:00')},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},SpreadsheetApp:{flush(){},newRichTextValue:()=>({setText(text){this.text=text;return this},build(){return {text:this.text}}})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('apps-script/SeedDemoData.gs','utf8'),ctx);
const plan=ctx.rentDemoSeedPlan_();assert.equal(plan.rooms,2);assert.deepEqual([...plan.months],[9,11,12]);
assert(!plan.items.some(i=>i.sheet===tenant&&i.row===2&&[2,4,8,9].includes(i.column)));assert(!plan.items.some(i=>i.sheet===tenant&&i.row===3&&i.column===4));
assert(!plan.items.some(i=>i.sheet!==tenant&&[7,9,11].includes(i.column)));
assert(plan.items.some(i=>i.sheet===nov&&i.formula.includes('*5')));assert(!plan.items.some(i=>i.sheet===dec&&[5,13,15,16,17].includes(i.column)));
ctx.seedRentDemoData();assert.equal(tenant.data[1][1],'既有房客');assert.equal(tenant.data[2][3],0);assert.equal(tenant.data[1][8],'01234');assert.equal(tenant.formulas['2:8'],'=""');assert(tenant.data[2][1].includes('示範'));
assert.equal(nov.data[1][12],1000);assert.equal(nov.data[1][14],1120);assert.equal(dec.data[1][6],'');
assert.equal(ctx.rentDemoSeedPlan_().items.length,0,'seed must be idempotent');
console.log('PASS: demo seed only fills empty inputs; preserves names, zero, formulas and leading zeros; leaves receipts/contracts/payment dates; odd-only meter formulas; prior readings preserved; repeat-safe.');
