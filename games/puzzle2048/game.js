/* ===== 2048 Puzzle ===== */
let params;
try{params=new URLSearchParams(location.search);}catch(e){params={get:function(){return null;}};}
function storeGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function storeSet(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}}

let user=params.get('user');
if(!user){try{const u=JSON.parse(storeGet('wg_user')||'null');if(u&&u.name)user=u.name;}catch(e){}}
if(!user)user='guest';
const KEY='puzzle2048_'+user;

const MISSIONS=[
  {id:'tile256',title:'Reach a 256 tile',target:256,type:'bestTile',reward:100},
  {id:'tile512',title:'Reach a 512 tile',target:512,type:'bestTile',reward:250},
  {id:'tile2048',title:'Reach a 2048 tile',target:2048,type:'bestTile',reward:1000},
  {id:'score10000',title:'Score 10,000 in one game',target:10000,type:'bestScore',reward:500},
  {id:'wins3',title:'Win 3 games',target:3,type:'wins',reward:750},
  {id:'games5',title:'Play 5 games',target:5,type:'gamesPlayed',reward:150}
];

function xpNeeded(l){return l*100;}
function defaultState(){
  return {user,money:0,xp:0,level:1,best:0,bestTile:0,bestScore:0,wins:0,gamesPlayed:0,totalScore:0,
    missions:MISSIONS.map(m=>({id:m.id,title:m.title,progress:0,done:false,type:m.type,target:m.target,reward:m.reward}))};
}
function loadState(){
  let s=null;
  try{s=JSON.parse(storeGet(KEY)||'null');}catch(e){s=null;}
  if(!s||!s.user)s=defaultState();
  ['money','xp','level','best','bestTile','bestScore','wins','gamesPlayed','totalScore'].forEach(k=>{
    if(typeof s[k]!=='number'||!isFinite(s[k]))s[k]=0;
  });
  if(!(s.level>=1))s.level=1;
  if(!Array.isArray(s.missions))s.missions=[];
  MISSIONS.forEach(def=>{
    if(!s.missions.some(m=>m&&m.id===def.id))s.missions.push({id:def.id,progress:0,done:false});
    const m=s.missions.find(m=>m&&m.id===def.id);
    if(m){m.type=def.type;m.target=def.target;m.reward=def.reward;m.title=def.title;}
  });
  return s;
}
let state=loadState();
function save(){storeSet(KEY,JSON.stringify(state));}

const $=id=>document.getElementById(id);

/* ---------- Audio ---------- */
let audioCtx=null,master=null,muted=false;
function unlockAudio(){
  try{
    if(!audioCtx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;
      audioCtx=new AC();
      master=audioCtx.createGain();master.gain.value=0.85;master.connect(audioCtx.destination);
    }
    if(audioCtx.state==='suspended')audioCtx.resume();
  }catch(e){}
}
function tone(freq,dur,type,vol,slideTo){
  if(!audioCtx||muted)return;
  try{
    const t=audioCtx.currentTime;
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.type=type||'sine';
    o.frequency.setValueAtTime(freq,t);
    if(slideTo)o.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo),t+dur);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vol||0.08,t+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+0.03);
  }catch(e){}
}
function clickSound(){tone(500,0.06,'square',0.055);}
function coinSound(){tone(980,0.14,'triangle',0.11,1400);}
function moveSound(){tone(300,0.06,'triangle',0.05,170);}
function spawnSound(){tone(880,0.03,'square',0.032);}
function mergeSound(k){tone(460*Math.pow(1.22,k||0),0.15,'sine',0.12);}
function levelSound(){tone(660,0.15,'square',0.1,990);}
function winFanfare(){
  const seq=[523,659,784,1047,1319];
  seq.forEach((f,i)=>{setTimeout(()=>{tone(f,0.24,'triangle',0.14);},i*130);});
}
function loseSound(){tone(320,0.55,'sawtooth',0.12,110);}
function missionSound(){tone(900,0.18,'triangle',0.12,1250);}
document.addEventListener('pointerdown',unlockAudio,{once:true});
document.addEventListener('touchstart',unlockAudio,{once:true,passive:true});
document.addEventListener('keydown',unlockAudio,{once:true});

