/** Same-origin transport for the original Site; private data stays in memory. */
(() => {
  const allowed = new Set(['getXingwuCollectionReport', 'getRentalSiteCapabilities', 'getAvailableBillingYears', 'getAvailableBillingMonths', 'getMonthlyAccounts', 'saveMonthlyAccountField', 'previewMonthlyInitialization', 'initializeMonthlyAccounts', 'previewMonthlyAccountsSheetCreation', 'createMonthlyAccountsSheet', 'getMonthlyPaymentPhotos', 'getRoomPaymentPhotoSelection', 'saveRoomPaymentPhotoSelection', 'getPaymentPhoto', 'getMeterPhotoReference','getMeterPhoto', 'getRoomNoticeData']);
  function runner(success = () => {}, failure = () => {}) {
    const chain = {
      withSuccessHandler(callback) { return runner(callback, failure); },
      withFailureHandler(callback) { return runner(success, callback); },
    };
    for (const action of allowed) chain[action] = async (...args) => {
      try {
        const response = await fetch('/api/billing-rpc', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'content-type': 'application/json', 'x-requested-with':'XMLHttpRequest' },
          body: JSON.stringify({ action, args, propertyId:window.RentalPropertyContext?.id||new URLSearchParams(location.search).get('property')||'default' }),
        });
        const result = await response.json();
        if (!response.ok || result.ok !== true) throw new Error(result.error?.message || '資料處理失敗，請重新讀取。');
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
