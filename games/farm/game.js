/* ===== Farm Sim ===== */
let params;
try{params=new URLSearchParams(location.search);}catch(e){params={get:function(){return null;}};}
function storeGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function storeSet(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}}

let user=params.get('user');
if(!user){try{const u=JSON.parse(storeGet('wg_user')||'null');if(u&&u.name)user=u.name;}catch(e){}}
if(!user)user='guest';
const KEY='farm_'+user;

const CROPS=[
  {id:'carrot',name:'Carrot',emoji:'🥕',seedCost:10,growSeconds:20,sellPrice:25,xpReward:10,unlockLevel:1},
  {id:'wheat',name:'Wheat',emoji:'🌾',seedCost:20,growSeconds:45,sellPrice:55,xpReward:18,unlockLevel:2},
  {id:'tomato',name:'Tomato',emoji:'🍅',seedCost:35,growSeconds:80,sellPrice:100,xpReward:30,unlockLevel:3},
  {id:'corn',name:'Corn',emoji:'🌽',seedCost:60,growSeconds:120,sellPrice:175,xpReward:45,unlockLevel:4},
  {id:'strawberry',name:'Strawberry',emoji:'🍓',seedCost:95,growSeconds:180,sellPrice:280,xpReward:65,unlockLevel:5},
  {id:'pumpkin',name:'Pumpkin',emoji:'🎃',seedCost:150,growSeconds:300,sellPrice:500,xpReward:100,unlockLevel:6}
];
const MISSIONS=[
  {id:'harvest10',title:'Harvest 10 crops',target:10,type:'harvests',reward:150},
  {id:'harvest50',title:'Harvest 50 crops',target:50,type:'harvests',reward:600},
  {id:'money1000',title:'Earn $1000 total money',target:1000,type:'totalMoney',reward:350},
  {id:'level3',title:'Reach Level 3',target:3,type:'level',reward:250},
  {id:'pumpkin1',title:'Harvest a Pumpkin',target:1,type:'pumpkins',reward:500}
];
const TOTAL_PLOTS=12,START_UNLOCKS=6;
const UNLOCK_COSTS=[100,150,220,300,400,550];
const DAY_MS=180000;

function cropById(id){return CROPS.find(c=>c.id===id)||null;}
function emptyPlot(){return {crop:null,plantedAt:0,watered:false,growMs:0};}
function xpNeeded(l){return l*100;}
function num(v,def){return (typeof v==='number'&&isFinite(v))?v:def;}

function defaultState(){
  return {user,money:50,xp:0,level:1,day:1,dayProgress:0,harvests:0,pumpkins:0,totalMoneyEarned:0,
    unlockedPlots:START_UNLOCKS,
    plots:Array.from({length:TOTAL_PLOTS},emptyPlot),
    missions:MISSIONS.map(m=>({id:m.id,progress:0,done:false})),
    selectedSeed:'carrot',muted:false};
}
function loadState(){
  let s=null;
  try{s=JSON.parse(storeGet(KEY)||'null');}catch(e){s=null;}
  if(!s||!s.user)s=defaultState();
  s.money=Math.max(0,Math.floor(num(s.money,50)));
  s.xp=Math.max(0,num(s.xp,0));
  s.level=Math.max(1,Math.floor(num(s.level,1)));
  s.day=Math.max(1,Math.floor(num(s.day,1)));
  s.dayProgress=Math.max(0,num(s.dayProgress,0));
  s.harvests=Math.max(0,Math.floor(num(s.harvests,0)));
  s.pumpkins=Math.max(0,Math.floor(num(s.pumpkins,0)));
  s.totalMoneyEarned=Math.max(0,num(s.totalMoneyEarned,0));
  s.unlockedPlots=Math.min(TOTAL_PLOTS,Math.max(START_UNLOCKS,Math.floor(num(s.unlockedPlots,START_UNLOCKS))));
  if(!Array.isArray(s.plots))s.plots=[];
  const plots=[];
  for(let i=0;i<TOTAL_PLOTS;i++){
    const p=s.plots[i];
    const crop=p&&cropById(p.crop);
    if(crop&&typeof p.plantedAt==='number'&&isFinite(p.plantedAt)&&p.plantedAt>0&&typeof p.growMs==='number'&&isFinite(p.growMs)&&p.growMs>0){
      plots.push({crop:crop.id,plantedAt:p.plantedAt,watered:!!p.watered,growMs:p.growMs});
    }else{
      plots.push(emptyPlot());
    }
  }
  s.plots=plots;
  if(!Array.isArray(s.missions))s.missions=[];
  MISSIONS.forEach(def=>{
    if(!s.missions.some(m=>m&&m.id===def.id))s.missions.push({id:def.id,progress:0,done:false});
    const m=s.missions.find(m=>m&&m.id===def.id);
    if(m){m.type=def.type;m.target=def.target;m.reward=def.reward;m.title=def.title;m.progress=Math.max(0,num(m.progress,0));m.done=!!m.done;}
  });
  if(!cropById(s.selectedSeed))s.selectedSeed='carrot';
  s.muted=!!s.muted;
  return s;
}
let state=loadState();
function save(){storeSet(KEY,JSON.stringify(state));}

