/** Default-deny authorization. Every future RPC must declare its permission here. */
export const ACTION_PERMISSIONS = Object.freeze({
  getWorkspaceLogo:'read',saveWorkspaceLogo:'write',ensureAnnualAccounts:'write',previewAnnualCheckout:'read',confirmAnnualCheckout:'write',previewTenantMoveIn:'read',confirmTenantMoveIn:'write',previewTenantBillingNames:'read',syncTenantBillingNames:'write',getRentalProperties:'read',saveRentalProperty:'write',saveTenantChanges:'write',previewTenantCheckout:'read',checkoutTenant:'write',getRoomSetupState:'read',confirmRoomSetup:'write',getRoomSettings:'read',saveRoomSetting:'write',getTenantData:'read', saveTenantField:'write', saveTenantNote:'write', saveTenantContract:'write',
  getXingwuCollectionReport:'read', getRentalSiteCapabilities:'read', getAvailableBillingYears:'read', getAvailableBillingMonths:'read', getMonthlyAccounts:'read',
  saveMonthlyAccountField:'write', previewMonthlyInitialization:'read', initializeMonthlyAccounts:'write',
  previewMonthlyAccountsSheetCreation:'read', createMonthlyAccountsSheet:'write',
  getMonthlyPaymentPhotos:'read', getRoomPaymentPhotoSelection:'read', saveRoomPaymentPhotoSelection:'write',
  getPaymentPhoto:'read', getMeterPhotoReference:'read',getMeterPhoto:'read', getRoomNoticeData:'read'
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
