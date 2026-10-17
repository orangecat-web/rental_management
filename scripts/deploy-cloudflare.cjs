const {spawnSync}=require('node:child_process');
for(const args of [['scripts/preflight-cloudflare.cjs'],['scripts/build-cloudflare.cjs']]){const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
const r=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['--yes','wrangler@4','deploy','--config','deploy/cloudflare.local.json'],{stdio:'inherit'});process.exit(r.status===0?0:(r.status||1));
