import {authenticate,authenticationFailure} from './auth.mjs';
import {canPerform} from './permissions.mjs';
/** Server-only Google gateway. Browser requests never receive the shared key. */
const TENANT_ACTIONS = new Set(['getTenantData', 'saveTenantField', 'saveTenantNote', 'saveTenantContract']);
const BILLING_ACTIONS = new Set(['getRentalSiteCapabilities', 'getAvailableBillingYears', 'getAvailableBillingMonths', 'getMonthlyAccounts', 'saveMonthlyAccountField', 'previewMonthlyInitialization', 'initializeMonthlyAccounts', 'previewMonthlyAccountsSheetCreation', 'createMonthlyAccountsSheet', 'getMonthlyPaymentPhotos', 'getRoomPaymentPhotoSelection', 'saveRoomPaymentPhotoSelection', 'getPaymentPhoto', 'getMeterPhoto', 'getRoomNoticeData']);
const MAX_BODY = 16000;
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'private, no-store',
  'x-content-type-options': 'nosniff',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
const fail = (code, message, status) => json({ ok: false, error: { code, message } }, status);

function configuration(env) {
  const endpoint = env.RENTAL_APPS_SCRIPT_URL || '';
  const secret = env.RENTAL_BRIDGE_SECRET || '';
  return { endpoint, secret, ready: /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint) && /^[a-f0-9]{64}$/i.test(secret) };
}

/** Never select a backend function supplied by the browser without validation. */
export function validCall(action, args) {
  if (!Array.isArray(args)) return false;
  const text = (value, max = 2000) => typeof value === 'string' && value.length <= max;
  const room = value => typeof value === 'string' && /^\d{3,8}$/.test(value);
  const year = value => ['number', 'string'].includes(typeof value) && /^\d{4}$/.test(String(value));
  const month = value => ['number', 'string'].includes(typeof value) && Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 12;
  const expected = value => value === null || (typeof value === 'number' && Number.isFinite(value)) || text(value);
  const file = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value);
  const leaseDate = value => value === '' || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  if (['getTenantData', 'getRentalSiteCapabilities', 'getAvailableBillingYears'].includes(action)) return args.length === 0;
  if (action === 'saveTenantField') return args.length === 4 && room(args[0]) &&
    ['name','phone','startDate','endDate','rent','cohabitant','cohabitantPhone','emergencyContact','emergencyPhone','introduction','maintenance','defaultTransferLastFive','student','roomType','initialMeterReading','contractDate'].includes(args[1]) && text(args[2]) && expected(args[3]) &&
    (args[1] !== 'roomType' || (['','套房','雅房'].includes(args[2]) && ['','套房','雅房'].includes(args[3]))) &&
    (args[1] !== 'contractDate' || leaseDate(args[2]) && leaseDate(args[3])) &&
    (args[1] !== 'initialMeterReading' || (args[2] === '' || /^\d+(?:\.\d+)?$/.test(args[2]) && Number(args[2])<=100000000) && (args[3] === null || typeof args[3] === 'number' && Number.isFinite(args[3]) && args[3]>=0 && args[3]<=100000000));
  if (action === 'saveTenantNote') return args.length === 3 && room(args[0]) && text(args[1]) && text(args[2]);
  if (action === 'saveTenantContract') return args.length === 3 && room(args[0]) && text(args[1]) && Array.isArray(args[2]) && args[2].length <= 20 && args[2].every(v => text(v));
  if (!year(args[0])) return false;
  if (action === 'getAvailableBillingMonths') return args.length === 1;
  if (!month(args[1])) return false;
  if (['getMonthlyAccounts','previewMonthlyInitialization','initializeMonthlyAccounts','previewMonthlyAccountsSheetCreation','createMonthlyAccountsSheet','getMonthlyPaymentPhotos'].includes(action)) return args.length === 2;
  if (action === 'getPaymentPhoto') return args.length === 3 && file(args[2]);
  if (!room(args[2])) return false;
  if (['getMeterPhoto','getRoomNoticeData'].includes(action)) return args.length === 3 && Number(args[1]) % 2 === 1;
  if (action === 'getRoomPaymentPhotoSelection') return args.length === 3;
  if (action === 'saveMonthlyAccountField') return args.length === 6 &&
    ['transferDate','transferLastFive','notes','currentReadingDate','currentReading','actualPaid','receiptConfirmed'].includes(args[3]) &&
    (!['currentReadingDate','currentReading'].includes(args[3]) || Number(args[1]) % 2 === 1) && text(args[4]) && expected(args[5]);
  if (action === 'saveRoomPaymentPhotoSelection') return args.length === 5 && Array.isArray(args[3]) && args[3].length <= 20 &&
    args[3].every(file) && new Set(args[3]).size === args[3].length && text(args[4], 12000);
  return false;
}

