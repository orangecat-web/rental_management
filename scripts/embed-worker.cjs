const fs = require('node:fs'), path = require('node:path');
const assets = {};
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8' };
function visit(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) visit(file);
    else {
      const key = '/' + path.relative('public', file).split(path.sep).join('/');
      assets[key] = { type: types[path.extname(file)] || 'application/octet-stream', data: fs.readFileSync(file).toString('base64') };
    }
  }
}
visit('public');
const strip=s=>s.replace(/^import .*?;\s*$/gm,'').replaceAll('export ', '');
const policy=strip(fs.readFileSync('worker/permissions.mjs','utf8'));
const auth=strip(fs.readFileSync('worker/auth.mjs','utf8')).replaceAll('const json=', 'const authJson=').replaceAll('return json(', 'return authJson(');
const api = policy+'\n'+auth+'\n'+strip(fs.readFileSync('worker/api.mjs','utf8'));
const worker = fs.readFileSync('worker/index.js', 'utf8').replace("import { handleApi } from './api.mjs';", api).replace("import { handleAuthRoute } from './auth.mjs';", '').replace('__RENTAL_ASSETS__', JSON.stringify(assets));
fs.writeFileSync('dist/server/index.js', worker);
console.log(`Embedded ${Object.keys(assets).length} public files; server secrets are runtime-only.`);
