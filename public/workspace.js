/** One workspace, one data source. No live records or photographs enter localStorage. */
(() => {
  const { createApp, ref, computed, onMounted } = Vue;
  async function start(){if(!await RentalAccess.ready)return;
  const tenantApi = RentalTransport('tenant');
  const app = createApp({
    components: { TenantEditor: RentalAccess.secureComponent(RentalComponents.tenant()), BillingEditor: RentalAccess.secureComponent(RentalComponents.billing()), RentalReports: RentalComponents.reports() },
    setup() {
      const query = new URLSearchParams(location.search);
      window.RentalPropertyContext={id:query.get('property')||'default'};
      const page = ref(query.get('view') === 'reports' ? 'reports' : query.get('view') === 'accounts' ? 'accounts' : query.get('view') === 'tenants' ? 'tenants' : 'overview');
      const propertyCompatible=ref(false),propertyReady=ref(false),propertyBusy=ref(false),propertyOpen=ref(false),propertyError=ref(''),properties=ref([]),propertyRevision=ref(0),workspaceName=ref('私人管理工作區'),workspaceDraft=ref(''),newPropertyName=ref(''),newPropertyFolder=ref(''),propertyDelete=ref(null),propertyEpoch=ref(0),activeProperty=ref(window.RentalPropertyContext.id);let newPropertyId='';
      const propertyRpc=(action,...args)=>new Promise((resolve,reject)=>tenantApi.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[action](...args));
      function acceptProperties(r){if(!r||!Number.isSafeInteger(r.revision)||!Array.isArray(r.items)||!r.items.every(p=>p&&typeof p.name==='string'&&typeof p.id==='string'))throw Error('房產清單格式不正確。');propertyCompatible.value=true;properties.value=r.items.map(p=>({...p,nextName:p.name,nextFolder:p.folderUrl||''}));propertyRevision.value=r.revision;workspaceName.value=workspaceDraft.value=r.workspaceName;}
      async function loadProperties(){if(propertyBusy.value||editorBusy.value||loading.value)return;const previousId=activeProperty.value;propertyBusy.value=true;propertyError.value='';try{acceptProperties(await propertyRpc('getRentalProperties'));if(!properties.value.some(p=>p.id===activeProperty.value&&!p.archived)){activeProperty.value=properties.value.find(p=>!p.archived)?.id||'default';window.RentalPropertyContext.id=activeProperty.value;}window.RentalPropertyContext.name=properties.value.find(p=>p.id===activeProperty.value)?.name;if(previousId!==activeProperty.value){propertyEpoch.value++;tenants.value=[];currentAccounts.value=[];loaded.value=false;}propertyReady.value=true;}catch(e){propertyError.value='房產清單讀取失敗：'+(e.message||String(e));if(activeProperty.value==='default'&&!propertyCompatible.value){properties.value=[{id:'default',name:'目前房產（清單暫不可用）',archived:false}];propertyReady.value=true;}else propertyReady.value=false;}finally{propertyBusy.value=false;}}
      function switchProperty(event){const id=event.target.value;if(editorBusy.value||loading.value||propertyBusy.value||propertyOpen.value){event.target.value=activeProperty.value;navigationMessage.value='請先完成儲存或關閉房產設定。';return;}if(!properties.value.some(p=>p.id===id&&!p.archived))return;window.RentalPhotoMemory?.clear();activeProperty.value=id;window.RentalPropertyContext.id=id;window.RentalPropertyContext.name=properties.value.find(p=>p.id===id)?.name;propertyEpoch.value++;tenants.value=[];currentAccounts.value=[];loaded.value=false;selectedRoom.value='';const url=new URL(location.href);url.searchParams.set('property',id);url.searchParams.delete('billingMonth');url.searchParams.delete('billingYear');history.replaceState(null,'',url.pathname+url.search);if(page.value==='overview')loadOverview();}
      async function saveProperty(mode,p){if(!RentalAccess.canWrite||propertyBusy.value||editorBusy.value)return;propertyBusy.value=true;propertyError.value='';try{if(mode==='create'&&!newPropertyId)newPropertyId='p-'+crypto.randomUUID();const id=mode==='create'?newPropertyId:p?.id||activeProperty.value;const r=await propertyRpc('saveRentalProperty',mode,id,mode==='create'?newPropertyName.value:p?.nextName||'',workspaceDraft.value,mode==='create'?newPropertyFolder.value:p?.nextFolder||'',propertyRevision.value);acceptProperties(r);if(mode==='update'){window.RentalPropertyContext.name=properties.value.find(p=>p.id===activeProperty.value)?.name;propertyEpoch.value++;}if(mode==='create'){newPropertyName.value='';newPropertyFolder.value='';newPropertyId='';}propertyDelete.value=null;propertyError.value='房產設定已儲存。';if(!r.items.some(p=>p.id===activeProperty.value&&!p.archived)){activeProperty.value=r.items.find(p=>!p.archived).id;window.RentalPropertyContext.id=activeProperty.value;window.RentalPropertyContext.name=r.items.find(p=>p.id===activeProperty.value)?.name;const url=new URL(location.href);url.searchParams.set('property',activeProperty.value);history.replaceState(null,'',url.pathname+url.search);propertyEpoch.value++;tenants.value=[];currentAccounts.value=[];loaded.value=false;if(page.value==='overview')await loadOverview();}}catch(e){propertyError.value='設定結果待核對：'+e.message+'。請重新讀取清單確認，勿重複新增。';}finally{propertyBusy.value=false;}}
      const tenants = ref([]), loading = ref(false), loaded = ref(false), status = ref('正在讀取房間資料……');
      const currentAccounts=ref([]),paymentPeriod=ref('');
      const roomPayment=room=>currentAccounts.value.find(a=>a.room===room);
      const search = ref(''), selectedRoom = ref(''), editorBusy = ref(false), navigationMessage = ref('');
      const nav = [{ id: 'overview', label: '房間總覽', icon: '▦' }, { id: 'reports', label: '收租統計', icon: '▥' }, { id: 'tenants', label: '房客資料', icon: '♧' }, { id: 'accounts', label: '每月帳務', icon: '▤' }];
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
        navigationMessage.value = ''; selectedRoom.value = room; page.value = next;if(next==='overview'&&!loaded.value)loadOverview();
        const url = new URL(location.href); url.searchParams.delete('page');
        if (next === 'overview') url.searchParams.delete('view'); else url.searchParams.set('view', next);
        history.replaceState(null, '', url.pathname + url.search);
      }
      onMounted(() => {
        loadProperties().then(()=>{if(propertyReady.value&&page.value==='overview')loadOverview();});
        window.addEventListener('beforeunload', event => { if (editorBusy.value) { event.preventDefault(); event.returnValue = ''; } });
      });
      return { propertyCompatible,propertyReady,propertyBusy,propertyOpen,propertyError,properties,propertyRevision,workspaceName,workspaceDraft,newPropertyName,newPropertyFolder,propertyDelete,propertyEpoch,activeProperty,loadProperties,switchProperty,saveProperty,access:RentalAccess.state, roomPayment, paymentPeriod, page, nav, title, subtitles, tenants, search, selectedRoom, editorBusy, navigationMessage, loading, loaded, status,
        money, vacantRooms, totalRent, missingRent, withContract, withName, filteredRooms, acceptTenants, loadOverview, navigate };
    }
  });
  app.config.errorHandler = () => { document.getElementById('workspace-error').hidden = false; };
  RentalAccess.install(app);
  app.mount('#app');
  }
  start();
})();
