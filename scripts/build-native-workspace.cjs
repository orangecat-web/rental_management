/** Compile the already-tested editors into native Vue components inside one workspace.
 * Templates are fixed build inputs; spreadsheet values are never compiled as HTML.
 */
const fs = require('node:fs');
function scopeCss(css, scope) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '', pos = 0;
  while (pos < css.length) {
    const start = css.indexOf('{', pos); if (start < 0) break;
    const header = css.slice(pos, start).trim();
    let end = start + 1, depth = 1, quote = '';
    for (; end < css.length && depth; end++) {
      const c = css[end];
      if (quote) { if (c === quote && css[end - 1] !== '\\') quote = ''; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '{') depth++; else if (c === '}') depth--;
    }
    const body = css.slice(start + 1, end - 1);
    out += header.startsWith('@') ? header + '{' + scopeCss(body, scope) + '}'
      : header.split(',').map(s => /^(:root|body)$/.test(s.trim()) ? scope : scope + ' ' + s.trim()).join(',') + '{' + body + '}';
    pos = end;
  }
  return out;
}
let allCss = '';
for (const [kind, file] of [['tenant','google-tenants.html'], ['billing','google-accounts.html']]) {
  const html = fs.readFileSync('public/' + file, 'utf8');
  let script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  const rootId = kind === 'tenant' ? 'tenant-app' : 'billing-app';
  let template = html.match(new RegExp('<main id="' + rootId + '"[^>]*>([\\s\\S]*?)<\\/main>'))[1];
  if (kind === 'tenant') template = template.replace(/<div class="page-heading">[\s\S]*?<\/div>\s*<p class="status"/, '<div class="page-heading"><button class="reload" type="button" @click="loadTenants" :disabled="loading || pendingSaves > 0 || dirtyKeys.size > 0">重新讀取</button></div><p class="status"');
  if (kind === 'billing') {
    template = `<div class="billing-tabs segmented" role="group" aria-label="帳務工作表"><button type="button" :class="{selected:billingView==='accounts'}" @click="billingView='accounts'" :disabled="controlsLocked">帳務資料</button><button type="button" :class="{selected:billingView==='meters'}" @click="billingView='meters'" :disabled="controlsLocked">電表抄錄表</button><button type="button" :class="{selected:billingView==='notices'}" @click="billingView='notices'" :disabled="controlsLocked">電費通知</button><button type="button" :class="{selected:billingView==='payments'}" @click="billingView='payments'" :disabled="controlsLocked">匯款截圖</button></div>` + template;
    template = template.replace('class="account-batch-actions"', `v-if="billingView==='accounts'" class="account-batch-actions"`);
    template = template.replace('v-if="accounts.length" class="table-wrap"', 'v-if="accounts.length && billingView===\'accounts\'" class="table-wrap"');
    template += `<p v-if="billingView==='meters' && month && month%2===0" class="notice">雙數月份不計收電費，請切換到單數月份。</p><meter-worksheet v-if="billingView==='meters' && month%2===1 && accounts.length" :key="year+':'+month" :accounts="accounts" :year="year" :month="month" :blocked="editorsBlocked" @dirty-change="setDirty('all','meterWorksheet',$event)" @busy-change="operation=$event" @field-saved="onMeterFieldSaved" @reconciled="onMeterReconciled" @refresh-request="refreshAfterMeter"></meter-worksheet>`;
    template += `<notice-batch v-if="billingView==='notices' && month%2===1 && accounts.length" :key="year+':'+month" :accounts="accounts" :year="year" :month="month" :blocked="editorsBlocked" @busy-change="operation=$event"></notice-batch><p v-if="billingView==='notices' && month && month%2===0" class="notice">雙數月份不發送電費通知，請切換到單數月份。</p>`;
    template += `<payment-worksheet v-if="billingView==='payments' && accounts.length" :key="year+':'+month" :accounts="accounts" :year="year" :month="month" :blocked="editorsBlocked" @busy-change="operation=$event" @dirty-change="setDirty('all','paymentWorksheet',$event)" @field-saved="onPaymentFieldSaved" @selection-saved="onPaymentSelectionSaved" @reconciled="onMeterReconciled"></payment-worksheet>`;
    template = template.replace(/<payment-photo-picker[\s\S]*?<\/payment-photo-picker>/, `<template v-if="column.key==='paymentPhotos'"></template>`);
    template = template.replace('v-else-if="column.editable"', `v-else-if="column.editable && !['transferDate','transferLastFive'].includes(column.key)"`);
    // Meter input lives only in the worksheet; the accounting table retains bill totals/notices.
    template = template.replaceAll('column in columns', "column in columns.filter(c=>!c.meter && c.key!=='paymentPhotos')");
  }
  script = script.slice(script.indexOf('const { createApp'));
  script = script.slice(0, script.indexOf('app.config.errorHandler'));
  script = script.replace('const app = createApp({', 'const component = {\n props: { initialRoom: String }, emits: ["update-data", "busy-change"],\n template: ' + JSON.stringify(template) + ',');
  script = script.replace(/\n      \}\);\s*$/, '\n      };');
  script = script.replace(/template: document\.getElementById\('([^']+)'\)\.innerHTML/g, (_, id) => {
    const t = html.match(new RegExp('<template id="' + id + '">([\\s\\S]*?)<\\/template>'))[1];
    return 'template: ' + JSON.stringify(t);
  });
  const split = script.indexOf('const component =');
  let before = script.slice(0, split), root = script.slice(split);
  root = root.replace('setup() {', 'setup(props, { emit }) {');
  if (kind === 'tenant') {
    root = root.replace("const selectedRoom = ref('');", "const selectedRoom = ref(props.initialRoom || '');");
    root = root.replace('onMounted(loadTenants);', `watch(() => loading.value || pendingSaves.value > 0 || dirtyKeys.size > 0,
      value => emit('busy-change', value), { immediate: true });
      watch(tenants, value => emit('update-data', value), { deep: true });
      onMounted(loadTenants);`);
  } else {
    root = root.replace('components: { AccountField, PaymentPhotoPicker, MeterPhotoViewer }', 'components: { AccountField, PaymentPhotoPicker, MeterPhotoViewer, MeterWorksheet: RentalComponents.meterWorksheet(api), NoticeBatch: RentalComponents.noticeBatch(api), PaymentWorksheet: RentalComponents.paymentWorksheet(api) }');
    root = root.replace('const year = ref(0)', "const billingView = ref(new URLSearchParams(location.search).has('billingMonth')?'payments':'accounts');\n const year = ref(0)");
    root = root.replace('return { historicalMode, numberFormat, accountFilter, filteredAccounts, cashSummary, year, years,', 'return { historicalMode, numberFormat, accountFilter, filteredAccounts, cashSummary, billingView, onPaymentFieldSaved, onPaymentSelectionSaved, onMeterFieldSaved, onMeterReconciled, refreshAfterMeter, year, years,');
    root = root.replace('onMounted(loadYears);', `function onPaymentFieldSaved(change){const account=accounts.value.find(a=>a.room===change.room);if(account)account[change.field]=change.value;}
    function onPaymentSelectionSaved(change){const account=accounts.value.find(a=>a.room===change.room);if(account)account.paymentScreenshot=change.value;}
    function onMeterFieldSaved(change) {
      const account=accounts.value.find(a=>a.room===change.room);if(!account?.meter)return;
      if(change.field==='currentReading')updateAccount(account,{key:change.field,meter:true},change.value);
      else account.meter[change.field]=change.value;
    }
    function onMeterReconciled(records) { accounts.value=validateAccounts(records,month.value);staleRooms.clear();accountsReady.value=true; }
    function refreshAfterMeter(){nextTick(()=>{if(!busy.value&&!dirtyKeys.size)loadAccounts();});}
    onMounted(loadYears);`);
    root = root.replace('onMounted(loadYears);' , `watch(controlsLocked, value => emit('busy-change', value), { immediate: true });
      watch(accounts, value => emit('update-data', { year: year.value, month: month.value, accounts: value }), { deep: true });
      onMounted(loadYears);`);
  }
  fs.writeFileSync('public/native-' + kind + '.js', `/** Generated from the tested editor; one native workspace, no iframe. */\nwindow.RentalComponents ||= {};\nwindow.RentalComponents.${kind} = function () {\nconst google = RentalTransport('${kind}');\n${before}${root}\nreturn component;\n};\n`);
  allCss += scopeCss(html.match(/<style>([\s\S]*?)<\/style>/)[1], '.' + kind + '-native') + '\n';
}
fs.writeFileSync('public/native-editors.css', allCss);
