const KEY='wg_user';
const DEFAULT_GAMES=[
  {title:'Racing',path:'games/racing/index.html',icon:'🏎️',desc:'Pseudo-3D street racing'},
  {title:'Boxing',path:'games/boxing/index.html',icon:'🥊',desc:'3D ring fighting'}
];
const $=id=>document.getElementById(id);

function storeGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function storeSet(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}}
function storeDel(k){try{localStorage.removeItem(k);}catch(e){}}
function readJSON(key){try{return JSON.parse(storeGet(key)||'null');}catch(e){return null;}}

let user=readJSON(KEY);

function saveUser(u){user=u;storeSet(KEY,JSON.stringify(u));}
function escape(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function showFatal(msg){
  const app=$('app');
  if(!app)return;
  app.innerHTML=`<div class="card"><h1>Something went wrong</h1>
    <p class="small">${escape(msg||'The app could not start on this device.')}</p>
    <button id="reload">Reload</button></div>`;
  const r=$('reload');
  if(r)r.onclick=()=>location.reload();
}

function bootstrap(){
  try{
    if(!$('app')){
      document.body.innerHTML='<div id="app"></div>';
    }
    render();
  }catch(e){
    console.error(e);
    showFatal('Startup error: '+e.message);
  }
}

function render(){
  const app=$('app');
  if(!user||!user.name){
    app.innerHTML=`
      <div class="card profile-card">
        <h1>Create Profile</h1>
        <div class="avatar-pick">
          <img id="preview" class="thumb" alt="" hidden>
          <span id="avatarHint" class="small">Optional photo</span>
        </div>
        <input id="name" placeholder="Username (required)" maxlength="20" autocomplete="off">
        <input id="photo" type="file" accept="image/*">
        <button id="save">Save &amp; Continue</button>
        <p class="small">Photo optional. Works offline.</p>
      </div>`;
    const photoInput=$('photo');
    if(photoInput)photoInput.onchange=()=>{
      const f=photoInput.files[0];
      const img=$('preview');
      if(f&&img){const r=new FileReader();r.onload=()=>{img.src=r.result;img.hidden=false;const h=$('avatarHint');if(h)h.hidden=true;};r.readAsDataURL(f);}
    };
    $('save').onclick=()=>{
      const name=($('name').value||'').trim();
      if(!name){alert('Username required');return;}
      const f=$('photo')&&$('photo').files?$('photo').files[0]:null;
      const finish=(photo)=>{saveUser({name,photo:photo||null});render();};
      if(!f){finish(null);return;}
      try{
        const r=new FileReader();
        r.onload=()=>finish(r.result);
        r.onerror=()=>finish(null);
        r.readAsDataURL(f);
      }catch(e){finish(null);}
    };
    return;
  }
  const safeName=escape(user.name);
  app.innerHTML=`
    <div class="top">
      <div class="top-user">
        ${user.photo?`<img class="thumb tiny" src="${user.photo}" alt="">`:`<span class="thumb tiny initial">${escape((user.name[0]||'?').toUpperCase())}</span>`}
        <b>Hi, ${safeName}</b>
      </div>
      <button id="reset" class="mini">Reset</button>
    </div>
    <div class="card" id="progress"><h1>Progress</h1><div id="plist"></div></div>
    <div class="card">
      <h1>Offline Games</h1>
      <div class="games" id="glist"></div>
      <p class="small" id="empty"></p>
      <p class="small cacheline" id="cacheStatus"></p>
    </div>`;
  const pl=$('plist');
  let anyProgress=false;
  try{
    const rp=readJSON('racing_'+user.name);
    if(rp){const d=document.createElement('div');d.className='progline';d.innerHTML=`<span class="dot race"></span>Racing <b>Lv ${escape(rp.level)}</b> · $${escape(rp.money)} · ${escape(rp.distance)}m`;pl.appendChild(d);anyProgress=true;}
    const bp=readJSON('boxing_'+user.name);
    if(bp){const d=document.createElement('div');d.className='progline';d.innerHTML=`<span class="dot box"></span>Boxing <b>Lv ${escape(bp.level)}</b> · $${escape(bp.money)} · ${escape(bp.wins)} wins`;pl.appendChild(d);anyProgress=true;}
  }catch(e){}
  if(!anyProgress)pl.textContent='No progress yet. Play a game to get started.';
  renderGames($('glist'),DEFAULT_GAMES);
  fetch('games/games.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('games.json '+r.status);return r.json();}).then(d=>{
    if(d&&Array.isArray(d.games)&&d.games.length)renderGames($('glist'),d.games);
  }).catch(e=>{console.warn('Games list not loaded:',e.message);});
  $('reset').onclick=()=>{
    if(!confirm('Reset profile? Game progress stays saved.'))return;
    storeDel(KEY);user=null;render();
  };
  updateCacheStatus();
}

