const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve('dist/pages-demo');
const wait = async predicate => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > 8000) throw Error('Demo UI readiness timeout');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
const errors = [], networkApi = [];
const server = http.createServer((req, res) => {
  if (req.url.includes('/api/')) networkApi.push(req.url);
  const url = new URL(req.url, 'http://localhost');
  const rel = url.pathname.replace(/^\/rental_management\//, '');
  const file = path.resolve(root, rel === '' ? 'index.html' : rel);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader('content-type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  fs.createReadStream(file).pipe(res);
});
(async () => {
  let dom;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/rental_management/`;
    const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
    dom = await JSDOM.fromURL(base, {
      resources: 'usable', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
      beforeParse(w) {
        w.Response = Response;
        w.fetch = (input, options) => fetch(new URL(input, w.location.href), options);
        const RealDate = w.Date;
        w.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-10-18T00:00:00Z'])); } };
        w.Storage.prototype.setItem = () => { throw Error('Demo must not persist records'); };
        // No photo pixels are validated here; verify fixture shape and shared renderer validation.
        w.HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {}, fillText() {} });
        w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,ZGVtbw==';
      }
    });
    const w = dom.window, d = w.document;
    await wait(() => d.querySelectorAll('.room-card').length === 15);assert(d.querySelector('nav button').textContent.includes('房間總覽'));[...d.querySelectorAll('nav button')].find(b=>b.textContent.includes('收租統計')).click();await wait(()=>d.querySelectorAll('.room-year-card').length===15);assert(w.location.search.includes('view=reports'));[...d.querySelectorAll('nav button')].find(b=>b.textContent.includes('房間總覽')).click();await wait(() => d.querySelectorAll('.room-card').length === 15);assert(!new URL(w.location.href).searchParams.has('view'));
    assert(d.querySelector('.pages-demo-banner').textContent.includes('虛構資料'));
    assert.equal(w.RentalAccess.state.role, 'viewer');
    assert.equal(w.RentalAccess.canWrite, false);
    assert(d.querySelector('[aria-label="查看 506 房"]').textContent.includes('NT$ 0'));
    assert(!d.querySelector('.access-identity form'));
    for (const el of d.querySelectorAll('script[src],link[rel="stylesheet"],a[href]')) {
      const href = el.src || el.href;
      if (href?.startsWith('http')) assert(href.startsWith(base), 'Project-relative asset/navigation: ' + href);
    }
    const rpc = async (action, args = [], scope = 'billing') => {
      const response = await w.fetch('/api/' + scope + '-rpc', { method: 'POST', body: JSON.stringify({ action, args }) });
      return { response, result: await response.json() };
    };
    const first = await rpc('getMonthlyAccounts', [2026, 1]);
    assert.equal(first.result.data.length, 15);
    const zero = first.result.data.find(a => a.room === '506');
    assert.equal(zero.rent, 0); assert(zero.electricityFee > 0);
    assert.equal(first.result.data[0].meter.previousReadingDate, '2025-11-01');
    const prepared = [];
    for (let month = 1; month <= 12; month++) {
      const { result } = await rpc('getMonthlyAccounts', [2026, month]);
      prepared.push(w.RentalReportData.prepare(2026, month, result.data));
      for (const a of result.data) {
        assert.equal(a.netDue, a.totalDue + a.arrears);
        if(a.receiptPhotoMatched&&!a.isReceived){assert.equal(a.unpaid,a.arrears+(a.electricityFee||0));assert.equal(a.actualPaid,null);assert.equal(a.effectivePaid,null);}else assert.equal(a.unpaid, a.netDue - a.effectivePaid);
        if (month % 2) assert(w.RentalReportData.meter(a).valid);
      }
    }
    const cohorts=w.RentalReportData.rentCohorts(prepared);assert(cohorts.filter(row=>!(row.month===12&&row.room==='401')).every(row=>row.valid));assert(!cohorts.find(row=>row.month===12&&row.room==='401').valid,'saved photo does not invent cash');
    const paired=(await rpc('getRoomPaymentPhotoSelection',[2026,12,'401'])).result.data;assert.deepEqual(Array.from(paired.fileIds),['demo-payment-401']);const demoDecember=(await rpc('getMonthlyAccounts',[2026,12])).result.data.find(a=>a.room==='401');assert.equal(demoDecember.isReceived,false);assert.equal(demoDecember.unpaid,0);assert.equal(demoDecember.receiptRecordedAmount,null);
    const notice = await rpc('getRoomNoticeData', [2026, 11, '506']);
    w.RentalNotice.validate(notice.result.data);
    assert(notice.result.data.photo.dataUrl.startsWith('data:image/png;base64,'));
    const namePreview=await rpc('previewTenantBillingNames',['401'],'tenant');assert.equal(namePreview.response.status,200);assert.equal(namePreview.result.data.changes.length,0);assert.equal((await rpc('syncTenantBillingNames',['401','demo-401','demo-name-preview',[{year:2026,month:10}]],'tenant')).response.status,403);
    const write = await rpc('saveTenantField', ['401', 'name', 'changed', ''], 'tenant');
    assert.equal(write.response.status, 403);
    assert.equal((await rpc('getTenantData', [], 'tenant')).result.data[0].name, '示範房客 A');
    assert.equal((await rpc('getMonthlyAccounts', [2027, 1])).response.status, 403);
    assert.equal((await rpc('unknownAction')).response.status, 403);
    assert.equal((await w.fetch('https://example.invalid/api/session')).status, 403);
    assert.equal((await w.fetch('/rental_management/api/unknown')).status, 403);
    d.querySelector('[aria-label="查看 506 房"]').click();
    await wait(() => d.querySelector('#tenant-506-rent'));
    assert(d.querySelector('#tenant-506-rent').readOnly);
    const identity=d.querySelector('[name=tenant-506-identity]:checked');assert(identity.disabled);assert.equal(identity.value,'學生');
    assert.deepEqual([...d.querySelectorAll('[name=tenant-506-identity]')].map(o=>o.value),['一般','學生','管理人']);
    assert.equal((await rpc('saveTenantField',['506','identity','管理人','學生'],'tenant')).response.status,403);
    [...d.querySelectorAll('.room-button')].find(b=>b.textContent.trim().startsWith('508')).click();
    await wait(()=>d.querySelector('[name=tenant-508-identity]:checked'));assert.equal(d.querySelector('[name=tenant-508-identity]:checked').value,'管理人');
    assert(d.querySelector('.tenant-heading .student-tag').textContent.includes('管理人'));assert(d.querySelector('[aria-label="508 房續約"]'));assert(d.querySelector('[aria-label="508 房續約"]').disabled);
    assert.equal((await rpc('saveTenantChanges',['508',{identity:'一般'},'demo-508'],'tenant')).response.status,403);
    assert.equal((await rpc('checkoutTenant',['508','demo-508'],'tenant')).response.status,403);
    assert.equal((await rpc('saveRoomSetting',['add','601','','套房',''],'tenant')).response.status,403);
    assert((await rpc('getRoomSettings',[],'tenant')).result.data.length===15);
    const navigate = label => [...d.querySelectorAll('nav button')].find(b => b.textContent.includes(label)).click();
    navigate('每月帳務');
    await wait(() => d.querySelector('.billing-native')?.textContent.includes('已讀取 15 筆帳務'));
    assert.equal(d.querySelector('#month').options.length, 12);
    const month = d.querySelector('#month'); month.value = '11'; month.dispatchEvent(new w.Event('change', { bubbles: true }));
    await wait(() => d.querySelector('.billing-native')?.textContent.includes('11 月｜已讀取'));
    const noticeLink = d.querySelector('.billing-native a[href*="notice.html"]');
    assert(noticeLink.href.startsWith(base + 'notice.html?'));
    navigate('收租統計');
    await wait(() => d.querySelectorAll('.room-year-card').length === 15);
    assert.equal(d.querySelector('#workspace-error').hidden, true);
    const select=d.querySelector('[aria-label="選擇房產"]');assert.equal(select.options.length,2);select.value='p-00000000-0000-4000-8000-000000000002';select.dispatchEvent(new w.Event('change',{bubbles:true}));navigate('房間總覽');await wait(()=>d.querySelectorAll('.room-card').length===2);assert(d.querySelector('.room-card').textContent.includes('601'));assert(!d.querySelector('.room-card').textContent.includes('401'));assert.equal((await rpc('saveRentalProperty',['workspace','default','','changed','',0],'tenant')).response.status,403);

    assert.deepEqual(networkApi, [], 'No API calls should reach even the static host');
    assert.deepEqual(errors, []);
    assert(!fs.readFileSync('public/index.html', 'utf8').includes('pages-demo.js'));
    assert(!fs.existsSync(path.join(root, 'downloads')));
    assert(!fs.existsSync(path.join(root, 'apps-script')));
    assert(!fs.existsSync(path.join(root, '.env')));
    const noticeHtml = fs.readFileSync(path.join(root, 'notice.html'), 'utf8');
    assert(noticeHtml.indexOf('pages-demo.js') < noticeHtml.indexOf('billing-transport.js'));
    assert(!noticeHtml.includes('href="/'));
    console.log('PASS: Pages project subpath, actual Vue boot/navigation, 15 fake rooms, 12 months, zero rent, FIFO report fixtures, odd-month notice validation, read-only UI, rejected writes/unknown APIs, no API network traffic, no localStorage, isolated production assets.');
  } finally {
    dom?.window.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
