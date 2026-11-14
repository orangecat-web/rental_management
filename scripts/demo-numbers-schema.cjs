/** Public numerical snapshot allowlist. No people, free text, bank suffixes, URLs or file IDs. */
const numeric=['rent','electricityFee','totalDue','netDue','arrears','creditApplied','effectivePaid','unpaid','overpaid','actualPaid','receiptTotal','receiptRecordedAmount','receiptSuggestedAmount','receiptDue','receiptDeposit','openingCredit'];
const meterNumeric=['previousReading','currentReading','usage','unitPrice','calculatedFee'];
const dates=['dueDate','transferDate'],meterDates=['previousReadingDate','currentReadingDate'];
const money=v=>v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e12;
const date=v=>typeof v==='string'&&(v===''||/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v);
const room=v=>typeof v==='string'&&/^\d{3,8}$/.test(v);
function pick(row,keys){return Object.fromEntries(keys.filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]]));}
function account(row,year,month){
 if(!row||row.year!==year||row.month!==month||!room(row.room)||['rent','electricityFee','totalDue','netDue','effectivePaid'].some(k=>!Object.hasOwn(row,k)))throw Error('Invalid numeric account scope');
 const out={year,month,room:row.room,...pick(row,numeric),...pick(row,dates)};
 for(const k of numeric)if(Object.hasOwn(out,k)&&!money(out[k]))throw Error('Invalid numeric account field: '+k+' ('+typeof out[k]+')');for(const k of dates)if(Object.hasOwn(out,k)&&!(date(out[k])||k==='dueDate'&&/^(?:[1-9]|[12][0-9]|3[01])$/.test(out[k])))throw Error('Invalid numeric account date: '+k+' ('+typeof out[k]+', length '+String(out[k]).length+')');
 for(const k of ['historical','vacant','planned','receiptAmountReady','isReceived'])if(Object.hasOwn(row,k)){if(typeof row[k]!=='boolean')throw Error('Invalid account flag');out[k]=row[k];}
 if(Object.hasOwn(row,'historySettlement')){if(!['settled','unknown','pending','unsettled','planned','not_applicable',''].includes(row.historySettlement))throw Error('Invalid settlement status');out.historySettlement=row.historySettlement;}
 if(Object.hasOwn(row,'occupantKey')){if(typeof row.occupantKey!=='string'||!/^[-\w]{43}$/.test(row.occupantKey))throw Error('Invalid anonymous identity');out.occupantKey=row.occupantKey;}
 if(Object.hasOwn(row,'receiptConfirmed')){if(!['是','否',''].includes(row.receiptConfirmed))throw Error('Invalid receipt confirmation');out.receiptConfirmed=row.receiptConfirmed;}
 if(row.meter==null)out.meter=null;else{out.meter=pick(row.meter,[...meterNumeric,...meterDates]);if(meterNumeric.some(k=>Object.hasOwn(out.meter,k)&&!money(out.meter[k]))||meterDates.some(k=>Object.hasOwn(out.meter,k)&&!date(out.meter[k])))throw Error('Invalid meter number/date');}
 return out;
}
function tenant(row){if(!room(row?.room)||!money(row.rent)||typeof row.vacant!=='boolean')throw Error('Invalid room numeric record');const out={room:row.room,rent:row.rent,vacant:row.vacant};if(['套房','雅房',''].includes(row.roomType))out.roomType=row.roomType;return out;}
const reportFields=['receiptCount','unknownReceiptCount','knownCashTotal','cashTotal','combinedReceipts'],monthFields=['rent','settledRent','settledElectricity','electricity'],signingFields=['rent','deposit','contractTotal','cash'];
function report(r,year){if(!r||r.version!==1||r.year!==year||!Array.isArray(r.months)||!Array.isArray(r.signing))throw Error('Invalid numeric report');const out={version:1,year,...pick(r,reportFields)};if(reportFields.some(k=>Object.hasOwn(out,k)&&!money(out[k])))throw Error('Invalid report total');out.months=r.months.map(m=>{if(!Number.isInteger(m.month)||m.month<1||m.month>12||!Array.isArray(m.vacantRooms)||m.vacantRooms.some(v=>!room(v)))throw Error('Invalid report month');const row={month:m.month,...pick(m,monthFields),vacantRooms:m.vacantRooms};if(monthFields.some(k=>Object.hasOwn(row,k)&&!money(row[k])))throw Error('Invalid report amount');return row;});if(Object.hasOwn(r,'incomeMonths')){if(!Array.isArray(r.incomeMonths))throw Error('Invalid income months');out.incomeMonths=r.incomeMonths.map(m=>{const keys=['rent','deposit','electricity','total','unallocatedCash','unknownReceiptCount'];if(!Number.isInteger(m.month)||m.month<1||m.month>12||keys.some(k=>!money(m[k])||m[k]===null)||!Number.isInteger(m.unknownReceiptCount)||Math.abs(m.total-m.rent-m.deposit-m.electricity)>.005)throw Error('Invalid income amount');return {month:m.month,...pick(m,keys)};});if(new Set(out.incomeMonths.map(m=>m.month)).size!==out.incomeMonths.length)throw Error('Duplicate income month');}out.signing=r.signing.map(s=>{if(!room(s.room)||!Number.isInteger(s.month)||s.month<1||s.month>12)throw Error('Invalid signing scope');const row={month:s.month,room:s.room,...pick(s,signingFields)};if(signingFields.some(k=>Object.hasOwn(row,k)&&!money(row[k])))throw Error('Invalid signing amount');return row;});return out;}
function expensePeriod(p){
 if(!p||!Number.isInteger(p.year)||p.year<1900||p.year>9999||!Number.isInteger(p.month)||p.month<1||p.month>12||!Array.isArray(p.rows)||!money(p.total)||p.total===null||!Number.isInteger(p.pendingCount)||p.pendingCount<0)throw Error('Invalid expense period');
 const rows=p.rows.map(r=>{if(!date(r.date)||!r.date.startsWith(p.year+'-'+String(p.month).padStart(2,'0')+'-')||['unitPrice','quantity','amount'].some(k=>!money(r[k])||r[k]===null)||!Number.isInteger(r.receiptCount)||r.receiptCount<0||typeof r.voided!=='boolean')throw Error('Invalid expense number');return pick(r,['date','unitPrice','quantity','amount','receiptCount','voided']);});
 if(Math.abs(rows.filter(r=>!r.voided).reduce((n,r)=>n+r.amount,0)-p.total)>.005)throw Error('Invalid expense total');
 const out={year:p.year,month:p.month,total:p.total,pendingCount:p.pendingCount,rows};if(Object.hasOwn(p,'claim')){const c=p.claim;if(!c||!['unclaimed','claimed'].includes(c.status)||!date(c.date)||c.status==='claimed'&&!c.date||c.status==='unclaimed'&&c.date!==''||!money(c.claimedTotal)||c.status==='claimed'&&c.claimedTotal===null||c.status==='unclaimed'&&c.claimedTotal!==null||typeof c.stale!=='boolean'||typeof c.pending!=='boolean')throw Error('Invalid monthly claim');out.claim=pick(c,['status','date','claimedTotal','stale','pending']);}return out;
}
const signedMoney=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e12;
function depositWorkspace(d){
 if(!d||!Array.isArray(d.items)||!Array.isArray(d.legacy))throw Error('Invalid deposit workspace');
 const items=d.items.map(t=>{if(!room(t.room)||['active','depositKnown','pending','paid'].some(k=>typeof t[k]!=='boolean')||!money(t.received)||t.received===null||!signedMoney(t.balance)||!Array.isArray(t.events))throw Error('Invalid deposit number');
  let settlement=null;
  if(t.settlement){const q=t.settlement,e=q.electricity;if(!date(q.date)||!['waive','preserve'].includes(q.rentMode)||!['separate','transfer','paid'].includes(q.electricityDisposition)||!e||['previous','current','unitPrice','usage','subtotal'].some(k=>!money(e[k])||e[k]===null)||!Array.isArray(q.other)||['otherSubtotal','deductionTotal','deposit'].some(k=>!money(q[k])||q[k]===null)||!signedMoney(q.balance)||!['refund','topup','clear'].includes(q.payoutType))throw Error('Invalid deposit settlement');
   const other=q.other.map(o=>{if(!money(o.amount)||o.amount===null)throw Error('Invalid deposit deduction');return {amount:o.amount};});
   if(Math.abs(other.reduce((n,o)=>n+o.amount,0)-q.otherSubtotal)>.005||Math.abs(e.subtotal+q.otherSubtotal-q.deductionTotal)>.005||Math.abs(q.deposit-q.deductionTotal-q.balance)>.005)throw Error('Invalid deposit total');
   settlement={date:q.date,rentMode:q.rentMode,electricityDisposition:q.electricityDisposition,electricity:pick(e,['previous','current','unitPrice','usage','subtotal']),other,...pick(q,['otherSubtotal','deductionTotal','deposit','balance','payoutType'])};
  }
  const events=t.events.map(e=>{if(!['receive','opening','adjustment','payout','checkout','checkout_pending'].includes(e.kind)||!date(e.data?.date))throw Error('Invalid deposit event');const data=pick(e.data,['date','amount','deductionTotal']);if(['amount','deductionTotal'].some(k=>Object.hasOwn(data,k)&&(!money(data[k])||data[k]===null)))throw Error('Invalid deposit event amount');return {kind:e.kind,data};});
  return {room:t.room,...pick(t,['active','received','depositKnown','pending']),settlement,...pick(t,['paid','balance']),events};
 });
 const legacy=d.legacy.map(v=>{if(!room(v.room)||!Number.isInteger(v.year)||v.year<1900||!Number.isInteger(v.month)||v.month<1||v.month>12||!money(v.expected)||v.expected===null||!money(v.confirmed))throw Error('Invalid legacy deposit');return pick(v,['room','year','month','expected','confirmed']);});
 return {items,legacy};
}
function repairWorkspace(value){
 if(!value||!Array.isArray(value.rows)||!Number.isInteger(value.pendingCount)||value.pendingCount<0)throw Error('Invalid repairs');
 return {rows:value.rows.map(r=>{const out=pick(r,['date','room','amount','voided']);if(!date(out.date)||!out.date||!(room(out.room)||out.room==='公共區域')||!money(out.amount)||out.amount===null||typeof out.voided!=='boolean')throw Error('Invalid repair numeric fields');return out;}),pendingCount:value.pendingCount};
}
function validateSnapshot(s){
 if(!s||s.version!==1||s.source!=='production-numbers'||s.personalData!=='synthetic'||typeof s.capturedAt!=='string'||!Number.isFinite(Date.parse(s.capturedAt))||!Array.isArray(s.tenants)||!Array.isArray(s.periods)||!Array.isArray(s.reports))throw Error('Invalid snapshot');
 const clean={version:1,source:s.source,personalData:s.personalData,capturedAt:s.capturedAt,tenants:s.tenants.map(tenant),periods:s.periods.map(p=>{if(!Number.isInteger(p.year)||p.year<1900||p.year>9999||!Number.isInteger(p.month)||p.month<1||p.month>12||!Array.isArray(p.accounts)||!p.accounts.length)throw Error('Invalid snapshot period');const rows=p.accounts.map(a=>account(a,p.year,p.month));if(new Set(rows.map(a=>a.room)).size!==rows.length)throw Error('Duplicate account room');return {year:p.year,month:p.month,accounts:rows};}),reports:s.reports.map(r=>report(r,r.year))};
 if(!clean.tenants.length||!clean.periods.length||new Set(clean.tenants.map(t=>t.room)).size!==clean.tenants.length||new Set(clean.periods.map(p=>p.year+'|'+p.month)).size!==clean.periods.length)throw Error('Duplicate/empty snapshot scope');
 if(Object.hasOwn(s,'expenses')){if(!Array.isArray(s.expenses))throw Error('Invalid expenses');clean.expenses=s.expenses.map(expensePeriod);if(new Set(clean.expenses.map(p=>p.year+'|'+p.month)).size!==clean.expenses.length)throw Error('Duplicate expense period');}
 if(Object.hasOwn(s,'deposits'))clean.deposits=depositWorkspace(s.deposits);
 if(Object.hasOwn(s,'repairs'))clean.repairs=repairWorkspace(s.repairs);
 if(Object.hasOwn(s,'financialProjection')){if(s.financialProjection!=='deposit-separated-v1')throw Error('Invalid financial projection');clean.financialProjection=s.financialProjection;}
 if(JSON.stringify(clean)!==JSON.stringify(s))throw Error('Snapshot contains unapproved or unordered fields');return clean;
}
module.exports={repairWorkspace,account,tenant,report,expensePeriod,depositWorkspace,validateSnapshot};
