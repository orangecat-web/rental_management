/** Private same-origin RPC. Only memory holds returned tenant and account records. */
window.RentalTransport = function (scope) {
  const allowed = scope === 'tenant'
    ? new Set(['getRoomSettings','saveTenantChanges','checkoutTenant','saveRoomSetting','getTenantData', 'saveTenantField', 'saveTenantNote', 'saveTenantContract'])
    : new Set(['getAvailableBillingYears', 'getAvailableBillingMonths', 'getMonthlyAccounts', 'saveMonthlyAccountField', 'previewMonthlyInitialization', 'initializeMonthlyAccounts', 'previewMonthlyAccountsSheetCreation', 'createMonthlyAccountsSheet', 'getMonthlyPaymentPhotos', 'getRoomPaymentPhotoSelection', 'saveRoomPaymentPhotoSelection', 'getPaymentPhoto', 'getMeterPhoto', 'getRoomNoticeData']);
  function runner(success = () => {}, failure = () => {}) {
    const chain = { withSuccessHandler: callback => runner(callback, failure), withFailureHandler: callback => runner(success, callback) };
    for (const action of allowed) chain[action] = async (...args) => {
      try {
        if(window.RentalAccess&&!RentalAccess.canWrite&&!RentalAccess.isReadAction(action))throw Error('目前為檢視者，無法新增、修改或刪除資料。');
        const response = await fetch('/api/' + (scope === 'tenant' ? 'tenant' : 'billing') + '-rpc', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'content-type': 'application/json', 'x-requested-with':'XMLHttpRequest' }, body: JSON.stringify({ action, args })
        });
        if(window.RentalAccess)RentalAccess.noteFailure(response.status);
        const result = await response.json();
        if (!response.ok || result.ok !== true) throw Error(result.error?.message || '未收到正確回應，請重新讀取確認。');
        success(result.data);
      } catch (error) { failure(error); }
    }; return chain;
  }
  const script = {}; Object.defineProperty(script, 'run', { get: () => runner() });
  return { script };
};
