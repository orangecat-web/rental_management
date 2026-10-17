/** Student status is explicit: empty = unknown, 是 = student, 否 = not student.
 * The old demo's fictional student assignments are never imported.
 */
function normalizeTenantStudent_(value) {
  if (value === '' || value === null || value === undefined) return '';
  if (value === true || value === '是' || value === '學生') return '是';
  if (value === false || value === '否' || value === '非學生') return '否';
  throw new Error('學生欄位請填「是」「否」，或留空。');
}
function tenantStudentTable_() {
  const sheet = getTenantSpreadsheet_().getSheetByName('房客資料');
  if (!sheet) throw new Error('找不到房客資料分頁。');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(v => String(v).trim());
  if (headers.filter(v => v === '學生').length > 1 || headers.filter(v => v === '房號').length !== 1) throw new Error('房號或學生欄位缺少或重複，請核對表頭。');
  return { sheet, rows, roomColumn: headers.indexOf('房號'), studentColumn: headers.indexOf('學生') };
}
/** Decorate the existing reader without changing any of its original fields. */
function getTenantDataWithStudent_() {
  const tenants = getTenantData();
  const table = tenantStudentTable_();
  return tenants.map(tenant => {
    const matches = table.rows.slice(1).filter(row => String(row[table.roomColumn]).trim() === tenant.room);
    if (matches.length !== 1) throw new Error('房號不存在或重複。');
    const student = table.studentColumn < 0 ? '' : normalizeTenantStudent_(matches[0][table.studentColumn]);
    return Object.assign({}, tenant, { student });
  });
}
/** Signed bridge only; same optimistic comparison and lock as the existing editors. */
function saveTenantStudent_(room, field, value, expectedValue) {
  if (field !== 'student' || typeof room !== 'string' || !/^\d{3,8}$/.test(room) ||
      !['', '是', '否'].includes(value) || !['', '是', '否'].includes(expectedValue)) throw new Error('學生身分格式不正確。');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const table = tenantStudentTable_();
    const matches = [];
    table.rows.slice(1).forEach((row, i) => { if (String(row[table.roomColumn]).trim() === room) matches.push(i + 2); });
    if (matches.length !== 1) throw new Error('房號不存在或重複。');
    let column = table.studentColumn;
    const current = column < 0 ? '' : normalizeTenantStudent_(table.rows[matches[0] - 1][column]);
    if (current !== expectedValue) throw new Error('學生身分已被其他操作更新，請重新讀取。');
    // Add the optional column only when an explicit selection is saved.
    if (column < 0) {
      if (!value) return { room, value: '' };
      column = table.sheet.getLastColumn();
      if (column >= table.sheet.getMaxColumns()) table.sheet.insertColumnAfter(column);
      table.sheet.getRange(1, column + 1).setValue('學生');
    }
    const cell = table.sheet.getRange(matches[0], column + 1);
    if (cell.getFormula() || cell.isPartOfMerge()) throw new Error('學生欄位含公式或合併格，暫不更新。');
    if (!value) cell.clearContent();
    else cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(value).build());
    SpreadsheetApp.flush();
    return { room, value };
  } finally { lock.releaseLock(); }
}
