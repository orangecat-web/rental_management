/** Session metadata only; tokens/cookies remain outside JavaScript and never enter localStorage. */
(() => {
 const state=Vue.reactive({authenticated:false,canWrite:false,role:'',email:'',provider:'',loginPath:'/auth/login',logoutPath:'/auth/logout'});
 const writeHandlers=new Set(['save','reset','saveAll','resetAll','resetEntry','matchNames','applyDateAndPhotos','restore','restoreEntry','previewInitialization','initializeMonth','toggleCreationPanel','previewNewMonth','createNewMonth']);
 function decorateTemplate(template){
  return template.replace(/<(button|input|textarea|select)\b/g,(prefix,tag,offset)=>{
   // Read to the closing bracket outside quoted attributes (arrow functions contain >).
   let end=offset+prefix.length,quote='';for(;end<template.length;end++){const c=template[end];if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='>')break;}
   const attrs=template.slice(offset,end),click=attrs.match(/@click(?:\.[\w]+)*="([^"]*)"/)?.[1]||'';
   const model=attrs.match(/v-model(?:\.[\w]+)*="([^"]*)"/)?.[1]||'';
   const change=attrs.match(/@change="([^"]*)"/)?.[1]||'';
   if(tag==='button'&&(writeHandlers.has(click.match(/^\w+/)?.[0])||click.includes('entry.ids='))&&!attrs.includes('v-write'))return prefix+' v-write';
   if(tag!=='button'&&(model==='draft'||model==='commonDate'||model==='newMonth'||model.startsWith('entry.')||/^(toggle|addPhoto)\(/.test(change))&&!attrs.includes('v-write-field'))return prefix+' v-write-field';
   return prefix;
  });
 }
 function secureComponent(component){if(component.template)component.template=decorateTemplate(component.template);for(const child of Object.values(component.components||{}))if(child&&typeof child==='object')secureComponent(child);return component;}
 const writeHook=el=>{if(!state.canWrite)el.hidden=true;};
 const fieldHook=el=>{if(!state.canWrite){if(el.tagName==='SELECT'||['checkbox','radio','file'].includes(el.type)){el.disabled=true;el.setAttribute('aria-disabled','true');}else{el.readOnly=true;el.setAttribute('aria-readonly','true');}}};
 function install(app){app.directive('write',{beforeMount:writeHook,updated:writeHook});app.directive('write-field',{beforeMount:fieldHook,updated:fieldHook});const viewerHook=el=>{if(state.canWrite)el.hidden=true;};app.directive('viewer-only',{beforeMount:viewerHook,updated:viewerHook});}
 function showGate(message,loginPath){const gate=document.getElementById('access-gate');if(!gate)return;gate.hidden=false;gate.querySelector('[data-access-message]').textContent=message;const login=gate.querySelector('a');login.href=loginPath||'/auth/login';login.hidden=false;}
 const ready=(async()=>{try{const response=await fetch('/api/session',{credentials:'same-origin',cache:'no-store',headers:{'accept':'application/json','x-requested-with':'XMLHttpRequest'}});const result=await response.json();if(!response.ok||result.ok!==true||!result.data?.authenticated||!['manager','viewer'].includes(result.data.role)||result.data.canWrite!==(result.data.role==='manager')){showGate(result.error?.message||'登入身分尚未確認。',result.auth?.loginPath);return false;}Object.assign(state,result.data);document.getElementById('access-gate')?.setAttribute('hidden','');return true;}catch{showGate('無法確認登入狀態，請重新登入或重新整理。');return false;}})();
 window.RentalAccess={state,ready,install,secureComponent,get canWrite(){return state.canWrite;},isReadAction:action=>action.startsWith('get'),noteFailure(status){if(status!==401&&status!==403)return;const message=document.getElementById('access-expired');if(message){message.hidden=false;message.textContent=status===401?'登入已過期，請重新登入；尚未儲存的輸入仍保留在此畫面。':'目前無法執行此操作，請確認帳號權限；未儲存的輸入仍保留。';}}};
})();
