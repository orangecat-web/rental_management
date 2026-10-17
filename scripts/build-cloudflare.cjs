/** Cross-platform build for GitHub/Codex and the independent Cloudflare account. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');process.chdir(root);
const result=spawnSync(process.execPath,['scripts/build-native-workspace.cjs'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
const out=path.join(root,'dist/cloudflare-assets');fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
fs.cpSync(path.join(root,'public'),out,{recursive:true});
fs.writeFileSync(path.join(out,'_headers'),'/*\n  Cache-Control: private, no-store\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Content-Security-Policy: frame-ancestors \'self\'; object-src \'none\'; base-uri \'self\'\n');
console.log('Cloudflare static assets built. No deployment or credentials included.');