/* ---------- Game state ---------- */
const SIZE=4,GAP=10;
let cellMap=new Array(16).fill(null);
let tileSeq=0;
let tileEls={};
const game={score:0,moves:0,over:false,winShown:false,winCounted:false,milestoneCoins:0,milestones:{},inputBlocked:false,coinsClaimed:false};
const MILESTONES={256:10,512:25,1024:60,2048:150,4096:200};

function show(id){
  const list=document.querySelectorAll('.overlay');
  for(let i=0;i<list.length;i++)list[i].classList.add('hidden');
  if(id){$(id).classList.remove('hidden');var b=$(id).querySelector('button');if(b){try{b.focus();}catch(e){}}}
}
function overlayVisible(){
  const list=document.querySelectorAll('.overlay');
  for(let i=0;i<list.length;i++)if(!list[i].classList.contains('hidden'))return true;
  return false;
}
function addXp(n){
  if(n<=0)return;
  state.xp+=n;
  let leveled=false;
  while(state.xp>=xpNeeded(state.level)){
    state.xp-=xpNeeded(state.level);
    state.level++;
    state.money+=state.level*50;
    leveled=true;
  }
  if(leveled)levelSound();
}
function runCoins(){return Math.floor(game.score/25)+game.milestoneCoins;}

/* ---------- Missions ---------- */
function missionValue(def){
  if(def.type==='bestTile')return state.bestTile;
  if(def.type==='bestScore')return state.bestScore;
  if(def.type==='wins')return state.wins;
  if(def.type==='gamesPlayed')return state.gamesPlayed;
  return 0;
}
function renderMissions(){
  const el=$('mlist');el.innerHTML='';
  state.missions.forEach(m=>{
    const def=MISSIONS.find(x=>x.id===m.id);
    if(!def)return;
    const d=document.createElement('div');d.className='mitem';
    const prog=Math.min(missionValue(def),def.target);
    const pct=Math.round(prog/def.target*100);
    d.innerHTML='<b>'+def.title+'</b><span>'+prog+'/'+def.target+' &middot; Reward '+def.reward+' coins'+(m.done?' &middot; DONE':'')+'</span>'+
      '<div class="bar mini"><i style="width:'+pct+'%;background:'+(m.done?'#22c55e':'#3b82f6')+'"></i></div>';
    el.appendChild(d);
  });
}
function checkMissions(){
  state.missions.forEach(m=>{
    if(m.done)return;
    const def=MISSIONS.find(x=>x.id===m.id);
    if(!def)return;
    m.progress=missionValue(def);
    if(m.progress>=def.target){
      m.done=true;
      state.money+=def.reward;
      missionSound();
      setTimeout(()=>{alert('Mission complete: '+def.title+' (+'+def.reward+' coins)');},120);
    }
  });
}

/* ---------- Board DOM ---------- */
function setupBoardCells(){
  const cells=$('cells');cells.innerHTML='';
  for(let i=0;i<16;i++){
    const d=document.createElement('div');d.className='cell';cells.appendChild(d);
  }
}
function boardMetrics(){
  const tw=$('tiles').clientWidth||1;
  const cell=(tw-GAP*(SIZE-1))/SIZE;
  return {cell:cell,step:cell+GAP};
}
function applyTileGeom(t){
  const el=tileEls[t.id];if(!el)return;
  const m=boardMetrics();
  el.style.width=m.cell+'px';
  el.style.height=m.cell+'px';
  el.style.fontSize=Math.round(m.cell*(t.value>=1024?0.32:t.value>=128?0.4:0.46))+'px';
  el.style.transform='translate('+Math.round(t.c*m.step)+'px,'+Math.round(t.r*m.step)+'px)';
}
function createTileEl(t,isNew){
  const el=document.createElement('div');
  el.className='tile t'+(t.value<=2048?t.value:'super');
  el.dataset.id=t.id;
  el.style.zIndex=t.merged?20:10;
  const inner=document.createElement('div');
  inner.className='tile-in'+(isNew?' pop':'')+(t.merged?' mergepop':'');
  inner.textContent=t.value;
  el.appendChild(inner);
  $('tiles').appendChild(el);
  tileEls[t.id]=el;
  applyTileGeom(t);
}
function clearTiles(){
  $('tiles').innerHTML='';
  tileEls={};
}
function floatAt(r,c,text,gold){
  const fx=$('fx');if(!fx)return;
  const m=boardMetrics();
  const d=document.createElement('div');
  d.className='float'+(gold?' gold':'');
  d.textContent=text;
  d.style.left=Math.round(c*m.step+m.cell/2)+'px';
  d.style.top=Math.round(r*m.step+m.cell/2)+'px';
  fx.appendChild(d);
  setTimeout(()=>{if(d.parentNode)d.parentNode.removeChild(d);},950);
}
function randSpawn(){
  const empties=[];
  for(let i=0;i<16;i++)if(!cellMap[i])empties.push(i);
  if(!empties.length)return;
  const idx=empties[(Math.random()*empties.length)|0];
  const value=Math.random()<0.9?2:4;
  const t={id:++tileSeq,value:value,r:(idx/4)|0,c:idx%4};
  cellMap[idx]=t;
  createTileEl(t,true);
  state.bestTile=Math.max(state.bestTile,value);
}

