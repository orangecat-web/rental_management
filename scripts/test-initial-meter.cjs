const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let rows=[['房號','房型','學生'],['401','套房','是']],locked=false,writes=0,formula=false;
let billingRows=[['房號','前期電表','前期抄表日期'],['401',900,'2026-07-01']];
let savedReading=null,paid=false;
const cell=(target,r,c)=>({getFormula:()=>formula&&target===billingRows?'=1':'',isPartOfMerge:()=>false,setValue:v=>{target[r-1][c-1]=v;writes++},setRichTextValue:v=>{target[r-1][c-1]=v;writes++},clearContent:()=>{target[r-1][c-1]='';writes++}});
const sheet={getDataRange:()=>({getValues:()=>rows.map(r=>[...r])}),getLastColumn:()=>rows[0].length,getMaxColumns:()=>26,getRange:(r,c)=>cell(rows,r,c)};
const bill={getDataRange:()=>({getValues:()=>billingRows.map(r=>[...r])}),getRange:(r,c)=>cell(billingRows,r,c)};
const ctx={getTenantSpreadsheet_:()=>({getSheetByName:()=>sheet}),getTenantData:()=>[{room:'401',name:'新房客',rent:0,phone:'0900000000'}],
 LockService:{getScriptLock:()=>({waitLock(){assert(!locked);locked=true},releaseLock(){locked=false}})},
 SpreadsheetApp:{flush(){},newRichTextValue:()=>{let text;return {setText(v){text=v;return this},build(){return text}}}},
 getBillingSpreadsheet_:()=>({getSheetByName:()=>bill}),
 readMonthlyAccounts_:(year,month)=>[{year,month,room:'401',name:'新房客',rent:0,isReceived:paid,actualPaid:null,meter:{previousReading:billingRows[1][1],previousReadingDate:billingRows[1][2],currentReading:savedReading,currentReadingDate:'2026-09-01'}}],
 previewMonthlyInitialization:()=>({rooms:1,warnings:[]}),initializeMonthlyAccounts:()=>({rooms:1,warnings:[]})};
