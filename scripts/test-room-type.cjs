const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
let rows, formula, merged, locked = false, writes, capacity, insertions;
const sheet = {
  getDataRange: () => ({ getValues: () => rows.map(r => [...r]) }),
  getLastColumn: () => rows[0].length, getMaxColumns: () => capacity,
  insertColumnAfter: () => { capacity++; insertions++; },
  getRange: (row, col) => ({
    getFormula: () => formula === `${row}:${col}` ? '=1' : '',
    isPartOfMerge: () => merged === `${row}:${col}`,
    setValue: value => { rows[row - 1][col - 1] = value; writes++; },
    setRichTextValue: value => { rows[row - 1][col - 1] = value; writes++; },
    clearContent: () => { rows[row - 1][col - 1] = ''; writes++; }
  })
};
const ctx = {
  getTenantSpreadsheet_: () => ({ getSheetByName: () => sheet }),
  getTenantData: () => [{ room: '401', name: '測試甲', rent: 0, phone: '0900000000', contractLinks: [] }, { room: '402', name: '測試乙' }],
  LockService: { getScriptLock: () => ({ waitLock() { assert(!locked); locked = true; }, releaseLock() { locked = false; } }) },
  SpreadsheetApp: { flush() {}, newRichTextValue: () => { let value; return { setText(v) { value = v; return this; }, build() { return value; } }; } }
};
vm.createContext(ctx);
for (const file of ['StudentStatus.gs', 'RoomType.gs', 'SiteBridge.gs']) vm.runInContext(fs.readFileSync('apps-script/' + file, 'utf8'), ctx);
const reset = () => { rows = [['房號', '居住者', '學生'], ['401', '測試甲', '是'], ['402', '測試乙', '']]; formula = merged = ''; capacity = 26; insertions = writes = 0; };
const save = (value, expected) => ctx.saveTenantRoomType_('401', 'roomType', value, expected);
reset();
const before = JSON.stringify(rows), old = ctx.getTenantDataWithRoomType_()[0];
assert.equal(old.roomType, ''); assert.equal(old.student, '是'); assert.equal(old.rent, 0); assert.equal(old.phone, '0900000000');
assert.equal(JSON.stringify(rows), before); assert.equal(writes, 0);
save('', ''); assert.equal(writes, 0); assert.equal(rows[0].length, 3);
save('套房', ''); assert.equal(rows[0][3], '房型'); assert.equal(rows[1][3], '套房'); assert.equal(ctx.getTenantDataWithRoomType_()[1].roomType, '');
assert.throws(() => save('雅房', ''), /更新/); assert(!locked); assert.equal(rows[1][3], '套房');
save('雅房', '套房'); assert.equal(ctx.getTenantDataWithRoomType_()[0].roomType, '雅房');
save('', '雅房'); assert.equal(ctx.getTenantDataWithRoomType_()[0].roomType, '');
for (const [value, expected] of [['別墅', ''], ['=IMPORTXML("bad")', ''], ['套房', null], [1, ''], ['', '未知']]) {
  assert.throws(() => save(value, expected), /格式/); assert(!locked);
}
formula = '2:4'; assert.throws(() => save('套房', ''), /公式/); assert(!locked); formula = '';
merged = '2:4'; assert.throws(() => save('套房', ''), /合併/); merged = ''; assert(!locked);
rows.push(['401', '重複', '', '']); assert.throws(() => save('套房', ''), /重複/); assert.throws(() => ctx.getTenantDataWithRoomType_(), /重複/); assert(!locked); rows.pop();
assert.throws(() => ctx.saveTenantRoomType_('403', 'roomType', '套房', ''), /房號/); assert(!locked);
rows[0].push('房型'); assert.throws(() => ctx.getTenantDataWithRoomType_(), /重複/);
reset(); rows[0].push('房型'); rows[1].push('未知'); assert.throws(() => ctx.getTenantDataWithRoomType_(), /房型欄位/);
reset(); formula = '1:4'; assert.throws(() => save('套房', ''), /表頭/); assert.equal(writes, 0); assert(!locked);
reset(); merged = '2:4'; assert.throws(() => save('套房', ''), /合併/); assert.equal(writes, 0); assert(!locked);
reset(); capacity = 3; save('套房', ''); assert.equal(insertions, 1); assert.equal(rows[0][3], '房型');
(async () => {
  const { validCall } = await import('../worker/api.mjs');
  for (const validate of [validCall, ctx.rentalBridgeValidCall_]) {
    for (const value of ['', '套房', '雅房']) assert(validate('saveTenantField', ['401', 'roomType', value, '']));
    for (const args of [['401', 'roomType', '未知', ''], ['401', 'roomType', '套房', null], ['401', 'roomType', '', '未知'], ['401', 'roomType', 0, '']]) {
      assert.equal(validate('saveTenantField', args), false);
    }
  }
  assert.equal(fs.readFileSync('public/downloads/SiteBridge.gs.txt', 'utf8'), fs.readFileSync('apps-script/SiteBridge.gs', 'utf8'));
  assert.equal(fs.readFileSync('public/downloads/RoomType.gs.txt', 'utf8'), fs.readFileSync('apps-script/RoomType.gs', 'utf8'));
  console.log('PASS: room type optional read without writes, explicit suite/shared choices and clearing, preserved student/zero rent/leading zeros, locked conflict checks, formula/merge/header/duplicate guards, enum validation in Worker and bridge, matching download extensions.');
})().catch(error => { console.error(error); process.exitCode = 1; });
