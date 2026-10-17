const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let entries=[],date='2026-11-01';const iterator=a=>{let i=0;return {hasNext:()=>i<a.length,next:()=>a[i++]}};
const photo=(name,mime='image/jpeg',size=100,trashed=false)=>({getName:()=>name,getMimeType:()=>mime,getSize:()=>size,isTrashed:()=>trashed,getBlob:()=>({getBytes:()=>[1,2]})});
const ctx={readMonthlyAccounts_:()=>[{room:'401',meter:{currentReadingDate:date}}],Utilities:{base64Encode:()=> 'AQI='},PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'root'})},DriveApp:{getFolderById:()=>({getFoldersByName:m=>{assert.equal(m,'11');return iterator([{getFiles:()=>iterator(entries)}])}})}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('apps-script/MeterPhotos.gs','utf8'),ctx);
for(const [name,mime] of [['401.jpg','image/jpeg'],['401.JPEG','image/jpeg'],['401.png','image/png'],['401.WeBp','image/webp'],['401_1101.jpg','image/jpeg']]){entries=[photo(name,mime)];const result=ctx.getMeterPhoto(2026,11,'401');assert(result.found,name);assert(result.dataUrl.startsWith('data:'+mime));assert.equal(result.readingDate,date)}
for(const name of ['402.jpg','401_1001.jpg','401.jpg.exe','401a.png']){entries=[photo(name)];assert.equal(ctx.getMeterPhoto(2026,11,'401').found,false,name)}
entries=[photo('401.jpg'),photo('401.png','image/png')];assert.throws(()=>ctx.getMeterPhoto(2026,11,'401'),/多張/);
entries=[photo('401.jpg'),photo('401_1101.png','image/png')];assert.throws(()=>ctx.getMeterPhoto(2026,11,'401'),/多張/);
entries=[photo('401.png','text/plain')];assert.equal(ctx.getMeterPhoto(2026,11,'401').found,false);
entries=[photo('401.jpg','image/jpeg',9*1024*1024)];assert.throws(()=>ctx.getMeterPhoto(2026,11,'401'),/8 MiB/);
entries=[photo('401.jpg','image/jpeg',100,true)];assert.equal(ctx.getMeterPhoto(2026,11,'401').found,false);
for(const invalid of ['2026-09-01','2026-11-31']){date=invalid;assert.throws(()=>ctx.getMeterPhoto(2026,11,'401'),/日期/)}
date='';assert.equal(ctx.getMeterPhoto(2026,11,'401').found,false);
console.log('PASS: JPG/JPEG/PNG/WebP case-insensitive room filenames; date-named compatibility; exact room and monthly date; duplicate/mime/trash/size protection; no data writes.');
