/** 將靜態 Vue 介面包進 Apps Script HTML Service，不需外部 CDN。 */
const fs=require('fs');let html=fs.readFileSync('public/index.html','utf8');
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+fs.readFileSync('public/style.css','utf8')+'</style>');
html=html.replace('<script defer src="vue.global.prod.js"></script>','');
html=html.replace('<script defer src="app.js"></script>','');
const escape=s=>s.replace(/<\/script/gi,'<\\/script');
html=html.replace('href="downloads/rental-google-starter.zip"','href="https://orange-rental-desk.orangecat1120.chatgpt.site/downloads/rental-google-starter.zip"');
html=html.replace('</body>','<script>'+escape(fs.readFileSync('public/vue.global.prod.js','utf8'))+'</script><script>'+escape(fs.readFileSync('public/app.js','utf8'))+'</script></body>');
fs.writeFileSync('apps-script/Index.html',html);console.log('Apps Script Index.html generated');