const $=id=>document.getElementById(id);
const LOW_GFX=/KAIOS/i.test(navigator.userAgent||'')||((window.innerWidth||999)<=320)||((window.innerHeight||999)<=380);
let waterMode=false;
const notified=new Set();

/* ---------- Audio ---------- */
let audioCtx=null,master=null,noiseBuf=null,musicTimer=null,musicGain=null,musicStep=0;
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
  if(!audioCtx||state.muted)return;
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
function getNoise(){
  if(noiseBuf||!audioCtx)return noiseBuf;
  try{
    const len=Math.floor(audioCtx.sampleRate*0.5);
    noiseBuf=audioCtx.createBuffer(1,len,audioCtx.sampleRate);
    const d=noiseBuf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  }catch(e){noiseBuf=null;}
  return noiseBuf;
}
function noise(dur,vol,freq,type){
  if(!audioCtx||state.muted)return;
  try{
    const b=getNoise();if(!b)return;
    const t=audioCtx.currentTime;
    const s=audioCtx.createBufferSource();s.buffer=b;
    const f=audioCtx.createBiquadFilter();f.type=type||'bandpass';f.frequency.value=freq||800;f.Q.value=0.8;
    const g=audioCtx.createGain();g.gain.setValueAtTime(vol||0.12,t);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(f);f.connect(g);g.connect(master);
    s.start(t);s.stop(t+dur+0.02);
  }catch(e){}
}
function sfxClick(){tone(520,0.06,'square',0.06);}
function sfxPlant(){tone(340,0.09,'triangle',0.09,520);setTimeout(()=>tone(520,0.08,'triangle',0.07,640),70);}
function sfxWater(){noise(0.28,0.16,800,'lowpass');tone(700,0.18,'sine',0.05,350);}
function sfxHarvest(){tone(660,0.12,'triangle',0.1,880);setTimeout(()=>tone(990,0.18,'triangle',0.1,1320),95);}
function sfxCoin(){tone(1250,0.06,'square',0.07);setTimeout(()=>tone(1700,0.13,'square',0.07),60);}
function sfxError(){tone(150,0.24,'sawtooth',0.12,95);}
function sfxUnlock(){tone(500,0.1,'square',0.08,750);setTimeout(()=>tone(750,0.16,'square',0.08,1050),105);}
function sfxLevel(){const seq=[523,659,784,1047];seq.forEach((f,i)=>setTimeout(()=>tone(f,0.24,'triangle',0.12),i*125));}
function noteFreq(semi){return 196*Math.pow(2,semi/12);}
const MUSIC_NOTES=[0,4,7,12,7,4,9,7];
const MUSIC_BASS=[0,0,5,5,4,4,0,0];
function startMusic(){
  unlockAudio();
  if(!audioCtx||state.muted||LOW_GFX)return;
  stopMusic();
  try{
    musicGain=audioCtx.createGain();musicGain.gain.value=0.5;musicGain.connect(master);
    musicStep=0;
    musicTimer=setInterval(()=>{
      if(!audioCtx||!musicGain)return;
      try{
        const i=musicStep++%8,t=audioCtx.currentTime;
        const o=audioCtx.createOscillator(),g=audioCtx.createGain();
        o.type='triangle';o.frequency.setValueAtTime(noteFreq(MUSIC_NOTES[i]+12),t);
        g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.04,t+0.03);
        g.gain.exponentialRampToValueAtTime(0.0001,t+0.35);
        o.connect(g);g.connect(musicGain);o.start(t);o.stop(t+0.4);
        if(i%2===0){
          const bo=audioCtx.createOscillator(),bg=audioCtx.createGain();
          bo.type='sine';bo.frequency.setValueAtTime(noteFreq(MUSIC_BASS[i])/2,t);
          bg.gain.setValueAtTime(0.0001,t);bg.gain.exponentialRampToValueAtTime(0.07,t+0.03);
          bg.gain.exponentialRampToValueAtTime(0.0001,t+0.55);
          bo.connect(bg);bg.connect(musicGain);bo.start(t);bo.stop(t+0.6);
        }
      }catch(e){}
    },300);
  }catch(e){}
}
function stopMusic(){
  if(musicTimer){clearInterval(musicTimer);musicTimer=null;}
  if(musicGain){try{musicGain.disconnect();}catch(e){}musicGain=null;}
}
function toggleMute(){
  unlockAudio();
  state.muted=!state.muted;
  save();
  if(state.muted)stopMusic();else startMusic();
  updateMenu();updateHud();
}

