/** Batch reads are sequential; each JPG contains one room only. No sheet writes. */
window.RentalComponents ||= {};
window.RentalComponents.noticeBatch = function(api) {
 const {ref,computed,watch,onBeforeUnmount}=Vue;
 return {props:{accounts:Array,year:Number,month:Number,blocked:Boolean},emits:['busy-change'],
 template:`<section class="notice-batch" aria-label="批次電費通知"><h2>批次電費通知</h2><p>勾選房間，一次產生各房 JPG 並打包下載。解壓縮後，將各房圖片分別傳給房客。</p><div class="batch-actions"><button type="button" @click="selectAll" :disabled="locked">全選房間</button><button type="button" @click="selected=[]" :disabled="locked">取消全選</button><button type="button" class="primary" @click="generate" :disabled="locked||!selected.length||month%2!==1">批次產生通知（{{selected.length}} 間）</button><button v-if="working" type="button" @click="stop=true" :disabled="stop">{{stop?'正在停止……':'停止後續產生'}}</button><a v-if="zipUrl" class="batch-download" :href="zipUrl" :download="zipName" @click="releaseAfterDownload">下載 ZIP（{{successCount}} 張 JPG）</a></div><p role="status" class="batch-notice-status">{{message}}</p><div class="notice-room-choices"><label v-for="account in accounts" :key="account.room"><input type="checkbox" :value="account.room" v-model="selected" :disabled="locked">{{account.room}} 房</label></div><ul v-if="results.length" class="notice-results"><li v-for="item in results" :key="item.room"><strong>{{item.room}} 房</strong><span>{{item.message}}</span><a v-if="item.url" :href="item.url" target="_blank" rel="noopener">預覽 JPG</a></li></ul></section>`,
 setup(props,{emit}) {
  const selected=ref([]),working=ref(false),stop=ref(false),message=ref('請先核對本月電表資料與照片。'),results=ref([]),zipUrl=ref('');let alive=true,releaseTimer;
  const locked=computed(()=>working.value||props.blocked),successCount=computed(()=>results.value.filter(r=>r.url).length),zipName=computed(()=>props.year+'-'+String(props.month).padStart(2,'0')+'_電費通知.zip');
  function releaseAfterDownload(){clearTimeout(releaseTimer);releaseTimer=setTimeout(()=>{clear();message.value='下載已啟動，瀏覽器暫存圖片與 ZIP 已釋放；需要時可重新產生。';},1500);}
  function clear(){clearTimeout(releaseTimer);if(zipUrl.value)URL.revokeObjectURL(zipUrl.value);zipUrl.value='';for(const r of results.value)if(r.url)URL.revokeObjectURL(r.url);results.value=[]}
  function selectAll(){selected.value=props.accounts.map(a=>a.room)}
  watch(()=>[props.year,props.month],()=>{clear();selectAll();message.value='請先核對本月電表資料與照片。'},{immediate:true});
  async function generate(){
   if(locked.value||props.month%2!==1||!selected.value.length)return;
   const rooms=props.accounts.filter(a=>selected.value.includes(a.room)).map(a=>a.room);if(!rooms.length)return;
   clear();working.value=true;stop.value=false;emit('busy-change',true);const files=[];
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
     finally{if(rendered?.canvas){rendered.canvas.width=1;rendered.canvas.height=1}}
    }
    if(!alive)return;
    const skipped=rooms.length-results.value.length;
    if(files.length){
     const report=results.value.map(r=>r.room+' 房：'+r.message).join('\r\n')+(skipped?'\r\n尚未處理：'+skipped+' 間':'');
     files.push({name:'產生結果.txt',blob:new Blob([report],{type:'text/plain;charset=utf-8'})});
     const zip=await RentalNoticeZip.create(files);if(!alive)return;zipUrl.value=URL.createObjectURL(zip);
    }
    message.value='處理完成：成功 '+successCount.value+' 間，未完成 '+results.value.filter(r=>!r.url).length+' 間'+(skipped?'，尚未處理 '+skipped+' 間':'')+'。'+(files.length?'請下載 ZIP，核對各房圖片後再傳送。':'請補齊資料或照片後再產生。');
   }catch(error){if(alive)message.value='打包失敗：'+(error?.message||String(error))+'；已完成圖片仍可逐張預覽。'}
   finally{working.value=false;emit('busy-change',false)}
  }
  onBeforeUnmount(()=>{clearTimeout(releaseTimer);alive=false;stop.value=true;clear()});
  return{releaseAfterDownload,selected,working,stop,message,results,zipUrl,locked,successCount,zipName,selectAll,generate};
 }};
};
