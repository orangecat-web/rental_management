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
    const controls=template.match(/<div class="controls">[\s\S]*?<\/div>/)[0];
    template=template.replace(controls,'');
    template = `<div class="billing-tabs billing-toolbar" role="group" aria-label="帳務工作表"><div class="billing-tab-buttons segmented"><button type="button" :class="{selected:billingView==='accounts'}" @click="changeBillingView('accounts')" :disabled="controlsLocked">帳務資料</button><button type="button" :class="{selected:billingView==='meters'}" @click="changeBillingView('meters')" :disabled="controlsLocked">電表抄錄與通知</button></div>${controls}</div>` + template;
    template = template.replace('v-for="value in months"', 'v-for="value in displayMonths"').replace('v-if="!months.length"', 'v-if="!displayMonths.length"');
    template = template.replace('class="account-batch-actions"', 'v-if="false" class="account-batch-actions"');
    template = template.replace('v-if="accounts.length" class="table-wrap"', 'v-if="accounts.length && billingView===\'accounts\'" class="table-wrap"');
    template += `<p v-if="billingView==='meters' && !displayMonths.length" class="notice">本年度尚無已建立的單數月份。</p><meter-worksheet v-if="billingView==='meters' && month%2===1 && accounts.length" :key="year+':'+month" :accounts="accounts" :year="year" :month="month" :blocked="editorsBlocked" :notice-url="noticeUrl" @dirty-change="setDirty('all','meterWorksheet',$event)" @busy-change="operation=$event" @field-saved="onMeterFieldSaved" @reconciled="onMeterReconciled" @refresh-request="refreshAfterMeter"></meter-worksheet>`;
    template += `<notice-batch v-if="billingView==='meters' && month%2===1 && accounts.length" :key="year+':'+month" :accounts="accounts" :year="year" :month="month" :blocked="editorsBlocked||dirtyKeys.size>0" @busy-change="operation=$event"></notice-batch>`;
    template += `<reconciliation-dialog v-if="reconciliationAccount" :key="year+':'+month+':'+reconciliationRoom" :account="reconciliationAccount" :year="year" :month="month" @close="closeReconciliation" @busy-change="operation=$event" @dirty-change="setDirty('all','paymentWorksheet',$event)" @reconciled="onPaymentReconciled" @field-saved="onPaymentFieldSaved" @selection-saved="onPaymentSelectionSaved"></reconciliation-dialog>`;
    template = template.replace('<template v-if="column.key===\'name\'">', `<template v-if="column.key==='reconciliation'"><button type="button" class="primary" @click="openReconciliation(account)" :disabled="controlsLocked" :aria-label="account.room+' 房實際對帳'">實際對帳</button></template><span v-else-if="column.key==='receiptStatus'" class="receipt-status" :class="{pending:!account.isReceived,short:account.isReceived&&account.unpaid>0}">{{receiptStatus(account)}}</span><template v-else-if="column.key==='name'">`);

    template = template.replace(':key="column.key" scope="col"', ':key="column.key" :class="{\'reconciliation-action-cell\':column.key===\'reconciliation\',\'reconciliation-status-cell\':column.key===\'receiptStatus\'}" scope="col"').replace('<td v-else>', '<td v-else :class="{\'reconciliation-action-cell\':column.key===\'reconciliation\',\'reconciliation-status-cell\':column.key===\'receiptStatus\'}">');
    template = template.replace(/<payment-photo-picker[\s\S]*?<\/payment-photo-picker>/, `<template v-else-if="column.key==='paymentPhotos'"></template>`);
    template = template.replace('v-else-if="column.editable && !(account.financialLocked && column.meter)"', `v-else-if="column.editable && !['transferDate','transferLastFive'].includes(column.key)"`);
    // Meter entries and notice previews live together; the accounting table retains bill totals.
    template = template.replaceAll('column in columns', "column in accountColumns").replace(':colspan="columns.filter(c=>c.key!==\'overpaid\'||accounts.some(a=>a.overpaid>0)).length"', ':colspan="accountColumns.length"');
    template=`<div :class="{'billing-accounts-view':billingView==='accounts'}">${template}</div>`;
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
    root = root.replace('components: { AccountField, PaymentPhotoPicker, MeterPhotoViewer }', 'components: { AccountField, PaymentPhotoPicker, MeterPhotoViewer, MeterWorksheet: RentalComponents.meterWorksheet(api), NoticeBatch: RentalComponents.noticeBatch(api), ReconciliationDialog: RentalComponents.reconciliationDialog(api) }');
    root = root.replace('const year = ref(0)', "const billingView = ref('accounts');\n const year = ref(0)");
    root = root.replace('return { reconciliationText,historicalMode, numberFormat, accountFilter, filteredAccounts, cashSummary, year, years,', 'return { reconciliationText,historicalMode, numberFormat, accountFilter, filteredAccounts, cashSummary, displayMonths, changeBillingView, accountColumns, reconciliationRoom, reconciliationAccount, openReconciliation, closeReconciliation, receiptStatus, billingView, onPaymentReconciled, onPaymentFieldSaved, onPaymentSelectionSaved, onMeterFieldSaved, onMeterReconciled, refreshAfterMeter, year, years,');
    root = root.replace('const controlsLocked = computed(() => busy.value || dirtyKeys.size > 0);', 'const controlsLocked = computed(() => busy.value || dirtyKeys.size > 0 || !!reconciliationRoom.value);');
    root = root.replace('const filteredAccounts=computed', `const reconciliationRoom=ref('');
    const displayMonths=computed(()=>billingView.value==='meters'?months.value.filter(m=>m%2===1):months.value);
    let lastAccountMonth=0,lastAccountYear=0;
    function pickMonth(available,requested){if(available.includes(requested))return requested;return available.filter(m=>m<=requested).at(-1)||available[0]||0;}
    async function changeBillingView(next){
      if(controlsLocked.value||next===billingView.value||!['accounts','meters'].includes(next))return;
      if(billingView.value==='accounts'){lastAccountMonth=month.value;lastAccountYear=year.value;}
      billingView.value=next;const requested=next==='accounts'&&lastAccountYear===year.value?lastAccountMonth:month.value;
      const selected=pickMonth(displayMonths.value,requested);
      if(selected===month.value&&accountsReady.value)return;
      month.value=selected;accounts.value=[];accountsReady.value=false;clearInitialization();
      if(selected)await loadAccounts();else status.value='本年度尚無已建立的單數月份。';
    }
    const reconciliationAccount=computed(()=>accounts.value.find(a=>a.room===reconciliationRoom.value));
    const accountColumns=computed(()=>[...columns.value.filter(c=>!c.meter&&!['paymentPhotos','transferDate','transferLastFive','notes','notice'].includes(c.key)&&(c.key!=='overpaid'||accounts.value.some(a=>a.overpaid>0))),{key:'receiptStatus',title:'對帳狀態'},{key:'reconciliation',title:'操作'}]);
    function receiptStatus(a){return !a.isReceived||a.receiptTotal===null?'待核對':a.unpaid>0?'短收 '+numberFormat.format(a.unpaid):a.overpaid>0?'溢收 '+numberFormat.format(a.overpaid):'已核對';}
    function openReconciliation(account){if(controlsLocked.value)return;reconciliationRoom.value=account.room;}
    function closeReconciliation(){reconciliationRoom.value='';}
    const filteredAccounts=computed`);
    root = root.replace("month.value = list.includes(preferred) ? preferred : annualMode.value&&list.includes(Number(taipeiToday().slice(5,7)))?Number(taipeiToday().slice(5,7)):months.value[months.value.length - 1];", `const requested=list.includes(preferred)?preferred:annualMode.value&&list.includes(Number(taipeiToday().slice(5,7)))?Number(taipeiToday().slice(5,7)):months.value[months.value.length-1];
              month.value=pickMonth(displayMonths.value,requested);
              if(!month.value){accounts.value=[];status.value='本年度尚無已建立的單數月份。';return false;}`);
    root = root.replace('onMounted(loadYears);', `function onPaymentReconciled(records){onMeterReconciled(records);status.value=year.value+' 年 '+month.value+' 月｜'+reconciliationRoom.value+' 房對帳資料已更新。';}
    function onPaymentFieldSaved(change){const account=accounts.value.find(a=>a.room===change.room);if(account)account[change.field]=change.value;}
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
