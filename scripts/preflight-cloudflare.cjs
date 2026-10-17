/** Validate local deployment settings; print no identity values or secrets. */
const fs=require('node:fs'),path=require('node:path');
function validate(config){
 const v=config.vars||{},errors=[];let origin;
 try{const u=new URL(v.PUBLIC_ORIGIN);if(u.protocol==='https:'&&u.origin===v.PUBLIC_ORIGIN&&!u.hostname.endsWith('.example.com')&&!u.hostname.endsWith('.workers.dev'))origin=u;}catch{}
 if(!origin)errors.push('PUBLIC_ORIGIN 必須是正式 HTTPS 自訂網域（不含結尾 /）。');
 if(v.AUTH_MODE!=='cloudflare-access')errors.push('外部環境必須使用 cloudflare-access。');
 if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(v.ACCESS_TEAM_DOMAIN||'')||/change_me|your-team|example/i.test(v.ACCESS_TEAM_DOMAIN||''))errors.push('請填入實際 Access team domain。');
 if(!/^[A-Za-z0-9_-]{20,200}$/.test(v.ACCESS_AUD||'')||/change_me/i.test(v.ACCESS_AUD))errors.push('請填入該應用程式的 Access AUD。');
 const managers=String(v.MANAGER_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean),viewers=String(v.VIEWER_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!managers.length||[...managers,...viewers].some(s=>!/^\S+@\S+\.\S+$/.test(s)||/@example\.(com|test)$/.test(s)))errors.push('請設定實際管理人／檢視者信箱。');
 if(viewers.some(s=>managers.includes(s)))errors.push('管理人與檢視者清單請勿重複。');
 if(config.workers_dev!==false||config.preview_urls!==false)errors.push('必須關閉 workers.dev 與 preview URLs。');
 if(!origin||!config.routes?.some(r=>r.custom_domain===true&&r.pattern===origin.hostname))errors.push('custom_domain route 必須與 PUBLIC_ORIGIN 相同。');
 if(config.assets?.binding!=='ASSETS'||!config.assets?.run_worker_first?.includes('/api/*')||!config.assets?.run_worker_first?.includes('/auth/*'))errors.push('請保留 ASSETS binding 與 API/auth 路由。');
 return errors;
}
module.exports={validate};
if(require.main===module){const file=path.resolve('deploy/cloudflare.local.json');if(!fs.existsSync(file)){console.error('尚未建立 deploy/cloudflare.local.json；請依 docs/DEPLOYMENT.md 設定。');process.exit(1);}let config;try{config=JSON.parse(fs.readFileSync(file,'utf8'));}catch{console.error('部署設定不是有效 JSON。');process.exit(1);}const errors=validate(config);if(errors.length){console.error(errors.join('\n'));process.exit(1);}console.log('Deployment configuration passed; ensure Access policy and server secrets are configured before publishing.');}
