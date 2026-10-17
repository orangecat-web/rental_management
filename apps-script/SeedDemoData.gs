/** Rent_Demo only. Fill empty cells with conspicuously fictitious sample data.
 * Never replace existing values/formulas/merged cells, create fake links or record payments.
 * Run previewRentDemoSeed before seedRentDemoData. No web API is added.
 */
function previewRentDemoSeed() {
  const plan = rentDemoSeedPlan_();
  console.log('示範資料預覽：房客 ' + plan.rooms + ' 間；月份 ' + plan.months.join('、'));
  console.log('可補入空白儲存格：' + plan.items.length + ' 格');
  console.log('保留既有內容、公式或合併格：' + plan.preserved + ' 格');
  console.log('不建立圖片、合約網址，不補付款日期。此步驟尚未寫入。');
}
function seedRentDemoData() {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const plan = rentDemoSeedPlan_(); let written = 0, skipped = 0;
    // Read current cells once per sheet, then write contiguous empty cells in batches.
    const grouped = new Map();
    plan.items.forEach(item => { if (!grouped.has(item.sheet)) grouped.set(item.sheet, []); grouped.get(item.sheet).push(item); });
    grouped.forEach(function (items, sheet) {
      const snapshot = sheet.getDataRange(), values = snapshot.getValues(), formulas = snapshot.getFormulas();
      const merged = new Set();
      snapshot.getMergedRanges().forEach(r => { for(let y=r.getRow();y<r.getRow()+r.getNumRows();y++) for(let x=r.getColumn();x<r.getColumn()+r.getNumColumns();x++) merged.add(y+':'+x); });
      const safe = items.filter(item => {
        const keep = values[item.row-1][item.column-1] === '' && !formulas[item.row-1][item.column-1] && !merged.has(item.row+':'+item.column);
        if(!keep) skipped++; return keep;
      }).sort((a,b) => a.row-b.row || a.column-b.column);
      const kind = item => item.formula ? 'formula' : item.value instanceof Date ? 'date' : typeof item.value;
      let batch=[];
      function flushBatch() {
        if(!batch.length)return;
        const first=batch[0], range=sheet.getRange(first.row,first.column,1,batch.length);
        if(kind(first)==='string') range.setNumberFormat('@');
        else if(kind(first)==='date') range.setNumberFormat('yyyy-mm-dd');
        range.setValues([batch.map(item => item.formula || item.value)]);
        written+=batch.length;batch=[];
      }
      safe.forEach(item => {
        const last=batch[batch.length-1];
        if(last && (last.row!==item.row || last.column+1!==item.column || kind(last)!==kind(item))) flushBatch();
        batch.push(item);
      });
      flushBatch();
      console.log('已處理分頁：'+sheet.getName()+'；累計補入 '+written+' 格。');
    });
    SpreadsheetApp.flush();
    console.log('已補入示範資料：' + written + ' 格；保留既有資料：' + plan.preserved + ' 格；執行時再跳過：' + skipped + ' 格');
    console.log('房客：' + plan.rooms + ' 間；已處理月份：' + plan.months.join('、'));
    console.log('圖片、合約連結與付款日期保留原狀；506 原有 0 元租金保留。');
  } finally { lock.releaseLock(); }
}
function verifyRentDemoSeed() {
  const tenants = readTenantData_();
  console.log('房客筆數：' + tenants.length);
  console.log('已填居住者：' + tenants.filter(t => Boolean(t.name)).length);
  console.log('0 元租金：' + tenants.filter(t => t.rent === 0).length);
  const book = getBillingSpreadsheet_(2026);
  book.getSheets().filter(s => /^(?:[1-9]|1[0-2])$/.test(s.getName())).forEach(function (sheet) {
    const rows = readMonthlyAccounts_(2026, Number(sheet.getName()));
    const complete = rows.filter(a => a.meter && typeof a.meter.previousReading === 'number' && typeof a.meter.currentReading === 'number');
    const mismatches = complete.filter(a => a.meter.currentReading < a.meter.previousReading ||
      a.meter.usage !== a.meter.currentReading - a.meter.previousReading ||
      a.meter.calculatedFee !== a.meter.usage * 5 || a.electricityFee !== a.meter.calculatedFee ||
      a.totalDue !== a.rent + a.electricityFee);
    console.log('月份 ' + sheet.getName() + '：' + rows.length + ' 間；完整電表 ' + complete.length + ' 間；電費不一致 ' + mismatches.length + ' 間');
  });
}
function rentDemoSeedPlan_() {
  const tenantBook = getTenantSpreadsheet_(), billingBook = getBillingSpreadsheet_(2026);
  if (tenantBook.getName() !== 'tenant_data' || billingBook.getName() !== 'rental_accounts_2026' ||
      billingBook.getId() !== '14X3qR9kYE6m7aqea3GNoO7n2hq3kYgRVXaRK9rjhyAE') throw Error('僅可用於目前指定的 Rent_Demo 測試試算表。');
  const tenantSheet = tenantBook.getSheetByName('房客資料');
  if (!tenantSheet) throw Error('缺少房客資料分頁。');
  const plan = { items: [], rooms: 0, months: [], preserved: 0 }, staged = new Set();
  function table(sheet) {
    const range = sheet.getDataRange();
    const displays = range.getDisplayValues(), values = range.getValues(), formulas = range.getFormulas();
    const merged = new Set();
    range.getMergedRanges().forEach(r => { for (let row=r.getRow();row<r.getRow()+r.getNumRows();row++) for(let c=r.getColumn();c<r.getColumn()+r.getNumColumns();c++) merged.add(row+":"+c); });
    const headers = displays[0].map(v => v.trim()), roomColumn = headers.indexOf('房號');
    if (roomColumn < 0) throw Error('分頁缺少房號欄位。');
    const rows = new Map();
    displays.slice(1).forEach(function (row, i) {
      const room = row[roomColumn].trim(); if (!/^\d{3,8}$/.test(room)) return;
      if (rows.has(room)) throw Error('房號重複，停止補入示範資料。');
      rows.set(room, i + 2);
    });
    return { sheet: sheet, headers: headers, rows: rows, values: values, formulas: formulas, merged: merged };
  }
  function value(tab, room, title) {
    const column = tab.headers.indexOf(title), row = tab.rows.get(room);
    return column < 0 || !row ? '' : tab.values[row - 1][column];
  }
  function put(tab, room, title, v, formula) {
    const column = tab.headers.indexOf(title), row = tab.rows.get(room);
    if (column < 0 || !row) return;
    const key = tab.sheet.getSheetId() + ':' + row + ':' + column;
    if (staged.has(key)) return;
    if (tab.values[row-1][column] !== '' || tab.formulas[row-1][column] || tab.merged.has(row+':'+(column+1))) { plan.preserved++; return; }
    staged.add(key); plan.items.push({ sheet: tab.sheet, row: row, column: column + 1, value: v, formula: formula || '' });
  }
  function date(book, year, month) { return Utilities.parseDate(year + '-' + String(month).padStart(2,'0') + '-01', book.getSpreadsheetTimeZone(), 'yyyy-MM-dd'); }
  function col(index) { let text = ''; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) text = String.fromCharCode(65 + (n - 1) % 26) + text; return text; }
  const t = table(tenantSheet), base = new Map(); let index = 0;
  t.rows.forEach(function (_, room) {
    const i = index++, defaultRent = room === '506' ? 0 : 5800 + i * 200;
    const existingRent = value(t, room, '目前房租');
    const rent = typeof existingRent === 'number' && Number.isFinite(existingRent) ? existingRent : defaultRent;
    const name = value(t, room, '居住者') || '示範房客 ' + room;
    const lastFive = value(t, room, '預設轉帳後五碼') || String(room).padStart(5,'0');
    base.set(room, { name: name, rent: rent, lastFive: lastFive, reading: 1000 + i * 300, usage: 120 + (i % 5) * 37 });
    const fields = { '居住者': name, '連絡電話': '0000-000-' + room,
      '同居人': i % 3 === 0 ? '示範同居人 ' + room : '無（示範）', '同居人電話': i % 3 === 0 ? '0000-100-' + room : '無',
      '緊急聯絡人': '示範聯絡人 ' + room, '聯絡人電話': '0000-200-' + room,
      '目前房租': rent, '基本介紹': '示範資料，供租務管理功能測試。', '備註': '示範資料；非真實聯絡資訊。',
      '房間維護整修紀錄': '2026-09-01 示範：冷氣濾網清潔、照明與水龍頭檢查。', '預設轉帳後五碼': lastFive,
      '起租日': date(tenantBook,2026,1), '到期日': date(tenantBook,2027,12) };
    Object.keys(fields).forEach(title => put(t, room, title, fields[title]));
  });
  plan.rooms = base.size;
  const monthly = billingBook.getSheets().filter(s => /^(?:[1-9]|1[0-2])$/.test(s.getName())).sort((a,b) => Number(a.getName()) - Number(b.getName()));
  const effectiveMeters = new Map();
  monthly.forEach(function (sheet) {
    const month = Number(sheet.getName()), tab = table(sheet); plan.months.push(month);
    tab.rows.forEach(function (row, room) {
      const b = base.get(room); if (!b) throw Error('帳務有未在房客資料表登記的房號，停止補入。');
      put(tab,room,'簽約人',b.name); put(tab,room,'房租',b.rent);
      put(tab,room,'應繳日期',date(billingBook,2026,month));
      put(tab,room,'轉帳後五碼',b.lastFive);
      put(tab,room,'備註','示範帳務；付款日期與圖片由管理人補入。');
      if (month % 2 === 1 && tab.headers.includes('本期電表')) {
        const previous = effectiveMeters.get((month - 2) + ':' + room);
        const priorRaw = value(tab,room,'前期電表'), currentRaw = value(tab,room,'本期電表');
        const previousReading = typeof priorRaw === 'number' ? priorRaw : previous ? previous.reading : b.reading + ((month - 9) / 2 - 1) * b.usage;
        const currentReading = typeof currentRaw === 'number' ? currentRaw : previousReading + b.usage;
        const previousDate = previous ? previous.date : date(billingBook,2026,Math.max(1,month - 2));
        const currentDate = value(tab,room,'本期抄表日期') || date(billingBook,2026,month);
        put(tab,room,'前期電表',previousReading); put(tab,room,'前期抄表日期',previousDate);
        put(tab,room,'本期電表',currentReading); put(tab,room,'本期抄表日期',currentDate);
        effectiveMeters.set(month + ':' + room,{ reading: currentReading, date: currentDate });
        const prev = col(tab.headers.indexOf('前期電表')) + row, current = col(tab.headers.indexOf('本期電表')) + row;
        const usage = col(tab.headers.indexOf('使用電度')) + row, fee = col(tab.headers.indexOf('需繳電費')) + row;
        put(tab,room,'使用電度',null,'=IF(COUNT(' + prev + ',' + current + ')=2,IF(' + current + '>=' + prev + ',' + current + '-' + prev + ',""),"")');
        put(tab,room,'需繳電費',null,'=IF(ISNUMBER(' + usage + '),' + usage + '*5,"")');
        put(tab,room,'電費',null,'=IF(ISNUMBER(' + fee + '),' + fee + ',"")');
      }
      const rentCell = col(tab.headers.indexOf('房租')) + row;
      const e = tab.headers.indexOf('電費');
      const totalFormula = month % 2 && e >= 0 ? '=IF(COUNT(' + rentCell + ',' + col(e) + row + ')=2,' + rentCell + '+' + col(e) + row + ',"")' : '=IF(ISNUMBER(' + rentCell + '),' + rentCell + ',"")';
      put(tab,room,'應繳金額',null,totalFormula);
    });
  });
  return plan;
}