vm.createContext(ctx);for(const file of ['StudentStatus.gs','RoomType.gs','InitialMeter.gs','SiteBridge.gs'])vm.runInContext(fs.readFileSync('apps-script/'+file,'utf8'),ctx);
const read=()=>ctx.getTenantDataWithInitialMeter_()[0],save=(f,v,e)=>ctx.saveTenantLeaseMeter_('401',f,v,e);
assert.equal(read().initialMeterReading,null);assert.equal(read().contractDate,'');assert.equal(writes,0);
save('initialMeterReading','0',null);assert.equal(read().initialMeterReading,0);assert.equal(read().rent,0);assert.equal(read().student,'是');
save('contractDate','2026-08-15','');assert.equal(read().contractDate,'2026-08-15');
assert.throws(()=>save('initialMeterReading','100',''),/更新/);assert(!locked);
assert.throws(()=>save('initialMeterReading','-1',0),/格式/);assert.throws(()=>save('initialMeterReading','Infinity',0),/格式/);
assert.throws(()=>save('contractDate','2026-02-29','2026-08-15'),/格式/);assert(!locked);
save('initialMeterReading','1000',0);
const tenant=read(),account=ctx.readMonthlyAccounts_(2026,9)[0],baseline=ctx.leaseInitialMeterBaseline_(account,tenant);
assert.equal(baseline.previousReading,1000);assert.equal(baseline.previousReadingDate,'2026-08-15');
assert.equal(ctx.leaseInitialMeterBaseline_({...account,name:'舊房客'},tenant),null);
assert.equal(ctx.leaseInitialMeterBaseline_({...account,month:7},tenant),null);
assert.equal(ctx.leaseInitialMeterBaseline_({...account,month:10},tenant),null);
assert.equal(ctx.leaseInitialMeterBaseline_({...account,month:11,meter:{...account.meter,previousReadingDate:'2026-09-01',currentReadingDate:'2026-11-01'}},tenant),null);
assert.equal(ctx.leaseInitialMeterBaseline_({...account,meter:{...account.meter,currentReadingDate:'2026-08-10'}},tenant),null);
assert.equal(ctx.leaseInitialMeterBaseline_(account,{...tenant,initialMeterReading:null}),null);
assert.equal(ctx.leaseInitialMeterBaseline_(account,{...tenant,initialMeterReading:0}).previousReading,0);
const jan={...account,year:2027,month:1,meter:{...account.meter,previousReadingDate:'2026-11-01',currentReadingDate:'2027-01-01'}};
assert.equal(ctx.leaseInitialMeterBaseline_(jan,{...tenant,contractDate:'2026-12-10'}).previousReadingDate,'2026-12-10');
assert.equal(ctx.previewMonthlyInitializationWithInitialMeter_(2026,9).initialMeters,1);
assert.equal(billingRows[1][1],900,'preview must not write');
assert.equal(ctx.initializeMonthlyAccountsWithInitialMeter_(2026,9).initialMeters,1);
assert.equal(billingRows[1][1],1000);assert.equal(billingRows[1][2],'2026-08-15');
assert.equal(ctx.initializeMonthlyAccountsWithInitialMeter_(2026,9).initialMeters,0,'repeat init is a no-op');
assert.equal(ctx.markInitialMeterSources_(ctx.readMonthlyAccounts_(2026,9))[0].meter.previousReadingSource,'initial');
ctx.readCashPaidAmounts_=(_b,_m,records)=>records.map(a=>({...a,actualPaid:0}));save('initialMeterReading','1050',1000);assert.equal(ctx.initializeMonthlyAccountsWithInitialMeter_(2026,9).initialMeters,0);assert.equal(billingRows[1][1],1000);delete ctx.readCashPaidAmounts_;save('initialMeterReading','1000',1050);
savedReading=1120;save('initialMeterReading','1100',1000);
let result=ctx.initializeMonthlyAccountsWithInitialMeter_(2026,9);assert.equal(result.initialMeters,0);assert(result.warnings[0].includes('抄表或收款'));assert.equal(billingRows[1][1],1000,'never overwrite a recorded bill');
savedReading=null;paid=true;result=ctx.initializeMonthlyAccountsWithInitialMeter_(2026,9);assert.equal(result.initialMeters,0);assert.equal(billingRows[1][1],1000);
paid=false;formula=true;result=ctx.initializeMonthlyAccountsWithInitialMeter_(2026,9);assert.equal(result.initialMeters,0);assert(result.warnings[0].includes('公式'));assert.equal(billingRows[1][1],1000);assert(!locked);
assert.equal(ctx.markInitialMeterSources_(ctx.readMonthlyAccounts_(2026,9))[0].meter.previousReading,1000,'reads keep the stored snapshot, not the edited current lease');
save('initialMeterReading','',1100);assert.equal(read().initialMeterReading,null);save('contractDate','','2026-08-15');assert.equal(read().contractDate,'');
(async()=>{const {validCall}=await import('../worker/api.mjs');for(const validate of [validCall,ctx.rentalBridgeValidCall_]){
 for(const args of [['401','initialMeterReading','0',null],['401','initialMeterReading','1000.5',0],['401','initialMeterReading','',0],['401','contractDate','2026-08-15','']])assert(validate('saveTenantField',args));
 for(const args of [['401','initialMeterReading','-1',null],['401','initialMeterReading','1e9',null],['401','initialMeterReading','100','0'],['401','contractDate','2026-02-29','']])assert.equal(validate('saveTenantField',args),false);
}assert.equal(fs.readFileSync('apps-script/InitialMeter.gs','utf8'),fs.readFileSync('public/downloads/InitialMeter.gs.txt','utf8'));
console.log('PASS: optional initial meter/signing date, zero/blank distinction, date and numeric validation, conflicts, tenant/first-cycle/cross-year selection, explicit preview/init snapshots, repeatability, finalized bill and formula protection, no historical read overrides.');})().catch(e=>{console.error(e);process.exitCode=1});
