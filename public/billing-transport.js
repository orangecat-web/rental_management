/** Same-origin transport for the original Site; private data stays in memory. */
(() => {
  const allowed = new Set(['ensureAnnualAccounts','getRentalSiteCapabilities','getXingwuCollectionReport', 'getRentalSiteCapabilities', 'getAvailableBillingYears', 'getAvailableBillingMonths', 'getMonthlyAccounts', 'saveMonthlyAccountField', 'previewMonthlyInitialization', 'initializeMonthlyAccounts', 'previewMonthlyAccountsSheetCreation', 'createMonthlyAccountsSheet', 'getMonthlyPaymentPhotos', 'getRoomPaymentPhotoSelection', 'saveRoomPaymentPhotoSelection', 'getPaymentPhoto', 'getMeterPhotoReference','getMeterPhoto', 'getRoomNoticeData']);
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
    if (!response.ok || !result.ok) throw new Error(typeof result.error?.message === 'string' ? result.error.message : '資料處理失敗，請重新讀取確認。');
    return result;
  }
  function runner(success = () => {}, failure = () => {}) {
    const chain = {
      withSuccessHandler(callback) { return runner(callback, failure); },
      withFailureHandler(callback) { return runner(success, callback); },
    };
    for (const action of allowed) chain[action] = async (...args) => {
      try {
        const response = await fetch('/api/billing-rpc', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'accept':'application/json', 'content-type': 'application/json', 'x-requested-with':'XMLHttpRequest' },
          body: JSON.stringify({ action, args, propertyId:window.RentalPropertyContext?.id||new URLSearchParams(location.search).get('property')||'default' }),
        }).catch(() => {throw responseError('NETWORK', action);});
        const result = await readResponse(response, action);
        success(result.data);
      } catch (error) { failure(error); }
    };
    return chain;
  }
  // Compatibility transport keeps the previously tested field editors unchanged.
  window.google = { script: {} };
  Object.defineProperty(window.google.script, 'run', { get: () => runner() });
  function reportState() {
    const dirty = !!document.querySelector('.draft-notice, [data-rental-busy="true"]');
    window.parent.postMessage({ type: 'rental-billing-frame', dirty }, location.origin);
  }
  addEventListener('DOMContentLoaded', () => {
    new MutationObserver(reportState).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-rental-busy'] });
    reportState();
  });
})();
