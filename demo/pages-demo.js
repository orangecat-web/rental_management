/** Loaded only by the separate Pages artifact. Never used by a production Worker. */
(() => {
  window.RentalDemo=true;
  const nativeFetch = window.fetch.bind(window);
  const formatPhone=v=>/^09\d{8}$/.test(v)?v.slice(0,4)+'-'+v.slice(4,7)+'-'+v.slice(7):v;
  // Fixed fictional cast, keyed by room so snapshot ordering cannot change a person's display name.
  const fictionalNames=Object.freeze({'401':'郝開心','402':'吳煩惱','403':'錢多多','404':'梅問題','405':'余有閒','406':'石在好','407':'田蜜蜜','408':'范特西','409':'何家歡','501':'包租安','502':'湯圓圓','503':'花生糖','504':'鍾意你','505':'賴床安','506':'鄭有錢','507':'蘇適圈','508':'胡椒鹽','601':'郝運來','602':'游自在'});
  const nameFor=room=>fictionalNames[room]||'甄有緣';
  const rooms = ['401','402','403','404','405','406','407','501','502','503','504','505','506','507','508'];
  const tenants = rooms.map((room, i) => ({
    rentSubsidy:i%2?'有':'無',cohabitantIdentity:i===0?'學生':'',cohabitant:i===0?'何睦睦':'',cohabitantPhone:i===0?'0900000098':'',cohabitantAddress:i===0?'桃園市龜山區測試用虛構路1號（非真實地址）':'',cohabitantId:i===0?'DEMO-COHABITANT-INVALID':'',cohabitantBirthDate:i===0?'2000-02-29':'',
    registeredAddress:'示範市範例區虛構路 1 號',nationalId:'DEMO-INVALID',birthDate:'2000-01-01',guarantorName:'包安心',guarantorAddress:'示範地址（非真實）',guarantorId:'DEMO-INVALID',guarantorBirthDate:'1970-01-01',guarantorPhone:'0900000099',vacant:false,version:'demo-'+room,contractKind:i%2?'新約':'續約',emergencyContacts:i===0?[{name:'郝照應',phone:'0900000001'},{name:'常聯絡',phone:'0900000002'}]:[],room, roomType: i === 14 ? '' : i % 2 === 0 ? '套房' : '雅房', name: nameFor(room),
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
    const replacements=numbers.tenants.map((n,i)=>{const t=fake.find(t=>t.room===n.room)||fake[i%fake.length];return {...t,room:n.room,version:'demo-'+n.room,name:n.vacant?'':nameFor(n.room),rent:n.rent,vacant:n.vacant,roomType:n.roomType??t.roomType,initialMeterReading:null,initialReading:null,phone:n.vacant?'':t.phone};});
    tenants.splice(0,tenants.length,...replacements);rooms.splice(0,rooms.length,...replacements.map(t=>t.room));
  }
  function numericalAccounts(year,month){
    const period=numbers.periods.find(p=>p.year===year&&p.month===month);if(!period)throw Error('正式快照沒有此月份，不補造資料。');
    const report=numbers.reports.find(r=>r.year===year);
    return period.accounts.map(a=>{const t=tenants.find(t=>t.room===a.room),signing=report?.signing.find(s=>s.room===a.room&&s.month===month),deposit=signing?.deposit??0,recorded=a.effectivePaid;
      return {...a,name:a.vacant?'空房':t?.name||nameFor(a.room),notes:'示範備註；帳務數字取自正式快照。',transferLastFive:'01234',paymentScreenshot:'',depositSeparated:true,receiptDeposit:0,receiptTotal:recorded,receiptRecordedAmount:recorded,actualPaid:recorded,receiptDue:a.netDue,receiptSuggestedAmount:a.netDue,receiptAmountReady:!a.meter||a.meter.currentReading!==null,isReceived:recorded!==null&&recorded!==undefined,receiptConfirmed:recorded!==null&&recorded!==undefined?'是':'否',receiptEditable:true,financialLocked:false,...(numbers.financialProjection==='deposit-separated-v1'?Object.fromEntries(['actualPaid','receiptTotal','receiptRecordedAmount','receiptSuggestedAmount','receiptDue','receiptDeposit','openingCredit','receiptAmountReady','isReceived','receiptConfirmed'].filter(k=>Object.hasOwn(a,k)).map(k=>[k,a[k]])):{})};
    });
  }
  // Independent fictitious deposits, never imported from the financial snapshot or Google.
  function demoDeposits(propertyId){
    if(numbers?.deposits&&propertyId!==demoProperty)return {version:'D'.repeat(43),items:numbers.deposits.items.map((t,i)=>({...t,leaseId:String(i+1).padStart(43,'D'),name:nameFor(t.room),startDate:'2026-01-01',settlement:t.settlement?{...t.settlement,other:t.settlement.other.map((o,j)=>({...o,reason:'其他扣款 '+(j+1)+'（虛構說明）'}))}:null,events:t.events.map((e,j)=>({...e,id:'snapshot-deposit-'+i+'-'+j,data:{...e.data,notes:'數值取自正式快照；人物與說明為虛構。'}}))})),legacy:numbers.deposits.legacy.map((t,i)=>({...t,id:'snapshot-legacy-'+i}))};
    const isSecond=propertyId===demoProperty,room=isSecond?'601':rooms[0],name=isSecond?nameFor('601'):tenants[0].name||nameFor(room),oldName='曾住過';
    const settlement={date:'2026-11-10',rentMode:'preserve',electricityDisposition:'separate',electricity:{previous:1000,current:1050,unitPrice:5,usage:50,subtotal:250},other:[{reason:'示範清潔費',amount:200}],otherSubtotal:200,deductionTotal:450,deposit:12000,balance:11550,payoutType:'refund'};
    return {version:'D'.repeat(43),legacy:[],items:[{room,leaseId:'A'.repeat(43),name,startDate:'2026-01-01',active:true,received:12000,depositKnown:true,pending:false,settlement:null,paid:false,balance:12000,events:[{id:'demo-deposit-opening',kind:'opening',data:{date:'2026-01-01',amount:12000,notes:'純假資料：示範保管押金，不代表正式收款。'}}]},{room,leaseId:'B'.repeat(43),name:oldName,startDate:'2025-01-01',active:false,received:12000,depositKnown:true,pending:false,settlement,paid:false,balance:11550,events:[{id:'demo-old-opening',kind:'opening',data:{date:'2025-01-01',amount:12000,notes:'純假資料示範'}},{id:'demo-old-checkout',kind:'checkout',data:{...settlement,notes:'純假資料示範退租結算'}}]}]};
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
        depositSeparated:true,year, month, room: t.room, name: t.name, rent: t.rent, dueDate: date(year, month).slice(0,8)+'10',
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
  // Expenses in the public Demo are entirely synthetic, independent of rental numeric snapshots.
  const expenseYears=()=>numbers?.expenses?[...new Set(numbers.expenses.map(p=>p.year))].sort((a,b)=>b-a):[...new Set([Number(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric'}).format(new Date())),2026])].sort((a,b)=>b-a);
  function demoExpenses(year,month,propertyId){
    if(!Number.isInteger(year)||year<1900||year>9999||!Number.isInteger(month)||month<1||month>12)throw Error('展示支出年月不正確。');
    const prefix=propertyId===demoProperty?'00000002':'00000001',period=year+'-'+String(month).padStart(2,'0');
    if(numbers?.expenses&&propertyId!==demoProperty){const p=numbers.expenses.find(p=>p.year===year&&p.month===month);if(!p)throw Error('快照沒有此支出月份。');return p.rows.map((r,i)=>({...r,id:'E-'+prefix+'-0000-4000-8000-'+String(year)+String(month).padStart(2,'0')+String(i+1).padStart(6,'0'),item:'支出項目 '+(i+1)+'（虛構名稱）',notes:'金額取自正式快照；品名與收據圖片為虛構。',version:'e'.repeat(43),lastRequestId:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0')}));}
    return [{day:'01',item:'示範公用清潔用品',unitPrice:293,quantity:1,receiptCount:1},{day:'12',item:'示範垃圾袋',unitPrice:270,quantity:1,receiptCount:2},{day:'25',item:'示範修繕耗材',unitPrice:270,quantity:2,receiptCount:0},{day:'26',item:'示範已作廢支出',unitPrice:100,quantity:2,receiptCount:1,voided:true}].map((r,i)=>({...r,id:'E-'+prefix+'-0000-4000-8000-'+String(year)+String(month).padStart(2,'0')+String(i+1).padStart(6,'0'),date:period+'-'+r.day,amount:r.unitPrice*r.quantity,notes:'虛構現金支出，非正式資料。',voided:r.voided===true,version:'e'.repeat(43),lastRequestId:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0')}));
  }
  function demoExpenseRead(action,args,propertyId){
    if(action==='getExpenseYears')return expenseYears();
    if(action==='getExpenses'){const rows=demoExpenses(args[0],args[1],propertyId),claim=numbers?.expenses&&propertyId!==demoProperty?numbers.expenses.find(p=>p.year===args[0]&&p.month===args[1])?.claim:null;return {claim:{status:'unclaimed',date:'',claimedTotal:null,stale:false,pending:false,...claim,version:'D'.repeat(43),lastRequestId:''},rows,total:rows.filter(r=>!r.voided).reduce((sum,r)=>sum+r.amount,0),pendingCount:numbers?.expenses&&propertyId!==demoProperty?numbers.expenses.find(p=>p.year===args[0]&&p.month===args[1])?.pendingCount||0:0};}
    if(action==='getExpenseReceipt'){
      const match=/^E-[a-f0-9-]+-(\d{4})(\d{2})(\d{6})$/.exec(args[0]||'');if(!match)throw Error('示範收據不存在。');
      const row=demoExpenses(Number(match[1]),Number(match[2]),propertyId).find(r=>r.id===args[0]);if(!row||row.version!==args[2]||!Number.isInteger(args[1])||args[1]<0||args[1]>=row.receiptCount)throw Error('示範收據不存在。');
      return {dataUrl:samplePhoto('DEMO','日常支出收據 '+(args[1]+1))};
    }
    throw Error('展示支出不提供此操作。');
  }
  function rpc(action, args, scope, propertyId='default') {
    if(action==='getWorkspaceLogo')return {version:'',dataUrl:''};
    if(action==='getRoomSetupState')return {confirmed:true,count:propertyId===demoProperty?2:tenants.length,version:'demo-room-setup',rooms:propertyId===demoProperty?[{room:'601',roomType:'套房',inactive:false},{room:'602',roomType:'雅房',inactive:false}]:tenants.map(t=>({room:t.room,roomType:t.roomType,inactive:false}))};
    if(action==='getRentalProperties')return demoProperties;
    if(!['default',demoProperty].includes(propertyId))throw Error('展示房產不存在。');
    if(action==='getDepositWorkspace')return demoDeposits(propertyId);
    if(['getExpenseYears','getExpenses','getExpenseReceipt'].includes(action))return demoExpenseRead(action,args,propertyId);
    if(propertyId===demoProperty){if(action==='getTenantData')return tenants.slice(0,2).map((t,i)=>({...t,room:String(601+i),name:nameFor(String(601+i))}));if(action==='getRoomSettings')return [{room:'601',roomType:'套房',inactive:false,occupied:true,version:'demo-b-601'},{room:'602',roomType:'雅房',inactive:false,occupied:true,version:'demo-b-602'}];if(action==='getAvailableBillingYears')return [2026];if(action==='getAvailableBillingMonths')return [];if(action==='getRentalSiteCapabilities')return {version:2,billing:true};throw Error('此示範房產尚無帳務資料。');}

    if(scope==='tenant'&&action==='previewTenantBillingNames'){const t=tenants.find(t=>t.room===args[0]);if(!t)throw Error('房號不存在。');return {room:t.room,name:t.name,startDate:t.startDate,endDate:t.endDate,changes:[],version:'demo-name-preview'};}
    if (scope === 'tenant' && action === 'getTenantData') return tenants;
    if(scope==='tenant'&&action==='getRoomSettings')return tenants.map(t=>({room:t.room,roomType:t.roomType,inactive:false,occupied:!!t.name,version:t.version}));
    if (scope !== 'billing') throw Error('展示版不提供此操作。');
    if (action === 'getRentalSiteCapabilities') return { version:2,billing:true,...(numbers?{historicalReadOnly:true,monthlyCreation:false}:{}) };
    if (action === 'getAvailableBillingYears') return snapshotYears;
    const [year, month, room] = args;
    if (!snapshotYears.includes(year)) throw Error('展示版沒有此年份的資料。');
    if (action === 'getAvailableBillingMonths') return snapshotMonths(year);
    if(action==='getXingwuCollectionReport'){if(numbers){const r=numbers.reports.find(r=>r.year===year);if(!r)throw Error('快照沒有此年度報表。');if(numbers.financialProjection==='deposit-separated-v1')return {...r,depositScope:'押金獨立管理；正式數值快照／虛構個資。'};const excluded=(r.signing||[]).reduce((sum,s)=>{const bill=numbers.periods.find(p=>p.year===year&&p.month===s.month)?.accounts.find(a=>a.room===s.room);return sum+(typeof s.cash==='number'?Math.max(0,s.cash-(typeof bill?.effectivePaid==='number'?bill.effectivePaid:0)):0);},0);return {...r,signing:r.signing,incomeMonths:r.incomeMonths?.map(m=>({...m,deposit:0,total:Math.round((m.rent+m.electricity)*100)/100})),knownCashTotal:r.knownCashTotal===null?null:Math.max(0,r.knownCashTotal-excluded),cashTotal:r.cashTotal===null?null:Math.max(0,r.cashTotal-excluded),depositScope:'押金另列純假資料示範，不計入每月租金與電費實收。'};}const rows=months.flatMap(m=>accounts(year,m));const count=rows.length;const cash=rows.reduce((s,a)=>s+(a.effectivePaid||0),0),unknown=rows.filter(a=>!a.isReceived).length;return {version:1,year,receiptCount:count,unknownReceiptCount:unknown,cashTotal:unknown?null:cash,knownCashTotal:cash,combinedReceipts:0,depositScope:'虛構簽約款，僅供介面展示',incomeMonths:months.map(m=>{const a=accounts(year,m),known=a.filter(r=>r.isReceived&&r.actualPaid!==null),rent=known.reduce((s,r)=>s+Math.min(r.rent,r.actualPaid),0),electricity=known.reduce((s,r)=>s+Math.min(r.electricityFee||0,Math.max(0,r.actualPaid-r.rent)),0);return {month:m,rent,deposit:0,electricity,total:rent+electricity,unallocatedCash:0,unknownReceiptCount:a.length-known.length};}),signing:[{month:1,room:'401',rent:5800,deposit:11600,contractTotal:17400,cash:17400}],months:months.map(m=>{const a=accounts(year,m),rent=a.reduce((s,r)=>s+r.rent,0),electricity=a.reduce((s,r)=>s+(r.electricityFee||0),0);return {month:m,rent,electricity,settledRent:rent,settledElectricity:electricity,historicalCredit:0,vacantRooms:[]};})};}

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
