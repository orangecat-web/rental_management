/** Static, reviewed presentation templates. Existing setup functions own every write. */
const fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'templates',name),'utf8');
exports.tenant=original=>{
 const start=original.indexOf('<section v-if="moveInPreview"'),end=original.indexOf('<div v-if="tenants.length" class="workspace">',start);
 if(start<0||end<0)throw Error('Tenant review boundaries changed');
 let reviews=original.slice(start,end).replaceAll('class="draft-notice','class="workflow-review draft-notice');
 reviews=reviews.replace(/<section v-if="moveInPreview"[\s\S]*?<\/section>/,read('move-in-review.html')).replace(/<section v-if="checkoutConfirm && activeTenant.annualBilling"[\s\S]*?<\/section>/,read('checkout-review.html'));
 return read('tenant-workspace.html').replace('<!-- WORKFLOW_REVIEWS -->',reviews);
};
exports.billing=()=>read('billing-list.html');
