/** Money is computed in integer cents. Reads never write credit into another month. */
function settlementCents_(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) throw new Error('金額必須為非負數字，最多兩位小數。');
  return Math.round(value * 100);
}
/** Chronological monthly snapshots; only the same named tenant in consecutive months inherits credit. */
function calculateCashSettlements_(periods) {
  const previous = new Map(), result = [];
  periods.slice().sort((a,b) => a.year*12+a.month-(b.year*12+b.month)).forEach(period => {
    const serial = period.year * 12 + period.month;
    const accounts = period.accounts.map(account => {
      const prior = previous.get(account.room);
      let opening = 0, arrears = 0, warning = '';
      if (prior && (prior.credit === null || prior.debt === null)) warning = '前期實收尚未核對，未自動累計或抵扣。';
      else if (prior && (prior.credit > 0 || prior.debt > 0)) {
        if (prior.serial !== serial - 1) warning = '中間缺少月份帳務，前期餘額暫不帶入。';
        else if (!account.name || !prior.name || account.name.trim() !== prior.name.trim()) warning = '承租人不同或未填，前期餘額暫不帶入，請核對。';
        else { opening = prior.credit; arrears = prior.debt; }
      }
      const paid = account.actualPaid === null || account.actualPaid === undefined ? null : settlementCents_(account.actualPaid);
      const gross = account.totalDue === null || account.totalDue === undefined ? null : settlementCents_(account.totalDue);
      const claim = gross === null ? null : gross + arrears;
      const applied = claim === null ? 0 : Math.min(opening, claim);
      const due = claim === null ? null : claim - applied;
      const isReceived = typeof account.isReceived === 'boolean' ? account.isReceived : Boolean(account.transferDate);
      const effectivePaid = isReceived ? (paid !== null ? paid : due) : 0;
      const confirmed = due !== null;
      const unpaid = !confirmed ? null : Math.max(0, due - (effectivePaid || 0));
      const credit = !confirmed ? null : opening - applied + Math.max(0, (effectivePaid || 0) - due);
      const status = gross === null ? '待補應收' : !confirmed ? '待核對' : credit > 0 ? '多收' : unpaid > 0 ? '未收' : applied > 0 && !effectivePaid ? '已抵扣' : claim === 0 ? '無應收' : '已收足';
      const output = Object.assign({}, account, {actualPaid: paid === null ? null : paid/100, effectivePaid:effectivePaid===null?null:effectivePaid/100, isReceived, openingCredit: opening/100, arrears:arrears/100, creditApplied: applied/100,
        netDue: due === null ? null : due/100, unpaid: unpaid === null ? null : unpaid/100, overpaid: credit === null ? null : credit/100,
        paymentStatus: status, creditWarning: warning, blockedCredit: warning && prior?.credit > 0 ? prior.credit/100 : 0, blockedArrears:warning && prior?.debt > 0 ? prior.debt/100 : 0});
      previous.set(account.room, {serial, name:account.name, credit, debt:unpaid});
      return output;
    });
    result.push({year:period.year,month:period.month,accounts});
  });
  return result;
}
function readCashPaidAmounts_(book, month, accounts) {
  const sheet=book.getSheetByName(String(month)),rows=sheet.getDataRange().getValues(),headers=rows[0].map(v=>String(v).trim());
  if(headers.filter(v=>v==='實收金額').length>1||headers.filter(v=>v==='收款確認').length>1)throw new Error('實收金額欄位重複，請核對表頭。');
  const roomColumn=headers.indexOf('房號'),paidColumn=headers.indexOf('實收金額'),confirmationColumn=headers.indexOf('收款確認');
  return accounts.map(a=>{const matches=rows.slice(1).filter(row=>String(row[roomColumn]).trim()===a.room);if(matches.length!==1)throw new Error('帳務房號不存在或重複。');const raw=paidColumn<0?'':matches[0][paidColumn];const actualPaid=raw===''||raw===null?null:settlementCents_(raw)/100;const receiptConfirmed=confirmationColumn<0?'':normalizeReceiptConfirmation_(matches[0][confirmationColumn]);return Object.assign({},a,{actualPaid,receiptConfirmed,isReceived:receiptConfirmed?receiptConfirmed==='是':Boolean(a.transferDate)})});
}
/** Recompute the configured history up to the selected month, including cross-year credit. */
function getMonthlyAccountsWithSettlement_(year, month) {
  year=Number(year);month=Number(month);
  if(!Number.isInteger(year)||year<1900||year>9999||!Number.isInteger(month)||month<1||month>12)throw new Error('年份或月份不正確。');
  const properties=PropertiesService.getScriptProperties().getProperties();
  const years=Object.keys(properties).map(key=>/^BILLING_SPREADSHEET_ID_(\d{4})$/.exec(key)).filter(Boolean).map(m=>Number(m[1])).filter(y=>y<=year).sort((a,b)=>a-b);
  const periods=[];
  years.forEach(y=>{const book=getBillingSpreadsheet_(y);const months=book.getSheets().map(s=>Number(s.getName())).filter(m=>Number.isInteger(m)&&m>=1&&m<=12&&(y<year||m<=month)).sort((a,b)=>a-b);months.forEach(m=>periods.push({year:y,month:m,accounts:readCashPaidAmounts_(book,m,readMonthlyAccounts_(y,m))}))});
  const target=calculateCashSettlements_(periods).find(p=>p.year===year&&p.month===month);
  if(!target)throw new Error('找不到指定月份帳務。');
  return target.accounts;
}
/** Optional human-confirmed exception; blank uses transfer-date default without writing a fabricated amount. */
function saveMonthlyActualPaid_(year,month,room,field,value,expectedValue) {
  if(field!=='actualPaid'||typeof value!=='string'||!/^\d{3,8}$/.test(String(room))||!/^\d{4}$/.test(String(year))||!Number.isInteger(Number(month))||Number(month)<1||Number(month)>12)throw new Error('實收金額格式不正確。');
  const next=value.trim()===''?null:(/^\d+(?:\.\d{1,2})?$/.test(value.trim())?settlementCents_(Number(value)):NaN);
  if(next!==null&&!Number.isFinite(next))throw new Error('實收金額請輸入非負金額，最多兩位小數。');
  const expected=expectedValue===null?null:settlementCents_(expectedValue);
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    const sheet=getBillingSpreadsheet_(year).getSheetByName(String(Number(month)));if(!sheet)throw new Error('找不到月份帳務。');
    const rows=sheet.getDataRange().getValues(),headers=rows[0].map(v=>String(v).trim());if(headers.filter(v=>v==='房號').length!==1||headers.filter(v=>v==='實收金額').length>1)throw new Error('房號或實收金額表頭缺少或重複。');
    const roomColumn=headers.indexOf('房號'),matches=[];rows.slice(1).forEach((r,i)=>{if(String(r[roomColumn]).trim()===String(room))matches.push(i+2)});if(matches.length!==1)throw new Error('房號不存在或重複。');
    let column=headers.indexOf('實收金額');const raw=column<0?'':rows[matches[0]-1][column],current=raw===''||raw===null?null:settlementCents_(raw);
    if(current!==expected)throw new Error('實收金額已被更新，請重新讀取核對。');
    if(column<0){if(next===null)return {value:null};column=sheet.getLastColumn();if(column>=sheet.getMaxColumns())sheet.insertColumnAfter(column);sheet.getRange(1,column+1).setValue('實收金額')}
    const cell=sheet.getRange(matches[0],column+1);if(cell.getFormula()||cell.isPartOfMerge())throw new Error('實收金額含公式或合併格，暫不更新。');
    if(next===null)cell.clearContent();else cell.setValue(next/100);SpreadsheetApp.flush();return {value:next===null?null:next/100};
  }finally{lock.releaseLock()}
}
function getRoomNoticeWithSettlement_(year,month,room) {
  const notice=getRoomNoticeData(year,month,room),account=getMonthlyAccountsWithSettlement_(year,month).find(a=>a.room===String(room));
  if(!account||account.netDue===null)throw new Error('本期應收金額尚未完整。');
  return Object.assign({},notice,{total:account.netDue,creditApplied:account.creditApplied,arrears:account.arrears,creditWarning:account.creditWarning});
}

