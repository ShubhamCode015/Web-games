const KEY='wg_user';
const DEFAULT_GAMES=[
  {title:'Racing',path:'games/racing/index.html',icon:'🏎️',desc:'2D top-down street racing'},
  {title:'Boxing',path:'games/boxing/index.html',icon:'🥊',desc:'2D side-view ring fighting'},
  {title:'Hill Climb',path:'games/hillclimb/index.html',icon:'🚙',desc:'Off-road hill climbing'},
  {title:'2048 Puzzle',path:'games/puzzle2048/index.html',icon:'🔢',desc:'Number tile puzzle'},
  {title:'Farm Sim',path:'games/farm/index.html',icon:'🌾',desc:'Idle farming simulation'},
  {title:'Kon Banega Gyani',path:'games/gyani/index.html',icon:'🧠',desc:'KBC-style ज्ञान की यात्रा'},
  {title:'Snake',path:'games/snake/index.html',icon:'🐍',desc:'Classic snake — eat, grow, survive'},
  {title:'Bounce',path:'games/bounce/index.html',icon:'🔴',desc:'Bouncy ball ring adventure'},
  {title:'Tic Tac Toe',path:'games/tictactoe/index.html',icon:'❌',desc:'X/O strategy — bot, same phone or 2 phones'},
  {title:'Ludo',path:'games/ludo/index.html',icon:'🎲',desc:'Classic 4-token race — bot, same phone or 2 phones'}
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
    const hp=readJSON('hillclimb_'+user.name);
    if(hp){const d=document.createElement('div');d.className='progline';d.innerHTML=`<span class="dot hill"></span>Hill Climb <b>Lv ${escape(hp.level)}</b> · $${escape(hp.money)} · best ${escape(hp.best||0)}m`;pl.appendChild(d);anyProgress=true;}
    const p2=readJSON('puzzle2048_'+user.name);
    if(p2){const d=document.createElement('div');d.className='progline';d.innerHTML=`<span class="dot puzzle"></span>2048 Puzzle <b>Lv ${escape(p2.level)}</b> · $${escape(p2.money)} · best ${escape(p2.best||0)}`;pl.appendChild(d);anyProgress=true;}
    const fp=readJSON('farm_'+user.name);
    if(fp){const d=document.createElement('div');d.className='progline';d.innerHTML=`<span class="dot farm"></span>Farm Sim <b>Lv ${escape(fp.level)}</b> · $${escape(fp.money)} · ${escape(fp.harvests||0)} harvests`;pl.appendChild(d);anyProgress=true;}
    const gp=readJSON('gyani_'+user.name);
    if(gp){const d=document.createElement('div');d.className='progline';d.innerHTML=`<span class="dot gyani"></span>Gyani <b>स्तर ${escape((gp.stage||0)+1)}</b> · ₹${escape(gp.money||0)} · 🔥${escape(gp.streak||0)} streak`;pl.appendChild(d);anyProgress=true;}
    const sp=readJSON('snake_'+user.name);
    if(sp){const d=document.createElement('div');d.className='progline';d.innerHTML=`<span class="dot snake"></span>Snake <b>Lv ${escape(sp.level||1)}</b> · $${escape(sp.money||0)} · best ${escape(sp.best||0)}`;pl.appendChild(d);anyProgress=true;}
    const bo=readJSON('bounce_'+user.name);
    if(bo){const done=Array.isArray(bo.levelsDone)?bo.levelsDone.length:0;const d=document.createElement('div');d.className='progline';d.innerHTML=`<span class="dot bounce"></span>Bounce <b>Lv ${escape(bo.level||1)}</b> · $${escape(bo.money||0)} · ${escape(done)}/6 levels`;pl.appendChild(d);anyProgress=true;}
    const tp=readJSON('tictactoe_'+user.name);
    if(tp){const d=document.createElement('div');d.className='progline';d.innerHTML=`<span class="dot ttt"></span>Tic Tac Toe <b>${escape(tp.wins||0)}W-${escape(tp.losses||0)}L-${escape(tp.draws||0)}D</b> · ${escape(tp.games||0)} games`;pl.appendChild(d);anyProgress=true;}
    const lp=readJSON('ludo_'+user.name);
    if(lp){const d=document.createElement('div');d.className='progline';d.innerHTML=`<span class="dot ludo"></span>Ludo <b>Bot ${escape(lp.botWins||0)}-${escape(lp.botLosses||0)}</b> · 2 phones ${escape(lp.remoteWins||0)}-${escape(lp.remoteLosses||0)}`;pl.appendChild(d);anyProgress=true;}
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
    const url=gameUrl(g.path);
    const el=document.createElement(url?'a':'div');
    el.className='game';
    if(url)el.href=url;
    el.innerHTML=`<div class="gicon">${escape(g.icon||'🎮')}</div><div class="gtitle">${escape(g.title)}</div><div class="gdesc small">${escape(g.desc||'')}</div>`;
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
