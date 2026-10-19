/** Same-origin transport for the original Site; private data stays in memory. */
(() => {
  const allowed = new Set(['getRoomSettings','saveTenantChanges','checkoutTenant','saveRoomSetting','getTenantData', 'saveTenantField', 'saveTenantNote', 'saveTenantContract']);
  function runner(success = () => {}, failure = () => {}) {
    const chain = {
      withSuccessHandler(callback) { return runner(callback, failure); },
      withFailureHandler(callback) { return runner(success, callback); },
    };
    for (const action of allowed) chain[action] = async (...args) => {
      try {
        const response = await fetch('/api/tenant-rpc', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, args }),
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
    const dirty = !!document.querySelector('.draft-notice');
    window.parent.postMessage({ type: 'rental-tenant-frame', dirty }, location.origin);
  }
  addEventListener('DOMContentLoaded', () => {
    new MutationObserver(reportState).observe(document.body, { subtree: true, childList: true, characterData: true });
    reportState();
  });
})();
