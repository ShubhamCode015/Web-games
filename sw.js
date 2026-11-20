const CACHE='wg-b2330947fd';
const CORE=[
  './',
  './manifest.appcache',
  './app.js',
  './games/boxing/game.js',
  './games/boxing/index.html',
  './games/boxing/style.css',
  './games/farm/game.js',
  './games/farm/index.html',
  './games/farm/style.css',
  './games/games.json',
  './games/gyani/game.js',
  './games/gyani/index.html',
  './games/gyani/questions.js',
  './games/gyani/style.css',
  './games/hillclimb/game.js',
  './games/hillclimb/index.html',
  './games/hillclimb/style.css',
  './games/puzzle2048/game.js',
  './games/puzzle2048/index.html',
  './games/puzzle2048/style.css',
  './games/racing/game.js',
  './games/racing/index.html',
  './games/racing/style.css',
  './icon.svg',
  './index.html',
  './manifest.json',
  './style.css'
];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      return Promise.all(CORE.map(function(u){
        return cache.add(u).catch(function(){});
      }));
    }).then(function(){return self.skipWaiting();})
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
    }).then(function(){return self.clients.claim();})
  );
});

function withTimeout(promise,ms){
  return new Promise(function(resolve){
    var done=false;
    var t=setTimeout(function(){if(!done){done=true;resolve(null);}},ms);
    promise.then(function(v){if(!done){done=true;clearTimeout(t);resolve(v);}})
      .catch(function(){if(!done){done=true;clearTimeout(t);resolve(null);}});
  });
}

function cacheFallback(request){
  return caches.match(request).then(function(exact){
    if(exact)return exact;
    return caches.match(request,{ignoreSearch:true});
  });
}

function networkFirst(request){
  return withTimeout(fetch(request),4000).then(function(res){
    if(res&&res.status===200&&(res.type==='basic'||res.type==='default')){
      var copy=res.clone();
      caches.open(CACHE).then(function(c){return c.put(request,copy);}).catch(function(){});
      return res;
    }
    return cacheFallback(request).then(function(cached){return cached||res;});
  }).then(function(r){
    if(r)return r;
    throw new Error('offline');
  });
}

function navigationResponse(request){
  return networkFirst(request).catch(function(){
    return cacheFallback(request).then(function(exact){
      return exact||caches.match('./index.html');
    });
  }).then(function(res){
    return res||new Response('<h1>Offline</h1>',{headers:{'Content-Type':'text/html'}});
  });
}

self.addEventListener('fetch',e=>{
  var req=e.request;
  if(req.method!=='GET')return;
  var url=new URL(req.url);
  if(url.origin!==location.origin)return;

  var isNav=req.mode==='navigate';
  var isCode=/\.(?:js|css|json|html)$/i.test(url.pathname);

  if(isNav){
    e.respondWith(navigationResponse(req));
    return;
  }

  if(isCode){
    e.respondWith(networkFirst(req).catch(function(){
      return cacheFallback(req).then(function(cached){
        return cached||new Response('',{status:503,statusText:'Offline'});
      });
    }));
    return;
  }

  e.respondWith(
    caches.match(req).then(function(cached){
      return cached||networkFirst(req);
    }).catch(function(){return new Response('',{status:503});})
  );
});
