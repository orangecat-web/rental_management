const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
(async()=>{
for(const file of ['workspace-transport.js','billing-transport.js']){
 const dom=new JSDOM('<textarea id="draft">未儲存資料</textarea>',{url:'https://rent.test/',runScripts:'outside-only'}),w=dom.window;const notices=[],calls=[];let response;
 w.RentalAccess={canWrite:true,isReadAction:a=>a.startsWith('get'),noteFailure:s=>notices.push(s)};
 w.fetch=async(url,options)=>{calls.push({url,options});if(response instanceof Error)throw response;return response;};w.eval(fs.readFileSync('public/'+file,'utf8'));
 const run=(action='getMonthlyAccounts')=>new Promise(resolve=>{const api=file==='workspace-transport.js'?w.RentalTransport('billing').script.run:w.google.script.run;api.withSuccessHandler(data=>resolve({data})).withFailureHandler(error=>resolve({error}))[action](2026,10);});
 const make=(status=200,type='application/json',body={ok:true,data:0},extra={})=>({ok:status>=200&&status<300,status,headers:{get:()=>type},json:async()=>{if(body instanceof Error)throw body;return body;},...extra});
 response=make();assert.equal((await run()).data,0);assert.equal(calls.at(-1).options.headers.accept,'application/json');
 for(const [r,code] of [[make(200,'text/html',new SyntaxError('SECRET HTML')),'INVALID_RESPONSE'],[make(200,'application/json',new SyntaxError('SECRET JSON')),'INVALID_RESPONSE'],[make(200,'',null),'INVALID_RESPONSE'],[make(401,'text/html'),'AUTH_REQUIRED'],[make(403,'text/html'),'FORBIDDEN'],[make(429,'text/html'),'RATE_LIMITED'],[make(502,'text/html'),'SERVICE_UNAVAILABLE'],[make(503,'application/json'),'SERVICE_UNAVAILABLE'],[make(200,'text/html',null,{redirected:true,url:'https://login.cloudflareaccess.com/cdn-cgi/access/login?token=SECRET'}),'AUTH_REQUIRED'],[make(200,'application/json',null,{redirected:true,url:'https://rent.test/wrong-page'}),'INVALID_RESPONSE'],[new TypeError('SECRET URL'),'NETWORK']]){
  response=r;const before=calls.length,result=await run();assert.equal(result.error?.code,code,file);assert.equal(calls.length,before+1,'never retry');assert(!result.error.message.includes('SECRET'));assert(!result.error.message.includes('Unexpected'));assert.equal(w.document.querySelector('#draft').value,'未儲存資料');
 }
 assert(notices.includes(401));assert(notices.includes(403));
 response=make(409,'application/json',{ok:false,error:{message:'資料已變更，請重新讀取。'}});assert.equal((await run()).error.message,'資料已變更，請重新讀取。');
 response=make(200,'application/problem+json',{ok:true,data:false});assert.equal((await run()).data,false);
 for(const action of ['saveMonthlyAccountField','ensureAnnualAccounts','initializeMonthlyAccounts']){response=make(200,'text/html');const before=calls.length,r=await run(action);assert(r.error.message.includes('勿重複送出'));assert.equal(calls.length,before+1);assert.equal(w.document.querySelector('#draft').value,'未儲存資料');}
 response=make();assert.equal((await run()).data,0,'manual next read recovers without reload or draft loss');
 dom.window.close();
}
console.log('PASS: both RPC transports safely classify HTML/malformed/empty/redirect/auth/rate-limit/service/network responses; preserve JSON business errors, zero/false and drafts; one request only and uncertain-write warnings, manual recovery, no response-body/URL leakage.');
})().catch(e=>{console.error(e);process.exit(1)});