/* ---------- Move logic ---------- */
function linesFor(dir){
  const lines=[];
  if(dir==='left'||dir==='right'){
    for(let r=0;r<SIZE;r++){
      const line=[];
      for(let c=0;c<SIZE;c++)line.push({r:r,c:c});
      if(dir==='right')line.reverse();
      lines.push(line);
    }
  }else{
    for(let c=0;c<SIZE;c++){
      const line=[];
      for(let r=0;r<SIZE;r++)line.push({r:r,c:c});
      if(dir==='down')line.reverse();
      lines.push(line);
    }
  }
  return lines;
}
function checkMilestone(t){
  const bonus=MILESTONES[t.value];
  if(bonus&&!game.milestones[t.value]){
    game.milestones[t.value]=true;
    game.milestoneCoins+=bonus;
    floatAt(t.r,t.c,'+'+bonus+' coins',true);
    coinSound();
  }
}
function handleWin(){
  if(!game.winCounted){game.winCounted=true;state.wins++;}
  if(!game.winShown){
    game.winShown=true;
    game.inputBlocked=true;
    winFanfare();
    showOver(true,coinsEarnedText());
  }
}
function doMove(dir){
  if(game.over||game.inputBlocked)return;
  unlockAudio();
  const lines=linesFor(dir);
  let moved=false,gained=0;
  const merges=[];
  const consumed=[];
  const newMap=new Array(16).fill(null);
  for(const line of lines){
    const seq=[];
    for(const p of line){const t=cellMap[p.r*4+p.c];if(t)seq.push(t);}
    let w=0;
    for(let i=0;i<seq.length;i++){
      const t=seq[i];
      if(i+1<seq.length&&seq[i+1].value===t.value){
        const o=seq[i+1];
        const pos=line[w];
        t.r=pos.r;t.c=pos.c;o.r=pos.r;o.c=pos.c;
        applyTileGeom(t);applyTileGeom(o);
        consumed.push(t,o);
        const nv=t.value*2;
        gained+=nv;
        const m={id:++tileSeq,value:nv,r:pos.r,c:pos.c,merged:true};
        merges.push(m);
        newMap[pos.r*4+pos.c]=m;
        moved=true;
        i++;
      }else{
        const pos=line[w];
        const nr=pos.r,nc=pos.c;
        if(t.r!==nr||t.c!==nc)moved=true;
        t.r=nr;t.c=nc;
        applyTileGeom(t);
        newMap[nr*4+nc]=t;
      }
      w++;
    }
  }
  if(!moved)return;
  cellMap=newMap;
  if(gained>0){
    game.score+=gained;
    state.totalScore+=gained;
    addXp(gained);
    if(game.score>state.bestScore){state.bestScore=game.score;state.best=game.score;}
  }
  game.moves++;
  consumed.forEach(t=>{
    const el=tileEls[t.id];
    delete tileEls[t.id];
    if(el)setTimeout(()=>{if(el.parentNode)el.parentNode.removeChild(el);},140);
  });
  merges.forEach((m,k)=>{
    createTileEl(m,false);
    mergeSound(k);
    floatAt(m.r,m.c,'+'+m.value,false);
    state.bestTile=Math.max(state.bestTile,m.value);
    checkMilestone(m);
    if(m.value>=2048)handleWin();
  });
  moveSound();
  randSpawn();
  spawnSound();
  refreshHud();
  save();
  if(!game.over&&!game.inputBlocked&&!movesAvailable()){
    game.over=true;
    finishLoss();
  }
}
function movesAvailable(){
  for(let i=0;i<16;i++)if(!cellMap[i])return true;
  for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
    const cell=cellMap[r*4+c];
    if(!cell)return true;
    const v=cell.value;
    if(c+1<SIZE&&cellMap[r*4+c+1]&&cellMap[r*4+c+1].value===v)return true;
    if(r+1<SIZE&&cellMap[(r+1)*4+c]&&cellMap[(r+1)*4+c].value===v)return true;
  }
  return false;
}

