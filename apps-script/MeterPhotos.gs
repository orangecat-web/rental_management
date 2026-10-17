/**
 * 設定 2026 年電表照片主資料夾。
 * 不修改照片或分享權限。
 */
function setupMeterPhotos2026() {
  const folder = DriveApp.getFolderById(
    '1FG3ZRJmgNKtu-6qgkNV8oUwtqaWbnf6W'
  );

  // 實際讀取，確認目前帳號可以存取。
  const name = folder.getName();

  PropertiesService.getScriptProperties().setProperty(
    'METER_PHOTO_FOLDER_ID_2026',
    folder.getId()
  );

  console.log('已設定 2026 年電表照片來源：' + name);
}

/**
 * 取得指定年份、月份的電表照片資料夾。
 * 路徑：已設定的主資料夾／11。
 */
function getMeterPhotoFolder_(year, month) {
  const yearText = String(year);
  const monthNumber = Number(month);

  if (
    !/^\d{4}$/.test(yearText) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    throw new Error('年份或月份格式不正確。');
  }

  const id = PropertiesService.getScriptProperties()
    .getProperty('METER_PHOTO_FOLDER_ID_' + yearText);

  if (!id) {
    throw new Error('尚未設定 ' + yearText + ' 年電表照片來源。');
  }

  const root = DriveApp.getFolderById(id);
  const folders = root.getFoldersByName(
    String(monthNumber).padStart(2, '0')
  );

  if (!folders.hasNext()) {
    throw new Error('找不到月份照片資料夾，請確認名稱為兩位數，例如 11。');
  }

  const folder = folders.next();

  if (folders.hasNext()) {
    throw new Error('有重複的月份資料夾，請先核對。');
  }

  return folder;
}

/**
 * 測試依 401 房的本期抄表日期配對照片。
 * 只檢查，不修改檔案。
 */
function testNovemberMeterPhoto() {
  const account = readMonthlyAccounts_(2026, 11)
    .find(item => item.room === '401');

  const date = account?.meter?.currentReadingDate;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('請先填寫 401 房的有效本期抄表日期。');
  }

  if (!date.startsWith('2026-')) {
    throw new Error('抄表年份與照片來源年份不同，請先核對。');
  }

  const folder = getMeterPhotoFolder_(2026, 11);

  // 支援房號檔名，亦相容舊版房號加日期檔名。
  const baseName = account.room;

  const pattern = new RegExp(
    '^' + baseName + '(?:_' + date.slice(5, 7) + date.slice(8, 10) + ')?\\.(jpg|jpeg|png|webp)$',
    'i'
  );

  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/webp'
  ];

  const files = folder.getFiles();
  let matches = 0;

  while (files.hasNext()) {
    const file = files.next();

    if (
      !file.isTrashed() &&
      pattern.test(file.getName()) &&
      allowedTypes.includes(file.getMimeType())
    ) {
      matches++;
    }
  }

  console.log('檢查月份：2026 年 11 月');
  console.log('檢查房號：401');
  console.log('預期檔名：' + baseName + '.jpg（亦支援 jpeg、png、webp）');
  console.log('符合照片：' + matches + ' 張');

  if (matches > 1) {
    throw new Error('照片配對重複，請保留一張正確照片後再測試。');
  }

  console.log(
    matches === 1
      ? '照片配對成功。'
      : '尚未找到照片，請確認檔名及所在月份資料夾。'
  );
}

/**
 * 依年月資料夾與房號讀取照片；抄表日期取自帳務。
 * 由已授權網站簽章橋接呼叫；不修改 Drive 分享權限。
 */
function getMeterPhoto(year, month, room) {
  const roomText = String(room ?? '').trim();
  const monthNumber = Number(month);

  if (
    !/^\d+$/.test(roomText) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    monthNumber % 2 === 0
  ) {
    throw new Error('請指定有效房號及奇數月份。');
  }

  const account = readMonthlyAccounts_(year, monthNumber)
    .find(item => item.room === roomText);

  if (!account) {
    throw new Error('找不到此房間的月份帳務。');
  }

  const date = account.meter?.currentReadingDate;

  if (!date) {
    return { found: false, message: '請先儲存本期抄表日期。' };
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date.slice(0, 7) !== String(year) + '-' + String(monthNumber).padStart(2, '0') ||
    !Number.isFinite(Date.parse(date + 'T00:00:00Z')) ||
    new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date
  ) {
    throw new Error('本期抄表日期格式或年份不正確。');
  }

  const folder = getMeterPhotoFolder_(year, monthNumber);
  const baseName = roomText;

  const pattern = new RegExp(
    '^' + baseName + '(?:_' + date.slice(5, 7) + date.slice(8, 10) + ')?\\.(jpg|jpeg|png|webp)$',
    'i'
  );

  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/webp'
  ];

  const matches = [];
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();

    if (
      !file.isTrashed() &&
      pattern.test(file.getName()) &&
      allowedTypes.includes(file.getMimeType())
    ) {
      matches.push(file);
    }
  }

  if (matches.length === 0) {
    return { found: false, message: '尚未提供此房間的照片（例如 401.jpg、401.png、401.webp）。' };
  }

  if (matches.length > 1) {
    throw new Error('有多張符合的照片，請先核對檔案。');
  }

  const file = matches[0];

  // Demo 單張限制 8 MiB，避免傳送過大的原圖。
  if (file.getSize() > 8 * 1024 * 1024) {
    throw new Error('照片超過 8 MiB，請先縮小圖片。');
  }

  return {
    found: true,
    readingDate: date,
    dataUrl: 'data:' + file.getMimeType() + ';base64,' +
      Utilities.base64Encode(file.getBlob().getBytes())
  };
}