/* ---------- Overlays / HUD ---------- */
function show(id){var list=document.querySelectorAll('.overlay');for(var i=0;i<list.length;i++)list[i].classList.add('hidden');if(id){$(id).classList.remove('hidden');var b=$(id).querySelector('button');if(b){try{b.focus();}catch(e){}}}}

let cursor=0;
const GRID_COLS=4;
function updateCursor(){for(let i=0;i<plotEls.length;i++){if(plotEls[i])plotEls[i].classList.toggle('cursor',i===cursor);}}
function moveCursor(dx,dy){
  const rows=Math.ceil(TOTAL_PLOTS/GRID_COLS);
  let r=Math.floor(cursor/GRID_COLS),c=cursor%GRID_COLS;
  c=Math.max(0,Math.min(GRID_COLS-1,c+dx));
  r=Math.max(0,Math.min(rows-1,r+dy));
  cursor=Math.min(TOTAL_PLOTS-1,r*GRID_COLS+c);
  updateCursor();
}
function menuFocusStep(dir){
  const ov=document.querySelector('.overlay:not(.hidden)');if(!ov)return;
  const btns=ov.querySelectorAll('button');const out=[];
  for(let i=0;i<btns.length;i++){if(!btns[i].disabled)out.push(btns[i]);}
  if(!out.length)return;
  let idx=-1;
  for(let i=0;i<out.length;i++){if(out[i]===document.activeElement){idx=i;break;}}
  const next=idx<0?0:(idx+dir+out.length)%out.length;
  try{out[next].focus();}catch(e){}
}
function menuActivateFocused(){
  const ov=document.querySelector('.overlay:not(.hidden)');if(!ov)return;
  const btns=ov.querySelectorAll('button');const out=[];
  for(let i=0;i<btns.length;i++){if(!btns[i].disabled)out.push(btns[i]);}
  if(!out.length)return;
  let idx=-1;
  for(let i=0;i<out.length;i++){if(out[i]===document.activeElement){idx=i;break;}}
  const t=idx<0?out[0]:out[idx];
  try{t.click();}catch(e){}
}
function tapSeedByIndex(i){
  const seeds=document.querySelectorAll('#seeds .seed');
  if(seeds[i]){try{seeds[i].click();}catch(e){}}
}
let toastTimer=null;
function toast(msg){
  const t=$('toast');if(!t)return;
  t.textContent=msg;t.classList.remove('hidden');t.classList.add('show');
  if(toastTimer)clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{t.classList.add('hidden');t.classList.remove('show');},2300);
}
function nextUnlockCost(){
  const idx=Math.min(UNLOCK_COSTS.length-1,Math.max(0,state.unlockedPlots-START_UNLOCKS));
  return UNLOCK_COSTS[idx];
}
function updateHud(){
  $('hday').textContent='Day '+state.day;
  $('hlvl').textContent='Lv '+state.level;
  $('hmny').textContent='$'+state.money;
  $('farmXpFill').style.width=Math.min(100,state.xp/xpNeeded(state.level)*100)+'%';
  $('farmXpText').textContent='XP '+Math.floor(state.xp)+'/'+xpNeeded(state.level);
  $('muteFarm').textContent=state.muted?'🔇':'🔊';
}
function updateMenu(){
  $('userinfo').textContent='Player: '+state.user;
  $('mlevel').textContent=state.level;
  $('mxp').textContent=Math.floor(state.xp);
  $('mneed').textContent=xpNeeded(state.level);
  $('mxpfill').style.width=Math.min(100,state.xp/xpNeeded(state.level)*100)+'%';
  $('mmoney').textContent=state.money;
  $('mday').textContent=state.day;
  $('mstats').textContent='Total harvests: '+state.harvests+' · Pumpkins: '+state.pumpkins;
  $('muteMenu').textContent=state.muted?'Sound: Off':'Sound: On';
}

