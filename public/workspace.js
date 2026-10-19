/** One workspace, one data source. No live records or photographs enter localStorage. */
(() => {
  const { createApp, ref, computed, onMounted } = Vue;
  async function start(){if(!await RentalAccess.ready)return;
  const tenantApi = RentalTransport('tenant');
  const app = createApp({
    components: { TenantEditor: RentalAccess.secureComponent(RentalComponents.tenant()), BillingEditor: RentalAccess.secureComponent(RentalComponents.billing()), RentalReports: RentalComponents.reports() },
    setup() {
      const query = new URLSearchParams(location.search);
      const page = ref(query.get('view') === 'reports' ? 'reports' : query.get('view') === 'accounts' ? 'accounts' : query.get('view') === 'tenants' ? 'tenants' : 'overview');
      const tenants = ref([]), loading = ref(false), loaded = ref(false), status = ref('正在讀取房間資料……');
      const currentAccounts=ref([]),paymentPeriod=ref('');
      const roomPayment=room=>currentAccounts.value.find(a=>a.room===room);
      const search = ref(''), selectedRoom = ref(''), editorBusy = ref(false), navigationMessage = ref('');
      const nav = [{ id: 'overview', label: '房間總覽', icon: '▦' }, { id: 'tenants', label: '房客資料', icon: '♧' }, { id: 'accounts', label: '每月帳務', icon: '▤' }, { id: 'reports', label: '收租統計', icon: '▥' }];
      const title = computed(() => nav.find(item => item.id === page.value)?.label || '租務管理');
      const subtitles = { reports: '租金收繳、全部用電與單房趨勢，在這裡一起掌握。', overview: '從房間開始，整理房客、租約與每月帳務。', tenants: '基本資料、聯絡方式與合約，在同一處查看與修改。', accounts: '收款、抄表、照片與電費通知，都從這裡處理。' };
      const money = value => value === null || value === undefined || value === '' ? '未填寫' : new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(value);
      const totalRent = computed(() => tenants.value.reduce((sum, t) => sum + (typeof t.rent === 'number' ? t.rent : 0), 0));
      const missingRent = computed(() => tenants.value.filter(t => t.rent === null || t.rent === undefined).length);
      const vacantRooms=computed(()=>tenants.value.filter(t=>t.vacant===true));
      const withContract = computed(() => tenants.value.filter(t => t.contractLinks?.length).length);
      const withName = computed(() => tenants.value.filter(t => t.name?.trim()).length);
      const filteredRooms = computed(() => {
        const needle = search.value.trim().toLocaleLowerCase();
        return tenants.value.filter(t => !needle || [t.room, t.name].some(v => String(v || '').toLocaleLowerCase().includes(needle)));
      });
      function acceptTenants(records) {
        if (!Array.isArray(records)) throw Error('房客資料格式不正確。');
        const rooms = new Set();
        for (const t of records) {
          if (!t || !/^\d{3,8}$/.test(String(t.room)) || rooms.has(String(t.room)) ||
              (t.rent !== null && t.rent !== undefined && (typeof t.rent !== 'number' || !Number.isFinite(t.rent) || t.rent < 0))) throw Error('房號或租金格式不正確。');
          rooms.add(String(t.room));
        }
        tenants.value = records.map(t => ({ ...t, room: String(t.room) }));
        loaded.value = true;
      }
      async function loadOverview() {
        if (loading.value || editorBusy.value) return;
        loading.value = true; status.value = '正在讀取房間資料……';
        try {
          const result = await new Promise((resolve, reject) => tenantApi.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getTenantData());
          acceptTenants(result); status.value = '已讀取 ' + result.length + ' 間房間的資料';
          const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit'}).formatToParts(new Date());const y=Number(parts.find(p=>p.type==='year').value),m=Number(parts.find(p=>p.type==='month').value);paymentPeriod.value=y+'-'+String(m).padStart(2,'0');
          try{const records=await new Promise((resolve,reject)=>RentalTransport('billing').script.run.withSuccessHandler(resolve).withFailureHandler(reject).getMonthlyAccounts(y,m));if(!Array.isArray(records)||!records.every(a=>a.year===y&&a.month===m))throw Error('月份回應不符');currentAccounts.value=records;status.value+='｜紅框標示 '+paymentPeriod.value+' 已核對未收房間';}catch{currentAccounts.value=[];status.value+='｜本月收款狀態尚未讀取';}
        } catch (error) { status.value = '讀取失敗：' + (error.message || String(error)); }
        finally { loading.value = false; }
      }
      function navigate(next, room = '') {
        if (editorBusy.value) { navigationMessage.value = '有未儲存的修改或資料處理中，請先儲存、還原或等待完成。'; return; }
        navigationMessage.value = ''; selectedRoom.value = room; page.value = next;
        const url = new URL(location.href); url.searchParams.delete('page');
        if (next === 'overview') url.searchParams.delete('view'); else url.searchParams.set('view', next);
        history.replaceState(null, '', url.pathname + url.search);
      }
      onMounted(() => {
        if (page.value === 'overview') loadOverview();
        window.addEventListener('beforeunload', event => { if (editorBusy.value) { event.preventDefault(); event.returnValue = ''; } });
      });
      return { access:RentalAccess.state, roomPayment, paymentPeriod, page, nav, title, subtitles, tenants, search, selectedRoom, editorBusy, navigationMessage, loading, loaded, status,
        money, vacantRooms, totalRent, missingRent, withContract, withName, filteredRooms, acceptTenants, loadOverview, navigate };
    }
  });
  app.config.errorHandler = () => { document.getElementById('workspace-error').hidden = false; };
  RentalAccess.install(app);
  app.mount('#app');
  }
  start();
})();
