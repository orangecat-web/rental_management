/** Supervisor-only local preview. Production uses the Worker, never this server. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve('public');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.txt':'text/plain; charset=utf-8','.zip':'application/zip'};
http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://preview').pathname);
 // Internal visual QA only: fictitious data, never included in the production Worker.
 if(pathname==='/api/session'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,data:{authenticated:true,role:'manager',canWrite:true,email:'preview@example.test',provider:'sites',logoutPath:'/signout-with-chatgpt'}}));return;}
 if(pathname==='/api/tenant-rpc'||pathname==='/api/billing-rpc'){
  let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
   try{const {action,args=[]}=JSON.parse(body);let data;
    const tenants=[{room:'401',name:'預覽房客 A',phone:'0900000000',rent:5800,startDate:'2026-09-01',endDate:'2027-08-31',notes:'',contractLinks:[]},{room:'506',name:'',rent:0,notes:'',contractLinks:[]}];
    if(action==='getTenantData')data=tenants;
    else if(action==='getAvailableBillingYears')data=[2026];
    else if(action==='getAvailableBillingMonths')data=[8,9,10,11,12];
    else if(action==='getMonthlyAccounts')data=tenants.map(t=>{
     const m=args[1],fee=m%2?600:0,prior=t.name?(m-8)*t.rent+[9,11].filter(v=>v<m).length*600:0;
     return {year:args[0],month:m,room:t.room,name:t.name,rent:t.rent,actualPaid:null,receiptConfirmed:'',isReceived:false,effectivePaid:0,openingCredit:0,creditApplied:0,arrears:prior,netDue:t.rent+fee+prior,unpaid:t.rent+fee+prior,overpaid:0,paymentStatus:t.rent+fee+prior>0?'未收':'無應收',electricityFee:m%2?600:null,totalDue:t.rent+fee,transferDate:'',transferLastFive:'01234',notes:'',meter:m%2?{previousReading:1000,currentReading:1120,previousReadingDate:`2026-${String(m-2).padStart(2,'0')}-01`,currentReadingDate:`2026-${String(m).padStart(2,'0')}-01`,usage:120,calculatedFee:600}:null};
    });
    else throw Error('內部預覽不執行寫入或讀取私人照片。');
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,data}));
   }catch(error){res.writeHead(409,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:{message:error.message}}))}
  });return;
 }
 if(pathname==='/api/connection'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,data:{configured:false,scope:'tenants'}}));return;}
 const f=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end('Not found');return;}
 res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);
}).listen(4173,'0.0.0.0',()=>console.log('Local: http://terminal.local:4173/'));