/* ---------- Round lifecycle ---------- */
function refreshHud(){
  $('gscore').textContent=game.score;
  $('gbest').textContent=Math.max(state.bestScore,game.score);
  $('gcoins').textContent=runCoins();
  $('gmoves').textContent=game.moves;
}
function endRun(){
  if(game.coinsClaimed||game.moves===0)return;
  const coins=runCoins();
  state.money+=coins;
  state.gamesPlayed++;
  state.best=state.bestScore;
  checkMissions();
  game.coinsClaimed=true;
  save();
}
function coinsEarnedText(){return runCoins();}
function showOver(win,coins){
  $('otitle').textContent=win?'2048! You Win!':'Game Over';
  $('otext').textContent=win?'You reached the 2048 tile!':'No more moves.';
  $('oscore').textContent=game.score;
  $('obest').textContent=Math.max(state.bestScore,game.score);
  $('ocoins').textContent=coins;
  $('keepgoing').classList.toggle('hidden',!win);
  show('over');
}
function finishLoss(){
  endRun();
  loseSound();
  showOver(false,coinsEarnedText());
  save();
}
function startNewGame(){
  cellMap=new Array(16).fill(null);
  tileSeq=0;
  clearTiles();
  game.score=0;game.moves=0;game.over=false;
  game.winShown=false;game.winCounted=false;
  game.milestoneCoins=0;game.milestones={};
  game.inputBlocked=false;game.coinsClaimed=false;
  randSpawn();
  randSpawn();
  refreshHud();
  show(null);
}

/* ---------- Menu / HUD ---------- */
function updateMenu(){
  $('userinfo').textContent='Player: '+state.user;
  $('mlevel').textContent=state.level;
  $('mxp').textContent=state.xp;
  $('mneed').textContent=xpNeeded(state.level);
  $('mmoney').textContent=state.money;
  $('mbest').textContent=state.bestScore;
  $('mtile').textContent=state.bestTile;
  $('mstats').textContent='Wins '+state.wins+' \u00B7 Games '+state.gamesPlayed+' \u00B7 Total score '+state.totalScore;
}

/* ---------- Input ---------- */
const boardEl=$('board');
let touchStart=null;
boardEl.addEventListener('touchstart',e=>{
  e.preventDefault();
  unlockAudio();
  if(e.changedTouches.length){
    const t=e.changedTouches[0];
    touchStart={x:t.clientX,y:t.clientY};
  }
},{passive:false});
boardEl.addEventListener('touchmove',e=>{e.preventDefault();},{passive:false});
boardEl.addEventListener('touchend',e=>{
  e.preventDefault();
  if(!touchStart)return;
  const t=e.changedTouches[0];
  const dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;
  touchStart=null;
  const adx=Math.abs(dx),ady=Math.abs(dy);
  if(Math.max(adx,ady)<24)return;
  if(adx>ady)doMove(dx>0?'right':'left');
  else doMove(dy>0?'down':'up');
},{passive:false});
boardEl.addEventListener('touchcancel',()=>{touchStart=null;});
let ptrStart=null;
boardEl.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch')return;
  unlockAudio();
  ptrStart={x:e.clientX,y:e.clientY};
});
boardEl.addEventListener('pointerup',e=>{
  if(e.pointerType==='touch'||!ptrStart)return;
  const dx=e.clientX-ptrStart.x,dy=e.clientY-ptrStart.y;
  ptrStart=null;
  const adx=Math.abs(dx),ady=Math.abs(dy);
  if(Math.max(adx,ady)<24)return;
  if(adx>ady)doMove(dx>0?'right':'left');
  else doMove(dy>0?'down':'up');
});
boardEl.addEventListener('pointercancel',()=>{ptrStart=null;});

