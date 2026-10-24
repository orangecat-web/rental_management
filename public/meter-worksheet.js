/** One worksheet for all rooms. Reuses the signed APIs and optimistic field checks. */
window.RentalComponents ||= {};
window.RentalComponents.meterWorksheet = function (api) {
  const { ref, computed, watch, nextTick, onBeforeUnmount } = Vue;
  return {
    props: { accounts: Array, year: Number, month: Number, blocked: Boolean, noticeUrl: Function },
    emits: ['dirty-change','busy-change','field-saved','reconciled','refresh-request'],
    template: `
<section class="meter-sheet" aria-label="整月電表抄錄表">
  <div class="meter-sheet-toolbar">
    <label v-write  class="meter-common-date">本期共同抄表日<input type="date" v-model="commonDate" :disabled="locked || historical" @input="acknowledgeDate" aria-label="本期共同抄表日"></label>
    <div class="meter-sheet-actions">
      <button type="button" class="secondary" @click="loadPhotos" :disabled="locked">更新照片連結</button>
      <button type="button" class="primary" @click="applyDateAndPhotos" :disabled="historical || locked || reviewRequired || !validDate">套用抄表日期並更新連結</button>
      <button type="button" class="primary" @click="saveAll" :disabled="historical || locked || reviewRequired || !dirty || !validDate">儲存全部抄表</button>
      <button type="button" class="secondary" @click="restore" :disabled="locked || !dirty">還原全部未儲存輸入</button>
      <button v-if="reviewRequired" type="button" class="secondary" @click="reconcile" :disabled="locked">重新讀取核對，保留未完成輸入</button>
    </div>
  </div>
  <p class="meter-sheet-hint">日期只填一次。照片只顯示連結，不預先下載；點擊後才載入單張圖片並彈出預覽視窗。連結依已儲存的抄表日配對；度數填完後按「儲存全部抄表」。空間不足會換行。</p>
  <p v-if="!validDate" class="meter-sheet-hint">請選擇有效的共同抄表日期（可與帳務月份不同）；原有日期仍顯示在各房資料中。</p>
  <p class="meter-batch-status" role="status" aria-live="polite">{{status}}</p>
  <div class="meter-sheet-rows" role="table" aria-label="各房電表度數">
    <article v-for="entry in entries" :key="entry.room" class="meter-sheet-row" role="row" :aria-label="entry.room+' 房電表'">
      <div class="meter-room-title"><h2>{{entry.room}} 房</h2><span>{{entry.name||'未填居住者'}}</span><span v-if="entry.conflict" class="meter-field-error">試算表已有其他修改，請還原此房或重新輸入後再儲存。</span></div>
      <div class="meter-row-values">
        <div class="meter-previous"><span>前期電表</span><strong>{{format(entry.previousReading)}} 度</strong><span>{{entry.previousDate||'前期日期待補'}}</span></div>
        <label class="meter-current">本期電表<input type="number" step="any" :min="entry.previousReading ?? 0" v-model="entry.draft" :disabled="historical || locked || entry.previousReading===null" @input="entry.conflict=false;entry.message=''" :aria-label="entry.room+' 房本期電表'"><span>試算表目前：{{format(entry.savedReading)}} 度</span></label>
        <div class="meter-amount"><span>本期使用</span><strong>{{usage(entry)===null?'—':format(usage(entry))+' 度'}}</strong><span>電費 NT$ {{usage(entry)===null?'—':format(usage(entry)*5)}}</span></div>
        <div class="meter-date-detail"><span>本期抄表日</span><strong>{{commonDate||entry.savedDate||'待填寫'}}</strong><span v-if="commonDate!==entry.savedDate">已儲存：{{entry.savedDate||'未填寫'}}</span></div>
      </div>
      <p v-if="readingError(entry)" class="meter-field-error">{{readingError(entry)}}</p>
      <p v-if="entry.message" class="meter-row-message" role="status">{{entry.message}}</p>
      <button v-if="entry.conflict" class="secondary" type="button" @click="restoreEntry(entry)" :disabled="locked">還原此房</button>
      <div class="meter-row-photo"><div class="meter-photo-status"><span class="meter-photo-message">{{entry.photoMessage||'點擊連結才開啟圖片，不預先載入。'}}</span></div><div class="meter-photo-actions"><a v-if="entry.savedDate&&(!commonDate||commonDate===entry.savedDate)" :href="entry.driveLink||'#'" @click.prevent="openPhoto(entry)" :aria-label="entry.room+' 房開啟本期電表照片'">本期電表照片</a><p v-else class="meter-sheet-hint">請先儲存本期抄表日期，再開啟對應照片。</p>
      <div v-if="noticeUrl" class="meter-notice"><a v-if="!dirty&&!reviewRequired&&!locked" class="notice-link" :href="noticeUrl({room:entry.room,year,month})" target="_blank" rel="noopener noreferrer" :aria-label="month+' 月 '+entry.room+' 房電費通知預覽'">預覽電費通知</a><p v-else class="meter-sheet-hint">請先儲存並核對抄表資料，再預覽電費通知。</p></div></div></div>
    </article>
  </div>
</section>`,
    setup(props, { emit }) {
      const preview=window.RentalPhotoPreview.create();
      onBeforeUnmount(()=>preview.close());
      const historical=computed(()=>props.accounts.some(a=>a.financialLocked&&!a.meterEditable));
      const entries = ref([]), commonDate = ref(''), status = ref(''), working = ref(false), photoBusy = ref(false), reviewRequired = ref(false);
      let currentPeriod = '', initialDate = '';
      const format = v => v === null || v === undefined || v === '' ? '—' : new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(v);
      const minDate = computed(()=>props.year+'-'+String(props.month).padStart(2,'0')+'-01');
      const maxDate = computed(()=>props.year+'-'+String(props.month).padStart(2,'0')+'-'+new Date(props.year,props.month,0).getDate());
      const validDate = computed(()=>/^\d{4}-\d{2}-\d{2}$/.test(commonDate.value) && Number.isFinite(Date.parse(commonDate.value+'T00:00:00Z')) && new Date(commonDate.value+'T00:00:00Z').toISOString().slice(0,10)===commonDate.value);
      const locked = computed(()=>props.blocked || working.value || photoBusy.value);
      const rawDraft = entry => entry.draft === '' ? null : Number(entry.draft);
      const readingDirty = entry => String(entry.draft ?? '') !== String(entry.savedReading ?? '');
      const dateDirty = entry => commonDate.value !== initialDate && commonDate.value !== entry.savedDate;
      const dirty = computed(()=>entries.value.some(e=>readingDirty(e)||dateDirty(e)));
      watch(dirty, value=>emit('dirty-change',value),{immediate:true});
      watch(()=>working.value||photoBusy.value,value=>emit('busy-change',value),{immediate:true});
      function sync(records) {
        const period=props.year+'-'+props.month, fresh=period!==currentPeriod;
        const old=new Map(fresh?[]:entries.value.map(e=>[e.room,e]));
        entries.value=records.filter(a=>a.meter).map(a=>{
          const e=old.get(a.room), m=a.meter, hadDraft=e&&readingDirty(e);
          const changed=e&&m.currentReading!==e.savedReading&&String(m.currentReading??'')!==String(e.draft??'');
          return {room:a.room,name:a.name,previousReading:typeof m.previousReading==='number'?m.previousReading:null,
            previousDate:m.previousReadingDate||'',savedDate:m.currentReadingDate||'',savedReading:m.currentReading??null,
            draft:hadDraft?e.draft:String(m.currentReading??''),conflict:!!(hadDraft&&(changed||e?.conflict)),message:e?.message||'',
            driveLink:e?.photoDate===(m.currentReadingDate||'')?e.driveLink||'':'',photoDate:e?.photoDate===(m.currentReadingDate||'')?e.photoDate:'',photoMessage:e?.photoDate===(m.currentReadingDate||'')?e.photoMessage||'':''};
        });
        const dates=[...new Set(entries.value.map(e=>e.savedDate))], uniform=dates.length===1?dates[0]:'';
        if(fresh || commonDate.value===initialDate) commonDate.value=uniform;
        initialDate=uniform;currentPeriod=period;
      }
      watch(()=>props.accounts,sync,{immediate:true});
      function acknowledgeDate(){status.value=''}
      function readingError(e){
        if(e.previousReading===null)return '前期度數尚未帶入，請先初始化本月或補齊前期紀錄。';
        if(e.draft==='')return '';
        const n=rawDraft(e);
        if(!Number.isFinite(n)||n<0)return '請輸入有效的電表度數。';
        if(n<e.previousReading)return '本期電表不能小於前期電表。';
        return '';
      }
      const usage=e=>e.draft===''||readingError(e)?null:rawDraft(e)-e.previousReading;
      function restoreEntry(e){e.draft=String(e.savedReading??'');e.conflict=false;e.message='已還原此房度數。'}
      function restore(){entries.value.forEach(restoreEntry);commonDate.value=initialDate;status.value='已還原尚未儲存的輸入。已寫入試算表的資料仍保留。'}
      function validateRecords(records){
        if(!Array.isArray(records)||!records.every(a=>a&&a.year===props.year&&a.month===props.month&&/^\d+$/.test(String(a.room))&&a.meter&&typeof a.meter==='object')||new Set(records.map(a=>a.room)).size!==records.length)throw Error('帳務回應格式不正確，請稍後重新讀取。');
        return records;
      }
      async function reconcile(){
        if(locked.value)return;working.value=true;status.value='正在核對試算表，保留未完成的度數輸入……';
        try{const records=validateRecords(await api.accounts(props.year,props.month));sync(records);emit('reconciled',records);reviewRequired.value=false;
          status.value='已重新讀取。請核對各房「試算表目前」度數；有衝突的房間請還原或重新輸入。';}
        catch(error){status.value='核對失敗：'+error.message}finally{working.value=false}
      }
      async function persist(mode){if(historical.value)return false;
        if(locked.value||reviewRequired.value||!validDate.value)return false;
        const targets=entries.value.filter(e=>mode==='date'?commonDate.value!==e.savedDate:readingDirty(e)||commonDate.value!==e.savedDate);
        if(targets.some(e=>e.conflict)){status.value='有其他修改尚未核對，請先處理標示的房間。';return false}
        if(mode!=='date'&&targets.some(e=>readingDirty(e)&&readingError(e))){status.value='請先修正各房標示的電表度數。';return false}
        working.value=true;const year=props.year,month=props.month,date=commonDate.value;let completed=0;
        try{
          for(const e of targets){
            status.value='儲存中：'+completed+' / '+targets.length+' 間（'+e.room+' 房）';
            if(mode!=='date'&&readingDirty(e)){
              const expected=e.savedReading, value=String(e.draft??'');
              const result=await api.saveField(year,month,e.room,'currentReading',value,expected);
              if(result?.value!==null&&(typeof result?.value!=='number'||!Number.isFinite(result.value)||result.value<0))throw Error('度數儲存回應不正確。');
              e.savedReading=result.value;e.draft=String(result.value??'');emit('field-saved',{room:e.room,field:'currentReading',value:result.value});
            }
            if(date!==e.savedDate){
              const result=await api.saveField(year,month,e.room,'currentReadingDate',date,e.savedDate);
              if(result?.value!==date)throw Error('日期儲存回應不正確。');
              e.savedDate=result.value;emit('field-saved',{room:e.room,field:'currentReadingDate',value:result.value});
            }
            e.message=mode==='date'?'共同抄表日已儲存。':'本期抄表已儲存。';completed++;
          }
          initialDate=date;status.value=targets.length?'已儲存 '+completed+' 間'+(mode==='date'?'共同抄表日。':'本期抄表資料。'):'沒有需要寫入的變更。';
          return true;
        }catch(error){reviewRequired.value=true;status.value='已完成 '+completed+' / '+targets.length+' 間；其餘尚未確認：'+error.message+'。請重新讀取核對，系統不會自動重送。';return false}
        finally{working.value=false}
      }
      async function saveAll(){if(await persist('all')){await nextTick();emit('refresh-request')}}
      const driveUrl=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(id)?'https://drive.google.com/file/d/'+id+'/view':'';
      async function reference(entry){
        if(!entry.savedDate)throw Error('請先儲存本期抄表日期。');
        const date=entry.savedDate,result=await api.meterPhotoReference(props.year,props.month,entry.room);
        if(entry.savedDate!==date)throw Error('抄表日期已變更，請重新開啟連結。');
        if(!result||typeof result.found!=='boolean')throw Error('照片連結回應格式不正確。');
        if(!result.found)throw Error(result.message||'尚未找到本期電表照片。');
        if(result.readingDate!==date||!driveUrl(result.id))throw Error('照片日期或連結不符。');
        entry.driveLink=driveUrl(result.id);entry.photoDate=date;entry.photoMessage='抄表日：'+date+'；點擊連結開啟原圖。';return entry.driveLink;
      }
      async function loadPhotos(){
        if(locked.value||reviewRequired.value)return;
        photoBusy.value=true;let completed=0,found=0,failed=0,index=0;
        const queue=[...entries.value];
        async function worker(){while(index<queue.length){const e=queue[index++];e.driveLink='';try{await reference(e);found++;}catch(error){e.photoMessage='連結讀取失敗：'+error.message;failed++;}finally{completed++;status.value='連結讀取中：'+completed+' / '+queue.length+' 間';}}}
        try{await Promise.all([worker(),worker()]);status.value='照片連結處理完成：'+queue.length+' 間，取得 '+found+' 個連結'+(failed?'，'+failed+' 間尚無有效連結':'')+'；未下載圖片內容。';}finally{photoBusy.value=false;}
      }
      function openPhoto(entry){
        if(locked.value)return;
        const date=entry.savedDate,year=props.year,month=props.month;
        preview.open(entry.room+' 房／本期電表照片',async()=>{
          const result=await api.meterPhoto(year,month,entry.room);
          if(!result?.found)throw Error(result?.message||'尚未找到本期電表照片。');
          if(entry.savedDate!==date||result.readingDate!==date)throw Error('照片日期與本期抄表日不一致，請重新核對。');
          return result.dataUrl;
        });
      }
      async function applyDateAndPhotos(){if(await persist('date')){await nextTick();await loadPhotos()}}
      return {openPhoto,historical,entries,commonDate,status,working,photoBusy,reviewRequired,minDate,maxDate,validDate,locked,dirty,format,usage,readingError,acknowledgeDate,restoreEntry,restore,reconcile,saveAll,applyDateAndPhotos,loadPhotos};
    }
  };
};