/* ---------- Crops & plots ---------- */
function plotProgress(p,now){
  if(!p||!p.crop||!(p.growMs>0))return 0;
  return Math.max(0,Math.min(1,(now-p.plantedAt)/p.growMs));
}
const plotEls=[];
function buildGrid(){
  const grid=$('grid');if(!grid)return;
  for(let i=0;i<TOTAL_PLOTS;i++){
    const d=document.createElement('div');
    d.className='plot empty';
    d.innerHTML='<div class="cropart"></div><div class="wm hidden">💧</div><div class="pbar hidden"><i class="pfill"></i></div><div class="lockpart hidden"><span class="lockemoji">🔒</span><span class="lockcost"></span></div>';
    d.tabIndex=0;
    d.setAttribute('role','button');
    d.addEventListener('click',()=>onPlotTap(i));
    d.addEventListener('keydown',e=>{
      const k=e.key||'',c=e.keyCode||0;
      if(k==='Enter'||k===' '||c===13||c===32||k==='5'||c===53||k==='SoftLeft'){e.preventDefault();e.stopPropagation();onPlotTap(i);}
    });
    grid.appendChild(d);
    plotEls.push(d);
  }
}
function renderPlots(){
  const now=Date.now();
  for(let i=0;i<TOTAL_PLOTS;i++){
    const el=plotEls[i];if(!el)continue;
    const p=state.plots[i];
    const cropart=el.querySelector('.cropart');
    const pbar=el.querySelector('.pbar');
    const fill=el.querySelector('.pfill');
    const wm=el.querySelector('.wm');
    const lockpart=el.querySelector('.lockpart');
    const lockcost=el.querySelector('.lockcost');
    if(i>=state.unlockedPlots){
      el.classList.add('locked');el.classList.remove('empty','growing','ready');
      cropart.textContent='';pbar.classList.add('hidden');wm.classList.add('hidden');
      lockpart.classList.remove('hidden');
      lockcost.textContent=(i===state.unlockedPlots)?('$'+nextUnlockCost()):'';
      el.title='Locked plot';
      continue;
    }
    el.classList.remove('locked');
    lockpart.classList.add('hidden');
    const crop=cropById(p.crop);
    if(!crop){
      el.classList.add('empty');el.classList.remove('growing','ready');
      cropart.textContent='';cropart.style.transform='';
      pbar.classList.add('hidden');wm.classList.add('hidden');
      el.title='Empty plot — tap to plant';
      continue;
    }
    el.classList.remove('empty');
    const prog=plotProgress(p,now);
    wm.classList.toggle('hidden',!p.watered);
    pbar.classList.remove('hidden');
    fill.style.width=Math.min(100,prog*100)+'%';
    if(now-p.plantedAt>=p.growMs){
      el.classList.add('ready');el.classList.remove('growing');
      cropart.textContent=crop.emoji;
      cropart.style.transform='scale(1)';
      el.title=crop.name+' ready! Tap to harvest';
    }else{
      el.classList.add('growing');el.classList.remove('ready');
      cropart.textContent=prog<0.35?'🌱':crop.emoji;
      cropart.style.transform='scale('+(0.55+0.45*prog).toFixed(3)+')';
      el.title=crop.name+' growing — '+Math.floor(prog*100)+'%';
    }
  }
  const maxed=state.unlockedPlots>=TOTAL_PLOTS;
  $('unlockTool').disabled=maxed;
  $('unlockCost').textContent=maxed?'All open':'$'+nextUnlockCost();
  updateHud();
}
function onPlotTap(i){
  unlockAudio();
  if(i>=state.unlockedPlots){unlockNextPlot();return;}
  const p=state.plots[i];
  const crop=cropById(p.crop);
  const now=Date.now();
  if(waterMode){
    if(!crop){toast('Nothing to water here');return;}
    if(now-p.plantedAt>=p.growMs){toast('Already grown — tap to harvest');return;}
    if(p.watered){sfxError();toast('Already watered');return;}
    const remaining=p.plantedAt+p.growMs-now;
    p.growMs=(now-p.plantedAt)+Math.max(1000,Math.floor(remaining/2));
    p.watered=true;
    save();sfxWater();toast('💧 Watered! Growth sped up');
    renderPlots();return;
  }
  if(!crop){
    const seed=cropById(state.selectedSeed);
    if(!seed){toast('Pick a seed first');return;}
    if(state.level<seed.unlockLevel){sfxError();toast('Unlocks at Level '+seed.unlockLevel);return;}
    if(state.money<seed.seedCost){sfxError();toast('Not enough money');return;}
    state.money-=seed.seedCost;
    state.plots[i]={crop:seed.id,plantedAt:now,watered:false,growMs:seed.growSeconds*1000};
    notified.delete(i);
    save();sfxPlant();renderPlots();
    return;
  }
  if(now-p.plantedAt>=p.growMs){harvestPlot(i);return;}
  toast(crop.name+' growing… '+Math.floor(plotProgress(p,now)*100)+'%');
}
function floatText(plotEl,text){
  try{
    const wrap=$('wrap');
    const wr=wrap.getBoundingClientRect();
    const pr=plotEl.getBoundingClientRect();
    const d=document.createElement('div');
    d.className='floaty';d.textContent=text;
    d.style.left=(pr.left-wr.left+pr.width/2)+'px';
    d.style.top=(pr.top-wr.top+6)+'px';
    wrap.appendChild(d);
    setTimeout(()=>{if(d.parentNode)d.parentNode.removeChild(d);},1150);
  }catch(e){}
}
function levelCheck(){
  let leveled=false;
  while(state.xp>=xpNeeded(state.level)){
    state.xp-=xpNeeded(state.level);
    state.level++;
    state.money+=state.level*50;
    state.totalMoneyEarned+=state.level*50;
    leveled=true;
  }
  if(leveled){
    sfxLevel();
    toast('🎉 Level up! Level '+state.level+' (+$'+(state.level*50)+')');
    renderSeeds();
  }
}
function missionValue(def){
  if(def.type==='level')return state.level;
  if(def.type==='totalMoney')return state.totalMoneyEarned;
  if(def.type==='harvests')return state.harvests;
  if(def.type==='pumpkins')return state.pumpkins;
  return 0;
}
function checkMissions(){
  state.missions.forEach(m=>{
    if(m.done)return;
    const def=MISSIONS.find(x=>x.id===m.id);if(!def)return;
    m.progress=Math.min(missionValue(def),def.target);
    if(m.progress>=def.target){
      m.done=true;
      state.money+=def.reward;
      state.totalMoneyEarned+=def.reward;
      sfxLevel();
      toast('Mission complete: '+def.title+' (+$'+def.reward+')');
    }
  });
}
function harvestPlot(i){
  const p=state.plots[i];
  const crop=cropById(p.crop);if(!crop)return;
  state.money+=crop.sellPrice;
  state.totalMoneyEarned+=crop.sellPrice;
  state.harvests++;
  if(crop.id==='pumpkin')state.pumpkins++;
  state.xp+=crop.xpReward;
  state.plots[i]=emptyPlot();
  notified.delete(i);
  floatText(plotEls[i],'+$'+crop.sellPrice);
  sfxHarvest();setTimeout(sfxCoin,130);
  levelCheck();
  checkMissions();
  save();renderPlots();updateMenu();
}
function unlockNextPlot(){
  if(state.unlockedPlots>=TOTAL_PLOTS){toast('All plots unlocked!');return;}
  const cost=nextUnlockCost();
  if(state.money<cost){sfxError();toast('Not enough money — need $'+cost);return;}
  state.money-=cost;
  state.unlockedPlots++;
  save();sfxUnlock();
  toast('🔓 New plot unlocked! ('+state.unlockedPlots+'/'+TOTAL_PLOTS+')');
  renderPlots();updateMenu();
}

