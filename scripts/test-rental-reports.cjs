const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('public/report-data.js','utf8'),ctx);const D=ctx.window.RentalReportData;
const account=(month,extra={})=>({year:2026,month,room:'401',name:'測試房客',rent:5800,electricityFee:month%2?600:null,totalDue:month%2?6400:5800,effectivePaid:0,arrears:0,creditApplied:0,netDue:month%2?6400:5800,unpaid:month%2?6400:5800,overpaid:0,meter:month%2?{previousReading:1000,currentReading:1120,previousReadingDate:`2026-${String(month-2).padStart(2,'0')}-01`,currentReadingDate:`2026-${String(month).padStart(2,'0')}-01`,usage:120}:null,...extra});
assert.equal(D.meter(account(11)).days,61);assert.equal(D.meter(account(11)).daily,120/61);
for(const [k,v] of [['currentReading',null],['currentReading',999],['currentReadingDate','2026-02-30'],['currentReadingDate','2026-09-01'],['usage',121]]) {const a=account(11);a.meter[k]=v;assert.equal(D.meter(a).valid,false,k);}
const zero=account(11);zero.meter.currentReading=1000;zero.meter.usage=0;assert.equal(D.meter(zero).usage,0);assert.equal(D.meter(zero).valid,true);
assert.notEqual(D.day('2024-02-29'),null);assert.equal(D.day('2026-02-29'),null);
assert.equal(D.prepare(2026,10,[account(10)]).electricity.value,0);
const partial=D.prepare(2026,11,[account(11),account(11,{room:'402',unpaid:null,effectivePaid:null})]);assert.equal(partial.debt.value,null);assert.equal(partial.debt.known,1);assert.equal(partial.paid.value,null);
assert.equal(D.prepare(2026,11,[account(11,{rent:.1}),account(11,{room:'402',rent:.2})]).rent.value,.3);
assert.throws(()=>D.prepare(2026,11,[account(10)]));assert.throws(()=>D.prepare(2026,11,[account(11),account(11)]));
// Use the actual backend ledger to prove that reporting allocates the same funds exactly once.
const cash={};vm.runInNewContext(fs.readFileSync('apps-script/CashSettlement.gs','utf8'),cash);
const raw=(month,rent,fee,paid,name='A')=>({year:2026,month,accounts:[{year:2026,month,room:'401',name,rent,electricityFee:fee,totalDue:rent+(fee||0),actualPaid:paid,isReceived:paid!==null,meter:null}]});
const history=cash.calculateCashSettlements_([raw(8,100,0,null),raw(9,100,50,80),raw(10,100,0,150),raw(11,100,50,300),raw(12,100,0,null)]).map(p=>D.prepare(p.year,p.month,p.accounts));
const cohorts=D.rentCohorts(history);assert.deepEqual(Array.from(cohorts,r=>r.paid),[100,100,100,100,30]);
const all=D.rentSummary(cohorts,[8,9,10,11,12]);assert.equal(all.total,500);assert.equal(all.paid,430);assert.equal(all.unpaid,70);assert.equal(all.paidPercent,86);
assert.equal(D.rentSummary(cohorts,[8,9]).paid,200);assert.equal(D.rentSummary(cohorts,[10,11,12]).paid,230);
const beforeLaterReceipt=D.rentCohorts(history.slice(0,2));assert.deepEqual(Array.from(beforeLaterReceipt,r=>r.paid),[80,0]);
const nameChange=cash.calculateCashSettlements_([raw(8,100,0,null),raw(9,100,50,50,'B')]).map(p=>D.prepare(p.year,p.month,p.accounts));assert.deepEqual(Array.from(D.rentCohorts(nameChange),r=>r.paid),[0,50]);
const unknown=D.rentCohorts([D.prepare(2026,10,[account(10,{totalDue:5700})])]);assert.equal(D.rentSummary(unknown,[10]).valid,false);
const external=D.rentCohorts([D.prepare(2026,10,[account(10,{rent:100,totalDue:100,arrears:20,effectivePaid:100,netDue:120,unpaid:20})])]);assert.equal(external[0].paid,80);
const free=D.rentCohorts([D.prepare(2026,10,[account(10,{rent:0,totalDue:0,unpaid:0,netDue:0})])]);assert.equal(D.rentSummary(free,[10]).paidPercent,null);
const cents=D.rentCohorts([D.prepare(2026,10,[account(10,{rent:.3,totalDue:.3,effectivePaid:.1,unpaid:.2,netDue:.3})])]);assert.equal(cents[0].unpaid,.2);
const wait=async fn=>{const start=Date.now();while(!fn()){if(Date.now()-start>5000)throw Error('timeout');await new Promise(r=>setTimeout(r,5));}};
(async()=>{
 const errors=[],calls=[];let active=0,maxActive=0,failMonth=10;
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<div id="app"><rental-reports></rental-reports></div>',{url:'https://rent.test/',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){w.fetch=async(url,o)=>{const c=JSON.parse(o.body);calls.push(c);let data;if(c.action==='getAvailableBillingYears')data=[2026];else if(c.action==='getAvailableBillingMonths')data=[9,10,11,12];else if(c.action==='getMonthlyAccounts'){active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,5));active--;if(c.args[1]===failMonth)return {ok:false,json:async()=>({ok:false,error:{message:'測試讀取失敗'}})};data=[account(c.args[1],{name:'測試'+c.args[1]}),account(c.args[1],{name:'',room:'506',rent:0,totalDue:c.args[1]%2?600:0,unpaid:c.args[1]%2?600:0,netDue:c.args[1]%2?600:0,meter:null})];}else throw Error('unexpected write');return {ok:true,json:async()=>({ok:true,data})};};w.Storage.prototype.setItem=()=>{throw Error('private report persisted')};w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});}});
 const w=dom.window,d=w.document;
 for(const f of ['tenant-vue.global.prod.js','workspace-transport.js','report-data.js','report-charts.js'])w.eval(fs.readFileSync('public/'+f,'utf8'));w.RentalComponents={};w.eval(fs.readFileSync('public/rental-reports.js','utf8'));w.Vue.createApp({components:{RentalReports:w.RentalComponents.reports()}}).mount('#app');
 await wait(()=>d.querySelector('.report-status').textContent.includes('已讀取'));
 assert(maxActive<=2);assert.equal(calls.filter(c=>c.action==='getMonthlyAccounts').length,4);assert(d.querySelector('.report-errors').textContent.includes('10 月'));assert(d.querySelector('.pie-empty'));
 assert(!d.querySelector('.report-check'));assert.equal(d.querySelectorAll('.room-year-card').length,2);assert.equal(d.querySelector('.room-year-card').querySelectorAll('.chart-column').length,6);assert.equal(d.querySelector('.room-year-card').querySelectorAll('.vertical-chart-row').length,1);assert(d.querySelector('.room-year-card').getAttribute('aria-label').includes('2026'));assert(d.querySelector('#electricity-report-title').textContent==='用電統計');
 assert(d.querySelector('#all-electricity .chart-unknown'),'missing room meter must not become an all-room zero');
 const meterSelect=d.querySelector('[aria-label="電費月份"]');meterSelect.value='11';meterSelect.dispatchEvent(new w.Event('change',{bubbles:true}));await w.Vue.nextTick();
 assert(d.querySelector('.electricity-panel').textContent.includes('1 / 2 間'));assert(d.querySelector('.electricity-panel').textContent.includes('尚未完整'));
 [...d.querySelectorAll('button')].find(b=>b.textContent==='每日平均用電').click();await w.Vue.nextTick();assert(d.querySelector('.room-year-card [aria-label^="9月："]').getAttribute('aria-label').includes('1.94'));
 const independent=d.querySelector('[aria-label="單房區單期比較月份"]');independent.value='9';independent.dispatchEvent(new w.Event('change',{bubbles:true}));await w.Vue.nextTick();assert.equal(meterSelect.value,'11');assert(d.querySelector('#room-period-comparison .vertical-chart').getAttribute('aria-label').includes('9 月'));assert.equal(d.querySelector('#room-period-comparison').querySelectorAll('.chart-column').length,2);
 // Two fee bars, separate from rent charts; no mixed-axis series.
 [...d.querySelectorAll('button')].find(b=>b.textContent==='電費（元）').click();await w.Vue.nextTick();assert(d.querySelector('#all-electricity .chart-unit').textContent.includes('元'));assert(d.querySelector('#all-electricity .chart-column-caption').textContent.includes('1,200'));
 failMonth=0;[...d.querySelectorAll('button')].find(b=>b.textContent==='重新讀取報表').click();await wait(()=>d.querySelector('.report-status').textContent.includes('已讀取 4 個月'));assert(!d.querySelector('.report-errors'));assert(d.querySelector('svg[aria-label*="已繳"]'));assert.equal(d.querySelectorAll('.rent-pie path').length,0);assert(d.querySelector('.rent-pie circle'),'all unpaid must render a full red pie');
 [...d.querySelectorAll('button')].find(b=>b.textContent==='季度').click();await w.Vue.nextTick();assert(d.querySelector('[aria-label="租金統計季度"]'));assert(d.querySelector('#rent-statistics').textContent.includes('5,800 元'));
 [...d.querySelectorAll('button')].find(b=>b.textContent==='年度').click();await w.Vue.nextTick();assert(d.querySelector('.report-coverage').textContent.includes('2 / 10'));assert(d.querySelector('#rent-statistics').textContent.includes('11,600 元'));assert(calls.every(c=>c.action.startsWith('get')));assert.deepEqual(errors,[]);
 // Mobile columns wrap in chunks of three, instead of creating horizontal scrolling.
 assert(d.querySelectorAll('#rent-statistics .vertical-chart-row').length===1);
 const pieHost=d.createElement('div');d.body.appendChild(pieHost);w.Vue.createApp({components:{TestPie:w.RentalReportCharts.pie},data:()=>({summary:all}),template:'<test-pie :summary="summary"></test-pie>'}).mount(pieHost);await w.Vue.nextTick();assert.equal(pieHost.querySelectorAll('path').length,2);assert(pieHost.querySelector('svg').getAttribute('aria-label').includes('已繳 86%'));assert(!pieHost.innerHTML.includes('NaN'));
 dom.window.close();console.log('PASS: FIFO rent allocation, historical repayments, partial receipts, credits once, cents, name changes, zero-rent/invalid data, month/quarter/year pies, separate rent/electricity bars, six-period annual room cards, independent period comparisons, no future toggle, mobile chart wrapping, bounded read-only RPC.');
})().catch(e=>{console.error(e);process.exit(1)});
