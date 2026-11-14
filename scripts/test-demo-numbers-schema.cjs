const assert=require('node:assert/strict'),{account,tenant,report,validateSnapshot}=require('./demo-numbers-schema.cjs');
const raw={year:2026,month:1,room:'401',rent:0,electricityFee:0,totalDue:0,netDue:0,effectivePaid:null,unpaid:null,notes:'PRIVATE',transferLastFive:'PRIVATE',name:'PRIVATE',meter:{previousReading:0,currentReading:0,usage:0,previousReadingDate:'2025-11-01',currentReadingDate:'2026-01-01',dataUrl:'PRIVATE'}};
const row=account(raw,2026,1);assert.equal(row.rent,0);assert.equal(row.effectivePaid,null);assert(!JSON.stringify(row).includes('PRIVATE'));assert.equal(row.meter.currentReading,0);
const s={version:1,source:'production-numbers',personalData:'synthetic',capturedAt:'2026-10-24T00:00:00.000Z',tenants:[tenant({room:'401',rent:0,vacant:true,name:'PRIVATE'})],periods:[{year:2026,month:1,accounts:[row]}],reports:[report({version:1,year:2026,cashTotal:null,depositScope:'PRIVATE',months:[],signing:[]},2026)]};assert.deepEqual(validateSnapshot(s),s);
for(const bad of [{...s,name:'PRIVATE'},{...s,source:'other'},{...s,periods:[s.periods[0],s.periods[0]]}])assert.throws(()=>validateSnapshot(bad));
assert.throws(()=>account({...raw,rent:'PRIVATE'},2026,1));assert.throws(()=>account({...raw,dueDate:'2026-02-31'},2026,1));assert.throws(()=>account(raw,2026,2));assert.throws(()=>account({...raw,occupantKey:'PRIVATE'},2026,1));console.log('PASS: numeric snapshot allowlist preserves zero/unknown, strips people/free text/URLs and rejects invalid scope, fields, dates and duplicates.');

assert.equal(account({...raw,dueDate:'10'},2026,1).dueDate,'10');assert.throws(()=>account({...raw,dueDate:'32'},2026,1));

const planned=account({...raw,planned:true,historySettlement:'planned'},2026,1);assert.equal(planned.planned,true);assert.equal(planned.historySettlement,'planned');

assert.equal(account({...raw,historySettlement:'not_applicable'},2026,1).historySettlement,'not_applicable');
const {expensePeriod,depositWorkspace}=require('./demo-numbers-schema.cjs');
const expense=expensePeriod({year:2026,month:11,total:42,pendingCount:0,rows:[{date:'2026-11-01',unitPrice:21,quantity:2,amount:42,receiptCount:1,voided:false,item:'PRIVATE_NAME',notes:'PRIVATE_PHONE',receiptIds:['PRIVATE_DRIVE']}]});
assert(!JSON.stringify(expense).includes('PRIVATE'));assert.equal(expense.rows[0].amount,42);assert.throws(()=>expensePeriod({...expense,total:0}));
const deposits=depositWorkspace({items:[{room:'401',name:'PRIVATE_NAME',identity:'PRIVATE_ID',active:true,received:100,depositKnown:true,pending:false,settlement:null,paid:false,balance:100,events:[{id:'PRIVATE_EVENT',kind:'opening',data:{date:'2026-11-01',amount:100,notes:'PRIVATE_NAME'}}]}],legacy:[{id:'PRIVATE',room:'401',year:2026,month:1,expected:100,confirmed:null}]});
assert(!JSON.stringify(deposits).includes('PRIVATE'));assert.equal(deposits.items[0].received,100);assert.equal(deposits.legacy[0].confirmed,null);
const full={...s,expenses:[expense],deposits,financialProjection:'deposit-separated-v1'};assert.deepEqual(validateSnapshot(full),full);assert.throws(()=>validateSnapshot({...full,deposits:{...deposits,name:'PRIVATE'}}));
console.log('PASS: deposit and expense monetary snapshot strips nested people/notes/file identifiers, preserves unknown cash, and validates totals and exact allowlists.');

const claimExpense=expensePeriod({...expense,claim:{status:'claimed',date:'2026-11-20',claimedTotal:42,stale:false,pending:false,version:'PRIVATE_VERSION',lastRequestId:'PRIVATE_ID'}});assert.equal(claimExpense.claim.status,'claimed');assert(!JSON.stringify(claimExpense).includes('PRIVATE'));assert.throws(()=>expensePeriod({...expense,claim:{...claimExpense.claim,date:''}}));assert.throws(()=>expensePeriod({...expense,claim:{...claimExpense.claim,date:'2026-02-30'}}));
