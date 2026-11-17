const CACHE='wg-v5';
const CORE=[
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './games/games.json',
  './games/racing/',
  './games/racing/index.html',
  './games/racing/style.css',
  './games/racing/game.js',
  './games/boxing/',
  './games/boxing/index.html',
  './games/boxing/style.css',
  './games/boxing/game.js'
];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(CORE.map(u=>cache.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(request){
  try{
    const res=await fetch(request);
    if(res&&res.status===200&&res.type==='basic'){
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(request,copy)).catch(()=>{});
    }
    return res;
  }catch(e){
    const exact=await caches.match(request);
    if(exact)return exact;
    const loose=await caches.match(request,{ignoreSearch:true});
    if(loose)return loose;
    throw e;
  }
}

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return;

  const isNav=req.mode==='navigate';
  const fresh=/\.(?:js|css|json|html)$/i.test(url.pathname)||isNav;

  if(isNav){
    e.respondWith((async()=>{
      try{return await networkFirst(req);}
      catch(e){
        const home=await caches.match('./index.html');
        return home||Response.error();
      }
    })());
    return;
  }

  if(fresh){
    e.respondWith(networkFirst(req).catch(async()=>{
      const cached=await caches.match(req,{ignoreSearch:true});
      return cached||Response.error();
    }));
    return;
  }

  e.respondWith(caches.match(req).then(r=>r||networkFirst(req)));
});
