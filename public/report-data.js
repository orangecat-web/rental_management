/** Read-only report calculations. A missing reading/payment is never a measured zero. */
(() => {
  const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  function day(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y,m,d] = value.split('-').map(Number), stamp = Date.UTC(y,m-1,d);
    const date = new Date(stamp);
    return date.getUTCFullYear() === y && date.getUTCMonth() === m-1 && date.getUTCDate() === d ? stamp / 86400000 : null;
  }
  function meter(account) {
    const m = account.meter;
    if (!m) return {valid:false,reason:'沒有電表紀錄'};
    if (!number(m.previousReading) || !number(m.currentReading)) return {valid:false,reason:'待補電表度數'};
    const usage = Math.round((m.currentReading-m.previousReading)*1000000)/1000000;
    if (usage < 0) return {valid:false,reason:'本期度數小於前期，請核對'};
    const start = day(m.previousReadingDate), end = day(m.currentReadingDate);
    if (start === null || end === null || end <= start) return {valid:false,reason:'抄表日期待補或期間不正確'};
    if (Number(m.currentReadingDate.slice(0,4)) !== account.year || Number(m.currentReadingDate.slice(5,7)) !== account.month) return {valid:false,reason:'本期抄表日與帳務月份不符'};
    if (m.usage !== null && m.usage !== undefined && (!number(m.usage) || Math.abs(m.usage-usage) > .000001)) return {valid:false,reason:'使用電度與電表差值不一致'};
    return {valid:true,usage,days:end-start,daily:usage/(end-start),previousDate:m.previousReadingDate,currentDate:m.currentReadingDate};
  }
  function aggregate(accounts, get) {
    const values=accounts.map(get), known=values.filter(number);
    return {value:known.length===accounts.length && accounts.length ? known.reduce((s,v)=>s+Math.round(v*100),0)/100 : null,known:known.length,total:accounts.length};
  }
  function prepare(year,month,accounts) {
    if (!Array.isArray(accounts) || !accounts.length) throw Error('本月沒有房間資料');
    const rooms=new Set();
    for (const a of accounts) {
      if (!a || a.year!==year || a.month!==month || !/^\d{3,8}$/.test(String(a.room)) || rooms.has(String(a.room))) throw Error('月份或房號資料不正確');
      rooms.add(String(a.room));
    }
    const odd=month%2===1;
    const rows=accounts.map(a=>({room:String(a.room),name:String(a.name||'').trim(),arrears:a.arrears,creditApplied:a.creditApplied,rent:a.rent,electricityFee:a.electricityFee,totalDue:a.totalDue,effectivePaid:a.effectivePaid,netDue:a.netDue,unpaid:a.unpaid,overpaid:a.overpaid,creditWarning:a.creditWarning||'',meter:meter(a)}));
    return {year,month,rows,rent:aggregate(rows,a=>a.rent),electricity:aggregate(rows,a=>odd?a.electricityFee:0),paid:aggregate(rows,a=>a.effectivePaid),debt:aggregate(rows,a=>a.unpaid),credit:aggregate(rows,a=>a.overpaid),warnings:rows.filter(a=>a.creditWarning).length};
  }
  /** Allocate funds once, FIFO: old claims, current rent, then electricity.
   * Cohorts retain their original month, so later receipts settle old rent without duplication.
   * Extra receipts are ignored here until the backend applies them as credit in another month.
   */
  function rentCohorts(periods) {
    const histories=new Map(), records=[];
    const cents=v=>number(v)&&Math.abs(v*100-Math.round(v*100))<.00001?Math.round(v*100):null;
    for(const p of [...periods].sort((a,b)=>a.year*12+a.month-b.year*12-b.month)) {
      for(const a of p.rows) {
        const serial=p.year*12+p.month, prior=histories.get(a.room);
        const inherited=prior&&prior.serial===serial-1&&a.name&&prior.name===a.name;
        let queue=inherited?prior.queue:[];
        const rent=cents(a.rent),fee=p.month%2?cents(a.electricityFee):0,gross=cents(a.totalDue),cash=cents(a.effectivePaid),credit=cents(a.creditApplied),arrears=cents(a.arrears);
        const record={year:p.year,month:p.month,room:a.room,rent,paid:0,valid:rent!==null};records.push(record);
        const valid=rent!==null&&fee!==null&&gross===rent+fee&&cash!==null&&credit!==null&&arrears!==null;
        if(!valid) {
          record.valid=false;for(const claim of queue)if(claim.record)claim.record.valid=false;
          histories.set(a.room,{serial,name:a.name,queue:[]});continue;
        }
        // The backend's carried amount is authoritative. A gap/name change keeps sessions separate.
        const carried=queue.reduce((sum,c)=>sum+c.left,0);
        if(carried>arrears){for(const claim of queue)if(claim.record)claim.record.valid=false;queue=[];}
        const known=queue.reduce((sum,c)=>sum+c.left,0);
        if(known<arrears)queue.unshift({left:arrears-known,record:null});
        queue.push({left:rent,record},{left:fee,record:null});
        let funds=cash+credit;
        for(const claim of queue){const used=Math.min(funds,claim.left);claim.left-=used;funds-=used;if(claim.record)claim.record.paid+=used;if(!funds)break;}
        queue=queue.filter(c=>c.left>0);
        histories.set(a.room,{serial,name:a.name,queue});
      }
    }
    return records.map(r=>({...r,rent:r.rent===null?null:r.rent/100,paid:r.paid/100,unpaid:r.rent===null?null:(r.rent-r.paid)/100}));
  }
  function rentSummary(records,months) {
    const selected=records.filter(r=>months.includes(r.month));
    const valid=selected.length>0&&selected.every(r=>r.valid);
    const sum=key=>selected.reduce((s,r)=>s+Math.round((r[key]||0)*100),0)/100;
    const total=valid?sum('rent'):null,paid=valid?sum('paid'):null,unpaid=valid?sum('unpaid'):null;
    return {valid,total,paid,unpaid,count:selected.length,unknown:selected.filter(r=>!r.valid).length,paidPercent:valid&&total>0?paid/total*100:null};
  }
  window.RentalReportData={meter,prepare,day,number,rentCohorts,rentSummary};
})();
