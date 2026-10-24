/** Loaded only by the separate Pages artifact. Never used by a production Worker. */
(() => {
  window.RentalDemo=true;
  const nativeFetch = window.fetch.bind(window);
  const formatPhone=v=>/^09\d{8}$/.test(v)?v.slice(0,4)+'-'+v.slice(4,7)+'-'+v.slice(7):v;
  const rooms = ['401','402','403','404','405','406','407','501','502','503','504','505','506','507','508'];
  const tenants = rooms.map((room, i) => ({
    registeredAddress:'示範市範例區虛構路 1 號',nationalId:'DEMO-INVALID',birthDate:'2000-01-01',guarantorName:'示範保證人',guarantorAddress:'示範地址（非真實）',guarantorId:'DEMO-INVALID',guarantorBirthDate:'1970-01-01',guarantorPhone:'0900000099',vacant:false,version:'demo-'+room,contractKind:i%2?'新約':'續約',emergencyContacts:i===0?[{name:'示範聯絡人甲',phone:'0900000001'},{name:'示範聯絡人乙',phone:'0900000002'}]:[],room, roomType: i === 14 ? '' : i % 2 === 0 ? '套房' : '雅房', name: '示範房客 ' + String.fromCharCode(65 + i),
    phone: '09000000' + String(i).padStart(2, '0'),
    rent: room === '506' ? 0 : 5800 + (i % 4) * 200,
    initialMeterReading: i === 0 ? 1000 : i === 12 ? 0 : null, contractDate: i === 0 ? '2026-08-15' : i === 12 ? '2026-06-15' : '',
    identity: i === 14 ? '管理人' : i % 3 === 0 ? '學生' : '一般',
    student: i % 3 === 0 ? '是' : '', startDate: '2026-01-01', endDate: '2026-12-31',
    notes: '虛構展示資料，非真實房客。', contractLinks: []
  })).map(tenant=>({...tenant,phone:formatPhone(tenant.phone),guarantorPhone:formatPhone(tenant.guarantorPhone),emergencyContacts:tenant.emergencyContacts.map(c=>({...c,phone:formatPhone(c.phone)})),initialReading:tenant.initialMeterReading,signingDate:tenant.contractDate}));
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const numbers=window.RentalDemoNumbers||null;
  const snapshotYears=numbers?[...new Set(numbers.periods.map(p=>p.year))].sort((a,b)=>b-a):[2026];
  const snapshotMonths=year=>numbers?numbers.periods.filter(p=>p.year===year).map(p=>p.month).sort((a,b)=>a-b):months;
  if(numbers){
    if(numbers.version!==1||numbers.source!=='production-numbers'||numbers.personalData!=='synthetic')throw Error('數值快照格式不正確。');
    const fake=tenants.map(t=>({...t}));
    const replacements=numbers.tenants.map((n,i)=>{const t=fake.find(t=>t.room===n.room)||fake[i%fake.length];return {...t,room:n.room,version:'demo-'+n.room,name:n.vacant?'':t.name||'示範房客 '+n.room,rent:n.rent,vacant:n.vacant,roomType:n.roomType??t.roomType,initialMeterReading:null,initialReading:null,phone:n.vacant?'':t.phone};});
    tenants.splice(0,tenants.length,...replacements);rooms.splice(0,rooms.length,...replacements.map(t=>t.room));
  }
  function numericalAccounts(year,month){
    const period=numbers.periods.find(p=>p.year===year&&p.month===month);if(!period)throw Error('正式快照沒有此月份，不補造資料。');
    const report=numbers.reports.find(r=>r.year===year);
    return period.accounts.map(a=>{const t=tenants.find(t=>t.room===a.room),signing=report?.signing.find(s=>s.room===a.room&&s.month===month),deposit=signing?.deposit??0,recorded=signing?signing.cash:a.effectivePaid;
      return {...a,name:a.vacant?'空房':t?.name||'示範房客 '+a.room,notes:'示範備註；帳務數字取自正式快照。',transferLastFive:'01234',paymentScreenshot:'',receiptDeposit:deposit,receiptTotal:recorded,receiptRecordedAmount:recorded,actualPaid:recorded,receiptDue:a.netDue===null?null:a.netDue+deposit,receiptSuggestedAmount:a.netDue===null?null:a.netDue+deposit,receiptAmountReady:!a.meter||a.meter.currentReading!==null,isReceived:recorded!==null&&recorded!==undefined,receiptConfirmed:recorded!==null&&recorded!==undefined?'是':'否',receiptEditable:true,financialLocked:false};
    });
  }
  const date = (year, month) => new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  function accounts(year, month) {
    if(numbers)return numericalAccounts(year,month);
    return tenants.map((t, i) => {
      const odd = month % 2 === 1, usage = 80 + i * 6 + month * 2;
      const firstMeterMonth = t.initialMeterReading === null ? null : months.find(m=>m%2===1 && t.contractDate>=date(year,m-2) && t.contractDate<date(year,m));
      const useInitial = odd && month === firstMeterMonth;
      let previousReading = 1000 + i * 100 + Math.floor(month / 2) * 200;
      if (odd && firstMeterMonth && month >= firstMeterMonth) {
        previousReading = t.initialMeterReading;
        for (let prior = firstMeterMonth; prior < month; prior += 2) previousReading += 80 + i * 6 + prior * 2;
      }
      const fee = odd ? usage * 5 : 0, totalDue = t.rent + fee;
      const isReceived = (i + month) % 4 !== 0;
      // Independent monthly fixtures: unpaid claims are settled in the following month.
      const priorMonth = month - 1, priorFee = priorMonth % 2 ? (80 + i * 6 + priorMonth * 2) * 5 : 0;
      const arrears = month > 1 && (i + priorMonth) % 4 === 0 ? t.rent + priorFee : 0;
      const receiptPhotoMatched=month===12&&i===0,netDue = totalDue + arrears, effectivePaid = receiptPhotoMatched&&!isReceived?null:isReceived ? netDue : 0;
      return {
        year, month, room: t.room, name: t.name, rent: t.rent, dueDate: date(year, month).slice(0,8)+'10',
        electricityFee: odd ? fee : null, totalDue, arrears, creditApplied: 0, openingCredit: 0,
        netDue,receiptRuleVersion:2,receiptPhotoMatched,receiptRecordedAmount:isReceived?netDue:null,receiptSuggestedAmount:netDue,receiptAmountReady:true,actualPaid:isReceived?netDue:null,effectivePaid,unpaid:receiptPhotoMatched&&!isReceived?arrears+fee:netDue-effectivePaid,overpaid:0,
        isReceived, receiptConfirmed: isReceived ? '是' : '',
        transferDate: isReceived ? date(year, month).slice(0, 8) + '05' : '',
        transferLastFive: '0' + String(1000 + i), paymentScreenshot:receiptPhotoMatched?'demo-only-saved-association':'', notes: '虛構展示帳務',
        paymentStatus:receiptPhotoMatched&&!isReceived?'已配對截圖／實收待人工確認':isReceived?'已收':'未收',
        meter: odd ? { previousReading, currentReading: previousReading + usage,
          previousReadingDate: useInitial ? t.contractDate : date(year, month - 2), previousReadingSource: useInitial ? 'initial' : '', currentReadingDate: date(year, month),
          usage, calculatedFee: fee } : null
      };
    });
  }
  function samplePhoto(room,kind='電表') {
    // Draw an explicitly labelled illustration; no real photo is packaged or fetched.
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#edf3e9'; ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = '#294638'; ctx.textAlign = 'center'; ctx.font = 'bold 36px system-ui';
    ctx.fillText(room + ' ROOM / DEMO', 320, 140); ctx.font = '26px system-ui';
    ctx.fillText(kind+'示意圖・非真實照片', 320, 210);
    return canvas.toDataURL('image/png');
  }
  const demoProperty='p-00000000-0000-4000-8000-000000000002';
  const demoProperties={revision:0,workspaceName:'假資料展示工作區',items:[{id:'default',name:'示範房產 A',archived:false,folderUrl:''},{id:demoProperty,name:'示範房產 B',archived:false,folderUrl:''}]};
  function rpc(action, args, scope, propertyId='default') {
    if(action==='getWorkspaceLogo')return {version:'',dataUrl:''};
    if(action==='getRoomSetupState')return {confirmed:true,count:propertyId===demoProperty?2:tenants.length,version:'demo-room-setup',rooms:propertyId===demoProperty?[{room:'601',roomType:'套房',inactive:false},{room:'602',roomType:'雅房',inactive:false}]:tenants.map(t=>({room:t.room,roomType:t.roomType,inactive:false}))};
    if(action==='getRentalProperties')return demoProperties;
    if(!['default',demoProperty].includes(propertyId))throw Error('展示房產不存在。');
    if(propertyId===demoProperty){if(action==='getTenantData')return tenants.slice(0,2).map((t,i)=>({...t,room:String(601+i),name:'示範房產 B 房客 '+(i+1)}));if(action==='getRoomSettings')return [{room:'601',roomType:'套房',inactive:false,occupied:true,version:'demo-b-601'},{room:'602',roomType:'雅房',inactive:false,occupied:true,version:'demo-b-602'}];if(action==='getAvailableBillingYears')return [2026];if(action==='getAvailableBillingMonths')return [];if(action==='getRentalSiteCapabilities')return {version:2,billing:true};throw Error('此示範房產尚無帳務資料。');}

    if(scope==='tenant'&&action==='previewTenantBillingNames'){const t=tenants.find(t=>t.room===args[0]);if(!t)throw Error('房號不存在。');return {room:t.room,name:t.name,startDate:t.startDate,endDate:t.endDate,changes:[],version:'demo-name-preview'};}
    if (scope === 'tenant' && action === 'getTenantData') return tenants;
    if(scope==='tenant'&&action==='getRoomSettings')return tenants.map(t=>({room:t.room,roomType:t.roomType,inactive:false,occupied:!!t.name,version:t.version}));
    if (scope !== 'billing') throw Error('展示版不提供此操作。');
    if (action === 'getRentalSiteCapabilities') return { version:2,billing:true,...(numbers?{historicalReadOnly:true,monthlyCreation:false}:{}) };
    if (action === 'getAvailableBillingYears') return snapshotYears;
    const [year, month, room] = args;
    if (!snapshotYears.includes(year)) throw Error('展示版沒有此年份的資料。');
    if (action === 'getAvailableBillingMonths') return snapshotMonths(year);
    if(action==='getXingwuCollectionReport'){if(numbers){const r=numbers.reports.find(r=>r.year===year);if(!r)throw Error('快照沒有此年度報表。');return {...r,depositScope:'正式帳務數值快照；個資及照片為示範資料。'};}const rows=months.flatMap(m=>accounts(year,m));const count=rows.length;const cash=rows.reduce((s,a)=>s+(a.effectivePaid||0),0),unknown=rows.filter(a=>!a.isReceived).length;return {version:1,year,receiptCount:count,unknownReceiptCount:unknown,cashTotal:unknown?null:cash,knownCashTotal:cash,combinedReceipts:0,depositScope:'虛構簽約款，僅供介面展示',incomeMonths:months.map(m=>{const a=accounts(year,m),known=a.filter(r=>r.isReceived&&r.actualPaid!==null),rent=known.reduce((s,r)=>s+Math.min(r.rent,r.actualPaid),0),electricity=known.reduce((s,r)=>s+Math.min(r.electricityFee||0,Math.max(0,r.actualPaid-r.rent)),0);return {month:m,rent,deposit:0,electricity,total:rent+electricity,unallocatedCash:0,unknownReceiptCount:a.length-known.length};}),signing:[{month:1,room:'401',rent:5800,deposit:11600,contractTotal:17400,cash:17400}],months:months.map(m=>{const a=accounts(year,m),rent=a.reduce((s,r)=>s+r.rent,0),electricity=a.reduce((s,r)=>s+(r.electricityFee||0),0);return {month:m,rent,electricity,settledRent:rent,settledElectricity:electricity,historicalCredit:0,vacantRooms:[]};})};}

    if (!Number.isInteger(month) || month < 1 || month > 12) throw Error('月份不正確。');
    if (action === 'getMonthlyAccounts') return accounts(year, month);
    if (action === 'getMonthlyPaymentPhotos') return month===12?[{id:'demo-payment-401',name:'401-DEMO.png'}]:[];
    if(action==='getPaymentPhoto'&&month===12&&room==='demo-payment-401')return {dataUrl:samplePhoto('401','匯款')};
    if (action === 'getRoomPaymentPhotoSelection' && rooms.includes(room)) return month===12&&room==='401'?{fileIds:['demo-payment-401'],value:'demo-only-saved-association'}:{ fileIds: [], value: '' };
    if (action === 'getMeterPhoto' || action === 'getMeterPhotoReference' || action === 'getRoomNoticeData') {
      const a = accounts(year, month).find(a => a.room === room);
      if (!a?.meter) throw Error('請選擇單數月份及有效房號。');
      if(action==='getMeterPhotoReference')return {found:true,id:'demo-meter-'+room,readingDate:a.meter.currentReadingDate};
      const photo = { found:true,name:room+'-demo.png',readingDate:a.meter.currentReadingDate,dataUrl:samplePhoto(room) };
      if (action === 'getMeterPhoto') return photo;
      return { year, month, room, rent: a.rent, arrears: a.arrears, creditApplied: a.creditApplied, total: a.netDue,
        dueDate: a.dueDate, photo,
        electricity: { previousDate: a.meter.previousReadingDate, currentDate: a.meter.currentReadingDate,
          previousReading: a.meter.previousReading, currentReading: a.meter.currentReading,
          usage: a.meter.usage, unitPrice: a.meter.unitPrice??5, fee: a.electricityFee } };
    }
    throw Error('展示版僅供瀏覽，不提供寫入或此項操作。');
  }
  const reply = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    // Every API request is handled locally or rejected, never forwarded to a real server.
    if (/(^|\/)api(?:\/|$)/.test(url.pathname)) {
      if (url.origin !== location.origin) return reply({ ok: false, error: { message: '展示版不連接外部 API。' } }, 403);
      const method = String(options.method || input.method || 'GET').toUpperCase();
      if (url.pathname === '/api/session' && method === 'GET') return reply({ ok: true, data: {
        authenticated: true, canWrite: false, role: 'viewer', email: 'demo@example.test',
        provider: 'demo', loginPath: './', logoutPath: './'
      } });
      if (url.pathname === '/api/connection' && method === 'GET') return reply({ ok: true, data: { configured: false, scope: 'demo' } });
      const match = url.pathname.match(/^\/api\/(tenant|billing)-rpc$/);
      if (match && method === 'POST') {
        try {
          const { action, args = [],propertyId='default' } = JSON.parse(options.body || '{}');
          if (!Array.isArray(args)) throw Error('參數不正確。');
          return reply({ ok: true, data: rpc(action, args, match[1],propertyId) });
        } catch (error) { return reply({ ok: false, error: { message: error.message } }, 403); }
      }
      return reply({ ok: false, error: { message: '展示版不提供此 API。' } }, 403);
    }
    return nativeFetch(input, options);
  };
})();
