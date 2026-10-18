/** One read-only statistics page; rent allocation and electricity use separate charts and units. */
window.RentalComponents.reports = function () {
  const {ref,computed,onMounted,onBeforeUnmount}=Vue,D=RentalReportData;
  const rpc=(name,...args)=>new Promise((resolve,reject)=>RentalTransport('billing').script.run.withSuccessHandler(resolve).withFailureHandler(reject)[name](...args));
  const fmt=v=>v===null||v===undefined?'待補':new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(v);
  const now=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'numeric'}).formatToParts(new Date());
  const currentYear=Number(now.find(p=>p.type==='year').value),currentMonth=Number(now.find(p=>p.type==='month').value);
  return {
    components:{ReportBars:RentalReportCharts.bars,RentPie:RentalReportCharts.pie},
    setup(){
      const years=ref([]),availableMonths=ref([]),year=ref(currentYear),periods=ref([]),failures=ref([]),busy=ref(false),status=ref(''),month=ref(0),meterMonth=ref(0),room=ref(''),roomCompareMonth=ref(0),mode=ref('usage'),powerMetric=ref('usage'),rentScope=ref('month'),quarter=ref(1);let alive=true;
      const future=m=>Number(year.value)>currentYear||(Number(year.value)===currentYear&&m>currentMonth);
      const cap=computed(()=>Number(year.value)<currentYear?12:Number(year.value)===currentYear?currentMonth:0);
      const visible=computed(()=>periods.value);
      const financialPeriods=computed(()=>periods.value.filter(p=>p.month<=cap.value));
      const asOf=computed(()=>financialPeriods.value.at(-1)?.month||0);
      const timeline=computed(()=>{const candidates=availableMonths.value;if(!candidates.length)return [];return Array.from({length:Math.max(...candidates)-Math.min(...candidates)+1},(_,i)=>Math.min(...candidates)+i).map(m=>periods.value.find(p=>p.month===m)||{year:Number(year.value),month:m,rows:null});});
      const meterPeriods=computed(()=>visible.value.filter(p=>p.month%2===1));
      const meterPeriod=computed(()=>meterPeriods.value.find(p=>p.month===Number(meterMonth.value)));
      const rooms=computed(()=>[...new Set(visible.value.flatMap(p=>p.rows.map(a=>a.room)))].sort((a,b)=>Number(a)-Number(b)));
      const financialTimeline=computed(()=>timeline.value.filter(p=>p.month<=cap.value));
      const records=computed(()=>D.rentCohorts(financialPeriods.value));
      const hasFailures=computed(()=>failures.value.some(f=>f.month<=cap.value));
      const rentMonths=computed(()=>{let start=1,end=cap.value;if(rentScope.value==='month')start=end=Number(month.value);else if(rentScope.value==='quarter'){start=(Number(quarter.value)-1)*3+1;end=Math.min(start+2,cap.value);}if(start<1||end<start)return [];return Array.from({length:end-start+1},(_,i)=>start+i);});
      const pieSummary=computed(()=>{const s=D.rentSummary(records.value,rentMonths.value);return hasFailures.value?{...s,valid:false,total:null,paid:null,unpaid:null,paidPercent:null}:s;});
      const coveredMonths=computed(()=>financialPeriods.value.filter(p=>rentMonths.value.includes(p.month)).map(p=>p.month));
      const missingMonths=computed(()=>rentMonths.value.filter(m=>!coveredMonths.value.includes(m)));
      const rentLabel=computed(()=>rentScope.value==='year'?year.value+' 年':rentScope.value==='quarter'?year.value+' 年第 '+quarter.value+' 季':year.value+' 年 '+month.value+' 月');
      const quarters=computed(()=>[1,2,3,4].filter(q=>(q-1)*3+1<=cap.value));
      const rentItems=computed(()=>financialTimeline.value.map(p=>{const r=D.rentSummary(records.value,[p.month]);const usable=r.valid&&!hasFailures.value;return {key:p.month,label:p.month+' 月'+(future(p.month)?'（預排）':''),value:usable?r.total:null,detail:usable?'已繳 '+fmt(r.paid)+'／未繳 '+fmt(r.unpaid):'資料待補或需核對',detailParts:usable?['已繳 '+fmt(r.paid),'未繳 '+fmt(r.unpaid)]:null,parts:usable?[{label:'已繳租金',value:r.paid,offset:0,color:'#589273',fill:'#58927366'},{label:'未繳租金',value:r.unpaid,offset:r.paid,color:'#d8787b',fill:'#d8787b55'}]:null};}));
      const rentWarnings=computed(()=>financialPeriods.value.reduce((s,p)=>s+p.warnings,0));
      const totalPowerItems=computed(()=>timeline.value.filter(p=>p.month%2===1).map(p=>{const valid=p.rows?.filter(a=>a.meter.valid)||[],count=p.rows?.length||0,known=valid.reduce((s,a)=>s+a.meter.usage,0),full=count>0&&valid.length===count;return {key:p.month,label:p.month+' 月',value:powerMetric.value==='fee'?(p.electricity?.value??null):full?known:null,detail:count?(valid.length+'/'+count+' 間有效'+(!full?'；已知 '+fmt(known)+' 度':'')):'未建立或讀取失敗'};}));
      const meterRows=computed(()=>meterPeriod.value?.rows||[]),validMeters=computed(()=>meterRows.value.filter(a=>a.meter.valid));
      const usageTotal=computed(()=>validMeters.value.reduce((s,a)=>s+a.meter.usage,0));
      const singleValue=a=>!a?null:mode.value==='fee'?(D.number(a.electricityFee)?a.electricityFee:null):a.meter.valid?a.meter[mode.value]:null;
      const yearMeterMonths=[1,3,5,7,9,11];
      const periodTrend=r=>yearMeterMonths.map(m=>({month:m,account:visible.value.find(p=>p.month===m)?.rows.find(a=>a.room===r)}));
      const itemsForRows=rows=>rows.map(a=>({key:a.room,label:a.room,value:singleValue(a),detail:mode.value==='fee'?'電費':a.meter.valid?a.meter.days+' 天':a.meter.reason}));
      const roomComparisonItems=computed(()=>itemsForRows(meterRows.value));
      const independentComparisonItems=computed(()=>itemsForRows(meterPeriods.value.find(p=>p.month===Number(roomCompareMonth.value))?.rows||[]));
      const roomUnit=computed(()=>mode.value==='fee'?'元':mode.value==='daily'?'度／日':'度');
      const roomCards=computed(()=>rooms.value.map(r=>{
        const trend=periodTrend(r),valid=trend.filter(t=>t.account?.meter.valid);
        const items=trend.map(t=>({key:t.month,label:t.month+'月',value:singleValue(t.account),detail:(t.account?.meter.valid?t.account.meter.days+' 天':t.account?.meter.reason||'未建立或沒有可用紀錄')}));
        const amounts=items.filter(t=>t.value!==null),sum=amounts.reduce((s,t)=>s+t.value,0);
        const days=valid.reduce((s,t)=>s+t.account.meter.days,0),usage=valid.reduce((s,t)=>s+t.account.meter.usage,0);
        const summary=mode.value==='daily'?(days?usage/days:null):amounts.length?sum:null;
        return {room:r,trend,items,summary,validCount:mode.value==='fee'?amounts.length:valid.length,summaryLabel:mode.value==='daily'?'有效期日平均':amounts.length===6?'年度合計':'已知合計'};
      }));
      const roomScale=computed(()=>RentalReportCharts.axisMaximum(roomCards.value.flatMap(c=>c.items.map(i=>i.value))));
      function focusRoom(r){room.value=r;Vue.nextTick(()=>{const card=document.getElementById('room-year-'+r);card?.scrollIntoView({block:'center'});card?.focus({preventScroll:true});});}
      function chooseDefaults(){month.value=financialPeriods.value.at(-1)?.month||0;quarter.value=month.value?Math.ceil(month.value/3):1;meterMonth.value=meterPeriods.value.at(-1)?.month||0;roomCompareMonth.value=meterMonth.value;if(!rooms.value.includes(room.value))room.value=rooms.value[0]||'';}
      async function load() {
        if(busy.value)return;busy.value=true;periods.value=[];failures.value=[];status.value='正在讀取月份列表……';
        try {
          availableMonths.value=[];const y=Number(year.value),months=await rpc('getAvailableBillingMonths',y);
          if(!Array.isArray(months)||!months.every(m=>Number.isInteger(m)&&m>=1&&m<=12)||new Set(months).size!==months.length)throw Error('月份列表格式不正確');
          availableMonths.value=[...months];let cursor=0,done=0;const sorted=[...months].sort((a,b)=>a-b),results=[],errors=[];
          // Two independent read requests at a time, no writes and no automatic retries.
          const worker=async()=>{while(cursor<sorted.length && alive){const m=sorted[cursor++];try{results.push(RentalReportData.prepare(y,m,await rpc('getMonthlyAccounts',y,m)));}catch(e){errors.push({month:m,message:e.message||String(e)});}done++;if(alive)status.value='正在整理 '+y+' 年帳務：'+done+' / '+sorted.length+' 個月';}};
          await Promise.all([worker(),worker()]);if(!alive)return;
          periods.value=results.sort((a,b)=>a.month-b.month);failures.value=errors.sort((a,b)=>a.month-b.month);chooseDefaults();
          status.value='已讀取 '+periods.value.length+' 個月'+(errors.length?'；'+errors.length+' 個月讀取失敗，圖表保留缺口':'，報表不會修改試算表');
        }catch(e){if(alive)status.value='讀取失敗：'+(e.message||String(e));}finally{if(alive)busy.value=false;}
      }
      async function initialize(){busy.value=true;status.value='正在讀取帳務年份……';try{const list=await rpc('getAvailableBillingYears');if(!Array.isArray(list)||!list.every(y=>Number.isInteger(y)&&y>=1900&&y<=9999))throw Error('年份格式不正確');years.value=[...new Set(list)].sort((a,b)=>b-a);if(!years.value.length)throw Error('尚未設定帳務年份');year.value=years.value.includes(currentYear)?currentYear:years.value[0];busy.value=false;if(alive)await load();}catch(e){if(alive){busy.value=false;status.value='讀取失敗：'+e.message;}}}
      onMounted(initialize);
      onBeforeUnmount(()=>{alive=false;});
      return {years,year,visible,financialPeriods,failures,busy,status,month,meterMonth,room,roomCompareMonth,mode,powerMetric,future,cap,asOf,quarters,quarter,rentScope,rentLabel,rentMonths,pieSummary,coveredMonths,missingMonths,hasFailures,rentWarnings,rentItems,totalPowerItems,meterPeriods,meterPeriod,meterRows,validMeters,usageTotal,rooms,roomCards,roomScale,roomComparisonItems,independentComparisonItems,roomUnit,focusRoom,fmt,load,initialize,chooseDefaults};
    },
    template:`<div class="rental-reports">
      <div class="report-toolbar"><label>帳務年份<select v-model="year" aria-label="帳務年份" @change="load" :disabled="busy"><option v-for="y in years" :value="y">{{y}} 年</option></select></label><button class="secondary" @click="years.length?load():initialize()" :disabled="busy">{{busy?'讀取中……':'重新讀取報表'}}</button></div>
      <p role="status" class="report-status">{{status}}</p><ul v-if="failures.length" class="report-errors"><li v-for="f in failures">{{f.month}} 月：{{f.message}}</li></ul>
      <nav v-if="visible.length" class="report-section-nav" aria-label="收租統計區塊"><a v-if="financialPeriods.length" href="#rent-statistics">租金統計</a><a href="#all-electricity">用電統計</a><a href="#room-electricity">單房用電</a></nav>
      <template v-if="visible.length">
      <section v-if="financialPeriods.length" id="rent-statistics" class="report-panel rent-panel" aria-labelledby="rent-report-title"><div class="report-heading"><div><p class="eyebrow">RENT COLLECTION</p><h2 id="rent-report-title">租金統計</h2><p>已繳與未繳按租金金額計算，電費另列於用電區。</p></div><span class="report-asof">截至 {{year}} 年 {{asOf}} 月{{future(asOf)?'（預排）':''}}</span></div>
      <div class="report-scope" role="group" aria-label="租金統計期間"><button v-for="s in [{key:'month',label:'單月'},{key:'quarter',label:'季度'},{key:'year',label:'年度'}]" :aria-pressed="rentScope===s.key" @click="rentScope=s.key">{{s.label}}</button><label v-if="rentScope==='month'">統計月份<select v-model="month" aria-label="租金統計月份"><option v-for="p in financialPeriods" :value="p.month">{{p.month}} 月{{future(p.month)?' · 預排':''}}</option></select></label><label v-if="rentScope==='quarter'">統計季度<select v-model="quarter" aria-label="租金統計季度"><option v-for="q in quarters" :value="q">第 {{q}} 季（{{(q-1)*3+1}}～{{q*3}} 月）</option></select></label></div>
      <h3>{{rentLabel}} · 已繳／未繳租金</h3><rent-pie :summary="pieSummary"></rent-pie>
      <p class="report-coverage">資料覆蓋：{{coveredMonths.length}} / {{rentMonths.length}} 個月份<span v-if="coveredMonths.length">（{{coveredMonths.join('、')}} 月）</span>。{{missingMonths.length?'未建立／未讀取的 '+missingMonths.join('、')+' 月不視為 0 元，百分比僅涵蓋已有資料。':'已涵蓋此範圍內的月份。'}}</p>
      <p v-if="hasFailures" class="report-missing">有月份讀取失敗，暫不顯示租金百分比，請重新讀取。</p><p v-if="pieSummary.unknown" class="report-missing">{{pieSummary.unknown}} 筆租金無法分配，請先核對應收金額與收款欄位。</p>
      <details class="report-details"><summary>租金收繳與統計方式</summary><p>款項依序沖銷前期欠款、本月租金、本月電費；前期欠款依月份由舊到新、同月租金優先。已使用的多收抵扣也列入已繳租金，尚未使用的多收款不算租金收入。</p><p>按原應收月份歸屬，截至 {{asOf}} 月的後續補繳會回沖原月份。季度、年度加總各月份租金一次，包含部分繳款；不把累計欠款重複相加，也不按銀行轉帳日期歸屬。</p><p>承租人不同或缺少月份時，依原帳務規則分開處理。應收金額與租金加電費不一致時，暫不將該筆計入租金統計，請先核對帳務。</p></details>
      <p v-if="rentWarnings" class="report-missing">帳務共有 {{rentWarnings}} 筆餘額銜接提醒，請至每月帳務核對。</p>
      <h3>各月租金結清狀況</h3><div class="report-legend"><span><i class="paid-dot"></i>已繳租金</span><span><i class="unpaid-dot"></i>未繳租金</span></div><report-bars :items="rentItems" single-row unit="元" title="各月租金應收、已繳與未繳長條圖"></report-bars>
      </section>
      <section id="all-electricity" class="report-panel electricity-panel" aria-labelledby="electricity-report-title"><div class="report-heading"><div><p class="eyebrow">TOTAL ELECTRICITY</p><h2 id="electricity-report-title">用電統計</h2><p>每期將全部房間加總，查看總用電量及電費變化。</p></div></div>
      <div class="report-mode" role="group" aria-label="全部用電圖表單位"><button @click="powerMetric='usage'" :aria-pressed="powerMetric==='usage'">用電量（度）</button><button @click="powerMetric='fee'" :aria-pressed="powerMetric==='fee'">電費（元）</button></div>
      <report-bars :items="totalPowerItems" :unit="powerMetric==='fee'?'元':'度'" :title="powerMetric==='fee'?'各期全部房間電費合計':'各期全部房間用電量合計'"></report-bars>
      <p class="report-note">用電量以本期減前期電表計算；電費依當月帳務的電費欄位。度數資料不完整時僅註明已知小計，不畫成全部合計，缺值也不算成 0。</p>
      <div class="report-heading"><h3>單期房間比較</h3><label>電費月份<select aria-label="電費月份" v-model="meterMonth"><option v-for="p in meterPeriods" :value="p.month">{{p.month}} 月</option></select></label></div>
      <div v-if="meterPeriod" class="report-metrics"><article><span>有效電表紀錄</span><strong>{{validMeters.length}} / {{meterRows.length}} 間</strong></article><article><span>{{validMeters.length===meterRows.length?'本期合計用電':'已知小計（尚未完整）'}}</span><strong>{{fmt(usageTotal)}} <small>度</small></strong></article><article><span>本期電費合計</span><strong>{{fmt(meterPeriod.electricity.value)}} <small>元</small></strong></article></div>
      <details class="report-details"><summary>展開各房比較長條圖</summary><p>點選房號可定位到下方該房的年度圖。比較單位與單房圖表同步。</p><report-bars :items="roomComparisonItems" :unit="roomUnit" title="同一期各房用電比較" interactive @select="focusRoom"></report-bars></details>
      </section>
      <section id="room-electricity" class="report-panel room-electricity-panel" aria-labelledby="room-electricity-title"><div class="report-heading"><div><p class="eyebrow">ROOM ELECTRICITY · {{year}}</p><h2 id="room-electricity-title">單間房用電量</h2><p>每間房一張年度圖，依帳務月份顯示六個電費期別；未填資料留空。</p></div><a class="room-compare-link" href="#room-period-comparison">查看單期各房比較 ↓</a></div>
      <div class="report-mode" role="group" aria-label="單房用電圖表單位"><button @click="mode='usage'" :aria-pressed="mode==='usage'">每期度數</button><button @click="mode='daily'" :aria-pressed="mode==='daily'">每日平均用電</button><button @click="mode='fee'" :aria-pressed="mode==='fee'">電費金額</button></div>
      <p class="room-year-hint">{{year}} 年 · 單位：{{roomUnit}} · 各房使用相同縱軸刻度，方便比較。每日平均依有效期的總度數 ÷ 總天數計算。</p>
      <div class="room-year-grid"><article v-for="card in roomCards" :key="card.room" :id="'room-year-'+card.room" class="room-year-card" :class="{'selected-room-year':room===card.room}" tabindex="-1" :aria-label="year+' 年 '+card.room+' 房用電圖表'"><header><h3>{{card.room}} 房</h3><span>{{year}} 年</span></header><report-bars :items="card.items" :unit="roomUnit" :title="year+' 年 '+card.room+' 房'+(mode==='fee'?'電費':'用電量')" compact :scale-max="roomScale"></report-bars><div class="room-year-summary"><span>{{card.summaryLabel}}</span><strong>{{fmt(card.summary)}}{{card.summary!==null?' '+roomUnit:''}}</strong><span>{{card.validCount}} / 6 期有效</span></div>
      <details class="report-details room-year-details"><summary>查看數值與抄表明細</summary><div class="room-year-readings"><div v-for="t in card.trend"><strong>{{t.month}} 月</strong><template v-if="t.account?.meter.valid"><p>{{t.account.meter.previousDate}} → {{t.account.meter.currentDate}}</p><p>{{fmt(t.account.meter.usage)}} 度 · {{t.account.meter.days}} 天</p><p>平均 {{fmt(t.account.meter.daily)}} 度／日 · 電費 {{fmt(t.account.electricityFee)}} 元</p></template><p v-else>{{t.account?.meter.reason||'未建立或沒有可用紀錄'}}<span v-if="t.account"> · 電費 {{fmt(t.account.electricityFee)}} 元</span></p></div></div></details></article></div>
      <section id="room-period-comparison" class="room-period-comparison" aria-labelledby="room-period-title"><div class="report-heading"><div><h3 id="room-period-title">單期各房比較</h3><p>獨立選擇月份，比較同一期各房的{{mode==='fee'?'電費':mode==='daily'?'每日平均用電':'用電量'}}。</p></div><label>比較月份<select aria-label="單房區單期比較月份" v-model="roomCompareMonth"><option v-for="p in meterPeriods" :value="p.month">{{p.month}} 月</option></select></label></div><report-bars :items="independentComparisonItems" :unit="roomUnit" :title="roomCompareMonth+' 月單期各房比較'" interactive @select="focusRoom"></report-bars></section>
      </section>
      </template><p v-else-if="!busy" class="report-panel">目前沒有可顯示的月份，請先到每月帳務建立資料。</p>
    </div>`
  };
};