/* ---------- Seeds toolbar ---------- */
function renderSeeds(){
  const el=$('seeds');if(!el)return;
  el.innerHTML='';
  CROPS.forEach(c=>{
    const locked=state.level<c.unlockLevel;
    const b=document.createElement('button');
    b.className='seed'+(state.selectedSeed===c.id?' selected':'')+(locked?' locked':'');
    b.title=c.name+' · '+c.growSeconds+'s grow · sells $'+c.sellPrice+' · '+c.xpReward+' XP';
    b.innerHTML=locked
      ?'<span class="semoji">🔒</span><b>Lv '+c.unlockLevel+'</b><small>'+c.name+'</small>'
      :'<span class="semoji">'+c.emoji+'</span><b>$'+c.seedCost+'</b><small>'+c.name+'</small>';
    b.addEventListener('click',()=>{
      unlockAudio();
      if(state.level<c.unlockLevel){sfxError();toast('Unlocks at Level '+c.unlockLevel);return;}
      state.selectedSeed=c.id;save();sfxClick();renderSeeds();
    });
    el.appendChild(b);
  });
}

/* ---------- Missions ---------- */
function renderMissions(){
  const el=$('mlist');if(!el)return;
  el.innerHTML='';
  state.missions.forEach(m=>{
    const def=MISSIONS.find(x=>x.id===m.id);if(!def)return;
    const prog=Math.min(Math.max(m.progress||0,0),def.target);
    const pct=Math.round(prog/def.target*100);
    const d=document.createElement('div');d.className='mitem';
    d.innerHTML='<b>'+def.title+'</b><span>'+prog+'/'+def.target+' · Reward $'+def.reward+(m.done?' · DONE':'')+'</span><div class="bar mini"><i style="width:'+pct+'%;background:'+(m.done?'#22c55e':'#3b82f6')+'"></i></div>';
    el.appendChild(d);
  });
}