window.addEventListener('keydown',e=>{
  const k=e.key||'';
  if(k==='ArrowLeft'||k==='ArrowRight'||k==='ArrowUp'||k==='ArrowDown'){
    e.preventDefault();
    if(overlayVisible())return;
    unlockAudio();
    if(k==='ArrowLeft')doMove('left');
    else if(k==='ArrowRight')doMove('right');
    else if(k==='ArrowUp')doMove('up');
    else doMove('down');
  }
});
window.addEventListener('resize',()=>{
  for(const id in tileEls){
    const el=tileEls[id];
    const t=findTileById(+id);
    if(t)applyTileGeom(t);
  }
});
function findTileById(id){
  for(let i=0;i<16;i++)if(cellMap[i]&&cellMap[i].id===id)return cellMap[i];
  return null;
}

/* ---------- Buttons ---------- */
function bindClick(id,fn){
  const el=$(id);if(!el)return;
  el.addEventListener('click',fn);
}
bindClick('start',()=>{unlockAudio();clickSound();startNewGame();});
bindClick('missions',()=>{unlockAudio();clickSound();renderMissions();show('missv');});
bindClick('back2',()=>{clickSound();updateMenu();show('menu');});
bindClick('home',()=>{clickSound();location.href='../../index.html';});
bindClick('newgame',()=>{unlockAudio();clickSound();endRun();startNewGame();});
bindClick('menu3',()=>{clickSound();endRun();updateMenu();show('menu');});
bindClick('retry',()=>{clickSound();endRun();startNewGame();});
bindClick('menu2',()=>{clickSound();endRun();updateMenu();show('menu');});
bindClick('keepgoing',()=>{clickSound();game.inputBlocked=false;show(null);});
bindClick('mute',()=>{
  muted=!muted;
  $('mute').textContent=muted?'Sound: Off':'Sound: On';
  if(!muted){unlockAudio();clickSound();}
});

/* ---------- Boot ---------- */
setupBoardCells();
startNewGame();
updateMenu();
show('menu');
save();

/* ---------- KaiOS menu navigation ---------- */
function menuFocusStep(dir){
  const ov=document.querySelector('.overlay:not(.hidden)');if(!ov)return;
  const all=ov.querySelectorAll('button');const out=[];
  for(let i=0;i<all.length;i++){if(!all[i].disabled)out.push(all[i]);}
  if(!out.length)return;
  let idx=-1;
  for(let i=0;i<out.length;i++){if(out[i]===document.activeElement){idx=i;break;}}
  const next=idx<0?0:(idx+dir+out.length)%out.length;
  try{out[next].focus();}catch(e){}
}
function menuActivateFocused(){
  const ov=document.querySelector('.overlay:not(.hidden)');if(!ov)return;
  const all=ov.querySelectorAll('button');const out=[];
  for(let i=0;i<all.length;i++){if(!all[i].disabled)out.push(all[i]);}
  if(!out.length)return;
  let idx=-1;
  for(let i=0;i<out.length;i++){if(out[i]===document.activeElement){idx=i;break;}}
  const t=idx<0?out[0]:out[idx];
  try{t.click();}catch(e){}
}
window.addEventListener('keydown',e=>{
  const k=e.key||'',c=e.keyCode||0;
  const ov=document.querySelector('.overlay:not(.hidden)');if(!ov)return;
  if(k==='ArrowDown'||c===40||k==='8'||c===56){e.preventDefault();menuFocusStep(1);}
  else if(k==='ArrowUp'||c===38||k==='2'||c===50){e.preventDefault();menuFocusStep(-1);}
  else if(k==='Enter'||k===' '||c===13||c===32||k==='5'||c===53||k==='SoftLeft'){e.preventDefault();menuActivateFocused();}
});
