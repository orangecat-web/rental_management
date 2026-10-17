/** One selected-room renderer shared by individual and batch notices. */
window.RentalNotice = (() => {
  const money = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 });
  const close = (a,b) => Math.abs(a-b) < 0.000001;
  const validDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  function validate(data) {
    if (!data || !/^\d{4}$/.test(String(data.year)) || !Number.isInteger(data.month) || data.month<1 || data.month>12 || data.month%2!==1 || !/^\d{3,8}$/.test(String(data.room))) throw Error('僅能產生單數月份的單房電費通知。');
    const m=data.electricity;
    if(![data.arrears??0,data.creditApplied??0].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)||((data.creditApplied||0)>data.rent+(m?.fee||0)+(data.arrears||0)))throw Error('前期餘額格式不正確。');
    if(!m || ![data.rent,data.total,m.previousReading,m.currentReading,m.usage,m.unitPrice,m.fee].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)) throw Error('房租或電表資料尚未完整。');
    if(m.currentReading<m.previousReading || m.unitPrice!==5 || !close(m.usage,m.currentReading-m.previousReading) || !close(m.fee,m.usage*m.unitPrice) || !close(data.total,data.rent+m.fee+(data.arrears||0)-(data.creditApplied||0))) throw Error('電費或應繳金額與抄表紀錄不一致。');
    if(!validDate(m.previousDate) || !validDate(m.currentDate) || m.currentDate.slice(0,7)!==data.year+'-'+String(data.month).padStart(2,'0') || m.previousDate>m.currentDate) throw Error('抄表日期尚未完整或不符合本期月份。');
  }
  function loadImage(dataUrl) {
    return new Promise((resolve,reject)=>{
      const img=new Image();const timer=setTimeout(()=>reject(Error('照片載入逾時。')),15000);
      img.onload=()=>{clearTimeout(timer);if(!img.naturalWidth||!img.naturalHeight)reject(Error('照片尺寸不正確。'));else resolve(img)};
      img.onerror=()=>{clearTimeout(timer);reject(Error('照片無法顯示，請確認圖片檔案。'))};img.src=dataUrl;
    });
  }
  async function render(data, options={}) {
    validate(data);
    if(options.requirePhoto && !data.photo?.found) throw Error('尚缺本期電表照片。');
    const canvas=options.canvas || document.createElement('canvas');
      let photo = null;

      if (data.photo?.found) {
        if (
          typeof data.photo.dataUrl !== 'string' ||
          !/^data:image\/(jpeg|png|webp);base64,/.test(data.photo.dataUrl)
        ) {
          throw new Error('照片格式不正確。');
        }

        photo = await loadImage(data.photo.dataUrl);
      }

      const meter = data.electricity;
      const scale = photo
        ? Math.min(920 / photo.naturalWidth, 1200 / photo.naturalHeight)
        : 1;

      const photoWidth = photo ? photo.naturalWidth * scale : 0;
      const photoHeight = photo ? photo.naturalHeight * scale : 0;

      canvas.width = 1080;
      canvas.height = meter ? 1100 + Math.ceil(photoHeight) + (data.arrears>0?65:0) + (data.creditApplied>0?65:0) : 700;

      const ctx = canvas.getContext('2d');
      const font = 'system-ui, sans-serif';

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      function text(content, x, y, size, color = '#294638', bold = false) {
        ctx.fillStyle = color;
        ctx.font = (bold ? 'bold ' : '') + size + 'px ' + font;
        ctx.textAlign = 'left';
        ctx.fillText(content, x, y);
      }

      text('電費通知', 80, 90, 52, '#294638', true);
      text(data.year + ' 年 ' + data.month + ' 月', 80, 150, 34);
      text(data.room + ' 房', 80, 240, 70, '#294638', true);

      ctx.strokeStyle = '#dce3d6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(80, 275);
      ctx.lineTo(1000, 275);
      ctx.stroke();

      let y = 340;

      function row(label, value) {
        text(label, 80, y, 34);
        ctx.textAlign = 'right';
        ctx.fillText(value, 1000, y);
        ctx.textAlign = 'left';
        y += 65;
      }

      if (data.dueDate) row('應繳日期', data.dueDate);

      row('房租', 'NT$ ' + money.format(data.rent));

      if (meter) {
        row('本期電費', 'NT$ ' + money.format(meter.fee));
      }

      if(data.arrears>0)row('前期未收累計','NT$ '+money.format(data.arrears));
      if(data.creditApplied>0)row('多收抵扣','− NT$ '+money.format(data.creditApplied));
      ctx.fillStyle = '#eaf0e3';
      ctx.fillRect(60, y - 10, 960, 110);
      text('應繳金額', 80, y + 60, 38, '#294638', true);

      ctx.textAlign = 'right';
      ctx.fillText('NT$ ' + money.format(data.total), 1000, y + 60);
      ctx.textAlign = 'left';
      y += 165;

      if (meter) {
        text('電費明細', 80, y, 38, '#294638', true);
        y += 65;

        row(
          '前期 ' + meter.previousDate,
          money.format(meter.previousReading) + ' 度'
        );

        row(
          '本期 ' + meter.currentDate,
          money.format(meter.currentReading) + ' 度'
        );

        row(
          '使用 ' + money.format(meter.usage) + ' 度',
          '每度 ' + money.format(meter.unitPrice) + ' 元'
        );

        y += 20;
        text('本期電表照片', 80, y, 34, '#294638', true);
        y += 35;

        if (photo) {
          ctx.drawImage(
            photo, (1080 - photoWidth) / 2, y,
            photoWidth, photoHeight
          );
        } else {
          text('尚未提供照片', 80, y + 45, 30, '#687963');
        }
      }


    const missingPhoto=!photo;
    if(photo)photo.src='';
    const blob=missingPhoto ? null : await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.92));
    if(!missingPhoto&&!blob)throw Error('JPG 產生失敗。');
    return {canvas,blob,missingPhoto};
  }
  function filename(data) {return data.year+'-'+String(data.month).padStart(2,'0')+'_'+data.room+'_電費通知.jpg'}
  return {render,filename,validate};
})();