/* ---------- Tick & persistence ---------- */
let lastTick=Date.now();
function tick(){
  const now=Date.now();
  const dt=now-lastTick;lastTick=now;
  state.dayProgress+=dt;
  let dayChanged=false;
  while(state.dayProgress>=DAY_MS){state.dayProgress-=DAY_MS;state.day++;dayChanged=true;}
  if(dayChanged)toast('🌅 Day '+state.day+' on the farm!');
  for(let i=0;i<TOTAL_PLOTS;i++){
    if(i>=state.unlockedPlots)continue;
    const p=state.plots[i];
    const crop=cropById(p.crop);if(!crop)continue;
    if(now-p.plantedAt>=p.growMs&&!notified.has(i)){
      notified.add(i);
      toast(crop.emoji+' '+crop.name+' ready!');
      tone(880,0.16,'triangle',0.09,1175);
    }
  }
  renderPlots();
}
setInterval(tick,500);
setInterval(save,10000);
window.addEventListener('beforeunload',save);
if(document.addEventListener)document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();});

/* ---------- Buttons ---------- */
function bindClick(id,fn){
  const el=$(id);if(!el)return;
  el.addEventListener('click',fn);
}
bindClick('play',()=>{unlockAudio();sfxClick();show(null);$('farm').classList.remove('hidden');startMusic();updateHud();});
bindClick('missions',()=>{unlockAudio();sfxClick();renderMissions();show('missv');});
bindClick('back2',()=>{unlockAudio();sfxClick();updateMenu();show('menu');});
bindClick('home',()=>{stopMusic();location.href='../../index.html';});
bindClick('menuBtn',()=>{unlockAudio();sfxClick();stopMusic();updateMenu();$('farm').classList.add('hidden');show('menu');});
bindClick('waterTool',()=>{unlockAudio();waterMode=!waterMode;$('waterTool').classList.toggle('active',waterMode);sfxClick();toast(waterMode?'💧 Tap a growing plot to water it':'Watering can off');});
bindClick('unlockTool',()=>{unlockAudio();unlockNextPlot();});
bindClick('muteFarm',toggleMute);
bindClick('muteMenu',toggleMute);

