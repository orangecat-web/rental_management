/** Private same-origin RPC. Only memory holds returned tenant and account records. */
window.RentalTransport = function (scope) {
  const allowed = scope === 'tenant'
    ? new Set(['getWorkspaceLogo','saveWorkspaceLogo','previewAnnualCheckout','confirmAnnualCheckout','previewTenantMoveIn','confirmTenantMoveIn','previewTenantBillingNames','syncTenantBillingNames','getRentalProperties','saveRentalProperty','saveTenantChanges','previewTenantCheckout','checkoutTenant','getRoomSetupState','confirmRoomSetup','getRoomSettings','saveRoomSetting', 'getTenantData', 'saveTenantField', 'saveTenantNote', 'saveTenantContract'])
    : new Set(['getExpenseYears','getExpenses','getExpenseReceipt','saveExpense','ensureAnnualAccounts','getRentalSiteCapabilities','getXingwuCollectionReport', 'getAvailableBillingYears', 'getAvailableBillingMonths', 'getMonthlyAccounts', 'saveMonthlyAccountField', 'previewMonthlyInitialization', 'initializeMonthlyAccounts', 'previewMonthlyAccountsSheetCreation', 'createMonthlyAccountsSheet', 'getMonthlyPaymentPhotos', 'getRoomPaymentPhotoSelection', 'saveRoomPaymentPhotoSelection', 'getPaymentPhoto', 'getMeterPhotoReference','getMeterPhoto', 'getRoomNoticeData']);
  // Never surface response bodies/URLs or parser snippets: they may contain private data.
  const readAction = action => /^(get|preview)/.test(action);
  function responseError(code, action, status = 0) {
    const messages = {
      AUTH_REQUIRED: '登入狀態已失效，請重新登入；尚未儲存的輸入仍保留在此畫面。',
      FORBIDDEN: '帳號權限或安全驗證未通過，請確認登入狀態後再試；尚未儲存的輸入仍保留。',
      RATE_LIMITED: '服務請求較多，請稍後按「重新讀取」。',
      SERVICE_UNAVAILABLE: '服務暫時無法回應，請稍後按「重新讀取」。',
      INVALID_RESPONSE: '服務未傳回正確資料格式，請稍後按「重新讀取」。',
      NETWORK: '連線中斷或逾時，請稍後按「重新讀取」。'
    };
    const suffix = readAction(action) ? '' : ' 未收到可確認的操作結果，請先重新讀取核對，勿重複送出。';
    return Object.assign(new Error(messages[code] + suffix), {code, status});
  }
  async function readResponse(response, action) {
    let loginRedirect = response.type === 'opaqueredirect';
    if (response.redirected && response.url) {
      try {const u = new URL(response.url, location.href);loginRedirect ||= /\/(?:cdn-cgi\/access|auth\/login)(?:\/|$)/.test(u.pathname) || /(?:^|\.)(?:cloudflareaccess\.com|accounts\.google\.com)$/.test(u.hostname);} catch {}
    }
    const status = response.status || 0;
    const authStatus = status === 401 || loginRedirect ? 401 : status === 403 ? 403 : 0;
    if (authStatus) {window.RentalAccess?.noteFailure?.(authStatus);throw responseError(authStatus === 401 ? 'AUTH_REQUIRED' : 'FORBIDDEN', action, status);}
    window.RentalAccess?.noteFailure?.(status);
    if (status === 429) throw responseError('RATE_LIMITED', action, status);
    if (status >= 500) throw responseError('SERVICE_UNAVAILABLE', action, status);
    const type = response.headers?.get('content-type')?.split(';')[0].trim().toLowerCase();
    if ((type && !/^application\/(?:[\w.-]+\+)?json$/.test(type)) || response.redirected) throw responseError('INVALID_RESPONSE', action, status);
    let result;
    try {result = await response.json();} catch (error) {throw responseError(['AbortError','TimeoutError'].includes(error?.name) ? 'NETWORK' : 'INVALID_RESPONSE', action, status);}
    if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.ok !== 'boolean') throw responseError('INVALID_RESPONSE', action, status);
    if (!response.ok || !result.ok) throw Object.assign(new Error(typeof result.error?.message === 'string' ? result.error.message : '資料處理失敗，請重新讀取確認。'),{code:action==='saveExpense'&&result.error?.code==='EXPENSE_NOT_SAVED'?'EXPENSE_NOT_SAVED':undefined});
    return result;
  }
  function runner(success = () => {}, failure = () => {}) {
    const chain = { withSuccessHandler: callback => runner(callback, failure), withFailureHandler: callback => runner(success, callback) };
    for (const action of allowed) chain[action] = async (...args) => {
      try {
        if(window.RentalAccess&&!RentalAccess.canWrite&&!RentalAccess.isReadAction(action))throw Error('目前為檢視者，無法新增、修改或刪除資料。');
        const response = await fetch('/api/' + (scope === 'tenant' ? 'tenant' : 'billing') + '-rpc', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'accept':'application/json', 'content-type': 'application/json', 'x-requested-with':'XMLHttpRequest' }, body: JSON.stringify({ action, args, propertyId:window.RentalPropertyContext?.id||new URLSearchParams(location.search).get('property')||'default' })
        }).catch(() => {throw responseError('NETWORK', action);});
        const result = await readResponse(response, action);
        success(result.data);
      } catch (error) { failure(error); }
    }; return chain;
  }
  const script = {}; Object.defineProperty(script, 'run', { get: () => runner() });
  return { script };
};
