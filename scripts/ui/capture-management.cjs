/** Before images come from the actual PR base; only the synthetic data adapter is aligned. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync,spawn}=require('node:child_process'),{chromium}=require('playwright');
const root=process.cwd(),base='70c7dbbb4fddf6e78362a41213e052eb1268d1ee',dir=path.join(root,'out/management-base'),shots=path.join(root,'docs/management-v2');
let beforeServer,afterServer,browser;
async function serve(args,port){const child=spawn(process.execPath,['node_modules/vite/bin/vite.js',...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';child.stderr.on('data',b=>output+=b);for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/`)).ok)return child;}catch{}if(child.exitCode!==null)throw Error(output);await new Promise(r=>setTimeout(r,100));}throw Error('Vite startup: '+output);}
(async()=>{
const {ConvexHttpClient}=await import('convex/browser'),{api}=await import('../../convex/_generated/api.js'),password=process.env.BAP_QA_PASSWORD||JSON.parse(fs.readFileSync('out/management/qa-credentials.json')).password;
const client=new ConvexHttpClient('https://doting-horse-423.convex.cloud'),token=(await client.action(api.authNode.login,{username:'admin.qa',password})).token;
const catalog=await client.query(api.kelola.catalog,{token}),c=catalog.kelas.find(c=>c.matkulKode==='PPB'),data=await client.query(api.kelola.detail,{token,kelasId:c.id}),meeting=data.pertemuan.find(p=>p.nomor===3);
if(meeting.revision!==0)throw Error('Comparison expects untouched synthetic PPB meeting3.');
for(const file of execFileSync('git',['ls-tree','-r','--name-only',base,'src','index.html','bap-shared','scripts/ui'],{encoding:'utf8'}).trim().split('\n')){const target=path.join(dir,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,execFileSync('git',['show',`${base}:${file}`]));}
fs.writeFileSync(path.join(dir,'scripts/ui/data-fixture.js'),`export const PESERTA=${JSON.stringify(data.peserta.map(p=>({nim:p.nim,nama:p.nama,golongan:p.golongan,urut:p.urut})))};`);
const slash=p=>p.replaceAll('\\','/');fs.writeFileSync(path.join(dir,'vite.config.mjs'),`import{defineConfig}from'vite';import react from'@vitejs/plugin-react';export default defineConfig({root:${JSON.stringify(slash(dir))},plugins:[react()],define:{'import.meta.env.VITE_CONVEX_URL':JSON.stringify('https://ui-fixture.convex.cloud')},resolve:{alias:[{find:/^convex\\/react$/,replacement:${JSON.stringify(slash(path.join(dir,'scripts/ui/convex-fixture.jsx')))}},{find:/^.*convex\\/_generated\\/api\\.js$/,replacement:${JSON.stringify(slash(path.join(dir,'scripts/ui/api-fixture.js')))}}]},server:{host:'127.0.0.1',port:5186,strictPort:true}});`);
beforeServer=await serve(['--config',path.join(dir,'vite.config.mjs')],5186);afterServer=await serve(['--host','127.0.0.1','--port','5187','--strictPort'],5187);browser=await chromium.launch();fs.mkdirSync(shots,{recursive:true});
for(const width of [390,1280])for(const mode of ['before','after']){
 const device=width===390?'mobile':'desktop',context=await browser.newContext({viewport:{width,height:width===390?844:900},colorScheme:'dark',reducedMotion:'reduce'}),page=await context.newPage();
 await page.addInitScript(({mode,token})=>{localStorage.setItem('bap.guide.dismissed.v1','1');localStorage.setItem('bap.theme','dark');if(mode==='before')localStorage.setItem('bap.token','ui-test-token');else localStorage.setItem('bap.token',token);},{mode,token});
 await page.goto(`http://127.0.0.1:${mode==='before'?5186:5187}${mode==='before'?'/':`/kelas/${c.id}`}`);await page.locator('.meeting-row').last().waitFor({timeout:30000});
 await page.screenshot({path:path.join(shots,`${mode}-kelas-${device}.png`),fullPage:true});
 await page.locator('.meeting-row').filter({hasText:'Pertemuan 3'}).click();await page.locator('.student-row').last().waitFor();await page.screenshot({path:path.join(shots,`${mode}-presensi-${device}.png`)});
 if(mode==='after'){await page.getByRole('button',{name:'Cari matkul, mahasiswa, atau fitur',exact:true}).click();await page.getByRole('combobox').fill('Alya');await page.getByRole('option').first().waitFor();await page.screenshot({path:path.join(shots,`after-search-${device}.png`)});}
 await context.close();
}
fs.writeFileSync(path.join(shots,'README.md'),`# Screenshot Management v2\n\nBase: ${base}. Before menggunakan sumber base asli dengan adapter data sintetis disamakan dengan QA. After memakai backend Convex QA nyata. PPB93 peserta,16 minggu, pertemuan3 terbuka, belum ada perubahan presensi. Viewport390×844 dan1280×900, tema gelap, reduced motion. Tidak memuat roster produksi atau kredensial.\n\nJalankan node scripts/ui/capture-management.cjs setelah QA sintetis disiapkan.\n`);
console.log('Actual-base before/after comparison saved.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();beforeServer?.kill();afterServer?.kill();});
