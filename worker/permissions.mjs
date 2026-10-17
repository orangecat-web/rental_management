/** Default-deny authorization. Every future RPC must declare its permission here. */
export const ACTION_PERMISSIONS = Object.freeze({
  getTenantData:'read', saveTenantField:'write', saveTenantNote:'write', saveTenantContract:'write',
  getRentalSiteCapabilities:'read', getAvailableBillingYears:'read', getAvailableBillingMonths:'read', getMonthlyAccounts:'read',
  saveMonthlyAccountField:'write', previewMonthlyInitialization:'read', initializeMonthlyAccounts:'write',
  previewMonthlyAccountsSheetCreation:'read', createMonthlyAccountsSheet:'write',
  getMonthlyPaymentPhotos:'read', getRoomPaymentPhotoSelection:'read', saveRoomPaymentPhotoSelection:'write',
  getPaymentPhoto:'read', getMeterPhoto:'read', getRoomNoticeData:'read'
});
export function roleForEmail(email,env){
  const list=key=>String(env[key]||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  const normalized=String(email||'').trim().toLowerCase();
  if(!normalized)return null;
  if(list('MANAGER_EMAILS').includes(normalized))return 'manager';
  if(list('VIEWER_EMAILS').includes(normalized))return 'viewer';
  return null;
}
export const canPerform=(principal,action)=>Boolean(principal&&['manager','viewer'].includes(principal.role)&&ACTION_PERMISSIONS[action]&&(ACTION_PERMISSIONS[action]==='read'||principal.role==='manager'));
