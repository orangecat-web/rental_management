/** Optional room metadata. Reading never creates or populates the 房型 column. */
function normalizeTenantRoomType_(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value === '套房' || value === '雅房') return value;
  throw new Error('房型欄位請填「套房」「雅房」，或留空。');
}
function tenantRoomTypeTable_() {
  const sheet = getTenantSpreadsheet_().getSheetByName('房客資料');
  if (!sheet) throw new Error('找不到房客資料分頁。');
  const rows = sheet.getDataRange().getValues();
  const headers = (rows[0] || []).map(v => String(v).trim());
  if (headers.filter(v => v === '房號').length !== 1 || headers.filter(v => v === '房型').length > 1) {
    throw new Error('房號或房型欄位缺少或重複，請核對表頭。');
  }
  return { sheet, rows, roomColumn: headers.indexOf('房號'), typeColumn: headers.indexOf('房型') };
}
function getTenantDataWithRoomType_() {
  const tenants = getTenantDataWithStudent_();
  const table = tenantRoomTypeTable_();
  return tenants.map(tenant => {
    const matches = table.rows.slice(1).filter(row => String(row[table.roomColumn]).trim() === String(tenant.room));
    if (matches.length !== 1) throw new Error('房號不存在或重複。');
    const roomType = table.typeColumn < 0 ? '' : normalizeTenantRoomType_(matches[0][table.typeColumn]);
    return Object.assign({}, tenant, { roomType });
  });
}
/** Called by the signed bridge after server-side manager authorization. */
function saveTenantRoomType_(room, field, value, expectedValue) {
  if (field !== 'roomType' || typeof room !== 'string' || !/^\d{3,8}$/.test(room) ||
      !['', '套房', '雅房'].includes(value) || !['', '套房', '雅房'].includes(expectedValue)) {
    throw new Error('房型格式不正確。');
  }
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const table = tenantRoomTypeTable_();
    const matches = [];
    table.rows.slice(1).forEach((row, i) => { if (String(row[table.roomColumn]).trim() === room) matches.push(i + 2); });
    if (matches.length !== 1) throw new Error('房號不存在或重複。');
    let column = table.typeColumn;
    const current = column < 0 ? '' : normalizeTenantRoomType_(table.rows[matches[0] - 1][column]);
    if (current !== expectedValue) throw new Error('房型已被其他操作更新，請重新讀取。');
    if (column < 0 && !value) return { room, value: '' };
    const createColumn = column < 0;
    if (createColumn) {
      column = table.sheet.getLastColumn();
      if (column >= table.sheet.getMaxColumns()) table.sheet.insertColumnAfter(column);
    }
    const cell = table.sheet.getRange(matches[0], column + 1);
    if (cell.getFormula() || cell.isPartOfMerge()) throw new Error('房型欄位含公式或合併格，暫不更新。');
    if (createColumn) {
      const header = table.sheet.getRange(1, column + 1);
      if (header.getFormula() || header.isPartOfMerge()) throw new Error('房型表頭含公式或合併格，暫不更新。');
      header.setValue('房型');
    }
    if (!value) cell.clearContent();
    else cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(value).build());
    SpreadsheetApp.flush();
    return { room, value };
  } finally { lock.releaseLock(); }
}
