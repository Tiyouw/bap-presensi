import { createHash } from "node:crypto";

// Precache only build artifacts. No Convex responses, credentials, or roster
// records enter the shared service-worker cache.
export function appShellPlugin() {
  let base = "/";
  return {
    name: "bap-offline-app-shell",
    apply: "build",
    enforce: "post",
    configResolved(config) { base = config.base; },
    generateBundle(_, bundle) {
      const names = Object.keys(bundle).filter(name => !name.endsWith(".map")).sort();
      const hash = createHash("sha256");
      for (const name of names) hash.update(name).update(bundle[name].code || bundle[name].source || "");
      const version = hash.digest("hex").slice(0, 20);
      const paths = [...new Set([base + "index.html", base + "favicon.svg", base + "third-party-notices.txt", ...names.map(name => base + name)])];
      const source = `const CACHE='bap-shell-${version}';
const PREFIX='bap-shell-';
const SHELL=${JSON.stringify(base + "index.html")};
const ASSETS=${JSON.stringify(paths)};
const ALLOWED=new Set(ASSETS);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||request.headers.has('Authorization'))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{try{const response=await fetch(request);if(response.ok)return response;}catch{}const cache=await caches.open(CACHE);return await cache.match(SHELL)||Response.error();})());
 }else if(!url.search&&ALLOWED.has(url.pathname)){
  event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(url.pathname);if(cached)return cached;return fetch(request);})());
 }
});`;
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}
