/**
 * Rent_Demo 的網站專用入口；沿用目前的 TenantData.gs 與 Script Properties。
 * 安裝前：把原本唯一的 doGet 改名為 legacyPreviewDoGet_，不要保留兩個 doGet。
 * 本部署只回 JSON，絕不回傳可呼叫 google.script.run 的 HTML 頁面。
 */
function doGet() {
  return rentalBridgeJson_({ ok: false, error: { code: 'AUTH', message: '請由租務管理網站操作。' } });
}

/** 執行一次；金鑰只存 Script Properties，不寫入日誌或回傳給網頁。 */
function setupRentalSiteBridgeKey() {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('RENTAL_BRIDGE_SECRET')) {
    console.log('已存在網站連線金鑰，保留原值。');
    return;
  }
  properties.setProperty('RENTAL_BRIDGE_SECRET',
    (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''));
  console.log('已建立網站連線金鑰。請在專案設定的指令碼屬性查看，不要貼到聊天或前端程式。');
}

/** 驗證簽章、時間與一次性請求後才執行允許的房客與帳務 API。 */
function doPost(e) {
  try {
    const envelope = JSON.parse(e && e.postData && e.postData.contents || '{}');
    const secret = PropertiesService.getScriptProperties().getProperty('RENTAL_BRIDGE_SECRET');
    if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) return rentalBridgeError_('CONFIG');
    if (typeof envelope.payload !== 'string' || envelope.payload.length > 16000 ||
        typeof envelope.signature !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(envelope.signature)) return rentalBridgeError_('AUTH');
    const expected = Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(envelope.payload, secret, Utilities.Charset.UTF_8)
    ).replace(/=+$/, '');
    let difference = expected.length ^ envelope.signature.length;
    for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ envelope.signature.charCodeAt(i);
    if (difference !== 0) return rentalBridgeError_('AUTH');

    const call = JSON.parse(envelope.payload);
    if (call.version !== 1 || !Number.isSafeInteger(call.issuedAt) || Math.abs(Date.now() - call.issuedAt) > 120000 ||
        typeof call.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(call.id) || !rentalBridgeValidCall_(call.action, call.args)) return rentalBridgeError_('AUTH');

    // 鎖只保護一次性請求登記；釋放後才呼叫既有寫入函式，避免重複取得 ScriptLock。
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const cache = CacheService.getScriptCache();
      const key = 'rental-site:' + call.id;
      if (cache.get(key)) return rentalBridgeError_('REPLAY');
      cache.put(key, '1', 300);
    } finally { lock.releaseLock(); }

    let data;
    try {
      switch (call.action) {
        case 'getTenantData': data = getTenantDataWithInitialMeter_(); break;
        case 'saveTenantField':
          data = ['initialMeterReading','contractDate'].includes(call.args[1]) ? saveTenantLeaseMeter_.apply(null,call.args) : call.args[1] === 'roomType' ? saveTenantRoomType_.apply(null, call.args) :
            call.args[1] === 'student' ? saveTenantStudent_.apply(null, call.args) : saveTenantField.apply(null, call.args);
          break;
        case 'saveTenantNote': data = saveTenantNote.apply(null, call.args); break;
        case 'saveTenantContract': data = saveTenantContract.apply(null, call.args); break;
        case 'getRentalSiteCapabilities': data = rentalBridgeCapabilities_(); break;
        case 'getAvailableBillingYears': data = rentalBridgeBillingYears_(); break;
        case 'getAvailableBillingMonths': data = rentalBridgeBillingMonths_(call.args[0]); break;
        case 'getMonthlyAccounts': data = getMonthlyAccountsWithSettlement_.apply(null, call.args); break;
        case 'saveMonthlyAccountField': data = call.args[3] === 'actualPaid' ? saveMonthlyActualPaid_.apply(null, call.args) : call.args[3] === 'receiptConfirmed' ? saveMonthlyReceiptConfirmed_.apply(null, call.args) : saveMonthlyAccountField.apply(null, call.args); break;
        case 'previewMonthlyInitialization': data = previewMonthlyInitializationWithInitialMeter_.apply(null, call.args); break;
        case 'initializeMonthlyAccounts': data = initializeMonthlyAccountsWithInitialMeter_.apply(null, call.args); break;
        case 'previewMonthlyAccountsSheetCreation': data = previewMonthlyAccountsSheetCreation.apply(null, call.args); break;
        case 'createMonthlyAccountsSheet': data = createMonthlyAccountsSheet.apply(null, call.args); break;
        case 'getMonthlyPaymentPhotos': data = getMonthlyPaymentPhotos.apply(null, call.args); break;
        case 'getRoomPaymentPhotoSelection': data = getRoomPaymentPhotoSelection.apply(null, call.args); break;
        case 'saveRoomPaymentPhotoSelection': data = saveRoomPaymentPhotoSelection.apply(null, call.args); break;
        case 'getPaymentPhoto': data = getPaymentPhoto.apply(null, call.args); break;
        case 'getMeterPhoto': data = getMeterPhoto.apply(null, call.args); break;
        case 'getRoomNoticeData': data = getRoomNoticeWithSettlement_.apply(null, call.args); break;
        default: return rentalBridgeError_('AUTH');
      }
    } catch (error) {
      return rentalBridgeJson_({ ok: false, error: { code: 'BUSINESS', message: String(error.message || '資料處理失敗，請重新讀取。').slice(0, 400) } });
    }
    return rentalBridgeJson_({ ok: true, data: data });
  } catch (_) {
    return rentalBridgeError_('AUTH');
  }
}

