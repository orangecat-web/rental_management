/**
 * 第一部分 Google 存取層。房客表與帳務表分離；照片保留在 Drive。
 * 所有入口驗證 Google 使用者；更新使用 ScriptLock 及資料指紋。
 * 僅寫指定人工欄位，不改原公式；請先對測試副本執行。
 */
function doGet() {
  requireUser_();
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('寓所・房客與收租管理')
    .addMetaTag('viewport', 'width=device-width,initial-scale=1');
}
function requireUser_() {
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email || !RENTAL_CONFIG.ALLOWED_EMAILS.map(e=>e.toLowerCase()).includes(email))
    throw new Error('此 Google 帳號未獲授權。請以指定帳號登入，並確認部署為「以存取網頁的使用者身分執行」。');
  return email;
}
function checkConfiguration() {
  const email = requireUser_();
  const basic = SpreadsheetApp.openById(RENTAL_CONFIG.BASIC_SPREADSHEET_ID);
  const billing = SpreadsheetApp.openById(RENTAL_CONFIG.BILLING_SPREADSHEET_ID);
  return {email,basic:basic.getName(),billing:billing.getName(),
    meterFolder:DriveApp.getFolderById(RENTAL_CONFIG.METER_FOLDER_ID).getName(),
    receiptFolder:DriveApp.getFolderById(RENTAL_CONFIG.RECEIPT_FOLDER_ID).getName()};
}
function month_(period) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw new Error('月份須為 YYYY-MM。');
  return period;
}
function normalize_(s){return String(s).replace(/[\s\u3000]/g,'').trim();}
function table_(sheet) {
  if(!sheet)throw new Error('找不到指定分頁，請確認設定及月份名稱。');
  const values=sheet.getDataRange().getValues();
  const headers=values.shift().map(normalize_);
  return {sheet,headers,values};
}
function column_(table,aliases,required=true) {
  for(const alias of aliases){const i=table.headers.indexOf(normalize_(alias));if(i>=0)return i;}
  if(required)throw new Error('缺少欄位：'+aliases[0]);return -1;
}
function value_(t,row,aliases,fallback='') {const i=column_(t,aliases,false);return i<0?fallback:row[i];}
function number_(v){if(v===''||v===null)return 0;const n=Number(String(v).replace(/NT\$|TWD|[$,\s]/gi,''));if(!Number.isFinite(n))throw new Error('金額不是有效數字：'+v);return n;}
function serial_(v){return v instanceof Date?Utilities.formatDate(v,'Asia/Taipei','yyyy-MM-dd'):v;}
function fingerprint_(t,rowIndex) {
  const range=t.sheet.getRange(rowIndex,1,1,t.headers.length);
  const text=JSON.stringify([range.getValues()[0].map(serial_),range.getFormulas()[0]]);
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text));
}
function sheet_(id,name){return table_(SpreadsheetApp.openById(id).getSheetByName(name));}
function rowByRoom_(t,room) {
  const column=column_(t,['房號']);const matches=[];
  t.values.forEach((r,i)=>{if(String(r[column]).trim()===String(room).trim())matches.push(i+2)});
  if(matches.length!==1)throw new Error('房號不存在或重複，請先核對資料表：'+room);
  return matches[0];
}
function readBasic() {
  requireUser_();const t=sheet_(RENTAL_CONFIG.BASIC_SPREADSHEET_ID,RENTAL_CONFIG.BASIC_SHEET_NAME);
  const roomCol=column_(t,['房號']);
  // 合併儲存格只用於讀取顯示；寫入時不自行推論跨房租約。
  const readMerged=(row,col)=>{if(col<0)return '';const cell=t.sheet.getRange(row,col+1);const merged=cell.getMergedRanges();return serial_(merged.length?merged[0].getCell(1,1).getValue():cell.getValue())};
  return {rows:t.values.map((r,i)=>({room:String(r[roomCol]).trim(),name:readMerged(i+2,column_(t,['居住者','簽約人'])),phone:readMerged(i+2,column_(t,['連絡電話','聯絡電話'],false)),
    start:serial_(value_(t,r,['起租日'])),end:serial_(value_(t,r,['到期日'])),rent:number_(value_(t,r,['目前房租','房租'],0)),
    cohabitant:value_(t,r,['同居人']),cohabitantPhone:value_(t,r,['同居人電話']),emergency:value_(t,r,['緊急聯絡人']),emergencyPhone:value_(t,r,['聯絡人電話']),intro:value_(t,r,['基本介紹']),note:value_(t,r,['備註']),maintenance:value_(t,r,['房間維護整修紀錄']),fingerprint:fingerprint_(t,i+2)})).filter(r=>r.room)};
}
function readMonth(period) {
  requireUser_();month_(period);const t=sheet_(RENTAL_CONFIG.BILLING_SPREADSHEET_ID,period);const roomCol=column_(t,['房號']);
  return {month:period,rows:t.values.map((r,i)=>({room:String(r[roomCol]).trim(),name:value_(t,r,['簽約人','居住者']),rent:number_(value_(t,r,['房租'],0)),
    previousDate:serial_(value_(t,r,['前期抄表日期','前期抄表日'])),previous:value_(t,r,['前期電表']),date:serial_(value_(t,r,['本期抄表日期','本期抄表日'])),current:value_(t,r,['本期電表']),
    electric:number_(value_(t,r,['需繳電費','電費'],0)),total:number_(value_(t,r,['應繳金額'],0)),paymentDate:serial_(value_(t,r,['轉帳日期','收款日期'])),
    photoFileId:value_(t,r,['本期照片檔案ID']),receiptFileId:value_(t,r,['匯款截圖檔案ID']),fingerprint:fingerprint_(t,i+2)})).filter(r=>r.room)};
}
/** 僅更新本期讀數/日期及收款日期；計費沿用既有公式。 */
function writeMonthInputs(period,room,patch,fingerprint) {
  const email=requireUser_();month_(period);const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const t=sheet_(RENTAL_CONFIG.BILLING_SPREADSHEET_ID,period),row=rowByRoom_(t,room);
    if(fingerprint_(t,row)!==fingerprint)throw new Error('資料已由其他人或試算表更新，請重新讀取再修改。');
    const allowed={current:['本期電表'],date:['本期抄表日期','本期抄表日'],paymentDate:['轉帳日期','收款日期']};
    if(!patch||Object.keys(patch).some(k=>!allowed[k]))throw new Error('包含未允許寫入的欄位。');
    const ops=[];
    for(const [key,value] of Object.entries(patch)){
      const cell=t.sheet.getRange(row,column_(t,allowed[key])+1);
      if(cell.getFormula()||cell.isPartOfMerge())throw new Error('此欄位為公式或合併儲存格，請先確認：'+allowed[key][0]);
      let next=value;
      if(key==='current'){
        if(Number(period.slice(5))%2!==1)throw new Error('僅單數月份可登記電費抄表。');
        const prev=t.sheet.getRange(row,column_(t,['前期電表'])+1).getValue();
        if(prev===''||value===''||!Number.isFinite(Number(value))||Number(value)<Number(prev))throw new Error('本期讀數無效，或缺少上期讀數。');next=Number(value);
      }else if(value!==''){
        if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new Error('日期格式錯誤。');
        if(key==='date'&&value.slice(0,7)!==period)throw new Error('抄表日期不在所選月份。');
        next=Utilities.parseDate(value+' 12:00','Asia/Taipei','yyyy-MM-dd HH:mm');
      }
      ops.push({cell,next,old:cell.getValue()});
    }
    try{ops.forEach(o=>o.cell.setValue(o.next));SpreadsheetApp.flush();}
    catch(error){ops.forEach(o=>o.cell.setValue(o.old));SpreadsheetApp.flush();throw error;}
    return {ok:true,actor:email,fingerprint:fingerprint_(t,row),message:'指定人工欄位已寫回；原有公式保持不變。'};
  }finally{lock.releaseLock();}
}
function periodFolder_(kind,period) {
  month_(period);if(!['meter','receipt'].includes(kind))throw new Error('資料夾類型錯誤。');
  const root=DriveApp.getFolderById(kind==='meter'?RENTAL_CONFIG.METER_FOLDER_ID:RENTAL_CONFIG.RECEIPT_FOLDER_ID);
  const [year,month]=period.split('-');let folder=root;
  for(const name of [year,month]){const matches=folder.getFoldersByName(name);if(!matches.hasNext())throw new Error('找不到資料夾：'+year+'/'+month);folder=matches.next();if(matches.hasNext())throw new Error('存在重複名稱的年月資料夾，請先整理。');}
  return folder;
}
function listPhotos(period,kind) {
  requireUser_();const folder=periodFolder_(kind,period),files=folder.getFiles(),result=[];
  while(files.hasNext()){
    const file=files.next();if(!file.getMimeType().startsWith('image/'))continue;
    const name=file.getName(),match=/^(\d+)_([01]\d)([0-3]\d)\.(jpe?g|png|webp)$/i.exec(name);
    let date='',error='檔名格式應為 401_1101.jpg';
    if(match){date=period.slice(0,4)+'-'+match[2]+'-'+match[3];try{error=date.slice(0,7)!==period||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date?'檔名日期與資料夾月份不符或日期無效。':'';}catch(e){error='日期無效。';}}
    result.push({id:file.getId(),name,room:match?match[1]:'',date,valid:!error,error});
  }
  return result.sort((a,b)=>a.name.localeCompare(b.name));
}
function readPhotoFile(fileId,kind,period) {
  requireUser_();const folder=periodFolder_(kind,period),file=DriveApp.getFileById(fileId),parents=file.getParents();let allowed=false;
  while(parents.hasNext())if(parents.next().getId()===folder.getId())allowed=true;
  if(!allowed||!/^image\/(jpeg|png|webp)$/.test(file.getMimeType()))throw new Error('檔案不在指定月份照片資料夾，或不是支援的照片。');
  if(file.getSize()>4*1024*1024)throw new Error('雲端原圖大於 4MB，請先縮圖後讀取。');
  return {id:file.getId(),name:file.getName(),dataUrl:'data:'+file.getMimeType()+';base64,'+Utilities.base64Encode(file.getBlob().getBytes())};
}
/** 基本資料逐房編輯；合併欄位不猜測如何拆分，先於副本取消合併。 */
function writeBasicFields(room,patch,fingerprint) {
  const actor=requireUser_(),lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    const t=sheet_(RENTAL_CONFIG.BASIC_SPREADSHEET_ID,RENTAL_CONFIG.BASIC_SHEET_NAME),row=rowByRoom_(t,room);
    if(fingerprint_(t,row)!==fingerprint)throw new Error('房客資料已更新，請重新讀取。');
    const fields={name:['居住者','簽約人'],phone:['連絡電話','聯絡電話'],start:['起租日'],end:['到期日'],rent:['目前房租','房租'],cohabitant:['同居人'],cohabitantPhone:['同居人電話'],emergency:['緊急聯絡人'],emergencyPhone:['聯絡人電話'],intro:['基本介紹'],note:['備註'],maintenance:['房間維護整修紀錄']};
    if(!patch||Object.keys(patch).some(k=>!fields[k]))throw new Error('包含未允許的基本資料欄位。');
    const ops=[];for(const [key,value] of Object.entries(patch)){
      const cell=t.sheet.getRange(row,column_(t,fields[key])+1);if(cell.getFormula()||cell.isPartOfMerge())throw new Error('欄位含公式或合併儲存格，請先在副本確認：'+fields[key][0]);
      let next=value;if(key==='rent'){if(value===''||!Number.isFinite(Number(value))||Number(value)<0)throw new Error('租金須為非負數，可填 0 元。');next=Number(value);}
      else if(['start','end'].includes(key)&&value!==''){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new Error('日期無效。');next=Utilities.parseDate(value+' 12:00','Asia/Taipei','yyyy-MM-dd HH:mm');}
      else{next=String(value);if(next.length>4000)throw new Error('文字過長。');if(/^[=+@-]/.test(next))next="'"+next;}
      ops.push({cell,next,old:cell.getValue()});
    }
    const current=t.values[row-2];const start=patch.start??serial_(value_(t,current,['起租日'])),end=patch.end??serial_(value_(t,current,['到期日']));if(start&&end&&start>end)throw new Error('到期日不可早於起租日。');
    try{ops.forEach(o=>o.cell.setValue(o.next));SpreadsheetApp.flush();}catch(error){ops.forEach(o=>o.cell.setValue(o.old));SpreadsheetApp.flush();throw error;}
    return {ok:true,actor,fingerprint:fingerprint_(t,row)};
  }finally{lock.releaseLock();}
}
