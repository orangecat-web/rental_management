/** Lease metadata and explicit first-cycle snapshots. Reads never alter historical bills. */
function initialMeterDate_(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;
}
function normalizeLeaseMeterField_(field, value) {
  if (field === 'contractDate') {
    if (value === '' || value === null || value === undefined) return '';
    if (value instanceof Date && Number.isFinite(value.getTime())) return Utilities.formatDate(value, getTenantSpreadsheet_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    if (initialMeterDate_(value)) return value;
    throw new Error('簽約日格式不正確。');
  }
  if (field !== 'initialMeterReading') throw new Error('合約電表欄位不正確。');
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100000000) return value;
  throw new Error('初始電表必須為非負度數，或留空。');
}
function leaseMeterTable_() {
  const sheet = getTenantSpreadsheet_().getSheetByName('房客資料');
  if (!sheet) throw new Error('找不到房客資料分頁。');
  const rows = sheet.getDataRange().getValues(), headers = (rows[0] || []).map(v => String(v).trim());
  if (headers.filter(h=>h==='房號').length!==1 || ['初始電表','簽約日'].some(h=>headers.filter(v=>v===h).length>1)) throw new Error('房號或合約電表表頭缺少或重複。');
  return {sheet, rows, headers};
}
function getTenantDataWithInitialMeter_() {
  const tenants = getTenantDataWithRoomType_(), table = leaseMeterTable_(), roomColumn = table.headers.indexOf('房號');
  return tenants.map(tenant => {
    const rows = table.rows.slice(1).filter(r=>String(r[roomColumn]).trim()===String(tenant.room));
    if (rows.length!==1) throw new Error('房號不存在或重複。');
    const fields = {};
    for (const [key, header] of [['initialMeterReading','初始電表'],['contractDate','簽約日']]) {
      const col = table.headers.indexOf(header); fields[key] = normalizeLeaseMeterField_(key, col<0?'':rows[0][col]);
    }
    return Object.assign({}, tenant, fields);
  });
}
function saveTenantLeaseMeter_(room, field, value, expectedValue) {
  if (!/^\d{3,8}$/.test(String(room)) || !['initialMeterReading','contractDate'].includes(field) || typeof value!=='string') throw new Error('合約電表格式不正確。');
  const numeric = field==='initialMeterReading';
  if (numeric && value!=='' && !/^\d+(?:\.\d+)?$/.test(value)) throw new Error('初始電表格式不正確。');
  const next = normalizeLeaseMeterField_(field, numeric && value!==''?Number(value):value);
  const expected = normalizeLeaseMeterField_(field, expectedValue);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t=leaseMeterTable_(), rc=t.headers.indexOf('房號'), matches=[];
    t.rows.slice(1).forEach((r,i)=>{if(String(r[rc]).trim()===String(room))matches.push(i+2);});
    if(matches.length!==1)throw new Error('房號不存在或重複。');
    const header=numeric?'初始電表':'簽約日';let col=t.headers.indexOf(header);
    const current=normalizeLeaseMeterField_(field,col<0?'':t.rows[matches[0]-1][col]);
    if(current!==expected)throw new Error('合約電表資料已被更新，請重新讀取。');
    if(col<0&&(next===null||next===''))return {room,value:next};
    const create=col<0;if(create){col=t.sheet.getLastColumn();if(col>=t.sheet.getMaxColumns())t.sheet.insertColumnAfter(col);}
    const cell=t.sheet.getRange(matches[0],col+1), head=t.sheet.getRange(1,col+1);
    if(cell.getFormula()||cell.isPartOfMerge()||(create&&(head.getFormula()||head.isPartOfMerge())))throw new Error('合約電表欄位含公式或合併格，暫不更新。');
    if(create)head.setValue(header);
    if(next===null||next==='')cell.clearContent();else if(numeric)cell.setValue(next);else cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(next).build());
    SpreadsheetApp.flush();return {room,value:next};
  } finally {lock.releaseLock();}
}
/** A signed lease inside the immediately preceding meter interval is the first cycle.
 * No baseline is inferred from rent startDate, room alone, or an old tenant's name.
 */
