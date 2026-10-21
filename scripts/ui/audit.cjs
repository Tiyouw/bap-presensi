const { chromium, webkit } = require('playwright');
const { spawn } = require('node:child_process');
const fs=require('node:fs'),assert=require('node:assert/strict');
const root=process.cwd(),out='out/audit/ui',url='http://127.0.0.1:5220',draftKey='bap.draft.qa-user:k1:p3';
fs.mkdirSync(out,{recursive:true});let server,browser,page;const results=[];
const ok=(engine,test)=>{results.push({engine,test,passed:true});console.log('OK audit UI',engine,test)};
async function context(options={}) {
 const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',...options});
 await c.addInitScript(()=>{localStorage.setItem('bap.token','ui-test-token');localStorage.setItem('bap.guide.dismissed.v1','1')});
 return c;
}
async function open(c,path='/kelas/k1/pertemuan/p3') {
 page=await c.newPage();await page.goto(url+path);await page.locator('.student-row').last().waitFor();
 return page;
}
const draft=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),draftKey);
const waitSaved=p=>p.waitForFunction(k=>Boolean(localStorage.getItem(k)),draftKey);
(async()=>{
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','scripts/ui/vite.config.mjs','--port','5220','--strictPort'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let log='';server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
 for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error(log);try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 for(const[engine,type]of Object.entries({chromium,webkit})){
  browser=await type.launch();let c=await context(),p=await open(c);const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.locator('.student-main').first().click();await waitSaved(p);
  await p.evaluate(()=>window.__qa.addParticipant({id:'NEW001',nim:'NEW001',nama:'Mahasiswa Baru Demo',golongan:'A',urut:94}));
  await p.getByText('Daftar atau identitas mahasiswa berubah.',{exact:false}).waitFor();
  await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.statuses.NEW001==='HADIR',draftKey);
  assert.equal((await draft(p)).statuses.DEMO00001,'ALPHA');
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('bap.draft.backup.qa-user:k1:p3')).statuses.DEMO00001),'ALPHA');
  await p.reload();await p.locator('.student-row').last().waitFor();assert.equal(await p.locator('.student-row').count(),94);
  assert.equal(await p.locator('.student-row').first().locator('.status-badge').innerText(),'Alpha');
  await p.getByRole('button',{name:'Simpan & Kunci',exact:false}).click();
  assert.equal(await p.getByRole('button',{name:/Kunci sekarang/}).isDisabled(),true);
  await p.getByLabel('Saya sudah memeriksa perubahan roster dan seluruh status presensi.').check();
  assert.equal(await p.getByRole('button',{name:/Kunci sekarang/}).isEnabled(),true);
  await p.screenshot({path:`${out}/roster-review-${engine}.png`});
  assert.deepEqual(errors,[]);await c.close();ok(engine,'F01 live/reloaded roster addition preserves absences, backs up and blocks lock until explicit review');
  c=await context();p=await open(c);await p.locator('.student-main').first().click();await waitSaved(p);
  await p.evaluate(()=>window.__qa.advanceOpenWithParticipant({id:'NEW001',nim:'NEW001',nama:'Mahasiswa Baru Demo',golongan:'A',urut:94}));
  await p.getByRole('button',{name:'Periksa perubahan',exact:true}).click();
  await p.getByRole('button',{name:'Pertahankan draf perangkat',exact:true}).click();
  await p.getByRole('button',{name:'Gunakan draf ini',exact:true}).click();
  await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.baseRevision===1 && JSON.parse(localStorage.getItem(k)).statuses.NEW001==='HADIR',draftKey);
  assert.equal((await draft(p)).statuses.DEMO00001,'ALPHA');assert.equal((await draft(p)).needsRosterReview,true);
  await c.close();ok(engine,'F01 keeping a conflicted draft reconciles the newer roster and preserves local absences');

  c=await context();const a=await open(c),b=await open(c);
  await b.getByText('Presensi ini sedang diedit di tab lain.',{exact:false}).waitFor();
  assert.equal(await b.locator('.student-main').first().isDisabled(),true);
  await a.locator('.student-main').first().click();await waitSaved(a);
  const before=(await draft(a)).ts;await b.locator('.student-main').nth(1).evaluate(el=>el.click());
  assert.equal((await draft(b)).ts,before);assert.equal((await draft(b)).statuses.DEMO00002,'HADIR');
  await a.close();await b.locator('.student-main').nth(1).waitFor();
  await b.locator('.student-main').nth(1).click();
  await b.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.statuses.DEMO00002==='ALPHA',draftKey);
  assert.equal((await draft(b)).statuses.DEMO00001,'ALPHA');
  await c.close();ok(engine,'F02 second tab is read-only; handoff loads latest draft and preserves both absences');

  c=await context();p=await open(c);await p.locator('.student-main').first().click();
  await p.getByRole('button',{name:'Simpan & Kunci',exact:false}).click();await p.getByRole('button',{name:/Kunci sekarang/}).click();
  await p.getByRole('button',{name:'Buka kunci',exact:true}).click();
  await p.evaluate(()=>window.__qa.advance('p3'));
  await p.getByRole('button',{name:'Buka kunci & koreksi',exact:true}).click();
  await p.getByRole('dialog').getByText('Data sudah berubah di perangkat lain.',{exact:false}).waitFor();
  assert.equal(await p.evaluate(()=>window.__qa.calls.filter(c=>c.name==='sesi:bukaKunci').at(-1).args.expectedRevision),1);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('ui-qa.server')).pertemuan.find(p=>p.id==='p3').status),'KUNCI');
  await c.close();ok(engine,'F04 unlock confirmation remains bound to the revision originally reviewed');

  c=await context({viewport:{width:1280,height:900}});p=await c.newPage();await p.goto(url+'/kelas/k1?tab=jadwal');
  let accept=false,confirms=0;p.on('dialog',d=>{confirms++;return accept?d.accept():d.dismiss()});
  await p.getByLabel('Ruang',{exact:true}).nth(2).fill('DRAF RUANG');
  await p.getByRole('link',{name:'Mahasiswa',exact:true}).click();assert.ok(p.url().includes('tab=jadwal'));
  assert.equal(await p.getByLabel('Ruang',{exact:true}).nth(2).inputValue(),'DRAF RUANG');
  accept=true;await p.getByRole('link',{name:'Template BAP',exact:true}).click();accept=false;
  await p.getByLabel('Nama institusi',{exact:true}).fill('DRAF INSTITUSI');
  await p.getByRole('link',{name:'Mahasiswa',exact:true}).click();assert.ok(p.url().includes('tab=template'));
  assert.equal(await p.getByLabel('Nama institusi',{exact:true}).inputValue(),'DRAF INSTITUSI');
  accept=true;await p.getByRole('navigation',{name:'Bagian kelas'}).getByRole('link',{name:'Pengaturan',exact:true}).click();accept=false;
  await p.getByLabel('Dosen pengampu',{exact:true}).fill('DRAF DOSEN');
  await p.getByRole('link',{name:'Mahasiswa',exact:true}).click();assert.ok(p.url().includes('tab=pengaturan'));
  assert.ok(confirms>=5);await c.close();ok(engine,'F03 navigation cancellation preserves schedule, template and class edits');
  c=await context({viewport:{width:1280,height:900}});p=await c.newPage();await p.goto(url+'/kelas/k1?tab=mahasiswa');
  let discard=false;p.on('dialog',d=>discard?d.accept():d.dismiss());
  await p.getByRole('button',{name:'Ubah',exact:true}).first().click();
  await p.getByLabel('Nama mahasiswa',{exact:true}).fill('Nama Draf Demo');
  await p.getByRole('button',{name:'Tutup',exact:true}).click();
  assert.equal(await p.getByLabel('Nama mahasiswa',{exact:true}).inputValue(),'Nama Draf Demo');
  discard=true;await p.getByRole('button',{name:'Tutup',exact:true}).click();
  assert.equal(await p.getByRole('dialog').count(),0);await c.close();ok(engine,'F03 closing the roster editor requires explicit discard of unsaved input');

  c=await context();p=await open(c);await p.locator('.student-main').first().click();
  await p.getByRole('button',{name:'Simpan & Kunci',exact:false}).click();await p.getByRole('button',{name:/Kunci sekarang/}).click();
  await p.getByRole('button',{name:'Buka kunci',exact:true}).click();await p.getByRole('button',{name:'Buka kunci & koreksi',exact:true}).click();
  await p.locator('.brush-modes').getByRole('button',{name:/Sakit/}).click();await p.locator('.student-main').first().click();
  await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.statuses.DEMO00001==='SAKIT',draftKey);
  await p.evaluate(()=>window.__qa.addParticipant({id:'NEW001',nim:'NEW001',nama:'Mahasiswa Baru Demo',golongan:'A',urut:94}));
  await p.getByRole('button',{name:'Terapkan data kelas terbaru',exact:true}).click();
  await p.evaluate(()=>{window.__originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('bap.draft.backup.'))throw Error('quota');return window.__originalSet.call(this,k,v)}});
  await p.getByRole('button',{name:'Ya, terapkan & periksa ulang',exact:true}).click();
  await p.getByText('Draf belum dapat dicadangkan.',{exact:false}).waitFor();
  assert.equal(await p.evaluate(()=>window.__qa.calls.filter(c=>c.name==='kelola:refreshSnapshot').length),0);
  await p.evaluate(()=>{Storage.prototype.setItem=function(k,v){if(k.startsWith('bap.draft.qa-user:'))throw Error('quota after mutation');return window.__originalSet.call(this,k,v)}});
  await p.getByRole('button',{name:'Ya, terapkan & periksa ulang',exact:true}).click();
  await p.waitForFunction(()=>document.querySelectorAll('.student-row').length===94 && !document.querySelector('.student-main')?.disabled);
  await p.getByText('Draf belum tersimpan di perangkat.',{exact:false}).waitFor();
  assert.equal((await draft(p)).baseRevision,1);
  assert.equal(await p.locator('.student-row').first().locator('.status-badge').innerText(),'Sakit');assert.equal(await p.locator('.student-row').count(),94);
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('bap.draft.backup.qa-user:k1:p3')).statuses.DEMO00001),'SAKIT');
  await p.evaluate(()=>Storage.prototype.setItem=window.__originalSet);
  await p.locator('.brush-modes').getByRole('button',{name:/Alpha/}).click();await p.locator('.student-main').nth(1).click();
  await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.baseRevision===2,draftKey);
  await p.getByRole('button',{name:'Simpan & Kunci',exact:false}).click();
  await p.getByLabel('Saya sudah memeriksa perubahan roster dan seluruh status presensi.').check();
  await p.getByRole('button',{name:/Kunci sekarang/}).click();await p.getByRole('button',{name:'Buka kunci',exact:true}).waitFor();
  await p.evaluate(()=>window.__qa.holdQuery('sesi:detail',true));await p.getByLabel('Memuat presensi',{exact:true}).waitFor();
  await p.evaluate(()=>window.__qa.holdQuery('sesi:detail',false));await p.getByRole('button',{name:'Buka kunci',exact:true}).waitFor();
  assert.equal(await p.getByText('Data di server lebih baru.',{exact:false}).count(),0);
  await p.reload();await p.locator('.student-row').last().waitFor();assert.equal(await p.locator('.student-row').first().locator('.status-badge').innerText(),'Sakit');
  await c.close();ok(engine,'F05 refresh preserves corrections through backup/write failures, relock and remount without resurrecting old drafts');

  c=await context();p=await c.newPage();await p.goto(url+'/kelas/k1?tab=mahasiswa');await p.getByRole('button',{name:'Impor Excel / CSV',exact:true}).click();
  const ExcelJS=require('exceljs'),wb=new ExcelJS.Workbook();wb.addWorksheet('Kosong');wb.addWorksheet('Data').addRows([['NIM','Nama','Golongan'],['DEMO001','Nama Demo','A']]);
  await p.locator('input[type=file]').setInputFiles({name:'empty-first.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await wb.xlsx.writeBuffer())});
  await p.getByLabel('Lembar kerja',{exact:true}).waitFor();assert.equal(await p.getByLabel('Lembar kerja',{exact:true}).inputValue(),'1');
  assert.match(await p.locator('.mg-table tbody').innerText(),/Nama Demo/);await c.close();ok(engine,'F06 first valid sheet is selected after an empty first worksheet');
  c=await context({viewport:{width:1280,height:900}});p=await open(c);await p.evaluate(()=>window.__qa.seedHistory(95));
  await p.getByRole('link',{name:'Dokumen BAP',exact:true}).click();
  await p.locator('.mg-panel .mg-list-row').first().waitFor();
  assert.equal(await p.locator('.mg-panel .mg-list-row').count(),30);
  for(let i=0;i<3;i++) {
    const previous=await p.locator('.mg-panel .mg-list-row').count();
    await p.getByLabel('Memuat dokumen berikutnya',{exact:true}).scrollIntoViewIfNeeded();
    await p.waitForFunction(n=>document.querySelectorAll('.mg-panel .mg-list-row').length>n,previous);
  }
  assert.equal(await p.locator('.mg-panel .mg-list-row').count(),95);
  await c.close();ok(engine,'R04 archive initially loads 30 metadata rows and loads further pages on scroll');
  await browser.close();browser=null;
 }
 fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
})().catch(async e=>{console.error(e);if(page&&!page.isClosed())await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()});
