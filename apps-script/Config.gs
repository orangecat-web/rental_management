/** 僅在 Apps Script 後端填入；不要把正式設定提交到公開 GitHub。 */
const RENTAL_CONFIG = Object.freeze({
  BASIC_SPREADSHEET_ID: '請填房客基本資料試算表ID',
  BASIC_SHEET_NAME: '房客資料',
  BILLING_SPREADSHEET_ID: '請填每月帳務試算表ID',
  METER_FOLDER_ID: '請填電表照片根資料夾ID',
  RECEIPT_FOLDER_ID: '請填匯款截圖根資料夾ID',
  ALLOWED_EMAILS: ['請填你的Google信箱', '請填房東Google信箱'],
  ELECTRIC_RATE: 5
});