export async function signPayload(payload, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** Only follow ContentService's one-time content URL, never login/arbitrary redirects. */
async function callGoogle(endpoint, body, fetchImpl, maxBytes) {
  const signal = AbortSignal.timeout(35000);
  let response = await fetchImpl(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body, redirect: 'manual', signal });
  console.info('rental-google-response', { stage: 'execute', status: response.status });
  for (let i = 0; i < 3 && [301, 302, 303, 307, 308].includes(response.status); i++) {
    const location = new URL(response.headers.get('location') || '', endpoint);
    console.info('rental-google-redirect', { host: location.hostname });
    if (location.protocol !== 'https:' || location.hostname !== 'script.googleusercontent.com') throw new Error('GOOGLE_DEPLOYMENT');
    // Google redirects only the output retrieval; do not forward the signed POST body.
    response = await fetchImpl(location.href, { method: 'GET', redirect: 'manual', signal });
    console.info('rental-google-response', { stage: 'content', status: response.status, json: Boolean(response.headers.get('content-type')?.includes('application/json')) });
  }
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('GOOGLE_DEPLOYMENT');
  const text = await response.text();
  if (text.length > maxBytes) throw new Error('INVALID_RESPONSE');
  return JSON.parse(text);
}

export async function handleApi(request, env, fetchImpl = fetch) {
  const path = new URL(request.url).pathname;
  let principal;
  try { principal=await authenticate(request,env,fetchImpl); } catch(error) { return authenticationFailure(error,env); }
  const config = configuration(env);
  if (path === '/api/connection') {
    if (request.method !== 'GET') return fail('METHOD', '不支援此操作。', 405);
    return json({ ok: true, data: { configured: config.ready, scope: 'tenants-and-billing', source: 'google' } });
  }
  if (!['/api/tenant-rpc','/api/billing-rpc'].includes(path)) return fail('NOT_FOUND', '找不到此操作。', 404);
  if (request.method !== 'POST') return fail('METHOD', '不支援此操作。', 405);
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return fail('ORIGIN', '請從原網站操作。', 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return fail('FORMAT', '資料格式不正確。', 400);
  if (!config.ready) return fail('NOT_CONFIGURED', '尚未設定 Google 連線。請先完成轉接程式與網站設定。', 503);
  if (Number(request.headers.get('content-length')) > MAX_BODY) return fail('SIZE', '資料過長。', 413);
  let call;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return fail('SIZE', '資料過長。', 413);
    call = JSON.parse(raw);
  } catch { return fail('FORMAT', '資料格式不正確。', 400); }
  if (!(path === '/api/tenant-rpc' ? TENANT_ACTIONS : BILLING_ACTIONS).has(call?.action) || !validCall(call?.action, call?.args)) return fail('ACTION', '不支援此欄位或資料格式。', 400);
  if (!canPerform(principal,call.action)) return fail('FORBIDDEN', '目前為檢視者，無法新增、修改或刪除資料。',403);
  const payload = JSON.stringify({ version: 1, id: crypto.randomUUID(), issuedAt: Date.now(), action: call.action, args: call.args });
  try {
    const large = ['getPaymentPhoto','getMeterPhoto','getRoomNoticeData'].includes(call.action);
    const result = await callGoogle(config.endpoint, JSON.stringify({ payload, signature: await signPayload(payload, config.secret) }), fetchImpl, (large ? 12 : 1) * 1024 * 1024);
    if (typeof result?.ok !== 'boolean') throw new Error('INVALID_RESPONSE');
    if (!result.ok) {
      const codes = ['AUTH', 'REPLAY', 'CONFIG', 'BUSINESS'];
      if (call.action === 'getRentalSiteCapabilities' && result.error?.code === 'AUTH') return fail('BRIDGE_UPDATE_REQUIRED', '請更新 Rent_Demo 的 SiteBridge.gs 並部署新版本；現有房客連線可繼續使用。', 426);
      const code = codes.includes(result.error?.code) ? result.error.code : 'UPSTREAM';
      return fail(code, code === 'BUSINESS' && typeof result.error?.message === 'string' ? result.error.message.slice(0, 400) : 'Google 連線驗證失敗，請核對轉接設定。', code === 'BUSINESS' ? 409 : 502);
    }
    return json({ ok: true, data: result.data });
  } catch (error) {
    // Only fixed diagnostic categories; never log URLs, signed bodies or tenant data.
    const category = ['GOOGLE_DEPLOYMENT', 'INVALID_RESPONSE'].includes(error?.message)
      ? error.message : error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
    console.error('rental-google-failure', { action: call.action, category });
    // Never automatically retry a write with an unknown result.
    return fail('GOOGLE_UNAVAILABLE', !['saveTenantField','saveTenantNote','saveTenantContract','saveMonthlyAccountField','saveRoomPaymentPhotoSelection','initializeMonthlyAccounts','createMonthlyAccountsSheet'].includes(call.action) ? 'Google 暫時無法讀取，請稍後再試。' : '未收到儲存結果，請重新讀取確認後再操作，避免重複寫入。', 502);
  }
}