function normalizeReceiptConfirmation_(value){if(value===''||value===null||value===undefined)return '';if(value===true||value==='是')return '是';if(value===false||value==='否')return '否';throw new Error('收款確認請使用是、否或核取方塊。')}
function saveMonthlyReceiptConfirmed_(year,month,room,field,value,expectedValue){
 if(field!=='receiptConfirmed'||!['是','否'].includes(value)||!['','是','否'].includes(expectedValue)||!/^\d{4}$/.test(String(year))||!/^\d{3,8}$/.test(String(room))||!Number.isInteger(Number(month))||Number(month)<1||Number(month)>12)throw new Error('收款確認格式不正確。');
 const lock=LockService.getScriptLock();lock.waitLock(20000);
 try{const sheet=getBillingSpreadsheet_(year).getSheetByName(String(Number(month)));if(!sheet)throw new Error('找不到月份帳務。');const rows=sheet.getDataRange().getValues(),headers=rows[0].map(v=>String(v).trim());if(headers.filter(h=>h==='房號').length!==1||headers.filter(h=>h==='收款確認').length>1)throw new Error('收款確認或房號表頭缺少或重複。');const roomColumn=headers.indexOf('房號'),matches=[];rows.slice(1).forEach((r,i)=>{if(String(r[roomColumn]).trim()===String(room))matches.push(i+2)});if(matches.length!==1)throw new Error('房號不存在或重複。');let column=headers.indexOf('收款確認');const current=column<0?'':normalizeReceiptConfirmation_(rows[matches[0]-1][column]);if(current!==expectedValue)throw new Error('收款確認已被更新，請重新讀取。');if(column<0){column=sheet.getLastColumn();if(column>=sheet.getMaxColumns())sheet.insertColumnAfter(column);sheet.getRange(1,column+1).setValue('收款確認')}const cell=sheet.getRange(matches[0],column+1);if(cell.getFormula()||cell.isPartOfMerge())throw new Error('收款確認含公式或合併格，暫不更新。');cell.setValue(value);SpreadsheetApp.flush();return {value};
 }finally{lock.releaseLock()}
}
