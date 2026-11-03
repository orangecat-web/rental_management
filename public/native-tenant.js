/** Generated from the tested editor; one native workspace, no iframe. */
window.RentalComponents ||= {};
window.RentalComponents.tenant = function () {
const google = RentalTransport('tenant');
const { createApp, ref, reactive, computed, watch, onMounted, onBeforeUnmount } = Vue;
      const errorText = error => error?.message || String(error);

      /** 把既有 Apps Script 介面包成 Promise；不更動後端名稱或參數順序。 */
      const tenantApi = {
        read() {
          return new Promise((resolve, reject) => {
            google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getTenantData();
          });
        },
        saveField(room, field, value, expected) {
          return new Promise((resolve, reject) => {
            const runner = google.script.run.withSuccessHandler(resolve).withFailureHandler(reject);
            if (field === 'notes') runner.saveTenantNote(room, value, expected);
            else runner.saveTenantField(room, field, value, expected);
          });
        },
        saveContract(room, url, expectedLinks) {
          return new Promise((resolve, reject) => {
            google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)
              .saveTenantContract(room, url, expectedLinks);
          });
        }
      };

      /** 只轉換輸入框顯示值；savedValue 仍保留後端原值作更新衝突檢查。 */
      function formatPhone(value) { const text=String(value??'').trim(),digits=text.replace(/[\s-]/g,'');return /^09\d{8}$/.test(digits)?digits.slice(0,4)+'-'+digits.slice(4,7)+'-'+digits.slice(7):text; }
      function displayField(value, field) {
        if (field.checkbox) return value === '是';
        const text = String(value ?? (field.key==='identity'?'一般':'')) || (field.key==='identity'?'一般':'');
        if (field.type === 'date' && text) {
          const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(text);
          if (match) return match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0');
        }
        return field.type==='tel'?formatPhone(text):text;
      }

      function validLeaseDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;}
      function leaseEndDate(start,years){if(!validLeaseDate(start)||!Number.isSafeInteger(years)||years<1)return null;const d=new Date(start+'T00:00:00Z');d.setUTCFullYear(d.getUTCFullYear()+years);d.setUTCDate(d.getUTCDate()-1);if(!Number.isFinite(d.getTime()))return null;const end=d.toISOString().slice(0,10);return validLeaseDate(end)?end:null;}
      function leaseYearCount(start,end){if(!validLeaseDate(start)||!validLeaseDate(end)||start>end)return null;const delta=Number(end.slice(0,4))-Number(start.slice(0,4));for(const n of [delta,delta+1])if(n>=1&&leaseEndDate(start,n)===end)return n;return null;}

      // County/district names only; bundled locally, with no geocoding or third-party requests.
      const TW_ADDRESS_DISTRICTS=Object.freeze({"臺北市":["中正區","大同區","中山區","松山區","大安區","萬華區","信義區","士林區","北投區","內湖區","南港區","文山區"],"新北市":["萬里區","金山區","板橋區","汐止區","深坑區","石碇區","瑞芳區","平溪區","雙溪區","貢寮區","新店區","坪林區","烏來區","永和區","中和區","土城區","三峽區","樹林區","鶯歌區","三重區","新莊區","泰山區","林口區","蘆洲區","五股區","八里區","淡水區","三芝區","石門區"],"桃園市":["中壢區","平鎮區","龍潭區","楊梅區","新屋區","觀音區","桃園區","龜山區","八德區","大溪區","復興區","大園區","蘆竹區"],"臺中市":["中區","東區","南區","西區","北區","北屯區","西屯區","南屯區","太平區","大里區","霧峰區","烏日區","豐原區","后里區","石岡區","東勢區","和平區","新社區","潭子區","大雅區","神岡區","大肚區","沙鹿區","龍井區","梧棲區","清水區","大甲區","外埔區","大安區"],"臺南市":["中西區","東區","南區","北區","安平區","安南區","永康區","歸仁區","新化區","左鎮區","玉井區","楠西區","南化區","仁德區","關廟區","龍崎區","官田區","麻豆區","佳里區","西港區","七股區","將軍區","學甲區","北門區","新營區","後壁區","白河區","東山區","六甲區","下營區","柳營區","鹽水區","善化區","新市區","大內區","山上區","安定區"],"高雄市":["新興區","前金區","苓雅區","鹽埕區","鼓山區","旗津區","前鎮區","三民區","楠梓區","小港區","左營區","仁武區","大社區","東沙群島","南沙群島","岡山區","路竹區","阿蓮區","田寮區","燕巢區","橋頭區","梓官區","彌陀區","永安區","湖內區","鳳山區","大寮區","林園區","鳥松區","大樹區","旗山區","美濃區","六龜區","內門區","杉林區","甲仙區","桃源區","那瑪夏區","茂林區","茄萣區"],"基隆市":["仁愛區","信義區","中正區","中山區","安樂區","暖暖區","七堵區"],"新竹市":["東區","北區","香山區"],"嘉義市":["西區","東區"],"新竹縣":["寶山鄉","竹北市","湖口鄉","新豐鄉","新埔鎮","關西鎮","芎林鄉","竹東鎮","五峰鄉","橫山鄉","尖石鄉","北埔鄉","峨眉鄉"],"苗栗縣":["竹南鎮","頭份市","三灣鄉","南庄鄉","獅潭鄉","後龍鎮","通霄鎮","苑裡鎮","苗栗市","造橋鄉","頭屋鄉","公館鄉","大湖鄉","泰安鄉","銅鑼鄉","三義鄉","西湖鄉","卓蘭鎮"],"彰化縣":["彰化市","芬園鄉","花壇鄉","秀水鄉","鹿港鎮","福興鄉","線西鄉","和美鎮","伸港鄉","員林市","社頭鄉","永靖鄉","埔心鄉","溪湖鎮","大村鄉","埔鹽鄉","田中鎮","北斗鎮","田尾鄉","埤頭鄉","溪州鄉","竹塘鄉","二林鎮","大城鄉","芳苑鄉","二水鄉"],"南投縣":["南投市","中寮鄉","草屯鎮","國姓鄉","埔里鎮","仁愛鄉","名間鄉","集集鎮","水里鄉","魚池鄉","信義鄉","竹山鎮","鹿谷鄉"],"雲林縣":["斗南鎮","大埤鄉","虎尾鎮","土庫鎮","褒忠鄉","東勢鄉","臺西鄉","崙背鄉","麥寮鄉","斗六市","林內鄉","古坑鄉","莿桐鄉","西螺鎮","二崙鄉","北港鎮","水林鄉","口湖鄉","四湖鄉","元長鄉"],"嘉義縣":["番路鄉","梅山鄉","竹崎鄉","阿里山鄉","中埔鄉","大埔鄉","水上鄉","鹿草鄉","太保市","朴子市","東石鄉","六腳鄉","新港鄉","民雄鄉","大林鎮","溪口鄉","義竹鄉","布袋鎮"],"屏東縣":["屏東市","三地門鄉","霧臺鄉","瑪家鄉","九如鄉","里港鄉","高樹鄉","鹽埔鄉","長治鄉","麟洛鄉","竹田鄉","內埔鄉","萬丹鄉","潮州鎮","泰武鄉","來義鄉","萬巒鄉","崁頂鄉","新埤鄉","南州鄉","林邊鄉","東港鎮","琉球鄉","佳冬鄉","新園鄉","枋寮鄉","枋山鄉","春日鄉","獅子鄉","車城鄉","牡丹鄉","恆春鎮","滿州鄉"],"宜蘭縣":["宜蘭市","壯圍鄉","頭城鎮","礁溪鄉","員山鄉","羅東鎮","三星鄉","大同鄉","五結鄉","冬山鄉","蘇澳鎮","南澳鄉","釣魚臺"],"花蓮縣":["花蓮市","新城鄉","秀林鄉","吉安鄉","壽豐鄉","鳳林鎮","光復鄉","豐濱鄉","瑞穗鄉","萬榮鄉","玉里鎮","卓溪鄉","富里鄉"],"臺東縣":["臺東市","綠島鄉","蘭嶼鄉","延平鄉","卑南鄉","鹿野鄉","關山鎮","海端鄉","池上鄉","東河鄉","成功鎮","長濱鄉","太麻里鄉","金峰鄉","大武鄉","達仁鄉"],"澎湖縣":["馬公市","西嶼鄉","望安鄉","七美鄉","白沙鄉","湖西鄉"],"金門縣":["金沙鎮","金湖鎮","金寧鄉","金城鎮","烈嶼鄉","烏坵鄉"],"連江縣":["南竿鄉","北竿鄉","莒光鄉","東引鄉"]});
      function splitTaiwanAddress(value){
        const raw=String(value??''),normal=v=>v.replaceAll('台','臺'),text=normal(raw);
        for(const city of Object.keys(TW_ADDRESS_DISTRICTS)){
          if(!text.startsWith(normal(city)))continue;
          const district=[...TW_ADDRESS_DISTRICTS[city]].sort((a,b)=>b.length-a.length).find(area=>text.slice(city.length).startsWith(normal(area)));
          if(district)return {city,district,detail:raw.slice(city.length+district.length),unparsed:false};
        }
        return {city:'',district:'',detail:raw,unparsed:!!raw};
      }
      const TenantField = {
        props: { tenant: Object, field: Object, blocked: Boolean, showTitle: Boolean },
        emits: ['saved', 'save-start', 'save-end', 'dirty-change','draft-change'],
        template: "\n    <div class=\"editor\" :class=\"{ multiline: field.multiline, phone: field.type === 'tel' }\">\n      <label v-if=\"showTitle\" class=\"editor-label\" :for=\"inputId\">{{ field.title }}</label>\n      <textarea v-if=\"field.multiline\" ref=\"inputElement\" :id=\"inputId\"\n        v-model=\"draft\" rows=\"3\" maxlength=\"2000\" :aria-label=\"label\"\n        :disabled=\"saving || blocked\"></textarea>\n      <div v-else-if=\"field.radio\" class=\"tenant-radio\" role=\"group\" :aria-label=\"label\"><label v-for=\"option in field.options\" :key=\"option\"><input v-write-field type=\"radio\" :name=\"inputId\" :value=\"option\" v-model=\"draft\" :disabled=\"saving || blocked\" :aria-label=\"label+' '+option\">{{option}}</label></div>\n      <div v-else-if=\"isAddress\" class=\"address-field\">\n        <input v-if=\"!addressEditable\" ref=\"inputElement\" :id=\"inputId\" :value=\"draft\" readonly :aria-label=\"label\">\n        <div v-else class=\"address-controls\">\n          <select v-write-field :id=\"inputId+'-city'\" v-model=\"addressCity\" @change=\"changeAddressCity\" :disabled=\"saving||blocked\" :aria-label=\"label+' 縣市'\"><option value=\"\">選擇縣市</option><option v-for=\"city in addressCities\" :key=\"city\" :value=\"city\">{{city}}</option></select>\n          <select v-write-field :id=\"inputId+'-district'\" v-model=\"addressDistrict\" @change=\"changeAddressDistrict\" :required=\"!!addressCity\" :disabled=\"saving||blocked||!addressCity\" :aria-label=\"label+' 鄉鎮市區'\"><option value=\"\">選擇鄉鎮市區</option><option v-for=\"district in addressDistricts\" :key=\"district\" :value=\"district\">{{district}}</option></select>\n          <input v-write-field ref=\"inputElement\" :id=\"inputId\" v-model=\"addressDetail\" @input=\"changeAddressDetail\" :maxlength=\"500-addressCity.length-addressDistrict.length\" :disabled=\"saving||blocked\" :aria-label=\"label+' 詳細地址'\" placeholder=\"路街、段巷弄、門牌樓層\">\n          <p v-if=\"addressUnparsed\" class=\"address-hint\">原地址無法自動拆分，完整原文已保留；請核對詳細地址後再選擇縣市與鄉鎮市區。</p>\n        </div>\n      </div>\n      <select v-else-if=\"field.options\" ref=\"inputElement\" :id=\"inputId\" v-model=\"draft\" :aria-label=\"label\" :disabled=\"saving || blocked\"><option v-for=\"option in field.options.includes(tenant[field.key]) || !tenant[field.key] ? field.options : [...field.options, tenant[field.key]]\" :key=\"option\" :value=\"option\">{{ option || '未標記' }}</option></select>\n      <div v-else-if=\"field.key==='contractKind'\" class=\"tenant-radio\" role=\"group\" aria-label=\"合約類型\"><label v-for=\"kind in ['續約','新約']\"><input v-write-field type=\"checkbox\" :checked=\"draft===kind\" @change=\"draft=$event.target.checked?kind:''\" :disabled=\"saving||blocked\" :aria-label=\"tenant.room+' 房'+kind\">{{kind}}</label></div>\n      <label v-else-if=\"field.checkbox\" class=\"student-checkbox\"><input ref=\"inputElement\" type=\"checkbox\" :id=\"inputId\" v-model=\"draft\" :aria-label=\"label\" :disabled=\"saving || blocked\">學生</label>\n      <input v-else ref=\"inputElement\" :id=\"inputId\" v-model=\"draft\" @blur=\"formatTelephone\"\n        :type=\"field.type || 'text'\" :aria-label=\"label\" :disabled=\"saving || blocked\"\n        :min=\"['rent','initialReading'].includes(field.key) ? 0 : undefined\"\n        :max=\"field.key === 'rent' ? 1000000 : field.key === 'initialReading' ? 100000000 : undefined\"\n        :step=\"['rent','initialReading'].includes(field.key) ? '0.01' : undefined\"\n        :maxlength=\"field.key === 'defaultTransferLastFive' ? 5 : ['registeredAddress','guarantorAddress'].includes(field.key) ? 500 : field.type === 'date' || ['rent','initialReading'].includes(field.key) ? undefined : 100\"\n        :inputmode=\"field.key === 'defaultTransferLastFive' ? 'numeric' : undefined\"\n        :pattern=\"field.key === 'defaultTransferLastFive' ? '[0-9]{0,5}' : undefined\"\n        :placeholder=\"field.key === 'defaultTransferLastFive' ? '例如 01234' : undefined\">\n      <slot name=\"lease-term\"></slot>\n      <div class=\"editor-actions\">\n\n        <button v-if=\"dirty\" type=\"button\" @click=\"reset\" :disabled=\"saving || blocked\">還原</button>\n      </div>\n      <div class=\"save-message\" role=\"status\" aria-live=\"polite\">{{ message }}</div>\n    </div>\n  ",
        setup(props, { emit }) {
          const savedValue = ref(props.tenant[props.field.key] ?? (['rent','initialReading'].includes(props.field.key) ? null : ''));
          const draft = ref(displayField(savedValue.value, props.field));
          const saving = ref(false);
          const message = ref('');
          const inputElement = ref(null);
          const label = computed(() => props.tenant.room + ' 房' + props.field.title);
          const inputId = computed(() => 'tenant-' + props.tenant.room + '-' + props.field.key);
          const isAddress=computed(()=>['registeredAddress','guarantorAddress'].includes(props.field.key));
          const addressEditable=computed(()=>window.RentalAccess?.canWrite!==false);
          const addressCities=Object.keys(TW_ADDRESS_DISTRICTS),addressCity=ref(''),addressDistrict=ref(''),addressDetail=ref(''),addressUnparsed=ref(false);
          const addressDistricts=computed(()=>TW_ADDRESS_DISTRICTS[addressCity.value]||[]);let composingAddress=false;
          watch(draft,value=>{if(!isAddress.value||composingAddress)return;const parsed=splitTaiwanAddress(value);addressCity.value=parsed.city;addressDistrict.value=parsed.district;addressDetail.value=parsed.detail;addressUnparsed.value=parsed.unparsed;},{immediate:true,flush:'sync'});
          function composeAddress(){if(!addressEditable.value||saving.value||props.blocked)return;composingAddress=true;try{draft.value=addressCity.value+addressDistrict.value+addressDetail.value;}finally{composingAddress=false;}}
          function changeAddressCity(){if(!addressEditable.value||saving.value||props.blocked)return;addressDistrict.value='';composeAddress();}
          function changeAddressDistrict(){composeAddress();}
          function changeAddressDetail(){addressUnparsed.value=false;composeAddress();}

          const dirty = computed(() => props.field.checkbox ? draft.value !== displayField(savedValue.value, props.field) : String(draft.value ?? '') !== displayField(savedValue.value, props.field));
          watch(dirty, value => emit('dirty-change', value));
          watch(draft,value=>emit('draft-change',value));

          function formatTelephone(){if(props.field.type==='tel')draft.value=formatPhone(draft.value);}
          function reset() {
            if (saving.value || props.blocked) return;
            draft.value = displayField(savedValue.value, props.field);
            message.value = '已還原為上次讀取或儲存的內容。';
          }
          async function save() {
            if (saving.value || props.blocked || !inputElement.value.reportValidity()) return;
            saving.value = true;
            message.value = '儲存中……';
            emit('save-start');
            try {
              const result = await tenantApi.saveField(
                props.tenant.room, props.field.key, props.field.checkbox ? (draft.value ? '是' : '否') : String(draft.value ?? ''), savedValue.value
              );
              const nextValue = props.field.key === 'notes' ? result?.note : result?.value;
              const valid = ['rent','initialReading'].includes(props.field.key)
                ? nextValue === null || (typeof nextValue === 'number' && Number.isFinite(nextValue) && nextValue >= 0)
                : typeof nextValue === 'string';
              if (!valid) throw new Error('儲存回應格式不正確，請核對試算表後重新讀取。');
              savedValue.value = nextValue;
              draft.value = displayField(nextValue, props.field);
              emit('saved', nextValue);
              emit('dirty-change', false);
              message.value = '已儲存 ✓';
            } catch (error) {
              message.value = '儲存未完成確認：' + errorText(error);
            } finally {
              saving.value = false;
              emit('save-end');
            }
          }
          return { isAddress,addressEditable,addressCities,addressCity,addressDistrict,addressDetail,addressUnparsed,addressDistricts,changeAddressCity,changeAddressDistrict,changeAddressDetail,draft, saving, message, inputElement, inputId, label, dirty, reset, save,formatTelephone };
        }
      };

      const TenantContract = {
        props: { tenant: Object, blocked: Boolean },
        emits: ['saved', 'save-start', 'save-end', 'dirty-change'],
        template: "\n    <div class=\"editor contract-editor\">\n      <div class=\"contract-links\">\n        <a v-for=\"(url, index) in safeLinks\" :key=\"url\" :href=\"url\"\n          target=\"_blank\" rel=\"noopener noreferrer\">查看合約 {{ index + 1 }}</a>\n        <span v-if=\"!safeLinks.length\">{{ savedLinks.length ? '連結格式待確認' : '尚未提供' }}</span>\n      </div>\n      <input ref=\"inputElement\" v-model=\"draft\" type=\"url\" maxlength=\"2000\"\n        placeholder=\"貼上 Google Drive 資料夾網址\" :aria-label=\"tenant.room + ' 房合約資料夾'\"\n        :disabled=\"saving || blocked || multiple\">\n      <div class=\"editor-actions\">\n\n        <button v-if=\"dirty\" type=\"button\" @click=\"reset\" :disabled=\"saving || blocked || multiple\">還原</button>\n      </div>\n      <div class=\"save-message\" role=\"status\" aria-live=\"polite\">{{ multiple ? '目前有多個連結，請先在試算表核對。' : message }}</div>\n    </div>\n  ",
        setup(props, { emit }) {
          const savedLinks = ref([...(props.tenant.contractLinks || [])]);
          const draft = ref(savedLinks.value[0] || '');
          const saving = ref(false);
          const message = ref('');
          const inputElement = ref(null);
          const multiple = computed(() => savedLinks.value.length > 1);
          const dirty = computed(() => draft.value !== (savedLinks.value[0] || ''));
          watch(dirty, value => emit('dirty-change', value));
          const safeLinks = computed(() => savedLinks.value.flatMap(url => {
            try {
              const parsed = new URL(url);
              return parsed.protocol === 'https:' && parsed.hostname === 'drive.google.com' &&
                !parsed.username && !parsed.password ? [parsed.href] : [];
            } catch { return []; }
          }));
          function reset() {
            if (saving.value || props.blocked || multiple.value) return;
            draft.value = savedLinks.value[0] || '';
            message.value = '已還原為上次讀取或儲存的連結。';
          }
          async function save() {
            if (saving.value || props.blocked || multiple.value || !inputElement.value.reportValidity()) return;
            const url = draft.value.trim();
            const folderPattern = /^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/[A-Za-z0-9_-]+\/?(?:[?#][^\s]*)?$/i;
            if (url && !folderPattern.test(url)) {
              message.value = '請貼上完整的 Google Drive 資料夾網址。';
              return;
            }
            saving.value = true;
            message.value = '儲存中……';
            emit('save-start');
            try {
              const result = await tenantApi.saveContract(props.tenant.room, url, [...savedLinks.value]);
              if (!result || !Array.isArray(result.links) || result.links.length > 1 ||
                  !result.links.every(link => typeof link === 'string')) {
                throw new Error('合約回應格式不正確，請核對試算表後重新讀取。');
              }
              savedLinks.value = [...result.links];
              draft.value = savedLinks.value[0] || '';
              emit('saved', [...savedLinks.value]);
              emit('dirty-change', false);
              message.value = '合約連結已儲存 ✓';
            } catch (error) {
              message.value = '儲存未完成確認：' + errorText(error);
            } finally {
              saving.value = false;
              emit('save-end');
            }
          }
          return { savedLinks, draft, saving, message, inputElement, multiple, dirty, safeLinks, reset, save };
        }
      };

      function leaseReminder(room){if(room.vacant||!/^\d{4}-\d{2}-\d{2}$/.test(room.endDate||''))return null;const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const start=new Date(today+'T00:00:00Z'),end=new Date(room.endDate+'T00:00:00Z');if(!Number.isFinite(+end))return null;if(end<start)return {level:'expired',text:'已到期，請辦理續約'};const plus=n=>{const d=new Date(start);const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,max));return d;};if(end<=plus(1))return {level:'urgent',text:'一個月內到期，請確認續約'};if(end<=plus(3))return {level:'soon',text:'三個月內到期'};return null;}
      window.RentalLeaseReminder=leaseReminder;
      const component = {
 props: { initialRoom: String }, emits: ["update-data", "busy-change"],
 template: "\n  <div class=\"page-heading\"><button class=\"reload\" type=\"button\" @click=\"loadTenants\" :disabled=\"loading || pendingSaves > 0 || dirtyKeys.size > 0\">重新讀取</button></div><p class=\"status\" role=\"status\" aria-live=\"polite\">{{ status }}</p>\n  <div class=\"tenant-batch-actions\"><button v-write type=\"button\" class=\"primary\" @click=\"saveAll\" :disabled=\"loading || pendingSaves > 0 || !dirtyKeys.size\">儲存全部修改</button><button v-write type=\"button\" @click=\"resetAll\" :disabled=\"loading || pendingSaves>0 || !dirtyKeys.size\">還原全部未儲存</button><button v-write type=\"button\" @click=\"openCheckout\" :disabled=\"!activeTenant || loading || pendingSaves > 0 || dirtyKeys.size > 0\">退租</button><button v-write type=\"button\" @click=\"previewMoveIn\" :disabled=\"!activeTenant||loading||pendingSaves>0||dirtyKeys.size>0\">確認入住與更新帳務</button><button v-write type=\"button\" @click=\"previewBillingNames\" :disabled=\"!activeTenant || loading || pendingSaves>0 || dirtyKeys.size>0\">同步帳務姓名</button></div>\n\n  <p>儲存房客姓名後，可按「同步帳務姓名」，勾選要更正的帳務月份；未勾選的月份保留原姓名。</p>\n  <section v-if=\"moveInPreview\" class=\"draft-notice billing-name-review\" aria-label=\"入住帳務核對\"><h2>入住與帳務核對</h2><p>{{moveInPreview.room}} 房／{{moveInPreview.name}}／整月房租 NT$ {{rentFormat.format(moveInPreview.monthlyRent)}}。</p><p>首期租用期間：{{moveInPreview.startDate}} 至 {{moveInPreview.firstCycleEnd}}；租約到期：{{moveInPreview.endDate}}。收租日固定每月 10 日，與租期起日分開。</p><p v-if=\"moveInPreview.annual\">系統已列出可更新的全部月份；請核對後確認。租約到期仍繼續計收，直到確認退租。</p><p v-else>請勾選要更新的既有帳務月份；預設不勾選，不建立缺少的月份。電費、押金、已填對帳金額及截圖保留，更新後須重新確認對帳。</p><ul><li v-for=\"c in moveInPreview.changes\" :key=\"c.year+':'+c.month\"><label><input v-write-field type=\"checkbox\" v-model=\"moveInMonths\" :value=\"c.year+':'+c.month\" :disabled=\"pendingSaves>0||!!c.blocked||moveInPreview.annual\"><span>{{c.year}} 年 {{c.month}} 月：{{c.before.vacant?'空房':c.before.name||'承租人待補'}} → {{c.after.name}}／房租 {{rentFormat.format(c.before.rent)}} → {{rentFormat.format(c.after.rent)}}／出租中／收租日 {{c.after.dueDate}}</span></label><p v-if=\"c.blocked\">{{c.blocked}}</p></li></ul><p v-if=\"!moveInPreview.changes.length\">租期內沒有需要更新的既有帳單。</p><p role=\"status\">{{moveInMessage}}</p><div class=\"billing-name-actions\"><button v-write type=\"button\" @click=\"confirmMoveIn\" :disabled=\"pendingSaves>0||(!moveInMonths.length&&(!moveInPreview.annual||moveInPreview.changes.length>0))\">{{moveInPreview.annual?'確認系統列出的更新月份':'確認更新勾選月份'}}</button><button type=\"button\" @click=\"moveInPreview=null;moveInMonths=[]\" :disabled=\"pendingSaves>0\">取消入住帳務核對</button></div></section>\n  <section v-if=\"billingNamePreview\" class=\"draft-notice billing-name-review\" aria-label=\"同租期帳務姓名同步\"><p>{{billingNamePreview.room}} 房：{{billingNamePreview.startDate}} 至 {{billingNamePreview.endDate}}。請勾選要更正姓名的月份；未勾選的月份、金額、收款與空房紀錄保留。</p><label v-if=\"billingNamePreview.changes.length\"><input v-write-field type=\"checkbox\" :checked=\"selectedBillingNames.length===billingNamePreview.changes.length\" @change=\"selectAllBillingNames($event.target.checked)\" :disabled=\"pendingSaves>0\" aria-label=\"全選姓名更正月份\"><span>全選／取消全選</span></label><ul><li v-for=\"c in billingNamePreview.changes\" :key=\"c.year+':'+c.month\"><label><input v-write-field type=\"checkbox\" v-model=\"selectedBillingNames\" :value=\"c.year+':'+c.month\" :disabled=\"pendingSaves>0\" :aria-label=\"'更正 '+c.year+' 年 '+c.month+' 月帳務姓名'\"><span>{{c.year}} 年 {{c.month}} 月：{{c.from||'未填姓名'}} → {{c.to}}</span></label></li></ul><p v-if=\"!billingNamePreview.changes.length\">同租期內的帳務姓名已一致。</p><p v-else>已選 {{selectedBillingNames.length}} 個月份。</p><div class=\"billing-name-actions\"><button v-write class=\"primary\" @click=\"syncBillingNames\" :disabled=\"pendingSaves>0 || dirtyKeys.size>0 || !selectedBillingNames.length\">確認同步帳務姓名</button><button @click=\"billingNamePreview=null;selectedBillingNames=[]\" :disabled=\"pendingSaves>0\">取消</button></div></section>\n  <section v-if=\"checkoutConfirm && activeTenant.annualBilling\" class=\"draft-notice\" role=\"alert\"><p>確認 {{activeTenant.room}} 房已搬離並完成點交。退租當月既有金額保留，不進行租金調整或退款計算。</p><label>退租點交日<input v-write-field type=\"date\" v-model=\"checkoutOptions.checkoutDate\" :disabled=\"pendingSaves>0\" aria-label=\"退租點交日\"></label><button v-write type=\"button\" @click=\"previewCheckout\" :disabled=\"pendingSaves>0\">預覽空房與後續帳務</button><p v-if=\"checkoutPreview\">系統將更新 {{checkoutPreview.changes.length}} 個後續月份為空房；原租約、歷史帳務及匯款照片保留。</p><p role=\"status\">{{checkoutMessage}}</p><button v-write type=\"button\" @click=\"checkout\" :disabled=\"pendingSaves>0||!checkoutPreview\">確認已點交並退租</button><button type=\"button\" @click=\"checkoutConfirm=false\" :disabled=\"pendingSaves>0\">取消</button></section>\n  <section v-else-if=\"checkoutConfirm\" class=\"draft-notice\" role=\"alert\"><p>確認 {{activeTenant.room}} 房退租？除了房型與房間維護整修紀錄，其他目前房客資料會清空；歷史帳務、照片原檔保留。</p><div class=\"field-grid\"><label>調整帳務月份<input v-write-field type=\"month\" v-model=\"checkoutPeriod\" :disabled=\"pendingSaves>0\" aria-label=\"退租帳務月份\"></label><label>當期房租計算<select v-write-field v-model=\"checkoutOptions.mode\" :disabled=\"pendingSaves>0\" aria-label=\"退租房租計算\"><option value=\"free\">當期全免</option><option value=\"daily\">按天計算</option><option value=\"fixed\">自行輸入金額</option></select></label><template v-if=\"checkoutOptions.mode==='daily'\"><label>本租期起日（依起租日，可修改）<input v-write-field type=\"date\" v-model=\"checkoutOptions.cycleStart\" :disabled=\"pendingSaves>0\"></label><label>最後居住日（包含當日）<input v-write-field type=\"date\" v-model=\"checkoutOptions.checkoutDate\" :disabled=\"pendingSaves>0\"></label><label>原月租<input v-write-field type=\"number\" min=\"0\" step=\"0.01\" v-model=\"checkoutOptions.monthlyRent\" :disabled=\"pendingSaves>0\"></label></template><label v-if=\"checkoutOptions.mode==='fixed'\">本期房租（元）<input v-write-field type=\"number\" min=\"0\" step=\"0.01\" v-model=\"checkoutOptions.amount\" :disabled=\"pendingSaves>0\" aria-label=\"退租指定房租\"></label></div><button @click=\"previewCheckout\" :disabled=\"pendingSaves>0\">預覽退租帳務</button><p v-if=\"checkoutPreview\">{{checkoutPreview.year}} 年 {{checkoutPreview.month}} 月：<span v-if=\"checkoutPreview.days\">{{checkoutPreview.monthlyRent}} ÷ {{checkoutPreview.days}} 天 × {{checkoutPreview.occupiedDays}} 天 ＝ </span>房租 {{checkoutPreview.rent}} 元＋電費 {{checkoutPreview.electricityFee}} 元；扣抵後應繳 {{checkoutPreview.netDue}} 元。只調整此月份，銀行實收保留。</p><p>{{checkoutMessage}}</p><button v-write class=\"danger\" @click=\"checkout\" :disabled=\"pendingSaves>0||!checkoutPreview\">確認退租並清空</button><button @click=\"checkoutConfirm=false\" :disabled=\"pendingSaves>0\">取消</button></section>\n  <div v-if=\"pendingSaves > 0\" class=\"draft-notice\" role=\"status\">有 {{ pendingSaves }} 筆儲存中，請稍候。</div>\n  <div v-else-if=\"dirtyKeys.size > 0\" class=\"draft-notice\">有 {{ dirtyKeys.size }} 個未儲存項目，請儲存或還原後再切換房間。</div>\n\n  <div v-if=\"tenants.length\" class=\"workspace\">\n    <aside class=\"room-panel\" aria-label=\"選擇房間\">\n      <div class=\"room-heading\"><h2>房間列表</h2><span class=\"room-count\">{{ tenants.length }} 間</span></div>\n      <div class=\"room-list\">\n        <button v-for=\"tenant in tenants\" :key=\"tenant.room\" class=\"room-button\" :class=\"leaseReminder(tenant)?'lease-'+leaseReminder(tenant).level:''\" type=\"button\"\n          :aria-label=\"'選擇 ' + tenant.room + ' 房'\" :aria-describedby=\"leaseReminder(tenant)?'room-lease-'+tenant.room:undefined\" :aria-pressed=\"selectedRoom === tenant.room\"\n          :disabled=\"loading || pendingSaves > 0 || (dirtyKeys.size > 0 && selectedRoom !== tenant.room)\"\n          @click=\"selectRoom(tenant.room)\">\n          <span class=\"room-number\">{{ tenant.room }}</span><span v-if=\"leaseReminder(tenant)\" class=\"room-lease-label\" :id=\"'room-lease-'+tenant.room\" :title=\"leaseReminder(tenant).text+'（'+tenant.endDate+'）'\">{{leaseReminder(tenant).level==='expired'?'已到期':'即將到期'}}</span>\n          <span class=\"room-name\">{{ tenant.name || '空房' }} <span v-if=\"['學生','管理人'].includes(tenant.identity)\" class=\"student-tag\">{{ tenant.identity }}</span></span>\n        </button>\n      </div>\n    </aside>\n\n    <article v-if=\"activeTenant\" :key=\"revision + ':' + activeTenant.room\" class=\"tenant-panel\" aria-label=\"房客資料編輯\">\n      <header class=\"tenant-heading\">\n        <div><span class=\"room-tag\">房間資料</span><h2>{{ activeTenant.room }} 房</h2><p class=\"tenant-name\">{{ activeTenant.name || '空房' }} <span v-if=\"['學生','管理人'].includes(activeTenant.identity)\" class=\"student-tag\">{{ activeTenant.identity }}</span></p></div>\n        <div class=\"rent-summary\"><span>目前房租／月</span><strong>{{ rentText(activeTenant.rent) }}</strong></div>\n      </header>\n\n      <section class=\"form-section\" aria-label=\"基本與租約資料\">\n        <div class=\"section-heading\"><h3>基本與租約資料</h3><span class=\"section-hint\">修改完成後，一鍵儲存全部；租期至少一年，以整年計算</span></div>\n        <div class=\"field-grid lease-fields\">\n          <tenant-field v-for=\"field in basicFields\" :key=\"field.key\" :ref=\"el=>registerField(field.key,el)\" :tenant=\"activeTenant\" :field=\"field\" :blocked=\"loading\" show-title\n            @save-start=\"startSave\" @save-end=\"finishSave\"\n            @saved=\"updateField(activeTenant, field.key, $event)\" @draft-change=\"onDraft(field.key,$event)\"\n            @dirty-change=\"setDirty(activeTenant.room, field.key, $event)\"><template v-if=\"field.key==='endDate'\" #lease-term><div class=\"lease-years-control\"><label :for=\"'tenant-'+activeTenant.room+'-leaseYears'\">租期年數</label><input v-write-field :id=\"'tenant-'+activeTenant.room+'-leaseYears'\" type=\"number\" min=\"1\" step=\"1\" required inputmode=\"numeric\" :value=\"leaseYears\" @input=\"changeLeaseYears($event.target.value)\" :disabled=\"loading||pendingSaves>0\" :aria-label=\"activeTenant.room+' 房租期年數'\"><span>年</span></div><p v-if=\"leaseTermMessage\" class=\"lease-term-message\" role=\"status\">{{leaseTermMessage}}</p></template></tenant-field>\n          <section v-if=\"!activeTenant.vacant\" class=\"renewal-notice\" aria-label=\"租約到期暨續約意願通知\"><h3>租約到期暨續約意願通知</h3><div class=\"renewal-controls\"><button type=\"button\" @click=\"createRenewal\" :disabled=\"loading||pendingSaves>0||dirtyKeys.size>0\">預覽續約通知圖片</button></div><p>通知包含房號、租約到期日與續租／退租回覆說明；下載圖片後由管理人自行聯絡。</p><p v-if=\"renewalMessage\" role=\"status\">{{renewalMessage}}</p><template v-if=\"renewalUrl\"><img :src=\"renewalUrl\" alt=\"租約到期暨續約意願通知預覽\" style=\"display:block;max-width:100%;width:600px\"><a class=\"rental-button primary renewal-download\" :href=\"renewalUrl\" :download=\"activeTenant.room+'_續約意願通知.png'\">下載通知圖片</a></template></section>\n        </div>\n      </section>\n\n\n\n      <section class=\"form-section\" aria-label=\"管理備註\">\n        <div class=\"section-heading\"><h3>管理備註</h3></div>\n        <tenant-field :ref=\"el=>registerField('notes',el)\" :tenant=\"activeTenant\" :field=\"noteField\" :blocked=\"loading\"\n          @save-start=\"startSave\" @save-end=\"finishSave\"\n          @saved=\"updateField(activeTenant, 'notes', $event)\"\n          @dirty-change=\"setDirty(activeTenant.room, 'notes', $event)\"></tenant-field>\n      </section>\n\n      <section class=\"form-section\" aria-label=\"緊急聯絡人\"><div class=\"section-heading\"><h3>緊急聯絡人</h3><button v-write @click=\"addContact\" :disabled=\"loading||pendingSaves>0||contacts.length>=20\">新增緊急聯絡人</button></div><div v-for=\"(contact,index) in contacts\" :key=\"index\" class=\"contact-row\"><label>聯絡人 {{index+1}}<input v-write-field v-model=\"contact.name\" maxlength=\"100\" :aria-label=\"'緊急聯絡人 '+(index+1)+' 姓名'\" :disabled=\"loading||pendingSaves>0\"></label><label>電話<input v-write-field v-model=\"contact.phone\" @blur=\"contact.phone=formatPhone(contact.phone)\" type=\"tel\" maxlength=\"100\" :aria-label=\"'緊急聯絡人 '+(index+1)+' 電話'\" :disabled=\"loading||pendingSaves>0\"></label><button v-write class=\"danger\" @click=\"contacts.splice(index,1)\" :disabled=\"loading||pendingSaves>0\">移除此聯絡人</button></div><p v-if=\"!contacts.length\">尚未填寫緊急聯絡人。</p></section>\n      <section class=\"form-section\">\n        <details class=\"other-data\">\n          <summary>其他聯絡與房間資料</summary>\n          <section class=\"tenant-contract-section\" aria-label=\"簽約資料\">\n        <div class=\"section-heading\"><h3>簽約資料</h3><span class=\"section-hint\">Google Drive 合約資料夾</span></div>\n        <tenant-contract :ref=\"el=>registerField('contractLinks',el)\" :tenant=\"activeTenant\" :blocked=\"loading\"\n          @save-start=\"startSave\" @save-end=\"finishSave\"\n          @saved=\"updateField(activeTenant, 'contractLinks', $event)\"\n          @dirty-change=\"setDirty(activeTenant.room, 'contractLinks', $event)\"></tenant-contract>\n      </section>\n          <div class=\"field-grid\">\n            <tenant-field v-for=\"field in extraFields\" :key=\"field.key\" :ref=\"el=>registerField(field.key,el)\" :tenant=\"activeTenant\" :field=\"field\" :blocked=\"loading\" show-title\n              @save-start=\"startSave\" @save-end=\"finishSave\"\n              @saved=\"updateField(activeTenant, field.key, $event)\" @draft-change=\"onDraft(field.key,$event)\"\n              @dirty-change=\"setDirty(activeTenant.room, field.key, $event)\"></tenant-field>\n          </div>\n          <h3>連帶保證人（丙方）</h3><div class=\"field-grid\"><tenant-field v-for=\"field in guarantorFields\" :key=\"field.key\" :ref=\"el=>registerField(field.key,el)\" :tenant=\"activeTenant\" :field=\"field\" :blocked=\"loading\" show-title @draft-change=\"onDraft(field.key,$event)\" @dirty-change=\"setDirty(activeTenant.room,field.key,$event)\"></tenant-field></div>\n        </details>\n      </section>\n    </article>\n  </div>\n  <p v-else-if=\"!loading && !loadFailed\" class=\"empty\">目前沒有房客資料。</p>\n  ",
        components: { TenantField, TenantContract },
        setup(props, { emit }) {
          const tenants = ref([]);
          const loading = ref(false);
          const loadFailed = ref(false);
          const pendingSaves = ref(0);
          const status = ref('正在讀取 Google 試算表……');
          const revision = ref(0);
          const selectedRoom = ref(props.initialRoom || '');
          const activeTenant = computed(() => tenants.value.find(tenant => tenant.room === selectedRoom.value) || null);
          const rentFormat = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 });
          function rentText(value) {
            return value === null || value === undefined ? '尚未填寫' : 'NT$ ' + rentFormat.format(value);
          }
          function selectRoom(room) {
            if (loading.value || pendingSaves.value > 0 || dirtyKeys.size > 0) return;
            selectedRoom.value = room;
          }
          const dirtyKeys = reactive(new Set());
          const moveInPreview=ref(null),moveInMonths=ref([]),moveInMessage=ref('');
          watch(activeTenant,()=>{moveInPreview.value=null;moveInMonths.value=[];moveInMessage.value='';});
          async function previewMoveIn(){if(!writeAllowed()||pendingSaves.value||dirtyKeys.size||!activeTenant.value)return;pendingSaves.value++;moveInMessage.value='';try{moveInPreview.value=await rpc('previewTenantMoveIn',activeTenant.value.room);moveInMonths.value=moveInPreview.value.annual?moveInPreview.value.changes.filter(c=>!c.blocked).map(c=>c.year+':'+c.month):[];}catch(e){status.value='入住帳務預覽失敗：'+errorText(e);}finally{pendingSaves.value--;}}
          async function confirmMoveIn(){if(!writeAllowed()||pendingSaves.value||dirtyKeys.size||!moveInPreview.value||(!moveInMonths.value.length&&(!moveInPreview.value.annual||moveInPreview.value.changes.length)))return;pendingSaves.value++;try{const p=moveInPreview.value,r=await rpc('confirmTenantMoveIn',p.room,p.tenantVersion,p.version,moveInMonths.value.map(key=>{const [year,month]=key.split(':').map(Number);return {year,month};}));acceptTenant(r.tenant);moveInPreview.value=null;moveInMonths.value=[];status.value='已更新 '+r.updated+' 個勾選月份：整月租金、承租人及出租狀態；收租日為每月10日，對帳金額保留，請重新核對。';}catch(e){moveInMessage.value='更新結果待核對：'+errorText(e)+'。請取消並重新預覽，不會自動重送。';}finally{pendingSaves.value--;}}
          const billingNamePreview=ref(null),selectedBillingNames=ref([]);
          function selectAllBillingNames(checked){selectedBillingNames.value=checked?billingNamePreview.value.changes.map(c=>c.year+':'+c.month):[];}
          watch(activeTenant,()=>{billingNamePreview.value=null;selectedBillingNames.value=[]});
          async function previewBillingNames(){if(!writeAllowed()||pendingSaves.value||dirtyKeys.size)return;pendingSaves.value++;try{billingNamePreview.value=await rpc('previewTenantBillingNames',activeTenant.value.room);selectedBillingNames.value=[];}catch(e){status.value='預覽姓名同步失敗：'+errorText(e);}finally{pendingSaves.value--;}}
          async function syncBillingNames(){if(!writeAllowed()||pendingSaves.value||dirtyKeys.size||!billingNamePreview.value||!selectedBillingNames.value.length)return;pendingSaves.value++;try{const result=await rpc('syncTenantBillingNames',activeTenant.value.room,activeTenant.value.version,billingNamePreview.value.version,selectedBillingNames.value.map(key=>{const [year,month]=key.split(':').map(Number);return {year,month};}));billingNamePreview.value=null;selectedBillingNames.value=[];status.value='已同步 '+result.updated+' 個月份的帳務姓名；金額與收款保留。';}catch(e){billingNamePreview.value=null;status.value='同步結果待核對：'+errorText(e)+'。請重新預覽，不會自動重送。';}finally{pendingSaves.value--;}}
          const checkoutPeriod=ref(''),checkoutOptions=ref({mode:'free',cycleStart:'',checkoutDate:'',monthlyRent:'',amount:''}),checkoutPreview=ref(null),checkoutMessage=ref('');
          watch([checkoutPeriod,checkoutOptions],()=>{checkoutPreview.value=null;checkoutMessage.value='';},{deep:true});
          function openCheckout(){const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());checkoutPeriod.value=today.slice(0,7);const start=activeTenant.value?.startDate||'',anchor=start?Number(start.slice(8,10)):1;let d=new Date(today+'T00:00:00Z');const boundary=(y,m)=>new Date(Date.UTC(y,m,Math.min(anchor,new Date(Date.UTC(y,m+1,0)).getUTCDate())));let cycle=boundary(d.getUTCFullYear(),d.getUTCMonth());if(cycle>d)cycle=boundary(d.getUTCFullYear(),d.getUTCMonth()-1);checkoutOptions.value={mode:'free',cycleStart:cycle.toISOString().slice(0,10),checkoutDate:today,monthlyRent:String(activeTenant.value?.rent??''),amount:''};checkoutConfirm.value=true;}
          const checkoutArgs=()=>({...checkoutOptions.value,year:Number(checkoutPeriod.value.slice(0,4)),month:Number(checkoutPeriod.value.slice(5,7)),monthlyRent:String(checkoutOptions.value.monthlyRent),amount:String(checkoutOptions.value.amount)});
          async function previewCheckout(){if(pendingSaves.value)return;pendingSaves.value++;try{checkoutPreview.value=activeTenant.value.annualBilling?await rpc('previewAnnualCheckout',activeTenant.value.room,checkoutOptions.value.checkoutDate):await rpc('previewTenantCheckout',activeTenant.value.room,checkoutArgs());checkoutMessage.value=activeTenant.value.annualBilling?'空房及後續月份已預覽，尚未執行退租。':'金額已預覽，尚未執行退租。';}catch(e){checkoutPreview.value=null;checkoutMessage.value='預覽失敗：'+errorText(e);}finally{pendingSaves.value--;}}
          const renewalUrl=ref(''),renewalMessage=ref('');
          function clearRenewal(){if(renewalUrl.value)URL.revokeObjectURL(renewalUrl.value);renewalUrl.value='';renewalMessage.value='';}
          watch(()=>[selectedRoom.value,activeTenant.value?.endDate],clearRenewal);
          onBeforeUnmount(clearRenewal);
          async function createRenewal(){clearRenewal();try{const t=activeTenant.value,valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;if(!t||!valid(t.endDate))throw Error('請先填妥租約到期日。');const canvas=document.createElement('canvas');canvas.width=1200;const c=canvas.getContext('2d');if(!c)throw Error('無法產生通知圖片。');
            const paragraphs=[['房號：'+t.room,40],['感謝您這段期間的入住與配合，\n也謝謝您對房屋的愛惜與照顧。',36],['租約到期日：'+t.endDate,40],['麻煩您回覆「續租」或「不續租」。若仍在考慮，或有任何租屋相關問題，也歡迎提出討論。',36],['如有意續租，我們會再與您確認續約內容及簽約時間；若不續租，則另行協調退租點交事宜。',36],['謝謝您的配合與這段時間的愛護 😊',36]];
            const lines=[];let y=270;
            for(const [text,size] of paragraphs){c.font=size+'px sans-serif';for(const paragraph of text.split('\n')){let line='';for(const character of Array.from(paragraph)){if(line&&c.measureText(line+character).width>1060){lines.push({text:line,size,y});y+=60;line='';}line+=character;}lines.push({text:line,size,y});y+=60;}y+=30;}
            canvas.height=y+30;c.fillStyle='#ffffff';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#284e3d';c.fillRect(0,0,1200,180);
            c.fillStyle='#ffffff';c.font='bold 48px sans-serif';c.fillText('租約到期暨續約意願通知',60,112);
            c.fillStyle='#284e3d';for(const line of lines){c.font=line.size+'px sans-serif';c.fillText(line.text,70,line.y);}
            const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('圖片產生失敗');renewalUrl.value=URL.createObjectURL(blob);renewalMessage.value='圖片已產生，請下載後人工聯絡房客。';}catch(e){renewalMessage.value=e.message;}}
          const fieldEditors=new Map(),contacts=ref([]),savedContacts=ref([]),checkoutConfirm=ref(false);
          const leaseYears=ref('1'),leaseTermMessage=ref('');let resettingLease=false,leaseYearsChosen=false;
          function initLeaseTerm(t){leaseYearsChosen=false;leaseYears.value=String(leaseYearCount(t?.startDate,t?.endDate)||1);leaseTermMessage.value='';}
          function changeLeaseYears(value){if(!writeAllowed()||loading.value||pendingSaves.value)return;leaseYears.value=value;leaseYearsChosen=true;const n=Number(value),start=fieldEditors.get('startDate')?.draft||'',end=leaseEndDate(start,n);if(!end){leaseTermMessage.value=validLeaseDate(start)?'請填入至少 1 年的整數年數，且日期須在可用範圍內。':'請先填妥起租日。';return;}leaseTermMessage.value='';const editor=fieldEditors.get('endDate');if(editor)editor.draft=end;}
          function onDraft(field,value){if(resettingLease)return;if(field==='startDate'&&validLeaseDate(value)){const existing=fieldEditors.get('endDate')?.draft;if(!leaseYearsChosen&&!validLeaseDate(activeTenant.value?.startDate)&&validLeaseDate(existing)){const years=leaseYearCount(value,existing);if(years){leaseYears.value=String(years);leaseTermMessage.value='';}else leaseTermMessage.value='請核對既有到期日，租期須以整年計算。';return;}const end=leaseEndDate(value,Number(leaseYears.value));if(end&&fieldEditors.get('endDate')){leaseTermMessage.value='';fieldEditors.get('endDate').draft=end;}}else if(field==='endDate'){const start=fieldEditors.get('startDate')?.draft||'',n=leaseYearCount(start,value);if(n){leaseYears.value=String(n);leaseTermMessage.value='';}else if(start&&value){leaseTermMessage.value='租期須至少一年，並以整年計算。';}}}

          function resetAll(){if(pendingSaves.value)return;resettingLease=true;initLeaseTerm(activeTenant.value);for(const e of fieldEditors.values())e.reset();Vue.nextTick(()=>{resettingLease=false;});contacts.value=JSON.parse(JSON.stringify(savedContacts.value));status.value='未儲存輸入已還原；可重新讀取核對。';}
          const registerField=(key,el)=>{if(el)fieldEditors.set(key,el);else fieldEditors.delete(key);};
          const rpc=(action,...args)=>new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[action](...args));
          const writeAllowed=()=>!window.RentalAccess||RentalAccess.canWrite;
          watch(activeTenant,t=>{initLeaseTerm(t);const list=t?.emergencyContacts??(t?.emergencyContact||t?.emergencyPhone?[{name:t.emergencyContact||'',phone:t.emergencyPhone||''}]:[]);contacts.value=JSON.parse(JSON.stringify(list));savedContacts.value=JSON.parse(JSON.stringify(list));checkoutConfirm.value=false;},{immediate:true});
          watch(contacts,()=>{if(activeTenant.value)setDirty(activeTenant.value.room,'emergencyContacts',JSON.stringify(contacts.value)!==JSON.stringify(savedContacts.value));},{deep:true});
          function addContact(){if(writeAllowed()&&contacts.value.length<20)contacts.value.push({name:'',phone:''});}
          function acceptTenant(t){const i=tenants.value.findIndex(r=>r.room===t.room);if(i<0)throw Error('儲存回應房號不符。');tenants.value.splice(i,1,t);dirtyKeys.clear();revision.value++;}
          async function saveAll(){
            if(!writeAllowed()||loading.value||pendingSaves.value||!activeTenant.value||!dirtyKeys.size)return;
            const start=fieldEditors.get('startDate'),end=fieldEditors.get('endDate');if((start?.dirty||end?.dirty)&&start?.draft&&end?.draft&&leaseYearCount(start.draft,end.draft)===null){status.value='租期須至少一年，並以一年、兩年、三年等整年計算。';return;}
            const article=document.querySelector('[aria-label="房客資料編輯"]');if(article&&[...article.querySelectorAll('input,textarea,select')].some(el=>!el.reportValidity()))return;
            const changes={};for(const [key,editor] of fieldEditors){if(!editor.dirty)continue;changes[key]=key==='contractLinks'?(editor.draft.trim()?[editor.draft.trim()]:[]):(['phone','cohabitantPhone','guarantorPhone'].includes(key)?formatPhone(editor.draft):String(editor.draft??''));}
            if(JSON.stringify(contacts.value)!==JSON.stringify(savedContacts.value))changes.emergencyContacts=contacts.value.map(c=>({...c,phone:formatPhone(c.phone)}));
            if(!activeTenant.value.identity)changes.identity='一般';
            pendingSaves.value++;status.value='正在儲存全部修改……';
            try{const t=await rpc('saveTenantChanges',activeTenant.value.room,changes,activeTenant.value.version);acceptTenant(t);status.value='全部修改已儲存 ✓'+(Object.hasOwn(changes,'name')?'；入住帳務請按「確認入住與更新帳務」核對；僅更正姓名可用「同步帳務姓名」。':'');}
            catch(e){status.value='儲存結果待核對：'+errorText(e)+'。請保留輸入，重新讀取核對；不會自動重送。';}finally{pendingSaves.value--;}
          }
          async function checkout(){if(!writeAllowed()||pendingSaves.value||dirtyKeys.size||!checkoutConfirm.value||!checkoutPreview.value)return;pendingSaves.value++;try{const result=activeTenant.value.annualBilling?await rpc('confirmAnnualCheckout',activeTenant.value.room,activeTenant.value.version,checkoutOptions.value.checkoutDate,checkoutPreview.value.version):await rpc('checkoutTenant',activeTenant.value.room,activeTenant.value.version,{...checkoutArgs(),previewVersion:checkoutPreview.value.version});acceptTenant(result.tenant||result);checkoutConfirm.value=false;checkoutPreview.value=null;status.value='已退租；歷史資料保留，後續空房已更新。';}catch(e){status.value='退租結果待核對：'+errorText(e);}finally{pendingSaves.value--;}}


          const basicFields = [
            { key: 'roomType', title: '房型', radio:true, options: ['套房', '雅房'] },
            { key: 'name', title: '居住者' },
            { key: 'phone', title: '電話', type: 'tel' },
            { key: 'identity', title: '身分', radio:true, options: ['一般', '學生', '管理人'] },
            { key: 'startDate', title: '起租日', type: 'date' },
            { key: 'endDate', title: '到期日', type: 'date' },
            { key: 'rent', title: '目前房租', type: 'number' }
          ];
          const noteField = { key: 'notes', title: '管理備註', multiline: true };
          const guarantorFields = [
            { key: 'guarantorName', title: '姓名' },
            { key: 'guarantorAddress', title: '戶籍地址' },
            { key: 'guarantorId', title: '身份證字號' },
            { key: 'guarantorBirthDate', title: '出生年月日', type: 'date' },
            { key: 'guarantorPhone', title: '聯絡電話', type: 'tel' },
          ];
          const extraFields = [
            { key: 'registeredAddress', title: '戶籍地址' },
            { key: 'nationalId', title: '身份證字號' },
            { key: 'birthDate', title: '出生年月日', type: 'date' },
            { key: 'initialReading', title: '初始電表（度）', type: 'number' },
            { key: 'signingDate', title: '簽約日', type: 'date' },
            { key: 'contractKind', title: '合約類型' },
            { key: 'defaultTransferLastFive', title: '預設轉帳後五碼' },
            { key: 'cohabitant', title: '同居人' },
            { key: 'cohabitantPhone', title: '同居人電話', type: 'tel' },
            { key: 'introduction', title: '基本介紹', multiline: true },
            { key: 'maintenance', title: '房間維護整修紀錄', multiline: true }
          ];
          function setDirty(room, field, value) {
            const key = room + ':' + field;
            if (value) dirtyKeys.add(key); else dirtyKeys.delete(key);
          }
          function startSave() { pendingSaves.value++; }
          function finishSave() { pendingSaves.value--; }
          function updateField(tenant, field, value) { tenant[field] = value; if(field==='identity')tenant.student=value==='學生'?'是':value===''?'':'否'; }

          async function loadTenants() {
            if (loading.value || pendingSaves.value > 0 || dirtyKeys.size > 0) return;
            loading.value = true;
            loadFailed.value = false;
            status.value = '正在讀取 Google 試算表……';
            try {
              const result = await tenantApi.read();
              if (!Array.isArray(result)) throw new Error('後端未回傳房客資料陣列。');
              const rooms = new Set();
              const checked = result.map(tenant => {
                if (!tenant || typeof tenant !== 'object') throw new Error('房客資料格式不正確。');
                const room = String(tenant.room ?? '').trim();
                if (!/^\d+$/.test(room) || rooms.has(room)) throw new Error('房號格式不正確或重複。');
                rooms.add(room);
                if (tenant.rent !== null && tenant.rent !== undefined &&
                    (typeof tenant.rent !== 'number' || !Number.isFinite(tenant.rent) || tenant.rent < 0)) {
                  throw new Error(room + ' 房租金格式不正確。');
                }
                if (tenant.contractLinks !== undefined && (!Array.isArray(tenant.contractLinks) ||
                    !tenant.contractLinks.every(link => typeof link === 'string'))) {
                  throw new Error(room + ' 房合約資料格式不正確。');
                }
                return { ...tenant, room, identity: tenant.identity ?? (tenant.student === '是' ? '學生' : tenant.student === '否' ? '一般' : ''), contractLinks: tenant.contractLinks || [] };
              });
              tenants.value = checked;
              if (!checked.some(tenant => tenant.room === selectedRoom.value)) {
                selectedRoom.value = checked[0]?.room || '';
              }
              revision.value++;
              dirtyKeys.clear();
              status.value = '已從 Google 試算表讀取 ' + checked.length + ' 筆資料';
            } catch (error) {
              loadFailed.value = true;
              status.value = '讀取失敗：' + errorText(error);
            } finally {
              loading.value = false;
            }
          }
          watch(() => loading.value || pendingSaves.value > 0 || dirtyKeys.size > 0,
      value => emit('busy-change', value), { immediate: true });
      watch(tenants, value => emit('update-data', value), { deep: true });
      onMounted(loadTenants);
          return {leaseReminder,moveInPreview,moveInMonths,moveInMessage,previewMoveIn,confirmMoveIn,rentFormat,renewalUrl,renewalMessage,createRenewal,billingNamePreview,selectedBillingNames,selectAllBillingNames,previewBillingNames,syncBillingNames,formatPhone,openCheckout,previewCheckout,checkoutPeriod,checkoutOptions,checkoutPreview,checkoutMessage,leaseYears,leaseTermMessage,changeLeaseYears,onDraft,resetAll,registerField,contacts,addContact,saveAll,checkoutConfirm,checkout,selectedRoom, activeTenant, selectRoom, rentText, tenants, loading, loadFailed, pendingSaves, dirtyKeys, status, revision,
            basicFields, noteField, extraFields, guarantorFields, setDirty, startSave, finishSave, updateField, loadTenants };
        }
      };
return component;
};