function rentalBridgeValidCall_(action, args) {
  if (!Array.isArray(args)) return false;
  const text = (value, max = 2000) => typeof value === 'string' && value.length <= max;
  const room = value => typeof value === 'string' && /^\d{3,8}$/.test(value);
  const year = value => ['number', 'string'].includes(typeof value) && /^\d{4}$/.test(String(value));
  const month = value => ['number', 'string'].includes(typeof value) && Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 12;
  const expected = value => value === null || (typeof value === 'number' && Number.isFinite(value)) || text(value);
  const file = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value);
  const leaseDate = value => value === '' || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  if (['getTenantData', 'getRentalSiteCapabilities', 'getAvailableBillingYears'].includes(action)) return args.length === 0;
  if (action === 'saveTenantField') return args.length === 4 && room(args[0]) &&
    ['name','phone','startDate','endDate','rent','cohabitant','cohabitantPhone','emergencyContact','emergencyPhone','introduction','maintenance','defaultTransferLastFive','student','roomType','initialMeterReading','contractDate'].includes(args[1]) && text(args[2]) && expected(args[3]) &&
    (args[1] !== 'roomType' || (['','套房','雅房'].includes(args[2]) && ['','套房','雅房'].includes(args[3]))) &&
    (args[1] !== 'contractDate' || leaseDate(args[2]) && leaseDate(args[3])) &&
    (args[1] !== 'initialMeterReading' || (args[2] === '' || /^\d+(?:\.\d+)?$/.test(args[2]) && Number(args[2])<=100000000) && (args[3] === null || typeof args[3] === 'number' && Number.isFinite(args[3]) && args[3]>=0 && args[3]<=100000000));
  if (action === 'saveTenantNote') return args.length === 3 && room(args[0]) && text(args[1]) && text(args[2]);
  if (action === 'saveTenantContract') return args.length === 3 && room(args[0]) && text(args[1]) && Array.isArray(args[2]) && args[2].length <= 20 && args[2].every(v => text(v));
  if (!year(args[0])) return false;
  if (action === 'getAvailableBillingMonths') return args.length === 1;
  if (!month(args[1])) return false;
  if (['getMonthlyAccounts','previewMonthlyInitialization','initializeMonthlyAccounts','previewMonthlyAccountsSheetCreation','createMonthlyAccountsSheet','getMonthlyPaymentPhotos'].includes(action)) return args.length === 2;
  if (action === 'getPaymentPhoto') return args.length === 3 && file(args[2]);
  if (!room(args[2])) return false;
  if (['getMeterPhoto','getRoomNoticeData'].includes(action)) return args.length === 3 && Number(args[1]) % 2 === 1;
  if (action === 'getRoomPaymentPhotoSelection') return args.length === 3;
  if (action === 'saveMonthlyAccountField') return args.length === 6 &&
    ['transferDate','transferLastFive','notes','currentReadingDate','currentReading','actualPaid','receiptConfirmed'].includes(args[3]) &&
    (!['currentReadingDate','currentReading'].includes(args[3]) || Number(args[1]) % 2 === 1) && text(args[4]) && expected(args[5]);
  if (action === 'saveRoomPaymentPhotoSelection') return args.length === 5 && Array.isArray(args[3]) && args[3].length <= 20 &&
    args[3].every(file) && new Set(args[3]).size === args[3].length && text(args[4], 12000);
  return false;
}

function rentalBridgeError_(code) {
  return rentalBridgeJson_({ ok: false, error: { code: code, message: '網站連線驗證失敗。' } });
}
function rentalBridgeJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

/** v2 能力資訊不包含房客資料、檔案 ID 或金鑰。 */
function rentalBridgeCapabilities_() {
  return { version: 2, billing: typeof getMonthlyAccounts === 'function', notices: typeof getRoomNoticeData === 'function' };
}
/** 直接沿用既有年份設定；不需要重新執行年度 setup。 */
function rentalBridgeBillingYears_() {
  const properties = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(properties).map(function (key) {
    const match = /^BILLING_SPREADSHEET_ID_(\d{4})$/.exec(key);
    return match && properties[key] ? Number(match[1]) : null;
  }).filter(function (year) { return year !== null; }).sort(function (a, b) { return a - b; });
}
function rentalBridgeBillingMonths_(year) {
  const id = PropertiesService.getScriptProperties().getProperty('BILLING_SPREADSHEET_ID_' + String(year));
  if (!id) throw new Error('尚未設定該年份的帳務來源。');
  return SpreadsheetApp.openById(id).getSheets().map(function (sheet) {
    const name = sheet.getName();
    return /^(?:[1-9]|1[0-2])$/.test(name) ? Number(name) : null;
  }).filter(function (month) { return month !== null; }).sort(function (a, b) { return a - b; });
}
