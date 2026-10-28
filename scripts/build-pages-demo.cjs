/** Build a self-contained, fictitious, read-only GitHub Pages demo. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const build = spawnSync(process.execPath, ['scripts/build-native-workspace.cjs'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);
const snapshotFile=path.join(root,'demo/production-numbers.json');
const numbers=fs.existsSync(snapshotFile)?require('./demo-numbers-schema.cjs').validateSnapshot(JSON.parse(fs.readFileSync(snapshotFile,'utf8'))):null;
const out = path.join(root, 'dist/pages-demo');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
// Explicit asset list: no Apps Script starters, downloads, deployment config or secrets.
const assets = [
  'index.html', 'notice.html', 'style.css', 'buttons.css', 'workspace.css', 'native-editors.css',
  'tenant-vue.global.prod.js', 'access-session.js', 'workspace-transport.js',
  'native-tenant.js', 'native-billing.js', 'billing-transport.js',
  'photo-preview.js', 'meter-worksheet.js', 'payment-worksheet.js', 'notice-renderer.js',
  'notice-zip.js', 'notice-batch.js', 'report-data.js', 'report-charts.js',
  'rental-reports.js', 'expenses.js', 'workspace.js'
];
for (const file of assets) fs.copyFileSync(path.join(root, 'public', file), path.join(out, file));
// Presentation differs only in the built Demo artifact; real viewer policy stays unchanged.
const accessFile=path.join(out,'access-session.js'),privateHook='const writeHook=el=>{if(!state.canWrite)el.hidden=true;};';
let access=fs.readFileSync(accessFile,'utf8');if(access.split(privateHook).length!==2)throw Error('Review Demo control presentation after session policy changes.');
access=access.replace(privateHook,"const writeHook=el=>{if(!state.canWrite){el.hidden=false;el.disabled=true;el.setAttribute('aria-disabled','true');el.title='Demo 展示：此操作不會寫入資料';}};");fs.writeFileSync(accessFile,access);
// Production annual billing opens the current month and omits obsolete initialization controls.
const billingFile=path.join(out,'native-billing.js');let billing=fs.readFileSync(billingFile,'utf8');if(billing.split('const annualMode=ref(false)').length!==2)throw Error('Review Demo annual view after billing changes.');billing=billing.replace('const annualMode=ref(false)','const annualMode=ref(true)');fs.writeFileSync(billingFile,billing);

// Keep the demo self-contained even when Google Fonts is unavailable.
const style = path.join(out, 'style.css');
fs.writeFileSync(style, fs.readFileSync(style, 'utf8').replace(/@import\s+url\([^)]*\);?/g, ''));
fs.copyFileSync(path.join(root, 'demo/pages-demo.js'), path.join(out, 'pages-demo.js'));
fs.copyFileSync(path.join(root, 'demo/pages-demo.css'), path.join(out, 'pages-demo.css'));
if(numbers)fs.writeFileSync(path.join(out,'production-numbers.js'),'/** Allowlisted production numbers; synthetic people only. */\nwindow.RentalDemoNumbers='+JSON.stringify(numbers)+';\n');
for (const file of ['index.html', 'notice.html']) {
  let html = fs.readFileSync(path.join(out, file), 'utf8');

  // Install before the session gate, including the non-deferred notice transport.
  html = html.replace('<head>', '<head><link rel="stylesheet" href="pages-demo.css">'+(numbers?'<script src="production-numbers.js"></script>':'')+'<script src="pages-demo.js"></script>');
  html = html.replace(/href="\//g, 'href="./');
  html = html.replace('<body>', '<body><aside class="pages-demo-banner" role="note"><strong>租務管理 Demo</strong><span>全部為虛構資料，僅供瀏覽；未連接 Google，不會儲存修改。</span><a href="./">回到展示首頁</a></aside>');
  html = html.replace('私人管理工作區', '假資料展示工作區')
    .replace('GOOGLE · 私人資料', 'DEMO · 虛構資料')
    .replace('資料來源：Google 試算表', '資料來源：內建虛構範例')
    .replace('目前為檢視者，可查看資料、照片與報表。', '展示版僅供瀏覽，可切換房間、月份與報表。照片為示意圖。');
  html = html.replace(/<a v-if="access.provider==='sites'"[\s\S]*?<\/form>/, '<form @submit.prevent><button type="submit" disabled aria-disabled="true" title="Demo 展示：無需登出">登出</button></form>');
  html=html.replace('v-write type="button" @click="propertyOpen=!propertyOpen"','type="button" @click="propertyOpen=!propertyOpen"').replace('<label v-if="access.canWrite">選擇 Logo 圖片','<label>選擇 Logo 圖片');
  if(numbers)html=html.replace('全部為虛構資料，僅供瀏覽；未連接 Google，不會儲存修改。','帳務數字取自正式資料快照；個資與照片為虛構資料。完整顯示操作介面；修改功能停用，不會儲存。').replace('DEMO · 虛構資料','DEMO · 正式數值／示範個資').replace('資料來源：內建虛構範例','資料來源：正式數值快照／示範個資');
  fs.writeFileSync(path.join(out, file), html);
}
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('Read-only fictitious GitHub Pages demo built in dist/pages-demo.');
