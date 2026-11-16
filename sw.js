const CACHE='wg-v3';
const CORE=['./','./index.html','./style.css','./app.js','./manifest.json','./icon.svg','./games/games.json','./games/racing/index.html','./games/racing/style.css','./games/racing/game.js','./games/boxing/index.html','./games/boxing/style.css','./games/boxing/game.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request).then(r=>{
    if(r)return r;
    return fetch(e.request).then(res=>{
      if(res&&res.status===200&&res.type==='basic'){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}
      return res;
    }).catch(()=>caches.match('./index.html'));
  }));
});