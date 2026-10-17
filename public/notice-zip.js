/** Small standards-compliant ZIP writer. JPGs are already compressed; store each file unchanged. */
window.RentalNoticeZip = (() => {
  const table=new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0}
  const crc32=bytes=>{let crc=0xffffffff;for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0};
  function header(size){const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)}}
  async function create(files){
    if(!Array.isArray(files)||!files.length||files.length>200)throw Error('沒有可打包的通知，或檔案數量過多。');
    const encoder=new TextEncoder(),local=[],central=[],names=new Set();let offset=0,total=0;
    for(const file of files){
      if(typeof file.name!=='string'||!/^[^/\\\x00-\x1f]+$/.test(file.name)||names.has(file.name))throw Error('通知檔名不正確或重複。');
      names.add(file.name);const name=encoder.encode(file.name),bytes=new Uint8Array(await file.blob.arrayBuffer());total+=bytes.length;
      if(name.length>65535||total>150*1024*1024)throw Error('通知檔案過大，請分批產生。');
      const crc=crc32(bytes),h=header(30),v=h.view;
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint16(12,0x21,true);
      v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);
      local.push(h.bytes,name,bytes);
      const c=header(46),cv=c.view;cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(14,0x21,true);
      cv.setUint32(16,crc,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);
      central.push(c.bytes,name);offset+=30+name.length+bytes.length;
    }
    const centralSize=central.reduce((s,b)=>s+b.length,0),end=header(22),ev=end.view;
    ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
    return new Blob([...local,...central,end.bytes],{type:'application/zip'});
  }
  return {create};
})();
