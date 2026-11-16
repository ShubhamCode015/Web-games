const KEY='wg_user';
const GAMES_KEY='wg_games';
const DEFAULT_GAMES=[{title:'Racing',path:'games/racing'}];
const $=id=>document.getElementById(id);
let user=JSON.parse(localStorage.getItem(KEY)||'null');

function saveUser(u){user=u;localStorage.setItem(KEY,JSON.stringify(u));}
function render(){
  const app=$('app');
  if(!user||!user.name){
    app.innerHTML=`
      <div class="card">
        <h1>Create Profile</h1>
        <input id="name" placeholder="Username (required)" maxlength="20">
        <input id="photo" type="file" accept="image/*">
        <button id="save">Save & Continue</button>
        <p class="small">Photo optional. Works offline.</p>
      </div>`;
    $('save').onclick=async()=>{
      const name=$('name').value.trim();
      if(!name){alert('Username required');return;}
      let photo=null;
      const f=$('photo').files[0];
      if(f){photo=await new Promise((res)=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(f);});}
      saveUser({name,photo});
      render();
    };
    return;
  }
  app.innerHTML=`
    <div class="top"><b>Hi, ${escape(user.name)}</b><button id="reset" style="width:auto;padding:6px 10px">Reset</button></div>
    ${user.photo?`<img class="thumb" src="${user.photo}">`:''}
    <div class="card" id="progress"><h1>Progress</h1><div id="plist"></div></div>
    <div class="card">
      <h1>Offline Games</h1>
      <div class="games" id="glist"></div>
      <p class="small" id="empty"></p>
    </div>`;
  const pl=$('plist');
  let anyProgress=false;
  const rp=readJSON('racing_'+user.name);
  if(rp){const d=document.createElement('div');d.className='small';d.textContent=`Racing: Level ${rp.level}, Money ${rp.money}, Distance ${rp.distance}`;pl.appendChild(d);anyProgress=true;}
  const bp=readJSON('boxing_'+user.name);
  if(bp){const d=document.createElement('div');d.className='small';d.textContent=`Boxing: Level ${bp.level}, Money ${bp.money}, Wins ${bp.wins}`;pl.appendChild(d);anyProgress=true;}
  if(!anyProgress)pl.textContent='No progress yet.';
  renderGames($('glist'),DEFAULT_GAMES);
  fetch('games/games.json').then(r=>{if(!r.ok)throw new Error('games.json ' + r.status);return r.json();}).then(d=>{
    if(d&&d.games&&d.games.length)renderGames($('glist'),d.games);
  }).catch(e=>{console.warn('Games list not loaded:',e.message);});
  $('reset').onclick=()=>{localStorage.removeItem(KEY);user=null;render();};
}
function renderGames(gl,games){
  gl.innerHTML='';
  games.forEach(g=>{
    const el=document.createElement('div');
    el.className='game';
    el.textContent=g.title;
    el.onclick=()=>{location.href=g.path+'?user='+encodeURIComponent(user.name);};
    gl.appendChild(el);
  });
  const empty=$('empty');
  if(empty)empty.textContent=games.length?'':'No games yet. Add games to /games folder.';
}
function readJSON(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch(e){return null;}}
function escape(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});