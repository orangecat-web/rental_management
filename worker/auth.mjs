import {roleForEmail} from './permissions.mjs';
/** Sites retains its native gate. External deployment uses independently verified Cloudflare Access JWTs. */
const keyCache=new Map();
const authError=(code,status=401)=>Object.assign(new Error(code),{code,status});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
function accessConfiguration(env){
  const domain=String(env.ACCESS_TEAM_DOMAIN||'').trim().toLowerCase();
  const aud=String(env.ACCESS_AUD||'').trim();
  let origin;try{const url=new URL(env.PUBLIC_ORIGIN);if(url.protocol==='https:'&&url.origin===env.PUBLIC_ORIGIN)origin=url.origin;}catch{}
  const invalidSettings=[];
  if(!origin)invalidSettings.push('PUBLIC_ORIGIN');
  if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(domain))invalidSettings.push('ACCESS_TEAM_DOMAIN');
  if(!/^[a-zA-Z0-9_-]{20,200}$/.test(aud))invalidSettings.push('ACCESS_AUD');
  if(invalidSettings.length)throw Object.assign(authError('AUTH_CONFIG',503),{invalidSettings});
  return {issuer:'https://'+domain,aud,origin};
}
function decodePart(part){
  if(!/^[A-Za-z0-9_-]+$/.test(part))throw authError('AUTH_INVALID');
  const binary=atob(part.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-part.length%4)%4));
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
/** Fixed RS256 algorithm, trusted issuer URL, application AUD, expiry and human identity. */
export async function verifyAccessToken(token,env,fetchImpl=fetch){
  const config=accessConfiguration(env),now=Math.floor(Date.now()/1000);
  if(typeof token!=='string'||token.length>16384)throw authError('AUTH_REQUIRED');
  const parts=token.split('.');if(parts.length!==3)throw authError('AUTH_INVALID');
  let header,claims;try{header=JSON.parse(new TextDecoder().decode(decodePart(parts[0])));claims=JSON.parse(new TextDecoder().decode(decodePart(parts[1])));}catch{throw authError('AUTH_INVALID');}
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>200||header.crit)throw authError('AUTH_INVALID');
  if(claims.iss!==config.issuer||!Array.isArray(claims.aud)||!claims.aud.includes(config.aud)||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+60||(claims.nbf!==undefined&&(!Number.isFinite(claims.nbf)||claims.nbf>now+60))||claims.type!=='app'||typeof claims.sub!=='string'||!claims.sub||typeof claims.email!=='string'||!/^\S+@\S+\.\S+$/.test(claims.email)||claims.email.length>254)throw authError('AUTH_INVALID');
  let cached=keyCache.get(config.issuer);
  if(!cached||cached.until<=now){
    // Workers does not implement redirect: 'error'. Manual mode plus the status
    // check rejects redirects without following them or trusting another host.
    let response,body;try{response=await fetchImpl(config.issuer+'/cdn-cgi/access/certs',{redirect:'manual',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error();body=await response.text();if(body.length>131072)throw Error();cached={keys:JSON.parse(body).keys,until:now+60};if(!Array.isArray(cached.keys)||cached.keys.length>20)throw Error();}catch{throw authError('AUTH_UNAVAILABLE',503);}
    if(keyCache.size>=4)keyCache.clear();keyCache.set(config.issuer,cached);
  }
  const jwk=cached.keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
  if(!jwk)throw authError('AUTH_INVALID');
  let verified=false;try{const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);verified=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decodePart(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));}catch{}
  if(!verified)throw authError('AUTH_INVALID');
  return {id:claims.sub,email:claims.email.trim().toLowerCase(),provider:'cloudflare-access'};
}
export async function authenticate(request,env,fetchImpl=fetch){
  let identity;
  if(env.AUTH_MODE==='sites'){
    const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');
    if(!id||!email)throw authError('AUTH_REQUIRED');
    identity={id,email:email.trim().toLowerCase(),provider:'sites'};
  }else if(env.AUTH_MODE==='cloudflare-access'){
    const config=accessConfiguration(env);
    if(new URL(request.url).origin!==config.origin)throw authError('AUTH_ORIGIN',403);
    identity=await verifyAccessToken(request.headers.get('cf-access-jwt-assertion'),env,fetchImpl);
  }else throw authError('AUTH_CONFIG',503);
  const role=roleForEmail(identity.email,env);if(!role)throw authError('AUTH_FORBIDDEN',403);
  return {...identity,role,canWrite:role==='manager'};
}
export function authenticationFailure(error,env){
  const status=[401,403,503].includes(error?.status)?error.status:401;
  // Only fixed setting names are public. Never return their values, tokens or secrets.
  const invalidSettings=error?.code==='AUTH_CONFIG'&&Array.isArray(error.invalidSettings)
    ? ['PUBLIC_ORIGIN','ACCESS_TEAM_DOMAIN','ACCESS_AUD'].filter(key=>error.invalidSettings.includes(key)):[];
  const message=invalidSettings.length?'登入設定尚未完成，請在此 Worker 的「設定 → 變數和秘密」核對：'+invalidSettings.join('、')+'。'
    :error?.code==='AUTH_UNAVAILABLE'?'暫時無法取得登入驗證公鑰，請稍後重新整理；若持續發生，請聯絡主要管理人。'
    :status===503?'登入設定尚未完成，請聯絡主要管理人。':status===403?'此帳號尚未授權，請聯絡主要管理人。':'登入已過期或尚未登入，請重新登入。';
  return json({ok:false,error:{code:error?.code||'AUTH_REQUIRED',message,...(invalidSettings.length?{invalidSettings}:{})},auth:{provider:env.AUTH_MODE||'',loginPath:env.AUTH_MODE==='sites'?'/signin-with-chatgpt':'/auth/login'}},status);
}
export async function handleAuthRoute(request,env,fetchImpl=fetch){
  const url=new URL(request.url);
  if(url.pathname==='/api/session'){
    if(request.method!=='GET')return json({ok:false,error:{message:'不支援此操作。'}},405);
    try{const user=await authenticate(request,env,fetchImpl);return json({ok:true,data:{authenticated:true,email:user.email,role:user.role,canWrite:user.canWrite,provider:user.provider,loginPath:env.AUTH_MODE==='sites'?'/signin-with-chatgpt':'/auth/login',logoutPath:env.AUTH_MODE==='sites'?'/signout-with-chatgpt':'/auth/logout'}});}catch(e){return authenticationFailure(e,env);}
  }
  if(url.pathname==='/auth/login'){
    if(request.method!=='GET')return new Response('Method not allowed',{status:405});
    if(env.AUTH_MODE==='sites')return Response.redirect(new URL('/signin-with-chatgpt',url.origin),303);
    try{return Response.redirect(accessConfiguration(env).origin+'/',303);}catch(e){return authenticationFailure(e,env);}
  }
  if(url.pathname==='/auth/logout'){
    if(request.method!=='POST'||request.headers.get('origin')!==url.origin)return new Response('Forbidden',{status:403});
    if(env.AUTH_MODE==='sites')return Response.redirect(new URL('/signout-with-chatgpt',url.origin),303);
    try{const c=accessConfiguration(env);if(url.origin!==c.origin)throw authError('AUTH_ORIGIN',403);return Response.redirect(c.origin+'/cdn-cgi/access/logout',303);}catch(e){return authenticationFailure(e,env);}
  }
  return null;
}
