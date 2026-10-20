/** Generated from the tested editor; one native workspace, no iframe. */
window.RentalComponents ||= {};
window.RentalComponents.billing = function () {
const google = RentalTransport('billing');
const { createApp, ref, reactive, computed, watch, onMounted, nextTick } = Vue;
      const APP_URL = new URL('notice.html', location.href).href;
      const numberFormat = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 });
      const errorText = error => error?.message || String(error);
      const rpc = invoke => new Promise((resolve, reject) => {
        invoke(google.script.run.withSuccessHandler(resolve).withFailureHandler(reject));
      });
      /** 所有讀寫仍透過原有 Apps Script 介面；沒有直接讀取公開試算表。 */
      const api = {
        drivePreview: !window.RentalDemo&&!!window.RentalAccess,
        meterPhotoReference: (...args) => rpc(r => r.getMeterPhotoReference(...args)),
        years: () => rpc(r => r.getAvailableBillingYears()),
        months: year => rpc(r => r.getAvailableBillingMonths(year)),
        previewNewMonth: (year, month) => rpc(r => r.previewMonthlyAccountsSheetCreation(year, month)),
        createNewMonth: (year, month) => rpc(r => r.createMonthlyAccountsSheet(year, month)),
        accounts: (year, month) => rpc(r => r.getMonthlyAccounts(year, month)),
        saveField: (...args) => rpc(r => r.saveMonthlyAccountField(...args)),
        previewInitialization: (year, month) => rpc(r => r.previewMonthlyInitialization(year, month)),
        initialize: (year, month) => rpc(r => r.initializeMonthlyAccounts(year, month)),
        photos: (year, month) => rpc(r => r.getMonthlyPaymentPhotos(year, month)),
        selection: (...args) => rpc(r => r.getRoomPaymentPhotoSelection(...args)),
        saveSelection: (...args) => rpc(r => r.saveRoomPaymentPhotoSelection(...args)),
        photo: (...args) => rpc(r => r.getPaymentPhoto(...args)),
        notice: (...args) => rpc(r => r.getRoomNoticeData(...args)),
        meterPhoto: (...args) => rpc(r => r.getMeterPhoto(...args))
      };
      function displayInput(value, field) {
        const text = String(value ?? '');
        if (field.type === 'date' && text) {
          const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(text);
          if (match) return match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0');
        }
        return text;
      }
      function validImage(value) { return typeof value === 'string' && /^data:image\/(?:jpeg|png|webp);base64,/.test(value); }
      function validateSelection(value) {
        if (!value || !Array.isArray(value.fileIds) || typeof value.value !== 'string' ||
            !value.fileIds.every(id => typeof id === 'string')) throw new Error('圖片對應格式不正確。');
      }

      const AccountField = {
        props: { account: Object, field: Object, blocked: Boolean },
        emits: ['save-start', 'save-end', 'saved', 'dirty-change'],
        template: "\n    <div class=\"editor\" :class=\"{ note: field.key === 'notes' }\">\n      <textarea v-if=\"field.key === 'notes'\" ref=\"inputElement\" v-model=\"draft\" rows=\"2\" maxlength=\"2000\"\n        :aria-label=\"label\" :disabled=\"saving || blocked\"></textarea>\n      <input v-else ref=\"inputElement\" v-model=\"draft\" :type=\"field.type || 'text'\" :aria-label=\"label\" :disabled=\"saving || blocked\"\n        :min=\"isReading ? 0 : undefined\" :step=\"isReading ? 'any' : undefined\"\n        :inputmode=\"field.key === 'transferLastFive' ? 'numeric' : undefined\"\n        :pattern=\"field.key === 'transferLastFive' ? '[0-9]{0,5}' : undefined\"\n        :maxlength=\"field.key === 'transferLastFive' ? 5 : undefined\"\n        :placeholder=\"field.key === 'transferLastFive' ? '例如 01234' : isReading ? '輸入累計電表度數' : undefined\">\n      <div class=\"editor-actions\">\n        <button type=\"button\" @click=\"save\" :disabled=\"saving || blocked\">{{ saving ? '儲存中……' : '儲存' }}</button>\n        <button v-if=\"dirty\" type=\"button\" @click=\"reset\" :disabled=\"saving || blocked\">還原</button>\n      </div>\n      <div class=\"save-message\" role=\"status\">{{ message }}</div>\n    </div>\n  ",
        setup(props, { emit }) {
          const isReading = props.field.key === 'currentReading';
          const source = props.field.meter ? props.account.meter : props.account;
          const savedValue = ref(source[props.field.key] ?? (isReading ? null : ''));
          const draft = ref(displayInput(savedValue.value, props.field));
          const saving = ref(false), message = ref(''), inputElement = ref(null);
          const label = computed(() => props.account.month + ' 月 ' + props.account.room + ' 房' + props.field.title);
          const dirty = computed(() => String(draft.value ?? '') !== displayInput(savedValue.value, props.field));
          watch(dirty, value => emit('dirty-change', value));
          function reset() {
            if (saving.value || props.blocked) return;
            draft.value = displayInput(savedValue.value, props.field);
            message.value = '已還原為上次讀取或儲存的內容。';
          }
          async function save(fromBatch=false) {
            if (saving.value || (props.blocked&&fromBatch!==true) || !validate()) return false;
            saving.value = true; message.value = '儲存中……'; emit('save-start');
            try {
              const result = await api.saveField(props.account.year, props.account.month, props.account.room,
                props.field.key, String(draft.value ?? ''), savedValue.value);
              const value = result?.value;
              const valid = isReading ? value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)
                : typeof value === 'string';
              if (!valid) throw new Error('儲存回應格式不正確，請核對後重新讀取。');
              savedValue.value = value; draft.value = displayInput(value, props.field);
              emit('saved', value); emit('dirty-change', false); message.value = '已寫回試算表 ✓';return true;
            } catch (error) { message.value = '儲存未完成確認：' + errorText(error);return false; }
            finally { saving.value = false; emit('save-end'); }
          }
          function validate(){return inputElement.value?.reportValidity()===true;}
          function getChange(){return {room:props.account.room,field:props.field.key,meter:!!props.field.meter,value:String(draft.value??''),expected:savedValue.value};}
          function acceptSaved(value){savedValue.value=value;draft.value=displayInput(value,props.field);emit('saved',value);emit('dirty-change',false);message.value='已寫回試算表 ✓';}
          return { validate,getChange,acceptSaved,isReading, draft, saving, message, inputElement, label, dirty, reset, save };
        }
      };

      const PaymentPhotoPicker = {
        props: { account: Object, blocked: Boolean },
        emits: ['save-start', 'save-end', 'saved', 'dirty-change'],
        template: "\n    <div class=\"photo-picker\">\n      <button type=\"button\" @click=\"load\" :disabled=\"localBusy || blocked || dirty\">讀取／管理匯款圖</button>\n      <div v-if=\"loaded\" class=\"photo-choices\">\n        <div v-for=\"photo in choices\" :key=\"photo.id\" class=\"photo-choice\">\n          <label>\n            <input type=\"checkbox\" :checked=\"selectedIds.includes(photo.id)\" @change=\"toggle(photo.id, $event)\"\n              :disabled=\"localBusy || blocked\" :aria-label=\"account.room + ' 房選取：' + photo.name\">\n            <span>{{ photo.name }}</span>\n          </label>\n          <button type=\"button\" @click=\"preview(photo)\" :disabled=\"localBusy || blocked || photo.unavailable\">預覽</button>\n        </div>\n      </div>\n      <div v-if=\"loaded\" class=\"editor-actions\">\n        <button type=\"button\" @click=\"save\" :disabled=\"localBusy || blocked\">儲存勾選結果</button>\n        <button v-if=\"dirty\" type=\"button\" @click=\"reset\" :disabled=\"localBusy || blocked\">還原</button>\n      </div>\n      <div class=\"save-message\" role=\"status\">{{ message }}</div>\n      <img v-if=\"imageUrl\" class=\"photo-image\" :src=\"imageUrl\" :alt=\"account.room + ' 房待核對匯款截圖'\" @error=\"imageError\">\n    </div>\n  ",
        setup(props, { emit }) {
          const photos = ref([]), selectedIds = ref([]), savedIds = ref([]);
          const expectedValue = ref(''), loaded = ref(false), localBusy = ref(false);
          const message = ref(''), imageUrl = ref('');
          const dirty = computed(() => loaded.value && (selectedIds.value.length !== savedIds.value.length ||
            selectedIds.value.some(id => !savedIds.value.includes(id))));
          watch(dirty, value => emit('dirty-change', value));
          const choices = computed(() => {
            const available = new Set(photos.value.map(photo => photo.id));
            return [...photos.value, ...savedIds.value.filter(id => !available.has(id)).map(id => ({
              id, name: '原已選圖片（已移除或不在本月份資料夾）', unavailable: true
            }))];
          });
          async function load() {
            if (localBusy.value || props.blocked || dirty.value) return;
            localBusy.value = true; loaded.value = false; imageUrl.value = '';
            message.value = '讀取當月圖片與已儲存的選擇……';
            try {
              const a = props.account;
              const [list, selection] = await Promise.all([api.photos(a.year, a.month), api.selection(a.year, a.month, a.room)]);
              if (!Array.isArray(list) || !list.every(photo => photo && typeof photo.id === 'string' && typeof photo.name === 'string')) {
                throw new Error('圖片列表格式不正確。');
              }
              validateSelection(selection);
              photos.value = list; savedIds.value = [...new Set(selection.fileIds)];
              selectedIds.value = [...savedIds.value]; expectedValue.value = selection.value; loaded.value = true;
              message.value = '當月圖片 ' + list.length + ' 張｜已儲存選擇 ' + savedIds.value.length + ' 張。';
            } catch (error) { message.value = '讀取失敗：' + errorText(error); }
            finally { localBusy.value = false; }
          }
          function toggle(id, event) {
            const checked = event.target.checked;
            if (localBusy.value || props.blocked) {
              event.target.checked = selectedIds.value.includes(id); return;
            }
            if (checked && !selectedIds.value.includes(id)) {
              if (selectedIds.value.length >= 20) {
                message.value = '每間房最多選取 20 張圖片。';
                // 回復核取方塊；不改動已選內容。
                event.target.checked = false; return;
              }
              selectedIds.value = [...selectedIds.value, id];
            } else if (!checked) selectedIds.value = selectedIds.value.filter(value => value !== id);
            message.value = '目前勾選 ' + selectedIds.value.length + ' 張，尚未儲存。';
          }
          function reset() {
            if (localBusy.value || props.blocked) return;
            selectedIds.value = [...savedIds.value]; message.value = '已還原為上次儲存的選擇。';
          }
          async function preview(photo) {
            if (localBusy.value || props.blocked || photo.unavailable) return;
            localBusy.value = true; imageUrl.value = ''; message.value = '圖片讀取中……';
            try {
              const a = props.account, result = await api.photo(a.year, a.month, photo.id);
              if (!validImage(result?.dataUrl)) throw new Error('圖片回應格式不正確。');
              imageUrl.value = result.dataUrl;
              message.value = '預覽：' + photo.name + '。請自行核對日期及金額。';
            } catch (error) { message.value = '預覽失敗：' + errorText(error); }
            finally { localBusy.value = false; }
          }
          function imageError() { imageUrl.value = ''; message.value = '圖片無法顯示，請重新讀取。'; }
          async function save() {
            if (localBusy.value || props.blocked || !loaded.value) return;
            localBusy.value = true; message.value = '儲存中……'; emit('save-start');
            try {
              const a = props.account;
              const result = await api.saveSelection(a.year, a.month, a.room, [...selectedIds.value], expectedValue.value);
              validateSelection(result);
              savedIds.value = [...new Set(result.fileIds)]; selectedIds.value = [...savedIds.value]; expectedValue.value = result.value;
              emit('saved', result.value); emit('dirty-change', false);
              message.value = '已儲存 ' + savedIds.value.length + ' 張匯款截圖 ✓';
            } catch (error) { message.value = '儲存未完成確認：' + errorText(error);return false; }
            finally { localBusy.value = false; emit('save-end'); }
          }
          return { choices, selectedIds, loaded, localBusy, dirty, message, imageUrl, load, toggle, reset, preview, imageError, save };
        }
      };

      const MeterPhotoViewer = {
        props: { account: Object, blocked: Boolean },
        template: "\n    <div class=\"meter-photo\">\n      <button type=\"button\" @click=\"load\" :disabled=\"loading || blocked\">{{ imageUrl ? '重新載入照片' : '載入照片' }}</button>\n      <div class=\"save-message\" role=\"status\">{{ message }}</div>\n      <img v-if=\"imageUrl\" class=\"photo-image\" :src=\"imageUrl\" :alt=\"account.room + ' 房本期電表照片'\" @error=\"imageError\">\n    </div>\n  ",
        setup(props) {
          const loading = ref(false), message = ref(''), imageUrl = ref('');
          watch(() => props.account.meter?.currentReadingDate, () => {
            imageUrl.value = ''; message.value = '抄表日期已變更，請重新載入照片。';
          });
          async function load() {
            if (loading.value || props.blocked) return;
            loading.value = true; imageUrl.value = ''; message.value = '照片讀取中……';
            try {
              const a = props.account, result = await api.meterPhoto(a.year, a.month, a.room);
              if (!result || typeof result.found !== 'boolean') throw new Error('照片回應格式不正確。');
              if (!result.found) { message.value = result.message || '尚未提供照片。'; return; }
              if (result.readingDate !== a.meter?.currentReadingDate) throw new Error('抄表日期已變更，請重新讀取帳務。');
              if (!validImage(result.dataUrl)) throw new Error('圖片格式不正確。');imageUrl.value = result.dataUrl; message.value = '抄表日期：' + result.readingDate;
            } catch (error) { message.value = '照片讀取失敗：' + errorText(error); }
            finally { loading.value = false; }
          }
          function imageError() { imageUrl.value = ''; message.value = '圖片無法顯示，請核對原始檔案。'; }
          return { loading, message, imageUrl, load, imageError };
        }
      };

      const component = {
 props: { initialRoom: String }, emits: ["update-data", "busy-change"],
 template: "<div class=\"billing-tabs segmented\" role=\"group\" aria-label=\"帳務工作表\"><button type=\"button\" :class=\"{selected:billingView==='accounts'}\" @click=\"billingView='accounts'\" :disabled=\"controlsLocked\">帳務資料</button><button type=\"button\" :class=\"{selected:billingView==='meters'}\" @click=\"billingView='meters'\" :disabled=\"controlsLocked\">電表抄錄表</button><button type=\"button\" :class=\"{selected:billingView==='notices'}\" @click=\"billingView='notices'\" :disabled=\"controlsLocked\">電費通知</button><button type=\"button\" :class=\"{selected:billingView==='payments'}\" @click=\"billingView='payments'\" :disabled=\"controlsLocked\">匯款截圖</button></div>\n    <div class=\"controls\">\n      <label for=\"year\">年份</label>\n      <select id=\"year\" v-model.number=\"year\" @change=\"changeYear\" :disabled=\"controlsLocked\">\n        <option v-if=\"!years.length\" :value=\"0\">尚無年度來源</option>\n        <option v-for=\"value in years\" :key=\"value\" :value=\"value\">{{ value }} 年</option>\n      </select>\n      <label for=\"month\">月份</label>\n      <select id=\"month\" v-model.number=\"month\" @change=\"changeMonth\" :disabled=\"controlsLocked\">\n        <option v-if=\"!months.length\" :value=\"0\">尚無可用月份</option>\n        <option v-for=\"value in months\" :key=\"value\" :value=\"value\">{{ value }} 月</option>\n      </select>\n      <button id=\"reload\" type=\"button\" @click=\"loadYears\" :disabled=\"controlsLocked\">重新讀取</button>\n      <button id=\"toggleCreation\" type=\"button\" @click=\"toggleCreationPanel\" :disabled=\"controlsLocked || !year\"\n        :aria-expanded=\"creationPanelOpen\" aria-controls=\"creation-panel\">{{ creationPanelOpen ? '收起新增月份' : '新增月份' }}</button>\n      <button id=\"previewInitialization\" type=\"button\" @click=\"previewInitialization\" :disabled=\"busy || !accountsReady\">預覽本月初始化</button>\n      <button id=\"initializeMonth\" type=\"button\" @click=\"initializeMonth\" :disabled=\"busy || !accountsReady || dirtyKeys.size > 0 || !canInitialize\">初始化本月</button>\n    </div>\n    <section v-if=\"creationPanelOpen\" id=\"creation-panel\" class=\"initialization-summary\" aria-label=\"新增月份\">\n      <p>建立 {{ year }} 年的新月份分頁</p>\n      <div class=\"controls\">\n        <label for=\"new-month\">月份</label>\n        <select id=\"new-month\" v-model.number=\"newMonth\" @change=\"changeCreationMonth\" :disabled=\"controlsLocked\">\n          <option :value=\"0\" disabled>請選擇月份</option>\n          <option v-for=\"value in monthChoices\" :key=\"value\" :value=\"value\" :disabled=\"months.includes(value)\">\n            {{ value }} 月{{ months.includes(value) ? '（已建立）' : '' }}\n          </option>\n        </select>\n        <button id=\"previewNewMonth\" type=\"button\" @click=\"previewNewMonth\" :disabled=\"controlsLocked || !validNewMonth\">預覽新月份</button>\n        <button id=\"createNewMonth\" type=\"button\" @click=\"createNewMonth\" :disabled=\"controlsLocked || !canCreate\">建立月份分頁</button>\n      </div>\n      <ul v-if=\"creationPreview\">\n        <li>預計建立：{{ creationPreview.year }} 年 {{ creationPreview.month }} 月</li>\n        <li>房號：{{ creationPreview.rooms }} 間，來源為房客基本資料。</li>\n        <li>{{ creationPreview.odd ? '奇數月，建立電表及電費公式。' : '偶數月，應繳金額等於房租。' }}</li>\n        <li>轉帳日期、匯款截圖及本期抄表資料先留白。</li>\n        <li>建立後再使用「預覽本月初始化」補入資料。</li>\n      </ul>\n    </section>\n    <p v-if=\"creationStatus\" id=\"creation-status\" class=\"status\" role=\"status\" aria-live=\"polite\">{{ creationStatus }}</p>\n    <div v-if=\"billingView==='accounts'\" class=\"account-batch-actions\"><button v-write type=\"button\" @click=\"saveAllAccounts\" :disabled=\"busy||!dirtyKeys.size||batchReview\">儲存全部帳務修改</button><button v-write type=\"button\" @click=\"resetAllAccounts\" :disabled=\"busy||!dirtyKeys.size\">還原全部帳務修改</button></div><p v-if=\"batchStatus\" class=\"status\" role=\"status\">{{batchStatus}}</p><p v-if=\"batchReview\" class=\"notice\">部分儲存結果尚待核對；請先還原未完成輸入，再重新讀取帳務確認，系統不會自動重送。</p>\n    <p v-if=\"dirtyKeys.size > 0\" class=\"draft-notice\">有 {{ dirtyKeys.size }} 個未儲存項目，請儲存或還原後再切換月份、重新讀取或初始化。</p>\n    <p v-if=\"pendingSaves > 0\" class=\"status\" role=\"status\">有 {{ pendingSaves }} 筆資料儲存中……</p>\n    <p id=\"initialization-status\" class=\"status\" role=\"status\" aria-live=\"polite\">{{ initializationStatus }}</p>\n    <section v-if=\"initializationResult\" class=\"initialization-summary\" aria-label=\"月份初始化結果\">\n      <p>{{ year }} 年 {{ initializationResult.month }} 月｜{{ initializationApplied ? '初始化結果' : '初始化預覽' }}</p>\n      <ul><li v-for=\"(line, index) in initializationLines\" :key=\"index\">{{ line }}</li></ul>\n    </section>\n    <p id=\"status\" class=\"status\" role=\"status\" aria-live=\"polite\">{{ status }}</p>\n    <p class=\"billing-due-note\">預設應繳日為每月 10 日，收款仍依實際日期紀錄。</p>\n    <section v-if=\"accounts.length\" class=\"cash-summary\" aria-label=\"每月收款摘要\"><div><span>應收（含前期餘額）</span><strong>NT$ {{numberFormat.format(cashSummary.due)}}</strong></div><div><span>確認未收</span><strong>NT$ {{numberFormat.format(cashSummary.unpaid)}}</strong></div><div><span>多收餘額</span><strong>NT$ {{numberFormat.format(cashSummary.overpaid)}}</strong></div><p>待補應收 {{cashSummary.pending}} 間。勾選已確認收款即預設收足；未勾選列未收。多收或少收再調整實收金額。</p><label>篩選房間<select v-model=\"accountFilter\" aria-label=\"收款狀態篩選\" :disabled=\"controlsLocked\"><option value=\"all\">全部房間</option><option value=\"unpaid\">未收房間</option><option value=\"overpaid\">多收房間</option><option value=\"pending\">待補應收房間</option></select></label></section>\n    <div v-if=\"accounts.length && billingView==='accounts'\" class=\"table-wrap\">\n      <table aria-label=\"每月帳務資料\">\n        <thead><tr><th v-for=\"column in columns.filter(c=>!c.meter && c.key!=='paymentPhotos')\" :key=\"column.key\" scope=\"col\">{{ column.title }}</th></tr></thead>\n        <tbody>\n          <tr v-for=\"account in filteredAccounts\" :class=\"{'unpaid-room':account.unpaid>0}\" :key=\"revision + ':' + account.room\">\n            <template v-for=\"column in columns.filter(c=>!c.meter && c.key!=='paymentPhotos')\" :key=\"column.key\">\n              <th v-if=\"column.key === 'room'\" scope=\"row\">{{ account.room }}</th>\n              <td v-else>\n                <template v-if=\"column.key==='paymentPhotos'\"></template>\n                <template v-else-if=\"column.key === 'notice'\">\n                  <span v-if=\"staleRooms.has(account.room)\" class=\"stale\">請重新讀取以更新電費與金額。</span>\n                  <a v-else class=\"notice-link\" :href=\"noticeUrl(account)\" target=\"_blank\" rel=\"noopener noreferrer\"\n                    :aria-label=\"account.month + ' 月 ' + account.room + ' 房電費通知預覽'\">預覽電費通知</a>\n                </template>\n                <meter-photo-viewer v-else-if=\"column.key === 'meterPhoto'\" :account=\"account\" :blocked=\"editorsBlocked\"></meter-photo-viewer>\n                <account-field v-else-if=\"column.editable && !['transferDate','transferLastFive'].includes(column.key)\" :ref=\"el=>registerAccountField(account.room,column.key,el)\" :account=\"account\" :field=\"column\" :blocked=\"editorsBlocked\"\n                  @save-start=\"startSave\" @save-end=\"finishSave\"\n                  @saved=\"updateAccount(account, column, $event)\"\n                  @dirty-change=\"setDirty(account.room, column.key, $event)\"></account-field>\n                <span v-else-if=\"staleRooms.has(account.room) && column.amount\" class=\"stale\">待重新讀取</span>\n                <span v-else class=\"value\">{{ displayCell(account, column) }}</span>\n              </td>\n            </template>\n          </tr>\n        </tbody>\n      </table>\n    </div>\n  <p v-if=\"billingView==='meters' && month && month%2===0\" class=\"notice\">雙數月份不計收電費，請切換到單數月份。</p><meter-worksheet v-if=\"billingView==='meters' && month%2===1 && accounts.length\" :key=\"year+':'+month\" :accounts=\"accounts\" :year=\"year\" :month=\"month\" :blocked=\"editorsBlocked\" @dirty-change=\"setDirty('all','meterWorksheet',$event)\" @busy-change=\"operation=$event\" @field-saved=\"onMeterFieldSaved\" @reconciled=\"onMeterReconciled\" @refresh-request=\"refreshAfterMeter\"></meter-worksheet><notice-batch v-if=\"billingView==='notices' && month%2===1 && accounts.length\" :key=\"year+':'+month\" :accounts=\"accounts\" :year=\"year\" :month=\"month\" :blocked=\"editorsBlocked\" @busy-change=\"operation=$event\"></notice-batch><p v-if=\"billingView==='notices' && month && month%2===0\" class=\"notice\">雙數月份不發送電費通知，請切換到單數月份。</p><payment-worksheet v-if=\"billingView==='payments' && accounts.length\" :key=\"year+':'+month\" :accounts=\"accounts\" :year=\"year\" :month=\"month\" :blocked=\"editorsBlocked\" @busy-change=\"operation=$event\" @dirty-change=\"setDirty('all','paymentWorksheet',$event)\" @field-saved=\"onPaymentFieldSaved\" @selection-saved=\"onPaymentSelectionSaved\" @reconciled=\"onMeterReconciled\"></payment-worksheet>",
        components: { AccountField, PaymentPhotoPicker, MeterPhotoViewer, MeterWorksheet: RentalComponents.meterWorksheet(api), NoticeBatch: RentalComponents.noticeBatch(api), PaymentWorksheet: RentalComponents.paymentWorksheet(api) },
        setup(props, { emit }) {
          const historicalMode=computed(()=>accounts.value.some(a=>a.historical));
          const accountFilter=ref('all');
          const billingView = ref(new URLSearchParams(location.search).has('billingMonth')?'payments':'accounts');
 const year = ref(0), years = ref([]), month = ref(0), months = ref([]), accounts = ref([]);
          const filteredAccounts=computed(()=>accounts.value.filter(a=>accountFilter.value==='all'||accountFilter.value==='pending'?(accountFilter.value==='all'||a.paymentStatus==='待補應收'):a[accountFilter.value]>0));
          const cashSummary=computed(()=>accounts.value.reduce((s,a)=>{s.due+=a.netDue??a.totalDue??0;s.unpaid+=a.unpaid??0;s.overpaid+=a.overpaid??0;if(a.paymentStatus==='待補應收')s.pending++;return s},{due:0,unpaid:0,overpaid:0,pending:0}));
          const loading = ref(false), operation = ref(false), pendingSaves = ref(0), accountsReady = ref(false), revision = ref(0);
          const status = ref('正在讀取月份……'), initializationStatus = ref('');
          const initializationResult = ref(null), initializationApplied = ref(false), initializationPreview = ref(null);
          const dirtyKeys = reactive(new Set()), staleRooms = reactive(new Set());
          const batchSaving=ref(false),batchReview=ref(false),batchStatus=ref(''),accountEditors=new Map();
          function registerAccountField(room,field,editor){const key=room+':'+field;if(editor)accountEditors.set(key,editor);else accountEditors.delete(key);}
          function resetAllAccounts(){if(busy.value)return;for(const e of accountEditors.values())e.reset();batchStatus.value='已還原尚未儲存的帳務輸入；已完成寫入的資料保留。';}
          async function saveAllAccounts(){
            if(busy.value||batchReview.value||!dirtyKeys.size||window.RentalAccess?.canWrite===false)return;
            const targets=[...accountEditors.values()].filter(e=>e.dirty),groups=new Map();
            if(!targets.length)return;
            for(const e of targets){if(!e.validate()){batchStatus.value='請先修正欄位格式，尚未寫入任何修改。';return;}const c=e.getChange(),a=accounts.value.find(a=>a.room===c.room),key=(!c.meter&&['notes','transferDate','transferLastFive'].includes(c.field)?a?.receiptId||c.room:c.room)+':'+c.field;const prior=groups.get(key);if(prior&&(prior.change.value!==c.value||prior.change.expected!==c.expected)){batchStatus.value='合併收款的同一欄位有不同輸入，請先統一後再儲存；尚未寫入任何修改。';return;}if(prior)prior.editors.push(e);else groups.set(key,{change:c,editors:[e]});}
            batchSaving.value=true;let done=0;
            try{for(const {editors} of groups.values()){batchStatus.value='儲存中：'+done+' / '+groups.size+' 個帳務欄位';if(!await editors[0].save(true)){batchReview.value=true;batchStatus.value='已完成 '+done+' 個欄位，其餘結果待核對。已停止後續寫入，保留未完成輸入。';return;}const value=editors[0].getChange().expected;for(const e of editors.slice(1))e.acceptSaved(value);done++;await nextTick();}batchStatus.value='已儲存全部 '+done+' 個帳務欄位。';}
            finally{batchSaving.value=false;if(!batchReview.value&&staleRooms.size&&!dirtyKeys.size)await loadAccounts();}
          }
          const busy = computed(() => loading.value || operation.value || batchSaving.value || pendingSaves.value > 0);
          const controlsLocked = computed(() => busy.value || dirtyKeys.size > 0);
          const editorsBlocked = computed(() => loading.value || operation.value || batchSaving.value);
          /** 新月份只回傳房間數等規劃資訊，實際寫入使用獨立按鈕。 */
          const creationPanelOpen = ref(false), newMonth = ref(0), creationPreview = ref(null), creationStatus = ref('');
          const monthChoices = Array.from({ length: 12 }, (_, index) => index + 1);
          const validNewMonth = computed(() => years.value.includes(year.value) && Number.isInteger(newMonth.value) && newMonth.value >= 1 &&
            newMonth.value <= 12 && !months.value.includes(newMonth.value));
          const canCreate = computed(() => validNewMonth.value && creationPreview.value &&
            creationPreview.value.year === year.value && creationPreview.value.month === newMonth.value);

          function changeCreationMonth() { creationPreview.value = null; creationStatus.value = ''; }
          function toggleCreationPanel() {
            if (controlsLocked.value) return;
            creationPanelOpen.value = !creationPanelOpen.value;
          }
          function validateCreation(result, selectedMonth, preview) {
            if (!result || result.year !== year.value || result.month !== selectedMonth ||
                !Number.isSafeInteger(result.rooms) || result.rooms <= 0 ||
                (preview && result.odd !== (selectedMonth % 2 === 1))) {
              throw new Error('新月份回應格式不正確，請重新讀取確認。');
            }
          }
          async function previewNewMonth() {
            if (controlsLocked.value || !validNewMonth.value) return;
            operation.value = true; creationPreview.value = null;
            const selectedMonth = newMonth.value;
            creationStatus.value = '正在預覽 ' + year.value + ' 年 ' + selectedMonth + ' 月……';
            try {
              const result = await api.previewNewMonth(year.value, selectedMonth);
              validateCreation(result, selectedMonth, true);
              creationPreview.value = result;
              creationStatus.value = '預覽完成，尚未建立分頁。核對後可按「建立月份分頁」。';
            } catch (error) { creationStatus.value = '預覽失敗：' + errorText(error); }
            finally { operation.value = false; }
          }
          async function createNewMonth() {
            if (controlsLocked.value || !canCreate.value) return;
            operation.value = true;
            const selectedMonth = newMonth.value;
            creationPreview.value = null;
            creationStatus.value = '正在建立 ' + year.value + ' 年 ' + selectedMonth + ' 月分頁……';
            try {
              const result = await api.createNewMonth(year.value, selectedMonth);
              validateCreation(result, selectedMonth, false);
              creationStatus.value = '月份分頁已建立，正在重新讀取……';
              const refreshed = await loadMonths({ afterCreation: true, preferMonth: selectedMonth });
              if (refreshed) {
                creationPanelOpen.value = false; newMonth.value = 0;
                creationStatus.value = year.value + ' 年 ' + selectedMonth + ' 月已建立，共 ' + result.rooms +
                  ' 間。請按「預覽本月初始化」再補入房租等資料。';
              } else {
                creationStatus.value = '分頁已建立，但重新讀取失敗。請按「重新讀取」確認，勿重複建立。';
              }
            } catch (error) {
              creationStatus.value = '建立未能確認完成：' + errorText(error) +
                '。請先按「重新讀取」核對分頁；若已存在，請直接初始化，不要重複建立。';
            } finally { operation.value = false; }
          }


          const commonColumns = [
            { key: 'room', title: '房號' }, { key: 'name', title: '承租人' }, { key: 'dueDate', title: '應繳日期' },
            { key: 'rent', title: '房租', numeric: true }, { key: 'electricityFee', title: '電費', numeric: true, amount: true },
            { key: 'netDue', title: '應收金額', numeric: true, amount: true },
            { key: 'effectivePaid', title: '實收金額', numeric: true }, { key: 'unpaid', title: '確認未收', numeric: true, amount: true }, { key: 'overpaid', title: '多收餘額', numeric: true, amount: true },
            { key: 'transferDate', title: '轉帳日期', editable: true, type: 'date' },
            { key: 'transferLastFive', title: '轉帳後五碼', editable: true },
            { key: 'paymentPhotos', title: '匯款截圖' }, { key: 'notes', title: '備註', editable: true },
            { key: 'notice', title: '電費通知' }
          ];
          const meterColumns = [
            { key: 'previousReadingDate', title: '前期抄表日期' }, { key: 'previousReading', title: '前期電表', numeric: true },
            { key: 'currentReadingDate', title: '本期抄表日期', editable: true, type: 'date' },
            { key: 'currentReading', title: '本期電表', editable: true, type: 'number', numeric: true },
            { key: 'usage', title: '使用電度', numeric: true, amount: true },
            { key: 'calculatedFee', title: '需繳電費', numeric: true, amount: true }, { key: 'meterPhoto', title: '本期電表照片' }
          ].map(column => ({ ...column, meter: true }));
          const columns = computed(() => {
            const odd = month.value % 2 === 1;
            return [...commonColumns.filter(column => odd || !['electricityFee', 'notice'].includes(column.key)),
              ...(odd && accounts.value.some(a => a.meter && typeof a.meter === 'object') ? meterColumns : [])];
          });
          function displayCell(account, column) {
            const value = column.meter ? account.meter?.[column.key] : account[column.key];
            return value === null || value === undefined || value === '' ? '—'
              : column.numeric ? numberFormat.format(value) : String(value);
          }
          function noticeUrl(account) {
            const url = new URL(APP_URL);
            url.searchParams.set('property',window.RentalPropertyContext?.id||'default');url.searchParams.set('page', 'notice'); url.searchParams.set('year', String(account.year));
            url.searchParams.set('month', String(account.month)); url.searchParams.set('room', account.room);
            return url.href;
          }
          function setDirty(room, field, value) {
            const key = room + ':' + field;
            if (value) dirtyKeys.add(key); else dirtyKeys.delete(key);
          }
          function clearInitialization() {
            initializationPreview.value = null; initializationResult.value = null; initializationStatus.value = '';
          }
          function startSave() { pendingSaves.value++; clearInitialization(); }
          function finishSave() {
            pendingSaves.value--;
            // 等所有元件完成 dirty 狀態更新，再重新讀取試算表公式結果。
            nextTick(() => {
              if (staleRooms.size && !busy.value && !dirtyKeys.size && accountsReady.value) loadAccounts();
            });
          }
          function updateAccount(account, column, value) {
            if (column.meter) {
              account.meter[column.key] = value; staleRooms.add(account.room);
              status.value = '抄表資料已儲存；電費與金額等待重新讀取。';
            } else account[column.key] = value;
          }
          function validateAccounts(result, selectedMonth) {
            if (!Array.isArray(result)) throw new Error('帳務資料格式不正確。');
            const rooms = new Set();
            return result.map(account => {
              if (!account || account.year !== year.value || account.month !== selectedMonth ||
                  !/^\d+$/.test(String(account.room)) || rooms.has(String(account.room))) {
                throw new Error('帳務年份、月份或房號格式不正確。');
              }
              rooms.add(String(account.room));
              // 舊版介面可能以空字串或省略欄位表示未填。
              // 一律轉為 null 供畫面顯示「—」；數字 0 保留為 0。
              const normalized = { ...account, room: String(account.room) };
              if (account.dueDate === null || account.dueDate === undefined || typeof account.dueDate === 'string' && !account.dueDate.trim()) {
                normalized.dueDate = year.value + '-' + String(selectedMonth).padStart(2,'0') + '-10';
              }
              const amountTitles = { rent: '房租', electricityFee: '電費', totalDue: '本期金額', netDue: '應收金額', actualPaid: '手動實收', effectivePaid: '實收金額', unpaid: '未收金額', overpaid: '多收餘額' };
              Object.entries(amountTitles).forEach(([key, title]) => {
                const value = key==='netDue' ? (account.netDue??account.totalDue) : account[key];
                if (value === null || value === undefined ||
                    (typeof value === 'string' && value.trim() === '')) {
                  normalized[key] = null;
                } else if (typeof value === 'number' && Number.isFinite(value)) {
                  normalized[key] = value;
                } else {
                  const type = typeof value === 'string' ? '文字' : typeof value;
                  throw new Error(account.room + ' 房「' + title + '」應為數字或空白，目前收到' + type + '。');
                }
              });
              // 偶數月未提供電表欄位時，視為無電表資料。
              normalized.meter = account.meter ?? null;
              if (normalized.meter !== null &&
                  (typeof normalized.meter !== 'object' || Array.isArray(normalized.meter))) {
                throw new Error(account.room + ' 房電表資料格式不正確。');
              }
              return normalized;
            });
          }
          async function loadAccounts(afterInitialization = false) {
            if (loading.value || pendingSaves.value > 0 || dirtyKeys.size > 0 || (operation.value && !afterInitialization)) return false;
            const selectedMonth = month.value;
            loading.value = true; accountsReady.value = false;
            if (!afterInitialization) clearInitialization();
            status.value = '正在讀取 ' + year.value + ' 年 ' + selectedMonth + ' 月帳務……';
            try {
              const result = validateAccounts(await api.accounts(year.value, selectedMonth), selectedMonth);
              accounts.value = result; revision.value++; dirtyKeys.clear(); staleRooms.clear(); accountsReady.value = true;batchReview.value=false;batchStatus.value='';
              status.value = year.value + ' 年 ' + selectedMonth + ' 月｜已讀取 ' + result.length + ' 筆帳務｜' +
                (selectedMonth % 2 === 1 ? '可編輯收款紀錄及本期抄表資料' : '可編輯收款紀錄');
              return true;
            } catch (error) { status.value = '讀取失敗：' + errorText(error); return false; }
            finally { loading.value = false; }
          }
          /** 初次讀取與重新讀取時，同步年度來源，再載入該年度月份。 */
          async function loadYears() {
            if (controlsLocked.value) return;
            const preferredYear = year.value||Number(new URLSearchParams(location.search).get('billingYear'));
            loading.value = true; accountsReady.value = false; clearInitialization();
            status.value = '正在讀取年度帳務來源……';
            let ready = false;
            try {
              const list = await api.years();
              if (!Array.isArray(list) || !list.every(value => Number.isInteger(value) && value >= 1000 && value <= 9999) ||
                  new Set(list).size !== list.length) throw new Error('年度來源清單格式不正確。');
              if (!list.length) throw new Error('尚未設定年度帳務來源。');
              years.value = [...list].sort((a, b) => a - b);
              year.value = list.includes(preferredYear) ? preferredYear : years.value[years.value.length - 1];
              if (year.value !== preferredYear) resetYearView();
              ready = true;
            } catch (error) {
              years.value = []; year.value = 0; resetYearView();
              status.value = '讀取失敗：' + errorText(error);
            } finally { loading.value = false; }
            if (ready) await loadMonths();
          }
          /** 換年份不沿用前一年的月份、新分頁預覽或圖片畫面。 */
          function resetYearView() {
            month.value = 0; months.value = []; accounts.value = [];
            staleRooms.clear(); clearInitialization();
            creationPanelOpen.value = false; newMonth.value = 0;
            creationPreview.value = null; creationStatus.value = '';
          }
          async function changeYear() {
            if (busy.value || dirtyKeys.size > 0) return;
            resetYearView();
            await loadMonths();
          }

          async function loadMonths(options = {}) {
            if (controlsLocked.value && !options.afterCreation) return false;
            const preferred = options.preferMonth ?? (month.value||Number(new URLSearchParams(location.search).get('billingMonth')));
            loading.value = true; accountsReady.value = false; clearInitialization();
            status.value = '正在讀取月份清單……';
            let ready = false;
            try {
              const list = await api.months(year.value);
              if (!Array.isArray(list) || !list.every(value => Number.isInteger(value) && value >= 1 && value <= 12) ||
                  new Set(list).size !== list.length) throw new Error('月份清單格式不正確。');
              if (!list.length) throw new Error('此年份尚無月份，請先按「新增月份」；建立前請完成房間資料。');
              months.value = [...list].sort((a, b) => a - b);
              month.value = list.includes(preferred) ? preferred : months.value[months.value.length - 1];
              ready = true;
            } catch (error) { months.value = []; month.value = 0; accounts.value = []; status.value = '讀取失敗：' + errorText(error); }
            finally { loading.value = false; }
            if (ready) return await loadAccounts(options.afterCreation === true);
            return false;
          }
          function changeMonth() { if (!busy.value && !dirtyKeys.size) { accounts.value = []; loadAccounts(); } }

          function validateInitialization(result, selectedMonth) {
            const keys = ['rooms', 'names', 'rents', 'zeroRents', 'defaults', 'meters', 'missingTenants',
              'missingRents', 'missingDefaults', 'missingMeters', 'preservedCells'];
            if (!result || result.year !== year.value || result.month !== selectedMonth ||
                !keys.every(key => Number.isSafeInteger(result[key]) && result[key] >= 0) ||
                !Array.isArray(result.warnings) || !result.warnings.every(value => typeof value === 'string')) {
              throw new Error('初始化回應格式不正確，請重新讀取確認。');
            }
          }
          const changeCount = result => result.names + result.rents + result.defaults + result.meters;
          const canInitialize = computed(() => initializationPreview.value && initializationPreview.value.month === month.value &&
            changeCount(initializationPreview.value) > 0);
          const initializationLines = computed(() => {
            const r = initializationResult.value;
            if (!r) return [];
            const prefix = initializationApplied.value ? '已補入' : '可補入';
            const lines = ['帳務房間：' + r.rooms + ' 間', prefix + '承租人：' + r.names + ' 間',
              prefix + '房租：' + r.rents + ' 間（其中 0 元：' + r.zeroRents + ' 間）',
              prefix + '預設後五碼：' + r.defaults + ' 間', '保留既有內容、公式或合併格：' + r.preservedCells + ' 格',
              '空白且無有效基本租金：' + r.missingRents + ' 間', '空白且無預設後五碼：' + r.missingDefaults + ' 間',
              '找不到房客基本資料：' + r.missingTenants + ' 間'];
            if (r.month % 2 === 1) lines.push(prefix + '前期日期及度數：' + r.meters + ' 間', '待補電表且上期紀錄不完整：' + r.missingMeters + ' 間');
            else lines.push('偶數月只處理房租與收款資料。');
            if (r.initialMeters !== undefined) lines.push(prefix + '新合約初始電表及簽約日：' + r.initialMeters + ' 間');
            return [...lines, ...r.warnings.map(value => '提醒：' + value)];
          });
          async function previewInitialization() {
            if (busy.value || !accountsReady.value) return;
            operation.value = true; clearInitialization(); const selectedMonth = month.value;
            initializationStatus.value = '正在預覽 ' + year.value + ' 年 ' + selectedMonth + ' 月……';
            try {
              const result = await api.previewInitialization(year.value, selectedMonth); validateInitialization(result, selectedMonth);
              initializationPreview.value = result; initializationResult.value = result; initializationApplied.value = false;
              initializationStatus.value = changeCount(result) > 0 ? '預覽完成，尚未寫入。核對後可按「初始化本月」。'
                : '本月沒有可補入的資料，無需初始化；待補項目可參考下方統計。';
            } catch (error) { initializationStatus.value = '預覽失敗：' + errorText(error); }
            finally { operation.value = false; }
          }
          async function initializeMonth() {
            if (busy.value || !accountsReady.value || dirtyKeys.size || !canInitialize.value) return;
            operation.value = true; initializationPreview.value = null; const selectedMonth = month.value;
            initializationStatus.value = '正在初始化 ' + year.value + ' 年 ' + selectedMonth + ' 月……';
            try {
              const result = await api.initialize(year.value, selectedMonth); validateInitialization(result, selectedMonth);
              initializationResult.value = result; initializationApplied.value = true;
              initializationStatus.value = '初始化完成，正在重新讀取帳務……';
              const refreshed = await loadAccounts(true);
              initializationStatus.value = refreshed ? '初始化完成，帳務已重新讀取。'
                : '初始化已完成，但帳務重新讀取失敗，請按「重新讀取」確認。';
            } catch (error) {
              initializationResult.value = null;
              initializationStatus.value = '初始化未能確認完成：' + errorText(error) + '。可能已有部分寫入，請重新讀取並預覽後再操作。';
            } finally { operation.value = false; }
          }
          function onPaymentFieldSaved(change){const account=accounts.value.find(a=>a.room===change.room);if(account)account[change.field]=change.value;}
    function onPaymentSelectionSaved(change){const account=accounts.value.find(a=>a.room===change.room);if(account)account.paymentScreenshot=change.value;}
    function onMeterFieldSaved(change) {
      const account=accounts.value.find(a=>a.room===change.room);if(!account?.meter)return;
      if(change.field==='currentReading')updateAccount(account,{key:change.field,meter:true},change.value);
      else account.meter[change.field]=change.value;
    }
    function onMeterReconciled(records) { accounts.value=validateAccounts(records,month.value);staleRooms.clear();accountsReady.value=true; }
    function refreshAfterMeter(){nextTick(()=>{if(!busy.value&&!dirtyKeys.size)loadAccounts();});}
    watch(controlsLocked, value => emit('busy-change', value), { immediate: true });
      watch(accounts, value => emit('update-data', { year: year.value, month: month.value, accounts: value }), { deep: true });
      onMounted(loadYears);
          return { historicalMode, numberFormat, accountFilter, filteredAccounts, cashSummary, billingView, onPaymentFieldSaved, onPaymentSelectionSaved, onMeterFieldSaved, onMeterReconciled, refreshAfterMeter, year, years, loadYears, changeYear, month, months, accounts, status, loading, operation, pendingSaves, accountsReady, revision,
            registerAccountField,saveAllAccounts,resetAllAccounts,batchReview,batchStatus,dirtyKeys, staleRooms, controlsLocked, busy, editorsBlocked, columns, displayCell, noticeUrl,
            creationPanelOpen, newMonth, monthChoices, validNewMonth, canCreate, creationPreview, creationStatus,
            changeCreationMonth, toggleCreationPanel, previewNewMonth, createNewMonth,
            setDirty, startSave, finishSave, updateAccount, loadMonths, changeMonth, initializationStatus,
            initializationResult, initializationApplied, initializationLines, canInitialize, previewInitialization, initializeMonth };
        }
      };
return component;
};
