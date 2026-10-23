import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const out="out/audit/verification";
mkdirSync(out,{recursive:true});
const fingerprint=()=>{const files=execFileSync("git",["ls-files","-c","-o","--exclude-standard"],{encoding:"utf8"}).trim().split(/\r?\n/).filter(f=>/^(src\/|convex\/|bap-shared\/|scripts\/|public\/|templates\/|package.*\.json$|vite\.config\.js$|vercel\.json$|convex\.json$|index\.html$)/.test(f));const h=createHash("sha256");for(const f of files.sort())h.update(f).update(readFileSync(f));return h.digest("hex")};
const manifest={base:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),startedAt:new Date().toISOString(),sourceFingerprint:fingerprint(),checks:[],passed:false};
const unit=JSON.parse(readFileSync("package.json","utf8")).scripts.test.split(" && ").map(c=>c.replace(/^node /,""));
const scripts=[...unit,"scripts/test-documents-v2.mjs","scripts/ui/audit.cjs","scripts/ui/panggil.cjs","scripts/ui/sidebar.cjs","scripts/ui/faults.cjs","scripts/ui/class-layout.cjs","scripts/ui/pdf.cjs","scripts/ui/offline.cjs","scripts/ui/corrections.cjs","scripts/ui/lifecycle.cjs","scripts/ui/class-controls.cjs"];
for(const script of scripts){
 const started=Date.now(),record={script,passed:false};
 try{const output=execFileSync(process.execPath,[script],{encoding:"utf8",windowsHide:true,maxBuffer:8*1024*1024,stdio:["ignore","pipe","pipe"]});writeFileSync(`${out}/${script.replaceAll("/","-")}.log`,output);record.passed=true;console.log("PASS",script);}
 catch(error){writeFileSync(`${out}/failure.log`,String(error.stdout||"")+String(error.stderr||"")+String(error.message));record.error="See out/audit/verification/failure.log";console.error("FAIL",script);}
 record.durationMs=Date.now()-started;manifest.checks.push(record);writeFileSync(`${out}/results.json`,JSON.stringify(manifest,null,2));if(!record.passed){process.exitCode=1;break;}
}
manifest.sourceUnchanged=manifest.sourceFingerprint===fingerprint();
manifest.passed=manifest.checks.length===scripts.length&&manifest.checks.every(c=>c.passed)&&manifest.sourceUnchanged;
manifest.finishedAt=new Date().toISOString();writeFileSync(`${out}/results.json`,JSON.stringify(manifest,null,2));
if(!manifest.passed)process.exitCode=1;
