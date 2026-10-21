import {parseArgs,stripVTControlCharacters} from "node:util";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync,existsSync,mkdirSync} from "node:fs";
const {values}=parseArgs({options:{deployment:{type:"string"},enable:{type:"boolean"},disable:{type:"boolean"}}});
if(!values.deployment||values.enable&&values.disable)throw Error("Specify --deployment explicitly and at most one of --enable/--disable.");
const run=(name,args)=>JSON.parse(stripVTControlCharacters(execFileSync(process.execPath,["node_modules/convex/bin/main.js","run",name,JSON.stringify(args),"--deployment",values.deployment,"--codegen","disable"],{encoding:"utf8",windowsHide:true,stdio:["ignore","pipe","inherit"]})).trim());
if(values.disable){console.log(run("revisionRollout:setEnabled",{enabled:false}));process.exit(0);}
mkdirSync("out/revisions",{recursive:true});
const file=`out/revisions/backfill-${createHash("sha256").update(values.deployment).digest("hex").slice(0,12)}.json`;
const state=existsSync(file)?JSON.parse(readFileSync(file,"utf8")):{deployment:values.deployment,phase:0,cursor:null};
if(state.deployment!==values.deployment)throw Error("Checkpoint deployment mismatch");
const phases=["pertemuan","bapDoc","kelas"];
while(state.phase<phases.length){const phase=phases[state.phase],r=run("revisionRollout:backfill",{phase,...(state.cursor?{cursor:state.cursor}:{})});
 if(typeof r.isDone!=="boolean"||!r.isDone&&!r.continueCursor)throw Error("Unexpected backfill result");
 state.cursor=r.continueCursor;if(r.isDone){state.phase++;state.cursor=null;}
 writeFileSync(file,JSON.stringify(state,null,2));console.log(`${phase}: ${r.count} rows; ${r.isDone?"complete":"checkpoint saved"}`);}
if(values.enable)console.log(run("revisionRollout:setEnabled",{enabled:true}));
else console.log("Ledger ready. Feature flag unchanged. Enable explicitly after preview validation.");
