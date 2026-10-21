const { chromium, webkit }=require('playwright');
const {execFileSync}=require('node:child_process');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('dist'),out='out/audit/offline',base='http://127.0.0.1:5222';
fs.mkdirSync(out,{recursive:true});let server,browser;const results=[];
(async()=>{
 execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{env:{...process.env,VITE_CONVEX_URL:'https://offline-fixture.convex.cloud'},windowsHide:true,stdio:'inherit'});
 server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,base).pathname);let file=path.resolve(root,'.'+name);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');
  const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.svg':'image/svg+xml'};
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);
 });await new Promise(r=>server.listen(5222,'127.0.0.1',r));
 for(const[engine,type]of Object.entries({chromium,webkit})){
  browser=await type.launch();const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await c.addInitScript(()=>{
   if(localStorage.getItem('offline.init'))return;localStorage.setItem('offline.init','1');
   const token='offline-audit-token',user={id:'offline-user',username:'demo',nama:'Admin Demo',peran:'ADMIN',aktif:true,wajibGanti:false,kelasIds:['k1']};
   const kelas={id:'k1',_id:'k1',matkulId:'m1',nama:'Kelas Offline Demo',matkulNama:'Matkul Demo',matkulKode:'DEMO',semester:'GASAL',tahunAkademik:'2026/2027',dosen:'Dosen Demo',asdos:'Asdos Demo',tempat:'F6',revision:1,templateVersion:1,arsip:false,draft:false,jumlahPeserta:1,jumlahPraktikum:1,jumlahTerkunci:0};
   const peserta=[{id:'offline-person',nim:'OFFLINE_PERSON_001',nama:'Mahasiswa Offline Demo',golongan:'A',urut:1,aktif:true}],pertemuan=[{id:'p3',nomor:3,tanggal:'2026-10-21',tempat:'F6',tipe:'REGULER',status:'TERBUKA',revision:0}];
   localStorage.setItem('bap.token',token);localStorage.setItem('bap.guide.dismissed.v1','1');
   localStorage.setItem('bap.identity.'+token.slice(0,16),JSON.stringify(user));
   localStorage.setItem('bap.catalog.offline-user',JSON.stringify({kelas:[kelas],matkul:[{id:'m1',nama:'Matkul Demo',kode:'DEMO'}]}));
   localStorage.setItem('bap.cache.bootstrap.offline-user:k1',JSON.stringify({kelas,peserta,pertemuan,templates:[],audit:[],impor:[]}));
  });
  let page=await c.newPage();await page.goto(base+'/kelas/k1');await page.locator('.meeting-row').waitFor();
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  const cached=await page.evaluate(async()=>{const names=await caches.keys(),requests=[];for(const name of names)for(const request of await(await caches.open(name)).keys())requests.push(request.url);return requests});
  assert.ok(cached.some(x=>x.endsWith('/index.html')));assert.ok(cached.some(x=>x.includes('exceljs')));
  assert.ok(cached.every(x=>new URL(x).origin===new URL(base).origin));
  let disruption='browserContext.setOffline';
  if(engine==='webkit') {
   // Playwright issue #42775: WebKit's offline flag rejects even a literal SW
   // response. Stop the real origin instead; record this as an outage control,
   // not a claim of testing airplane mode in Safari.
   disruption='origin-stopped (WebKit offline-emulation limitation #42775)';
   await new Promise(r=>{server.close(()=>r());server.closeAllConnections();});
  } else await c.setOffline(true);
  await page.close();page=await c.newPage();
  const response=await page.goto(base+'/kelas/k1/pertemuan/p3');assert.equal(response.fromServiceWorker(),true);
  await page.locator('.student-main').first().click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('bap.draft.offline-user:k1:p3'))?.statuses['offline-person']==='ALPHA');
  assert.equal(await page.getByRole('button',{name:'Simpan & Kunci',exact:false}).isDisabled(),true);
  const protectedFetch=await page.evaluate(async()=>{try{await fetch('/documents?id=synthetic',{headers:{Authorization:'Bearer synthetic'}});return 'unexpected'}catch{return 'offline'}});
  assert.equal(protectedFetch,'offline');
  await page.close();page=await c.newPage();await page.goto(base+'/kelas/k1/pertemuan/p3');await page.locator('.student-row').last().waitFor();
  assert.equal(await page.locator('.student-row .status-badge').first().innerText(),'Alpha');
  const leaked=await page.evaluate(async()=>{for(const key of await caches.keys())for(const request of await(await caches.open(key)).keys()){if(request.url.includes('convex')||request.url.includes('/documents'))return true;const response=await(await caches.open(key)).match(request);if((await response.text()).includes('OFFLINE_PERSON_001'))return true;}return false;});
  assert.equal(leaked,false);
  await page.screenshot({path:`${out}/cold-start-${engine}.png`});
  results.push({engine,passed:true,disruption,checks:['Versioned app shell precached','Cold start deep link served by service worker during disruption','Local draft survives closing all tabs','Server save disabled while disconnected','Protected document request is not served from cache','No roster data in service-worker cache'],cacheEntries:cached.length});
  console.log('OK offline cold start',engine);await c.close();await browser.close();browser=null;
 }
 fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(server?.listening)await new Promise(r=>server.close(r))});
