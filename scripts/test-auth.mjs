import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {authenticate,verifyAccessToken,handleAuthRoute} from '../worker/auth.mjs';
import {canPerform,ACTION_PERMISSIONS} from '../worker/permissions.mjs';
import {handleApi} from '../worker/api.mjs';
import externalWorker from '../worker/cloudflare.mjs';
globalThis.crypto??=webcrypto;
const origin='https://rental.real-domain.test',aud='a'.repeat(64),issuer='https://rental-auth-test.cloudflareaccess.com';
const base={AUTH_MODE:'cloudflare-access',PUBLIC_ORIGIN:origin,ACCESS_TEAM_DOMAIN:'rental-auth-test.cloudflareaccess.com',ACCESS_AUD:aud,MANAGER_EMAILS:'owner@example.test',VIEWER_EMAILS:'viewer@example.test',RENTAL_APPS_SCRIPT_URL:'https://script.google.com/macros/s/TEST/exec',RENTAL_BRIDGE_SECRET:'a'.repeat(64)};
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='test-key';jwk.alg='RS256';jwk.use='sig';
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
async function token(email='viewer@example.test',patch={},header={}){const now=Math.floor(Date.now()/1000),h=encode({alg:'RS256',kid:'test-key',...header}),p=encode({iss:issuer,aud:[aud],iat:now,exp:now+3600,sub:'user-1',email,type:'app',...patch}),input=h+'.'+p,signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(input));return input+'.'+Buffer.from(signature).toString('base64url');}
let certificates=0,googleCalls=0;
const fetchMock=async(url,options)=>{if(url===issuer+'/cdn-cgi/access/certs'){
  // Workers rejects this mode before sending a request; Node's fetch accepts it.
  if(options.redirect==='error')throw new TypeError('Unsupported redirect mode: error');
  assert.equal(options.redirect,'manual','Never follow certificate redirects');
  certificates++;return new Response(JSON.stringify({keys:[jwk]}),{headers:{'content-type':'application/json'}});
}assert(url.startsWith('https://script.google.com/'));googleCalls++;const envelope=JSON.parse(options.body);assert(envelope.signature);return new Response(JSON.stringify({ok:true,data:[{room:'401'}]}),{headers:{'content-type':'application/json'}});};
const req=(path,credential,{method='GET',body,headers={}}={})=>new Request(origin+path,{method,headers:{...(credential?{'cf-access-jwt-assertion':credential}:{}),origin,'content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
const viewer=await token(),manager=await token('OWNER@example.test');
const logoArgs=['data:image/png;base64,'+'A'.repeat(100000),''];
assert.equal((await handleApi(req('/api/tenant-rpc',viewer,{method:'POST',body:{action:'getWorkspaceLogo',args:[]}}),base,fetchMock)).status,200);
const beforeLogo=googleCalls;
assert.equal((await handleApi(req('/api/tenant-rpc',viewer,{method:'POST',body:{action:'saveWorkspaceLogo',args:logoArgs}}),base,fetchMock)).status,403);assert.equal(googleCalls,beforeLogo);
assert.equal((await handleApi(req('/api/tenant-rpc',manager,{method:'POST',body:{action:'saveWorkspaceLogo',args:logoArgs}}),base,fetchMock)).status,200);
assert.equal((await handleApi(req('/api/tenant-rpc',manager,{method:'POST',body:{action:'getTenantData',args:[],padding:'x'.repeat(17000)}}),base,fetchMock)).status,413);
assert.equal((await handleApi(req('/api/tenant-rpc',manager,{method:'POST',body:{action:'saveWorkspaceLogo',args:['data:image/svg+xml;base64,AAAA','']}}),base,fetchMock)).status,400);
assert.equal((await authenticate(req('/',viewer),base,fetchMock)).role,'viewer');assert.equal((await authenticate(req('/',manager),base,fetchMock)).role,'manager');assert.equal(certificates,1);
// Failed/redirected certificate responses never authenticate, follow a redirect,
// leak their response body or poison the cache for a later valid response.
for(const [index,reply] of [
 ...[301,302,303,307,308,401,500].map(status=>()=>new Response('upstream-private-detail',{status,headers:{location:'https://untrusted.test/certs'}})),
 ()=>new Response('not JSON'),()=>new Response('x'.repeat(131073)),
 ()=>new Response('{}'),()=>new Response(JSON.stringify({keys:Array(21).fill(jwk)})),
 ()=>{throw new TypeError('upstream-private-detail');}
].entries()){
 const domain='cert-failure-'+index+'.cloudflareaccess.com',testIssuer='https://'+domain;
 const testEnv={...base,ACCESS_TEAM_DOMAIN:domain},credential=await token('viewer@example.test',{iss:testIssuer});
 let calls=0;
 const response=await handleAuthRoute(req('/api/session',credential),testEnv,async(url,options)=>{
  calls++;assert.equal(url,testIssuer+'/cdn-cgi/access/certs');assert.equal(options.redirect,'manual');return reply();
 }),body=await response.json();
 assert.equal(calls,1);assert.equal(response.status,503);assert.equal(body.error.code,'AUTH_UNAVAILABLE');
 assert(body.error.message.includes('驗證公鑰'));assert.equal(response.headers.get('cache-control'),'private, no-store');
 for(const secret of ['upstream-private-detail','untrusted.test',credential,base.RENTAL_BRIDGE_SECRET])assert(!JSON.stringify(body).includes(secret));
 const recovered=await handleAuthRoute(req('/api/session',credential),testEnv,async()=>new Response(JSON.stringify({keys:[jwk]})));
 assert.equal(recovered.status,200,'Failed JWKS must not be cached');
}
for(const [action,permission] of Object.entries(ACTION_PERMISSIONS)){assert.equal(canPerform({role:'viewer'},action),permission==='read');assert.equal(canPerform({role:'manager'},action),true);}assert(!canPerform({role:'manager'},'futureUndeclaredDelete'));assert(!canPerform({role:'unknown'},'getTenantData'));
let r=await handleApi(req('/api/tenant-rpc',viewer,{method:'POST',body:{action:'getTenantData',args:[]}}),base,fetchMock);assert.equal(r.status,200);const before=googleCalls;
for(const [action,args] of [['syncTenantBillingNames',['401','tenant-version','preview-version',[{year:2026,month:10}]]],['saveTenantChanges',['401',{name:'no'},'version']],['checkoutTenant',['401','version']],['saveRoomSetting',['add','601','','套房','']],['saveTenantField',['401','phone','01234','']],['saveTenantField',['401','identity','管理人','學生']],['saveTenantNote',['401','note','']],['saveTenantContract',['401','',[]]],['saveMonthlyAccountField',[2026,11,'401','receiptConfirmed','是','']],['saveRoomPaymentPhotoSelection',[2026,11,'401',[],'']],['initializeMonthlyAccounts',[2026,11]],['createMonthlyAccountsSheet',[2026,12]]]){r=await handleApi(req('/api/'+(action.startsWith('saveTenant')||['syncTenantBillingNames','checkoutTenant','saveRoomSetting'].includes(action)?'tenant':'billing')+'-rpc',viewer,{method:'POST',body:{action,args}}),base,fetchMock);assert.equal(r.status,403,action);}assert.equal(googleCalls,before,'viewer must never reach Google for a write');
assert.equal((await handleApi(req('/api/tenant-rpc',manager,{method:'POST',body:{action:'syncTenantBillingNames',args:['401','tenant-version','preview-version',[{year:2026,month:10}]]}}),base,fetchMock)).status,200);
const beforeInvalidSelection=googleCalls;for(const periods of [[],[{year:2026,month:13}],[{year:2026,month:10,room:'402'}]])assert.equal((await handleApi(req('/api/tenant-rpc',manager,{method:'POST',body:{action:'syncTenantBillingNames',args:['401','tenant-version','preview-version',periods]}}),base,fetchMock)).status,400);assert.equal(googleCalls,beforeInvalidSelection);
r=await handleApi(req('/api/tenant-rpc',manager,{method:'POST',body:{action:'saveTenantNote',args:['401','memo','']}}),base,fetchMock);assert.equal(r.status,200);
for(const bad of [await token('viewer@example.test',{exp:Math.floor(Date.now()/1000)-1}),await token('viewer@example.test',{aud:['other']}),await token('viewer@example.test',{iss:'https://evil.test'}),await token('viewer@example.test',{nbf:Math.floor(Date.now()/1000)+120}),await token('viewer@example.test',{type:'service'}),await token('viewer@example.test',{}, {alg:'HS256'}),viewer.slice(0,-8)+'AAAAAAAA']){await assert.rejects(()=>verifyAccessToken(bad,base,fetchMock));}
await assert.rejects(()=>authenticate(req('/',awaitPromiseNoToken()),base,fetchMock));
function awaitPromiseNoToken(){return null;}
await assert.rejects(()=>authenticate(req('/',null,{headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'}}),base,fetchMock));
await assert.rejects(()=>authenticate(new Request('https://bypass.workers.dev/api/session',{headers:{'cf-access-jwt-assertion':manager}}),base,fetchMock));
await assert.rejects(()=>authenticate(req('/',viewer),{...base,VIEWER_EMAILS:''},fetchMock),e=>e.status===403);
await assert.rejects(()=>authenticate(req('/',null),{},fetchMock),e=>e.status===503);
const sites={AUTH_MODE:'sites',MANAGER_EMAILS:'owner@example.test',VIEWER_EMAILS:'viewer@example.test'};
assert.equal((await authenticate(req('/',null,{headers:{'oai-authenticated-user-id':'site-id','oai-authenticated-user-email':'owner@example.test'}}),sites,fetchMock)).role,'manager');
await assert.rejects(()=>authenticate(req('/',null,{headers:{'oai-authenticated-user-id':'unlisted','oai-authenticated-user-email':'other@example.test'}}),sites,fetchMock));
r=await handleAuthRoute(req('/api/session',viewer),base,fetchMock);const session=await r.json();assert(session.data.authenticated);assert.equal(session.data.canWrite,false);assert(!JSON.stringify(session).includes(viewer));assert(!session.data.id);
r=await handleAuthRoute(req('/auth/logout',viewer,{method:'POST'}),base,fetchMock);assert.equal(r.status,303);assert.equal(r.headers.get('location'),origin+'/cdn-cgi/access/logout');
assert.equal((await handleAuthRoute(req('/auth/logout',viewer),base,fetchMock)).status,403);
assert.equal((await handleAuthRoute(req('/auth/logout',viewer,{method:'POST',headers:{origin:'https://evil.test'}}),base,fetchMock)).status,403);
r=await handleAuthRoute(req('/auth/login?returnTo=https://evil.test',null),base,fetchMock);assert.equal(r.headers.get('location'),origin+'/');
assert.equal((await externalWorker.fetch(req('/api/session',null),{AUTH_MODE:'sites'})).status,503);
// Diagnose runtime setup before contacting either identity certificates or Google.
const neverFetch=()=>{throw Error('Invalid configuration must stop before network access')};
for(const path of ['/api/session','/auth/login']){
 for(const [key,value] of [['PUBLIC_ORIGIN',''],['PUBLIC_ORIGIN',origin+'/'],['PUBLIC_ORIGIN',' '+origin],['ACCESS_TEAM_DOMAIN',''],['ACCESS_TEAM_DOMAIN',issuer],['ACCESS_TEAM_DOMAIN',issuer+'/cdn-cgi/access/certs'],['ACCESS_AUD',''],['ACCESS_AUD','not an AUD']]){
  const response=await handleAuthRoute(req(path,null),{...base,[key]:value},neverFetch),body=await response.json();
  assert.equal(response.status,503);assert.equal(body.error.code,'AUTH_CONFIG');assert.deepEqual(body.error.invalidSettings,[key]);assert(body.error.message.includes(key));assert(!JSON.stringify(body).includes(base.RENTAL_BRIDGE_SECRET));assert(!JSON.stringify(body).includes(base.RENTAL_APPS_SCRIPT_URL));
 }
 const response=await handleAuthRoute(req(path,null),{AUTH_MODE:'cloudflare-access'},neverFetch),body=await response.json();
 assert.deepEqual(body.error.invalidSettings,['PUBLIC_ORIGIN','ACCESS_TEAM_DOMAIN','ACCESS_AUD']);assert.equal(response.headers.get('cache-control'),'private, no-store');
}
const require=createRequire(import.meta.url),{validate}=require('./preflight-cloudflare.cjs');const config=JSON.parse(fs.readFileSync('deploy/cloudflare.example.json'));assert(validate(config).length>0);Object.assign(config.vars,base,{MANAGER_EMAILS:'owner@real-domain.test',VIEWER_EMAILS:'viewer@real-domain.test'});config.routes=[{pattern:new URL(origin).hostname,custom_domain:true}];assert.deepEqual(validate(config),[]);config.vars.AUTH_MODE='sites';assert(validate(config).length>0);
console.log('PASS: real RSA signatures, JWKS caching, expiry/issuer/AUD/algorithm/forged-header rejection, manager/viewer per-action enforcement before Google, revoked roles, session metadata, logout CSRF, safe login redirects, external fail-closed config.');
