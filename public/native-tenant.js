/** Generated from the tested editor; one native workspace, no iframe. */
window.RentalComponents ||= {};
window.RentalComponents.tenant = function () {
const google = RentalTransport('tenant');
const { createApp, ref, reactive, computed, watch, onMounted } = Vue;
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
      function displayField(value, field) {
        if (field.checkbox) return value === '是';
        const text = String(value ?? '');
        if (field.type === 'date' && text) {
          const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(text);
          if (match) return match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0');
        }
        return text;
      }

      const TenantField = {
        props: { tenant: Object, field: Object, blocked: Boolean, showTitle: Boolean },
        emits: ['saved', 'save-start', 'save-end', 'dirty-change'],
        template: "\n    <div class=\"editor\" :class=\"{ multiline: field.multiline, phone: field.type === 'tel' }\">\n      <label v-if=\"showTitle\" class=\"editor-label\" :for=\"inputId\">{{ field.title }}</label>\n      <textarea v-if=\"field.multiline\" ref=\"inputElement\" :id=\"inputId\"\n        v-model=\"draft\" rows=\"3\" maxlength=\"2000\" :aria-label=\"label\"\n        :disabled=\"saving || blocked\"></textarea>\n      <label v-else-if=\"field.checkbox\" class=\"student-checkbox\"><input ref=\"inputElement\" type=\"checkbox\" :id=\"inputId\" v-model=\"draft\" :aria-label=\"label\" :disabled=\"saving || blocked\">學生</label>\n      <select v-else-if=\"field.options\" ref=\"inputElement\" :id=\"inputId\" v-model=\"draft\"\n        :aria-label=\"label\" :disabled=\"saving || blocked\">\n        <option value=\"\">未設定</option>\n        <option v-for=\"option in field.options\" :key=\"option\" :value=\"option\">{{ option }}</option>\n      </select>\n      <input v-else ref=\"inputElement\" :id=\"inputId\" v-model=\"draft\"\n        :type=\"field.type || 'text'\" :aria-label=\"label\" :disabled=\"saving || blocked\"\n        :min=\"field.type === 'number' ? 0 : undefined\"\n        :max=\"field.key === 'rent' ? 1000000 : field.key === 'initialMeterReading' ? 100000000 : undefined\"\n        :step=\"field.key === 'rent' ? '0.01' : field.key === 'initialMeterReading' ? 'any' : undefined\"\n        :maxlength=\"field.key === 'defaultTransferLastFive' ? 5 : field.type === 'date' || field.key === 'rent' ? undefined : 100\"\n        :inputmode=\"field.key === 'defaultTransferLastFive' ? 'numeric' : undefined\"\n        :pattern=\"field.key === 'defaultTransferLastFive' ? '[0-9]{5}' : undefined\"\n        :placeholder=\"field.key === 'defaultTransferLastFive' ? '例如 01234' : undefined\">\n      <div class=\"editor-actions\">\n        <button type=\"button\" @click=\"save\" :disabled=\"saving || blocked\">{{ saving ? '儲存中……' : '儲存' }}</button>\n        <button v-if=\"dirty\" type=\"button\" @click=\"reset\" :disabled=\"saving || blocked\">還原</button>\n      </div>\n      <div class=\"save-message\" role=\"status\" aria-live=\"polite\">{{ message }}</div>\n    </div>\n  ",
        setup(props, { emit }) {
          const savedValue = ref(props.tenant[props.field.key] ?? (['rent','initialMeterReading'].includes(props.field.key) ? null : ''));
          const draft = ref(displayField(savedValue.value, props.field));
          const saving = ref(false);
          const message = ref('');
          const inputElement = ref(null);
          const label = computed(() => props.tenant.room + ' 房' + props.field.title);
          const inputId = computed(() => 'tenant-' + props.tenant.room + '-' + props.field.key);
          const dirty = computed(() => props.field.checkbox ? draft.value !== displayField(savedValue.value, props.field) : String(draft.value ?? '') !== displayField(savedValue.value, props.field));
          watch(dirty, value => emit('dirty-change', value));

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
              const valid = ['rent','initialMeterReading'].includes(props.field.key)
                ? nextValue === null || (typeof nextValue === 'number' && Number.isFinite(nextValue) && nextValue >= 0)
                : typeof nextValue === 'string' && (!props.field.options || nextValue === '' || props.field.options.includes(nextValue));
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
          return { draft, saving, message, inputElement, inputId, label, dirty, reset, save };
        }
      };

      const TenantContract = {
        props: { tenant: Object, blocked: Boolean },
        emits: ['saved', 'save-start', 'save-end', 'dirty-change'],
        template: "\n    <div class=\"editor contract-editor\">\n      <div class=\"contract-links\">\n        <a v-for=\"(url, index) in safeLinks\" :key=\"url\" :href=\"url\"\n          target=\"_blank\" rel=\"noopener noreferrer\">查看合約 {{ index + 1 }}</a>\n        <span v-if=\"!safeLinks.length\">{{ savedLinks.length ? '連結格式待確認' : '尚未提供' }}</span>\n      </div>\n      <input ref=\"inputElement\" v-model=\"draft\" type=\"url\" maxlength=\"2000\"\n        placeholder=\"貼上 Google Drive 資料夾網址\" :aria-label=\"tenant.room + ' 房合約資料夾'\"\n        :disabled=\"saving || blocked || multiple\">\n      <div class=\"editor-actions\">\n        <button type=\"button\" @click=\"save\" :disabled=\"saving || blocked || multiple\">{{ saving ? '儲存中……' : '儲存合約連結' }}</button>\n        <button v-if=\"dirty\" type=\"button\" @click=\"reset\" :disabled=\"saving || blocked || multiple\">還原</button>\n      </div>\n      <div class=\"save-message\" role=\"status\" aria-live=\"polite\">{{ multiple ? '目前有多個連結，請先在試算表核對。' : message }}</div>\n    </div>\n  ",
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

      const component = {
 props: { initialRoom: String }, emits: ["update-data", "busy-change"],
 template: "\n  <div class=\"page-heading\"><button class=\"reload\" type=\"button\" @click=\"loadTenants\" :disabled=\"loading || pendingSaves > 0 || dirtyKeys.size > 0\">重新讀取</button></div><p class=\"status\" role=\"status\" aria-live=\"polite\">{{ status }}</p>\n  <div v-if=\"pendingSaves > 0\" class=\"draft-notice\" role=\"status\">有 {{ pendingSaves }} 筆儲存中，請稍候。</div>\n  <div v-else-if=\"dirtyKeys.size > 0\" class=\"draft-notice\">有 {{ dirtyKeys.size }} 個未儲存項目，請儲存或還原後再切換房間。</div>\n\n  <div v-if=\"tenants.length\" class=\"workspace\">\n    <aside class=\"room-panel\" aria-label=\"選擇房間\">\n      <div class=\"room-heading\"><h2>房間列表</h2><span class=\"room-count\">{{ tenants.length }} 間</span></div>\n      <div class=\"room-list\">\n        <button v-for=\"tenant in tenants\" :key=\"tenant.room\" class=\"room-button\" type=\"button\"\n          :aria-label=\"'選擇 ' + tenant.room + ' 房'\" :aria-pressed=\"selectedRoom === tenant.room\"\n          :disabled=\"loading || pendingSaves > 0 || (dirtyKeys.size > 0 && selectedRoom !== tenant.room)\"\n          @click=\"selectRoom(tenant.room)\">\n          <span class=\"room-number\">{{ tenant.room }}</span>\n          <span class=\"room-name\">{{ tenant.name || '未填居住者' }} <span v-if=\"tenant.student==='是'\" class=\"student-tag\">學生</span></span>\n        </button>\n      </div>\n    </aside>\n\n    <article v-if=\"activeTenant\" :key=\"revision + ':' + activeTenant.room\" class=\"tenant-panel\" aria-label=\"房客資料編輯\">\n      <header class=\"tenant-heading\">\n        <div><span class=\"room-tag\">房間資料</span><h2>{{ activeTenant.room }} 房</h2><p class=\"tenant-name\">{{ activeTenant.name || '尚未填寫居住者' }} <span v-if=\"activeTenant.student==='是'\" class=\"student-tag\">學生</span></p></div>\n        <div class=\"rent-summary\"><span>目前房租／月</span><strong>{{ rentText(activeTenant.rent) }}</strong></div>\n      </header>\n\n      <section class=\"form-section\" aria-label=\"基本與租約資料\">\n        <div class=\"section-heading\"><h3>基本與租約資料</h3><span class=\"section-hint\">各欄位可個別儲存</span></div>\n        <div class=\"field-grid\">\n          <tenant-field v-for=\"field in basicFields\" :key=\"field.key\" :tenant=\"activeTenant\" :field=\"field\" :blocked=\"loading\" show-title\n            @save-start=\"startSave\" @save-end=\"finishSave\"\n            @saved=\"updateField(activeTenant, field.key, $event)\"\n            @dirty-change=\"setDirty(activeTenant.room, field.key, $event)\"></tenant-field>\n        </div>\n      </section>\n\n      <section class=\"form-section\" aria-label=\"簽約資料\">\n        <div class=\"section-heading\"><h3>簽約資料</h3><span class=\"section-hint\">Google Drive 合約資料夾</span></div>\n        <tenant-contract :tenant=\"activeTenant\" :blocked=\"loading\"\n          @save-start=\"startSave\" @save-end=\"finishSave\"\n          @saved=\"updateField(activeTenant, 'contractLinks', $event)\"\n          @dirty-change=\"setDirty(activeTenant.room, 'contractLinks', $event)\"></tenant-contract>\n      </section>\n\n      <section class=\"form-section\" aria-label=\"管理備註\">\n        <div class=\"section-heading\"><h3>管理備註</h3></div>\n        <tenant-field :tenant=\"activeTenant\" :field=\"noteField\" :blocked=\"loading\"\n          @save-start=\"startSave\" @save-end=\"finishSave\"\n          @saved=\"updateField(activeTenant, 'notes', $event)\"\n          @dirty-change=\"setDirty(activeTenant.room, 'notes', $event)\"></tenant-field>\n      </section>\n\n      <section class=\"form-section\">\n        <details class=\"other-data\">\n          <summary>其他聯絡與房間資料</summary>\n          <div class=\"field-grid\">\n            <tenant-field v-for=\"field in extraFields\" :key=\"field.key\" :tenant=\"activeTenant\" :field=\"field\" :blocked=\"loading\" show-title\n              @save-start=\"startSave\" @save-end=\"finishSave\"\n              @saved=\"updateField(activeTenant, field.key, $event)\"\n              @dirty-change=\"setDirty(activeTenant.room, field.key, $event)\"></tenant-field>\n          </div>\n        </details>\n      </section>\n    </article>\n  </div>\n  <p v-else-if=\"!loading && !loadFailed\" class=\"empty\">目前沒有房客資料。</p>\n  ",
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
          const basicFields = [
            { key: 'roomType', title: '房型', options: ['套房', '雅房'] },
            { key: 'name', title: '居住者' },
            { key: 'phone', title: '電話', type: 'tel' },
            { key: 'student', title: '學生標記', checkbox: true },
            { key: 'startDate', title: '起租日', type: 'date' },
            { key: 'endDate', title: '到期日', type: 'date' },
            { key: 'rent', title: '目前房租', type: 'number' }
          ];
          const noteField = { key: 'notes', title: '管理備註', multiline: true };
          const extraFields = [
            { key: 'initialMeterReading', title: '初始電表（度）', type: 'number' },
            { key: 'contractDate', title: '簽約日', type: 'date' },
            { key: 'defaultTransferLastFive', title: '預設轉帳後五碼' },
            { key: 'cohabitant', title: '同居人' },
            { key: 'cohabitantPhone', title: '同居人電話', type: 'tel' },
            { key: 'emergencyContact', title: '緊急聯絡人' },
            { key: 'emergencyPhone', title: '聯絡人電話', type: 'tel' },
            { key: 'introduction', title: '基本介紹', multiline: true },
            { key: 'maintenance', title: '房間維護整修紀錄', multiline: true }
          ];
          function setDirty(room, field, value) {
            const key = room + ':' + field;
            if (value) dirtyKeys.add(key); else dirtyKeys.delete(key);
          }
          function startSave() { pendingSaves.value++; }
          function finishSave() { pendingSaves.value--; }
          function updateField(tenant, field, value) { tenant[field] = value; }

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
                return { ...tenant, room, contractLinks: tenant.contractLinks || [] };
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
          return { selectedRoom, activeTenant, selectRoom, rentText, tenants, loading, loadFailed, pendingSaves, dirtyKeys, status, revision,
            basicFields, noteField, extraFields, setDirty, startSave, finishSave, updateField, loadTenants };
        }
      };
return component;
};