function gameUrl(path){
  let url=String(path||'').trim();
  if(!url)return null;
  url=url.split('?')[0].split('#')[0];
  if(/\/$/.test(url))url+='index.html';
  return url;
}

function offlineReady(){
  var ac=window.applicationCache||null;
  if(ac){
    try{
      if(ac.status===ac.CACHED||ac.status===ac.UPDATEREADY)return true;
    }catch(e){}
  }
  try{
    if(navigator.serviceWorker&&navigator.serviceWorker.controller)return true;
  }catch(e){}
  return false;
}
function updateCacheStatus(){
  var el=$('cacheStatus');
  if(!el)return;
  var ready=offlineReady();
  if(navigator.onLine===false){
    el.textContent=ready?'Offline mode — games ready':'Offline — open once with internet first';
    el.className='small cacheline '+(ready?'ready':'warn');
  }else if(ready){
    el.textContent='Offline ready ✓ — works without internet';
    el.className='small cacheline ready';
  }else{
    el.textContent='Saving for offline use… (online rakho thodi der)';
    el.className='small cacheline saving';
  }
}

function renderGames(gl,games){
  if(!gl)return;
  gl.innerHTML='';
  games.forEach(g=>{
    const el=document.createElement('div');
    el.className='game';
    el.innerHTML=`<div class="gicon">${escape(g.icon||'🎮')}</div><div class="gtitle">${escape(g.title)}</div><div class="gdesc small">${escape(g.desc||'')}</div>`;
    el.onclick=()=>{const url=gameUrl(g.path);if(url)location.href=url;};
    gl.appendChild(el);
  });
  const empty=$('empty');
  if(empty)empty.textContent=games.length?'':'No games yet. Add games to /games folder.';
}

bootstrap();

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').then(reg=>{
      try{reg.update();}catch(e){}
      reg.addEventListener('updatefound',()=>{
        const nw=reg.installing;
        if(!nw)return;
        nw.addEventListener('statechange',()=>{
          if(nw.state==='activated'&&navigator.serviceWorker.controller){
            let done=false;
            try{done=sessionStorage.getItem('wg_reloaded')==='1';}catch(e){done=false;}
            if(!done){
              try{sessionStorage.setItem('wg_reloaded','1');}catch(e){}
              location.reload();
            }
          }
        });
      });
    }).catch(()=>{});
  });
}

try{
  window.addEventListener('online',updateCacheStatus);
  window.addEventListener('offline',updateCacheStatus);
}catch(e){}

if(window.applicationCache){
  try{
    var ac=window.applicationCache;
    function acSync(){
      try{
        if(ac.status===ac.UPDATEREADY)ac.swapCache();
      }catch(e){}
      updateCacheStatus();
    }
    ['checking','downloading','progress','cached','updateready','noupdate','error','obsolete'].forEach(function(ev){
      try{ac.addEventListener(ev,acSync,false);}catch(e){}
    });
    acSync();
  }catch(e){}
}
