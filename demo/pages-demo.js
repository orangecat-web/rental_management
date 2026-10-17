/** Loaded only by the separate Pages artifact. Never used by a production Worker. */
(() => {
  const nativeFetch = window.fetch.bind(window);
  const rooms = ['401','402','403','404','405','406','407','501','502','503','504','505','506','507','508'];
  const tenants = rooms.map((room, i) => ({
    room, roomType: i === 14 ? '' : i % 2 === 0 ? '套房' : '雅房', name: '示範房客 ' + String.fromCharCode(65 + i),
    phone: '09000000' + String(i).padStart(2, '0'),
    rent: room === '506' ? 0 : 5800 + (i % 4) * 200,
    student: i % 3 === 0 ? '是' : '', startDate: '2026-01-01', endDate: '2027-12-31',
    notes: '虛構展示資料，非真實房客。', contractLinks: []
  }));
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const date = (year, month) => new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  function accounts(year, month) {
    return tenants.map((t, i) => {
      const odd = month % 2 === 1, usage = 80 + i * 6 + month * 2;
      const previousReading = 1000 + i * 100 + Math.floor(month / 2) * 200;
      const fee = odd ? usage * 5 : 0, totalDue = t.rent + fee;
      const isReceived = (i + month) % 4 !== 0;
      // Independent monthly fixtures: unpaid claims are settled in the following month.
      const priorMonth = month - 1, priorFee = priorMonth % 2 ? (80 + i * 6 + priorMonth * 2) * 5 : 0;
      const arrears = month > 1 && (i + priorMonth) % 4 === 0 ? t.rent + priorFee : 0;
      const netDue = totalDue + arrears, effectivePaid = isReceived ? netDue : 0;
      return {
        year, month, room: t.room, name: t.name, rent: t.rent,
        electricityFee: odd ? fee : null, totalDue, arrears, creditApplied: 0, openingCredit: 0,
        netDue, actualPaid: null, effectivePaid, unpaid: netDue - effectivePaid, overpaid: 0,
        isReceived, receiptConfirmed: isReceived ? '是' : '',
        transferDate: isReceived ? date(year, month).slice(0, 8) + '05' : '',
        transferLastFive: '0' + String(1000 + i), paymentScreenshot: '', notes: '虛構展示帳務',
        paymentStatus: isReceived ? '已收' : '未收',
        meter: odd ? { previousReading, currentReading: previousReading + usage,
          previousReadingDate: date(year, month - 2), currentReadingDate: date(year, month),
          usage, calculatedFee: fee } : null
      };
    });
  }
  function samplePhoto(room) {
    // Draw an explicitly labelled illustration; no real photo is packaged or fetched.
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#edf3e9'; ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = '#294638'; ctx.textAlign = 'center'; ctx.font = 'bold 36px system-ui';
    ctx.fillText(room + ' ROOM / DEMO', 320, 140); ctx.font = '26px system-ui';
    ctx.fillText('電表示意圖・非真實照片', 320, 210);
    return canvas.toDataURL('image/png');
  }
  function rpc(action, args, scope) {
    if (scope === 'tenant' && action === 'getTenantData') return tenants;
    if (scope !== 'billing') throw Error('展示版不提供此操作。');
    if (action === 'getRentalSiteCapabilities') return { version: 2, billing: true };
    if (action === 'getAvailableBillingYears') return [2026];
    const [year, month, room] = args;
    if (year !== 2026) throw Error('展示版提供 2026 年資料。');
    if (action === 'getAvailableBillingMonths') return months;
    if (!Number.isInteger(month) || month < 1 || month > 12) throw Error('月份不正確。');
    if (action === 'getMonthlyAccounts') return accounts(year, month);
    if (action === 'getMonthlyPaymentPhotos') return [];
    if (action === 'getRoomPaymentPhotoSelection' && rooms.includes(room)) return { fileIds: [], value: '' };
    if (action === 'getMeterPhoto' || action === 'getRoomNoticeData') {
      const a = accounts(year, month).find(a => a.room === room);
      if (!a?.meter) throw Error('請選擇單數月份及有效房號。');
      const photo = { found: true, name: room + '-demo.png', readingDate: date(year, month), dataUrl: samplePhoto(room) };
      if (action === 'getMeterPhoto') return photo;
      return { year, month, room, rent: a.rent, arrears: a.arrears, creditApplied: 0, total: a.netDue,
        dueDate: date(year, month).slice(0, 8) + '05', photo,
        electricity: { previousDate: a.meter.previousReadingDate, currentDate: a.meter.currentReadingDate,
          previousReading: a.meter.previousReading, currentReading: a.meter.currentReading,
          usage: a.meter.usage, unitPrice: 5, fee: a.electricityFee } };
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
          const { action, args = [] } = JSON.parse(options.body || '{}');
          if (!Array.isArray(args)) throw Error('參數不正確。');
          return reply({ ok: true, data: rpc(action, args, match[1]) });
        } catch (error) { return reply({ ok: false, error: { message: error.message } }, 403); }
      }
      return reply({ ok: false, error: { message: '展示版不提供此 API。' } }, 403);
    }
    return nativeFetch(input, options);
  };
})();