buildGrid();
for(let i=0;i<TOTAL_PLOTS;i++){
  const p=state.plots[i];
  if(p&&p.crop&&Date.now()-p.plantedAt>=p.growMs)notified.add(i);
}
renderSeeds();
renderPlots();
updateMenu();
show('menu');
save();

/* ---------- KaiOS keypad ---------- */
window.addEventListener('keydown',e=>{
  const k=e.key||'',c=e.keyCode||0;
  const ok=(k==='Enter'||k===' '||c===13||c===32||k==='5'||c===53||k==='SoftLeft');
  const ov=document.querySelector('.overlay:not(.hidden)');
  if(ov){
    if(k==='ArrowDown'||c===40||k==='8'||c===56){e.preventDefault();menuFocusStep(1);}
    else if(k==='ArrowUp'||c===38||k==='2'||c===50){e.preventDefault();menuFocusStep(-1);}
    else if(ok){e.preventDefault();menuActivateFocused();}
    return;
  }
  if(k==='ArrowLeft'||c===37||k==='4'||c===52){e.preventDefault();moveCursor(-1,0);}
  else if(k==='ArrowRight'||c===39||k==='6'||c===54){e.preventDefault();moveCursor(1,0);}
  else if(k==='ArrowUp'||c===38||k==='2'||c===50){e.preventDefault();moveCursor(0,-1);}
  else if(k==='ArrowDown'||c===40||k==='8'||c===56){e.preventDefault();moveCursor(0,1);}
  else if(ok){e.preventDefault();onPlotTap(cursor);}
  else if(k>='1'&&k<='6'){e.preventDefault();tapSeedByIndex(+k-1);}
  else if(k==='7'){e.preventDefault();const b=$('waterTool');if(b)b.click();}
  else if(k==='9'){e.preventDefault();const b=$('unlockTool');if(b)b.click();}
  else if(k==='0'){e.preventDefault();const b=$('menuBtn');if(b)b.click();}
});
updateCursor();