function leaseInitialMeterBaseline_(account, tenant) {
  if (!tenant || !account.meter || account.month%2!==1 || String(account.room)!==String(tenant.room) ||
      !account.name || account.name.trim()!==String(tenant.name||'').trim() ||
      !initialMeterDate_(tenant.contractDate) || typeof tenant.initialMeterReading!=='number' ||
      !Number.isFinite(tenant.initialMeterReading) || tenant.initialMeterReading<0) return null;
  const start=new Date(Date.UTC(account.year,account.month-3,1)).toISOString().slice(0,10);
  const end=new Date(Date.UTC(account.year,account.month,0)).toISOString().slice(0,10);
  const before=account.meter.previousReadingDate, after=account.meter.currentReadingDate;
  if(tenant.contractDate<start || tenant.contractDate>end ||
     (initialMeterDate_(before)&&tenant.contractDate<before) ||
     (initialMeterDate_(after)&&tenant.contractDate>=after))return null;
  return {previousReading:tenant.initialMeterReading,previousReadingDate:tenant.contractDate,previousReadingSource:'initial'};
}
function initialMeterPlan_(year,month) {
  if(Number(month)%2!==1)return [];
  const tenants=getTenantDataWithInitialMeter_();
  const raw=readMonthlyAccounts_(Number(year),Number(month));
  const accounts=typeof readCashPaidAmounts_==='function'?readCashPaidAmounts_(getBillingSpreadsheet_(year),Number(month),raw):raw;
  return accounts.map(a=>({account:a,baseline:leaseInitialMeterBaseline_(a,tenants.find(t=>String(t.room)===String(a.room)))})).filter(p=>p.baseline);
}
function initialMeterCanSnapshot_(a) {
  return (a.meter.currentReading===null||a.meter.currentReading===undefined||a.meter.currentReading==='') && !a.isReceived && !a.transferDate && a.receiptConfirmed!=='是' && (a.actualPaid===null||a.actualPaid===undefined);
}
function previewMonthlyInitializationWithInitialMeter_(year,month) {
  const result=previewMonthlyInitialization(year,month), plan=initialMeterPlan_(year,month);
  return Object.assign({},result,{initialMeters:plan.filter(p=>initialMeterCanSnapshot_(p.account)).length});
}
/** Run only after the manager explicitly initializes a month. Snapshot values, not live links. */
function initializeMonthlyAccountsWithInitialMeter_(year,month) {
  const result=initializeMonthlyAccounts(year,month);let count=0;const warnings=[];
  if(Number(month)%2!==1)return Object.assign({},result,{initialMeters:0});
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const plan=initialMeterPlan_(year,month),sheet=getBillingSpreadsheet_(year).getSheetByName(String(Number(month)));
    if(!plan.length)return Object.assign({},result,{initialMeters:0});
    const rows=sheet.getDataRange().getValues(),headers=rows[0].map(v=>String(v).trim());
    for(const h of ['房號','前期電表','前期抄表日期'])if(headers.filter(v=>v===h).length!==1)throw new Error('初始電表所需帳務表頭缺少或重複：'+h);
    for(const p of plan){
      const a=p.account,m=a.meter,b=p.baseline;
      if(!initialMeterCanSnapshot_(a)){warnings.push(a.room+' 房已有抄表或收款，初始電表未覆蓋。');continue;}
      const matches=[];rows.slice(1).forEach((r,i)=>{if(String(r[headers.indexOf('房號')]).trim()===String(a.room))matches.push(i+2);});
      if(matches.length!==1)throw new Error('帳務房號不存在或重複。');
      const reading=sheet.getRange(matches[0],headers.indexOf('前期電表')+1),date=sheet.getRange(matches[0],headers.indexOf('前期抄表日期')+1);
      if(reading.getFormula()||date.getFormula()||reading.isPartOfMerge()||date.isPartOfMerge()){warnings.push(a.room+' 房前期欄位含公式或合併格，請核對初始電表。');continue;}
      if(m.previousReading===b.previousReading&&m.previousReadingDate===b.previousReadingDate)continue;
      reading.setValue(b.previousReading);date.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(b.previousReadingDate).build());count++;
    }
    SpreadsheetApp.flush();
  }finally{lock.releaseLock();}
  return Object.assign({},result,{initialMeters:count,warnings:(result.warnings||[]).concat(warnings)});
}

/** Label only an already-snapshotted baseline; never substitute live lease values on reads. */
function markInitialMeterSources_(accounts) {
  const tenants=getTenantDataWithInitialMeter_();
  return accounts.map(a=>{const tenant=tenants.find(t=>String(t.room)===String(a.room)),b=leaseInitialMeterBaseline_(a,tenant);
    if(!b||a.meter.previousReading!==b.previousReading||a.meter.previousReadingDate!==b.previousReadingDate)return a;
    return Object.assign({},a,{meter:Object.assign({},a.meter,{previousReadingSource:'initial'})});
  });
}
