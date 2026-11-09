/** Batch reads are sequential; each JPG contains one room only. No sheet writes. */
window.RentalComponents ||= {};
window.RentalComponents.noticeBatch = function(api) {
 const {ref,computed,watch,onBeforeUnmount,nextTick}=Vue;
 return {props:{accounts:Array,year:Number,month:Number,blocked:Boolean},emits:['busy-change'],
 template:`<div class="notice-center notice-batch"><button class="notice-launcher" @click="openNotice" :disabled="locked"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="warm-ab-icons.svg#message"/></svg>批次通知</button><dialog ref="noticeDialog" class="notice-center-dialog" aria-label="通知預覽與下載" @cancel.prevent="closeNotice"><header class="notice-center-heading"><div><h2>通知預覽與下載</h2><p>{{year}} 年 {{month}} 月 · 下載後由管理人自行聯絡，不自動傳送。</p></div><button @click="closeNotice" :disabled="working" aria-label="關閉通知預覽">✕</button></header><div class="notice-type-tabs"><button :aria-pressed="noticeType==='electricity'" @click="changeNoticeType('electricity')" :disabled="working||month%2!==1">電費通知</button><button :aria-pressed="noticeType==='renewal'" @click="changeNoticeType('renewal')" :disabled="working">續約提醒</button></div><p v-if="month%2!==1" class="notice-even-month">本月不計電費，可預覽與下載續約提醒。</p><div class="notice-center-layout"><aside class="notice-room-choices"><label v-for="account in accounts" :key="account.room" :class="{selected:previewRoom===account.room}"><input type="checkbox" :value="account.room" v-model="selected" :disabled="locked||account.meter?.billingApplicable===false"><button @click="choosePreviewRoom(account.room)" :disabled="working"><strong>{{account.room}}</strong><span>{{account.name||'空房'}}</span><small v-if="account.meter?.billingApplicable===false">本期不收電費</small></button></label><div class="batch-actions"><button @click="selectAll" :disabled="locked">全選房間</button><button @click="selected=[]" :disabled="locked">取消全選</button></div></aside><section class="notice-preview-pane"><div class="notice-preview-image"><img v-if="previewUrl" :src="previewUrl" :alt="previewRoom+' 房通知預覽'"><div v-else class="empty"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="ui-icons.svg#document"/></svg><p>選擇房間並按預覽，才會載入通知及照片。</p></div></div><div class="notice-preview-actions"><button @click="previewNotice" :disabled="working||propsBlocked||!previewRoom">預覽</button><a v-if="previewUrl" class="rental-button" :href="previewUrl" :download="previewName">下載圖片</a><button v-if="noticeType==='electricity'" class="primary" @click="generate" :disabled="locked||!selected.length||month%2!==1">批次產生通知（{{selected.length}} 間）</button></div><p v-if="noticeType==='renewal'">續約提醒保留友善例行語氣，以及協調退租點交的說明。</p><p v-if="previewMessage" role="status">{{previewMessage}}</p></section></div><div class="notice-downloads"><button v-if="working" @click="stop=true" :disabled="stop">{{stop?'正在停止……':'停止後續產生'}}</button><a v-if="zipUrl" class="batch-download rental-button primary" :href="zipUrl" :download="zipName" @click="releaseAfterDownload">下載 ZIP（{{successCount}} 張 JPG）</a><p role="status" class="batch-notice-status">{{message}}</p><div class="notice-progress" v-if="totalTasks"><label>產生進度 {{progress}}%（{{processed}}／{{totalTasks}}）<progress :value="progress" max="100" aria-label="批次通知產生進度"></progress></label></div><ul v-if="results.length" class="notice-results"><li v-for="item in results" :key="item.room"><strong>{{item.room}} 房</strong><span>{{item.message}}</span><a v-if="item.url" :href="item.url" target="_blank" rel="noopener">預覽 JPG</a></li></ul></div></dialog></div>`,
 setup(props,{emit}) {
  const noticeDialog=ref(null),noticeType=ref(props.month%2===1?'electricity':'renewal'),previewRoom=ref(''),previewUrl=ref(''),previewName=ref(''),previewMessage=ref('');const propsBlocked=computed(()=>props.blocked);let previewGeneration=0,previewOrigin=null;
  async function openNotice(){previewOrigin=document.activeElement;previewRoom.value ||= props.accounts.find(a=>a.meter?.billingApplicable!==false)?.room||props.accounts[0]?.room||'';await nextTick();if(typeof noticeDialog.value?.showModal==='function')noticeDialog.value.showModal();else noticeDialog.value?.setAttribute('open','');}
  function clearPreview(){previewGeneration++;if(previewUrl.value)URL.revokeObjectURL(previewUrl.value);previewUrl.value='';previewMessage.value='';}
  function closeNotice(){if(working.value)return;clearPreview();if(typeof noticeDialog.value?.close==='function')noticeDialog.value.close();else noticeDialog.value?.removeAttribute('open');previewOrigin?.focus();}
  function changeNoticeType(type){if(working.value||type==='electricity'&&props.month%2!==1)return;noticeType.value=type;clearPreview();}
  function choosePreviewRoom(room){if(working.value)return;previewRoom.value=room;clearPreview();}
  async function previewNotice(){if(working.value||props.blocked||!previewRoom.value)return;clearPreview();const generation=previewGeneration,room=previewRoom.value;working.value=true;emit('busy-change',true);previewMessage.value='正在產生預覽……';let rendered;
    try{let blob;if(noticeType.value==='renewal'){const records=await new Promise((resolve,reject)=>RentalTransport('tenant').script.run.withSuccessHandler(resolve).withFailureHandler(reject).getTenantData());const tenant=Array.isArray(records)&&records.find(t=>String(t.room)===room);if(!tenant)throw Error('找不到此房間的租約資料。');blob=await RentalRenewalNotice.render(tenant);previewName.value=room+'_續約意願通知.png';}else{const data=await api.notice(props.year,props.month,room);if(data.year!==props.year||data.month!==props.month||String(data.room)!==room)throw Error('通知房號或月份不符。');rendered=await RentalNotice.render(data);blob=rendered.blob;previewName.value=RentalNotice.filename(data);}if(!alive||generation!==previewGeneration)return;if(!blob)throw Error('圖片產生失敗。');previewUrl.value=URL.createObjectURL(blob);previewMessage.value='已產生預覽；請核對後下載並自行聯絡房客。';}catch(e){if(alive&&generation===previewGeneration)previewMessage.value=e.message||'預覽失敗，請稍後重新預覽。';}finally{if(rendered?.canvas){rendered.canvas.width=1;rendered.canvas.height=1;}working.value=false;emit('busy-change',false);}}
  const processed=ref(0),totalTasks=ref(0),packaged=ref(false);const progress=computed(()=>totalTasks.value?packaged.value?100:Math.min(95,Math.floor(processed.value/totalTasks.value*95)):0);
  const selected=ref([]),working=ref(false),stop=ref(false),message=ref('請先核對本月電表資料與照片。'),results=ref([]),zipUrl=ref('');let alive=true,releaseTimer;
  const locked=computed(()=>working.value||props.blocked),successCount=computed(()=>results.value.filter(r=>r.url).length),zipName=computed(()=>props.year+'-'+String(props.month).padStart(2,'0')+'_電費通知.zip');
  function releaseAfterDownload(){clearTimeout(releaseTimer);releaseTimer=setTimeout(()=>{clear();message.value='下載已啟動，瀏覽器暫存圖片與 ZIP 已釋放；需要時可重新產生。';},1500);}
  function clear(){clearPreview();clearTimeout(releaseTimer);if(zipUrl.value)URL.revokeObjectURL(zipUrl.value);zipUrl.value='';for(const r of results.value)if(r.url)URL.revokeObjectURL(r.url);results.value=[]}
  function selectAll(){selected.value=props.accounts.filter(a=>a.meter?.billingApplicable!==false).map(a=>a.room)}
  watch(()=>[props.year,props.month],()=>{clear();if(props.month%2!==1)noticeType.value='renewal';selectAll();message.value=props.month%2===1?'請先核對本月電表資料與照片。':'本月不計電費，可預覽與下載續約提醒。'},{immediate:true});
  async function generate(){
   if(locked.value||props.month%2!==1||!selected.value.length)return;
   const rooms=props.accounts.filter(a=>a.meter?.billingApplicable!==false&&selected.value.includes(a.room)).map(a=>a.room);if(!rooms.length)return;
   clear();processed.value=0;packaged.value=false;totalTasks.value=rooms.length;working.value=true;stop.value=false;emit('busy-change',true);const files=[],completedGroups=new Set(),attemptedGroups=new Set();
   try {
    for(const room of rooms){
     if(!alive||stop.value)break;
     
     message.value='正在產生 '+room+' 房（'+(results.value.length+1)+'／'+rooms.length+'）……';
     let rendered;
     try {
      const data=await api.notice(props.year,props.month,room);if(!alive)break;
      if(data.year!==props.year||data.month!==props.month||String(data.room)!==room)throw Error('通知房號或月份不符，已略過。');
      rendered=await RentalNotice.render(data,{requirePhoto:true});if(!alive)break;
      if(!rendered.blob)throw Error('圖片產生失敗。');
      const name=RentalNotice.filename(data),url=URL.createObjectURL(rendered.blob);
      files.push({name,blob:rendered.blob});results.value.push({room,message:'已完成',url});
     }catch(error){if(alive)results.value.push({room,message:error?.message||String(error),url:''})}
     finally{processed.value++;if(rendered?.canvas){rendered.canvas.width=1;rendered.canvas.height=1}}
    }
    if(!alive)return;
    const skipped=Math.max(0,totalTasks.value-processed.value);
    if(files.length){
     const report=results.value.map(r=>r.room+' 房：'+r.message).join('\r\n')+(skipped?'\r\n尚未處理：'+skipped+' 間':'');
     files.push({name:'產生結果.txt',blob:new Blob([report],{type:'text/plain;charset=utf-8'})});
     const zip=await RentalNoticeZip.create(files);if(!alive)return;zipUrl.value=URL.createObjectURL(zip);
    }
    packaged.value=processed.value===totalTasks.value;message.value='處理完成：成功 '+successCount.value+' 份，未完成 '+results.value.filter(r=>!r.url).length+' 份'+(skipped?'，尚未處理 '+skipped+' 份':'')+'。'+(files.length?'請下載 ZIP，核對各房圖片後再傳送。':'請補齊資料或照片後再產生。');
   }catch(error){if(alive)message.value='打包失敗：'+(error?.message||String(error))+'；已完成圖片仍可逐張預覽。'}
   finally{working.value=false;emit('busy-change',false)}
  }
  onBeforeUnmount(()=>{clearTimeout(releaseTimer);alive=false;stop.value=true;clear()});
  return{noticeDialog,noticeType,previewRoom,previewUrl,previewName,previewMessage,propsBlocked,openNotice,closeNotice,changeNoticeType,choosePreviewRoom,previewNotice,processed,totalTasks,progress,releaseAfterDownload,selected,working,stop,message,results,zipUrl,locked,successCount,zipName,selectAll,generate};
 }};
};
