const assert=require('node:assert/strict'),{account,tenant,report,validateSnapshot}=require('./demo-numbers-schema.cjs');
const raw={year:2026,month:1,room:'401',rent:0,electricityFee:0,totalDue:0,netDue:0,effectivePaid:null,unpaid:null,notes:'PRIVATE',transferLastFive:'PRIVATE',name:'PRIVATE',meter:{previousReading:0,currentReading:0,usage:0,previousReadingDate:'2025-11-01',currentReadingDate:'2026-01-01',dataUrl:'PRIVATE'}};
const row=account(raw,2026,1);assert.equal(row.rent,0);assert.equal(row.effectivePaid,null);assert(!JSON.stringify(row).includes('PRIVATE'));assert.equal(row.meter.currentReading,0);
const s={version:1,source:'production-numbers',personalData:'synthetic',capturedAt:'2026-10-24T00:00:00.000Z',tenants:[tenant({room:'401',rent:0,vacant:true,name:'PRIVATE'})],periods:[{year:2026,month:1,accounts:[row]}],reports:[report({version:1,year:2026,cashTotal:null,depositScope:'PRIVATE',months:[],signing:[]},2026)]};assert.deepEqual(validateSnapshot(s),s);
for(const bad of [{...s,name:'PRIVATE'},{...s,source:'other'},{...s,periods:[s.periods[0],s.periods[0]]}])assert.throws(()=>validateSnapshot(bad));
assert.throws(()=>account({...raw,rent:'PRIVATE'},2026,1));assert.throws(()=>account({...raw,dueDate:'2026-02-31'},2026,1));assert.throws(()=>account(raw,2026,2));assert.throws(()=>account({...raw,occupantKey:'PRIVATE'},2026,1));console.log('PASS: numeric snapshot allowlist preserves zero/unknown, strips people/free text/URLs and rejects invalid scope, fields, dates and duplicates.');

assert.equal(account({...raw,dueDate:'10'},2026,1).dueDate,'10');assert.throws(()=>account({...raw,dueDate:'32'},2026,1));

const planned=account({...raw,planned:true,historySettlement:'planned'},2026,1);assert.equal(planned.planned,true);assert.equal(planned.historySettlement,'planned');
