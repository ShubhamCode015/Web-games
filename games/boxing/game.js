/* ===== Boxing - 3D styled ===== */
const params=new URLSearchParams(location.search);
function storeGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function storeSet(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}}

let user=params.get('user');
if(!user){try{const u=JSON.parse(storeGet('wg_user')||'null');if(u&&u.name)user=u.name;}catch(e){}}
if(!user)user='guest';
const KEY='boxing_'+user;
const MAX_LEVEL=100;

const FIGHTERS=[
  {id:'rookie',name:'Rookie',price:0,levelReq:0,pow:10,spd:10,def:10,skill:'Jab Combo',skillType:'combo',skillVal:1.7,color:'#3b82f6',skin:'#e0a878',trunk:'#2563eb',glove:'#dc2626',desc:'Balanced all-rounder'},
  {id:'bull',name:'Street Bull',price:500,levelReq:0,pow:16,spd:7,def:12,skill:'Haymaker',skillType:'heavy',skillVal:2.5,color:'#ef4444',skin:'#c98a5b',trunk:'#b91c1c',glove:'#7c2d12',desc:'Slow but heavy hands'},
  {id:'flash',name:'Flash',price:1500,levelReq:0,pow:9,spd:18,def:8,skill:'Rapid Fire',skillType:'multi',skillVal:1.6,color:'#22c55e',skin:'#d69a6a',trunk:'#15803d',glove:'#facc15',desc:'Lightning fast puncher'},
  {id:'iron',name:'Iron Guard',price:5000,levelReq:0,pow:12,spd:9,def:20,skill:'Iron Wall',skillType:'shield',skillVal:1.8,color:'#a855f7',skin:'#b97b52',trunk:'#7e22ce',glove:'#4c1d95',desc:'Tank with healing guard'},
  {id:'spark',name:'Spark',price:0,levelReq:15,pow:14,spd:14,def:12,skill:'Static Shock',skillType:'stun',skillVal:2.1,color:'#f59e0b',skin:'#e6b183',trunk:'#b45309',glove:'#fbbf24',desc:'Free at Level 15'},
  {id:'blaze',name:'Blaze',price:0,levelReq:35,pow:18,spd:15,def:13,skill:'Flame Rush',skillType:'heavy',skillVal:2.9,color:'#f97316',skin:'#d98f5f',trunk:'#c2410c',glove:'#ef4444',desc:'Free at Level 35'},
  {id:'shadow',name:'Shadow',price:12000,levelReq:0,pow:17,spd:17,def:14,skill:'Shadow Strike',skillType:'crit',skillVal:3.2,color:'#6366f1',skin:'#a06a45',trunk:'#312e81',glove:'#4338ca',desc:'Critical striker'},
  {id:'legend',name:'Legend',price:0,levelReq:60,pow:20,spd:18,def:16,skill:'Legend Fury',skillType:'multi',skillVal:2.4,color:'#eab308',skin:'#d69a6a',trunk:'#a16207',glove:'#fde047',desc:'Free at Level 60'},
  {id:'king',name:'K.O. King',price:0,levelReq:100,pow:25,spd:22,def:20,skill:'Final Knockout',skillType:'ko',skillVal:5,color:'#e11d48',skin:'#b97b52',trunk:'#9f1239',glove:'#fb7185',desc:'Ultimate — Level 100'}
];

const MISSIONS=[
  {id:'win1',title:'Win 1 match',type:'wins',target:1,reward:100},
  {id:'win10',title:'Win 10 matches',type:'wins',target:10,reward:400},
  {id:'punches50',title:'Land 50 punches',type:'punches',target:50,reward:300},
  {id:'ko5',title:'Score 5 KOs',type:'kos',target:5,reward:500},
  {id:'skills10',title:'Use 10 skills',type:'skills',target:10,reward:350},
  {id:'level10',title:'Reach Level 10',type:'level',target:10,reward:600},
  {id:'level50',title:'Reach Level 50',type:'level',target:50,reward:2000},
  {id:'king',title:'Become Level 100',type:'level',target:100,reward:10000}
];

function defaultState(){
  return {
    user,money:0,xp:0,level:1,selected:0,owned:['rookie'],
    wins:0,losses:0,punches:0,kos:0,skills:0,
    missions:MISSIONS.map(m=>({id:m.id,progress:0,done:false}))
  };
}
function loadState(){
  let s=null;
  try{s=JSON.parse(storeGet(KEY)||'null');}catch(e){s=null;}
  if(!s||!s.user)return defaultState();
  if(!Array.isArray(s.owned)||!s.owned.length)s.owned=['rookie'];
  if(!Array.isArray(s.missions))s.missions=[];
  MISSIONS.forEach(def=>{if(!s.missions.some(m=>m&&m.id===def.id))s.missions.push({id:def.id,progress:0,done:false});});
  if(typeof s.selected!=='number')s.selected=0;
  if(!s.level)s.level=1;
  return s;
}
let state=loadState();
function save(){storeSet(KEY,JSON.stringify(state));}

const $=id=>document.getElementById(id);
const canvas=$('c');
const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height;
const LANES=[110,250];
const FEET=352;

let running=false,last=0,fight=null,hitFx=[];
const LOW_GFX=/KAIOS/i.test(navigator.userAgent||'')||((window.innerWidth||999)<=320);

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
  if(!audioCtx)return;
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
    const len=Math.floor(audioCtx.sampleRate*0.6);
    noiseBuf=audioCtx.createBuffer(1,len,audioCtx.sampleRate);
    const d=noiseBuf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  }catch(e){noiseBuf=null;}
  return noiseBuf;
}
function noise(dur,vol,freq,type){
  if(!audioCtx)return;
  try{
    const b=getNoise();if(!b)return;
    const t=audioCtx.currentTime;
    const s=audioCtx.createBufferSource();s.buffer=b;
    const f=audioCtx.createBiquadFilter();f.type=type||'bandpass';f.frequency.value=freq||800;f.Q.value=0.7;
    const g=audioCtx.createGain();g.gain.setValueAtTime(vol||0.12,t);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+dur+0.02);
  }catch(e){}
}
function crowd(dur,vol){
  if(!audioCtx)return;
  try{
    const b=getNoise();if(!b)return;
    const t=audioCtx.currentTime;
    for(let i=0;i<3;i++){
      const s=audioCtx.createBufferSource();s.buffer=b;s.loop=true;
      const f=audioCtx.createBiquadFilter();f.type='bandpass';f.frequency.value=500+i*650;f.Q.value=0.5;
      const g=audioCtx.createGain();
      g.gain.setValueAtTime(0.0001,t);
      g.gain.linearRampToValueAtTime(vol,t+dur*0.35);
      g.gain.linearRampToValueAtTime(0.0001,t+dur);
      s.connect(f);f.connect(g);g.connect(master);
      s.start(t);s.stop(t+dur+0.05);
    }
  }catch(e){}
}
function bell(){
  [880,1320,1760].forEach((f,i)=>{
    setTimeout(()=>tone(f,0.5,'triangle',0.10-i*0.02),i*8);
  });
  setTimeout(()=>{[880,1320].forEach((f,i)=>tone(f,0.45,'triangle',0.09-i*0.02));},190);
}
function hitSound(blocked){
  noise(blocked?0.1:0.16,blocked?0.16:0.24,blocked?2400:900,blocked?'bandpass':'lowpass');
  tone(blocked?720:150,blocked?0.08:0.13,'square',blocked?0.06:0.12,blocked?520:60);
}
function koSound(){
  noise(0.6,0.4,240,'lowpass');
  tone(90,0.6,'sawtooth',0.18,40);
  crowd(1.6,0.08);
}
function startMusic(){
  unlockAudio();
  if(!audioCtx)return;
  stopMusic();
  try{
    musicGain=audioCtx.createGain();musicGain.gain.value=0.5;musicGain.connect(master);
    musicStep=0;
    const bass=[0,0,-3,-3,-5,-5,-2,-2];
    musicTimer=setInterval(()=>{
      if(!audioCtx||!musicGain)return;
      try{
        const i=musicStep++%8,t=audioCtx.currentTime;
        const o=audioCtx.createOscillator(),g=audioCtx.createGain();
        o.type='sine';o.frequency.setValueAtTime(82*Math.pow(2,bass[i]/12),t);
        g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.075,t+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001,t+0.42);
        o.connect(g);g.connect(musicGain);o.start(t);o.stop(t+0.44);
        if(i%4===2){
          const ho=audioCtx.createOscillator(),hg=audioCtx.createGain();
          ho.type='triangle';ho.frequency.setValueAtTime(440,t);
          hg.gain.setValueAtTime(0.0001,t);hg.gain.exponentialRampToValueAtTime(0.022,t+0.02);
          hg.gain.exponentialRampToValueAtTime(0.0001,t+0.3);
          ho.connect(hg);hg.connect(musicGain);ho.start(t);ho.stop(t+0.32);
        }
      }catch(e){}
    },360);
  }catch(e){}
}
function stopMusic(){
  if(musicTimer){clearInterval(musicTimer);musicTimer=null;}
  if(musicGain){try{musicGain.disconnect();}catch(e){}musicGain=null;}
}

/* ---------- State helpers ---------- */
function xpNeeded(l){return Math.floor(60*Math.pow(l,1.15));}
function fighter(){return FIGHTERS[state.selected]||FIGHTERS[0];}
function isOwned(f){return state.owned.indexOf(f.id)>=0;}
function grantLevelUnlocks(){
  let unlocked=false;
  FIGHTERS.forEach(f=>{
    if(f.levelReq>0&&state.level>=f.levelReq&&state.owned.indexOf(f.id)<0){state.owned.push(f.id);unlocked=true;}
  });
  return unlocked;
}
function addXp(x){
  if(state.level>=MAX_LEVEL)return 0;
  const before=state.level;
  state.xp+=x;
  while(state.level<MAX_LEVEL&&state.xp>=xpNeeded(state.level)){
    state.xp-=xpNeeded(state.level);state.level++;state.money+=state.level*25;
  }
  if(state.level>=MAX_LEVEL)state.xp=0;
  grantLevelUnlocks();
  return state.level-before;
}
function missionProgress(m){
  const def=MISSIONS.find(x=>x.id===m.id);
  if(!def)return 0;
  if(def.type==='wins')return state.wins;
  if(def.type==='punches')return state.punches;
  if(def.type==='kos')return state.kos;
  if(def.type==='skills')return state.skills;
  if(def.type==='level')return state.level;
  return 0;
}
function checkMissions(){
  state.missions.forEach(m=>{
    if(m.done)return;
    const def=MISSIONS.find(x=>x.id===m.id);
    if(!def)return;
    m.progress=missionProgress(m);
    if(m.progress>=def.target){m.done=true;state.money+=def.reward;}
  });
}

function show(id){
  var list=document.querySelectorAll('.overlay');
  for(var i=0;i<list.length;i++)list[i].classList.add('hidden');
  if(id)$(id).classList.remove('hidden');
}
function showControls(){$('controls').classList.remove('hidden');}
function hideControls(){$('controls').classList.add('hidden');}

function updateMenu(){
  $('userinfo').textContent='Player: '+state.user;
  $('mlevel').textContent=state.level;
  $('mxp').textContent=state.xp;
  $('mneed').textContent=state.level>=MAX_LEVEL?'MAX':xpNeeded(state.level);
  $('mmoney').textContent=state.money;
  const f=fighter();
  $('mstats').textContent='Wins '+state.wins+' · KO '+state.kos+' · '+f.name+' (POW '+f.pow+' SPD '+f.spd+' DEF '+f.def+')';
}

function renderFighters(){
  const el=$('flist');el.innerHTML='';
  FIGHTERS.forEach((f,i)=>{
    const owned=isOwned(f),sel=state.selected===i;
    const d=document.createElement('div');
    d.className='fitem';
    let html='<b>'+f.name+'</b>';
    html+='<span>POW '+f.pow+' · SPD '+f.spd+' · DEF '+f.def+'</span>';
    html+='<span>Skill: '+f.skill+'</span>';
    if(f.levelReq>0&&!owned)html+='<span>Unlocks free at Level '+f.levelReq+'</span>';
    d.innerHTML=html;
    const btn=document.createElement('button');
    if(sel){btn.textContent='Selected';btn.disabled=true;}
    else if(owned){btn.textContent='Select';btn.onclick=()=>{state.selected=i;save();renderFighters();updateMenu();};}
    else if(f.levelReq>0){btn.textContent='Locked — Lv '+f.levelReq;btn.disabled=true;}
    else if(state.money>=f.price){
      btn.textContent='Buy $'+f.price;
      btn.onclick=()=>{
        if(state.money<f.price)return;
        state.money-=f.price;state.owned.push(f.id);state.selected=i;
        save();renderFighters();updateMenu();
      };
    }
    else{btn.textContent='Need $'+(f.price-state.money);btn.disabled=true;}
    d.appendChild(btn);el.appendChild(d);
  });
}
function renderMissions(){
  const el=$('mlist');el.innerHTML='';
  state.missions.forEach(m=>{
    const def=MISSIONS.find(x=>x.id===m.id);
    if(!def)return;
    const prog=Math.min(missionProgress(m),def.target);
    const pct=Math.round(prog/def.target*100);
    const d=document.createElement('div');d.className='mitem';
    d.innerHTML='<b>'+def.title+'</b><span>'+prog+'/'+def.target+' · Reward $'+def.reward+(m.done?' · DONE':'')+'</span>'+
      '<div class="bar mini"><i style="width:'+pct+'%;background:'+(m.done?'#22c55e':'#3b82f6')+'"></i></div>';
    el.appendChild(d);
  });
}

/* ---------- Fight ---------- */
function startFight(){
  unlockAudio();
  const f=fighter();
  fight={
    time:45,
    phpMax:80+f.def*4+state.level*2,
    ehpMax:90+state.level*9,
    php:0,ehp:0,energy:0,
    pBlock:false,pPunchCd:0,pHitT:0,eHitT:0,
    pPunchAnim:0,pPunchDur:0.2,ePunchAnim:0,ePunchDur:0.25,
    eAtkCd:1.6,eWind:0,eStun:0,
    eBlocking:false,eBlockCd:0,
    over:false,phase:'intro',phaseT:0,fightFlash:0,hitFlash:0,
    pSlide:0,eSlide:0,pWalk:0,eWalk:0
  };
  fight.php=fight.phpMax;fight.ehp=fight.ehpMax;
  hitFx=[];
  running=true;last=0;
  show(null);showControls();
  startMusic();crowd(1.8,0.05);
  requestAnimationFrame(loop);
}

function spawnHit(x,y,color,power){
  const n=Math.round(6+power*8);
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2,sp=40+Math.random()*180;
    hitFx.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-30,life:0.35+Math.random()*0.3,max:0.65,color,r:1+Math.random()*2.2});
  }
}

function enemyAttack(){
  if(!fight||fight.over)return;
  fight.ePunchAnim=fight.ePunchDur;
  fight.eWind=0;
  const f=fighter();
  let dmg=6+state.level*0.35+Math.random()*3;
  dmg=dmg*(100/(100+f.def*2.5));
  if(fight.pBlock)dmg*=0.3;
  dmg=Math.max(2,dmg);
  fight.php-=dmg;
  fight.pHitT=0.2;
  fight.hitFlash=0.22;
  fight.energy=Math.min(100,fight.energy+8);
  spawnHit(LANES[0]+fight.pSlide+16,226,'#fca5a5',0.7);
  hitSound(fight.pBlock);
  if(fight.php<=0){fight.php=0;endFight(false,'KO');return;}
  fight.eAtkCd=Math.max(0.7,1.6-state.level*0.004)+Math.random()*0.6;
}

function playerPunch(){
  if(!running||!fight||fight.over||fight.phase!=='fight')return;
  if(fight.pPunchCd>0)return;
  const f=fighter();
  fight.pPunchCd=Math.max(0.2,0.8-f.spd*0.02);
  fight.pPunchDur=0.2;fight.pPunchAnim=fight.pPunchDur;
  let dmg=(4+f.pow*0.9)*(0.9+Math.random()*0.2);
  const blocked=fight.eBlocking;
  if(blocked)dmg*=0.4;
  fight.ehp-=dmg;
  fight.eHitT=0.17;
  state.punches++;
  fight.energy=Math.min(100,fight.energy+(blocked?4:12));
  spawnHit(LANES[1]+fight.eSlide-14,226,blocked?'#93c5fd':'#fde047',blocked?0.4:0.9);
  hitSound(blocked);
  if(!blocked&&Math.random()<0.25){fight.eBlocking=true;fight.eBlockCd=0.7;}
  if(fight.ehp<=0){fight.ehp=0;endFight(true,'KO');}
}

function useSkill(){
  if(!running||!fight||fight.over||fight.phase!=='fight')return;
  if(fight.energy<100)return;
  const f=fighter();
  let dmg=(4+f.pow*0.9)*f.skillVal;
  fight.energy=0;
  fight.pPunchDur=0.42;fight.pPunchAnim=fight.pPunchDur;
  state.skills++;
  if(f.skillType==='shield'){fight.php=Math.min(fight.phpMax,fight.php+12+f.def);}
  else if(f.skillType==='stun'){fight.eStun=2.2;}
  else if(f.skillType==='multi'){dmg*=1.15;}
  else if(f.skillType==='crit'){dmg*=1.3;}
  else if(f.skillType==='ko'){dmg*=1.45;}
  fight.ehp-=dmg;
  fight.eHitT=0.36;fight.hitFlash=0.12;
  spawnHit(LANES[1]+fight.eSlide-16,222,'#fbbf24',1.4);
  noise(0.4,0.26,700,'lowpass');
  tone(90,0.42,'sawtooth',0.14,50);
  if(fight.ehp<=0){fight.ehp=0;endFight(true,'KO');}
}

function endFight(won,reason){
  if(!fight||fight.over)return;
  fight.over=true;fight.phase='over';
  running=false;
  stopMusic();
  let money=0,xp=0,ups=0;
  if(won){
    state.wins++;
    if(reason==='KO')state.kos++;
    money=40+state.level*8+(reason==='KO'?40:0);
    xp=50+state.level*10+(reason==='KO'?25:0);
    state.money+=money;
    ups=addXp(xp);
    if(reason==='KO')koSound();else{bell();crowd(1.4,0.05);}
  }else{
    state.losses++;
    tone(120,0.5,'sawtooth',0.12,60);
  }
  grantLevelUnlocks();checkMissions();save();
  $('otitle').textContent=won?'You Win!':'You Lose';
  let txt=(reason==='KO'?'Knockout! ':'Time up! ');
  if(won)txt+='+$'+money+'  +'+xp+' XP';
  else txt+='Keep your guard up when the red ! appears.';
  if(ups>0)txt+='  LEVEL UP x'+ups;
  if(ups>0&&state.level>=MAX_LEVEL)txt+='  K.O. King unlocked!';
  $('otext').textContent=txt;
  show('over');hideControls();
}

function update(dt){
  if(!fight||fight.over)return;

  if(fight.phase==='intro'){
    fight.phaseT+=dt;
    const pt=fight.phaseT;
    let pSlide=0,eSlide=0,walk=0;
    if(pt<1.1){const k=1-pt/1.1,e=k*k;pSlide=-240*e;eSlide=240*e;walk=Math.abs(Math.sin(pt*16));}
    else if(pt<1.7){/* settle */}
    else if(pt<2.5){const k=(pt-1.7)/0.8,a=Math.sin(k*Math.PI);pSlide=52*a;eSlide=-52*a;}
    else if(pt<2.9){const k=(pt-2.5)/0.4;pSlide=52*(1-k);eSlide=-52*(1-k);}
    fight.pSlide=pSlide;fight.eSlide=eSlide;fight.pWalk=walk;fight.eWalk=walk;
    if(pt>=3.0){fight.phase='fight';fight.pSlide=0;fight.eSlide=0;fight.pWalk=0;fight.eWalk=0;
      fight.eAtkCd=Math.max(0.8,1.6-state.level*0.004);
      fight.fightFlash=1.2;bell();crowd(1.1,0.06);}
    return;
  }

  if(fight.fightFlash>0)fight.fightFlash-=dt;
  if(fight.hitFlash>0)fight.hitFlash-=dt;

  fight.time-=dt;
  if(fight.time<=0){
    fight.time=0;
    endFight((fight.php/fight.phpMax)>=(fight.ehp/fight.ehpMax),'TIME');
    return;
  }

  fight.pPunchCd=Math.max(0,fight.pPunchCd-dt);
  fight.pHitT=Math.max(0,fight.pHitT-dt);
  fight.eHitT=Math.max(0,fight.eHitT-dt);
  fight.pPunchAnim=Math.max(0,fight.pPunchAnim-dt);
  fight.ePunchAnim=Math.max(0,fight.ePunchAnim-dt);
  fight.eBlockCd=Math.max(0,fight.eBlockCd-dt);
  fight.eStun=Math.max(0,fight.eStun-dt);
  if(fight.eBlockCd<=0)fight.eBlocking=false;

  if(fight.eStun<=0){
    if(fight.eWind>0){
      fight.eWind-=dt;
      if(fight.eWind<=0)enemyAttack();
    }else{
      fight.eAtkCd-=dt;
      if(fight.eAtkCd<=0){
        fight.eWind=0.75;
        noise(0.18,0.05,650,'bandpass');
        if(!fight.over)fight.eAtkCd=999;
      }
    }
  }else{
    fight.eWind=0;
    if(fight.eAtkCd>1.2)fight.eAtkCd=1.2;
  }

  hitFx.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=420*dt;p.life-=dt;});
  hitFx=hitFx.filter(p=>p.life>0);
}

/* ---------- Drawing helpers ---------- */
function rr(g,x,y,w,h,r){
  r=Math.max(0,Math.min(r,Math.min(w,h)/2));
  g.beginPath();g.moveTo(x+r,y);
  g.arcTo(x+w,y,x+w,y+h,r);
  g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r);
  g.arcTo(x,y,x+w,y,r);
  g.closePath();
}
function shade(hex,amt){
  let c=String(hex||'#888').replace('#','');
  if(c.length===3)c=c.split('').map(ch=>ch+ch).join('');
  const n=parseInt(c,16)||0;
  const clamp=v=>Math.max(0,Math.min(255,Math.round(v)));
  return 'rgb('+clamp(((n>>16)&255)+255*amt)+','+clamp(((n>>8)&255)+255*amt)+','+clamp((n&255)+255*amt)+')';
}
function sphere(x,y,r,base,light,dark){
  const g=ctx.createRadialGradient(x-r*0.35,y-r*0.4,r*0.1,x,y,r*1.05);
  g.addColorStop(0,light);
  g.addColorStop(0.55,base);
  g.addColorStop(1,dark);
  return g;
}
function limb(x1,y1,x2,y2,w,base,light,dark){
  ctx.lineCap='round';
  ctx.strokeStyle=dark;ctx.lineWidth=w+3;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  ctx.strokeStyle=base;ctx.lineWidth=w;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  ctx.strokeStyle=light;ctx.lineWidth=Math.max(1,w*0.3);
  ctx.beginPath();ctx.moveTo(x1-w*0.18,y1);ctx.lineTo(x2-w*0.18,y2);ctx.stroke();
}

function drawBoxer3D(cx,feetY,scale,dir,skin,trunkColor,gloveColor,opts){
  const o=opts||{};
  const punch=Math.max(0,Math.min(1,o.punch||0));
  const block=!!o.block;
  const flash=o.flash>0;
  const bob=o.bob||0;
  const walk=o.walk||0;
  const lean=o.lean||0;

  const skinBase=flash?'#ffffff':skin;
  const skinLight=flash?'#ffffff':shade(skin,0.18);
  const skinDark=flash?'#d9d9d9':shade(skin,-0.28);
  const trunkBase=flash?'#ffffff':trunkColor;
  const trunkLight=flash?'#ffffff':shade(trunkColor,0.22);
  const trunkDark=flash?'#d9d9d9':shade(trunkColor,-0.32);
  const gloveBase=flash?'#ffffff':gloveColor;
  const gloveLight=flash?'#ffffff':shade(gloveColor,0.28);
  const gloveDark=flash?'#d9d9d9':shade(gloveColor,-0.36);

  ctx.save();
  ctx.translate(cx,feetY+bob);
  ctx.scale(scale*dir,scale);
  ctx.rotate(lean);

  const swing=Math.sin(performance.now()/260)*2;
  const backFootX=-20-walk*6,frontFootX=20+walk*6;

  limb(-8,-58,-16,-30,13,skinDark,skinBase,shade(skin,-0.4));
  limb(-16,-30,backFootX,-6,11,skinDark,skinBase,shade(skin,-0.4));
  ctx.fillStyle=shade(trunkDark,-0.3);
  rr(ctx,backFootX-10,-8,20,10,4);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.14)';
  rr(ctx,backFootX-8,-6,16,3,2);ctx.fill();

  limb(8,-58,16,-32,13,skinBase,skinLight,skinDark);
  limb(16,-32,frontFootX,-6,11,skinBase,skinLight,skinDark);
  ctx.fillStyle=shade(trunkBase,-0.42);
  rr(ctx,frontFootX-10,-8,20,10,4);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.18)';
  rr(ctx,frontFootX-8,-6,16,3,2);ctx.fill();

  const torsoG=ctx.createLinearGradient(-24,0,24,0);
  torsoG.addColorStop(0,skinDark);
  torsoG.addColorStop(0.35,skinBase);
  torsoG.addColorStop(0.62,skinLight);
  torsoG.addColorStop(1,skinDark);
  ctx.fillStyle=torsoG;
  ctx.beginPath();
  ctx.moveTo(-18,-106);
  ctx.quadraticCurveTo(-28,-92,-21,-60);
  ctx.lineTo(21,-60);
  ctx.quadraticCurveTo(28,-92,18,-106);
  ctx.quadraticCurveTo(0,-116,-18,-106);
  ctx.closePath();ctx.fill();

  ctx.fillStyle=sphere(-7,-92,11,skinBase,skinLight,skinDark);
  ctx.beginPath();ctx.ellipse(-7,-92,11,7,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=sphere(9,-92,12,skinBase,skinLight,skinDark);
  ctx.beginPath();ctx.ellipse(9,-92,12,7,0,0,Math.PI*2);ctx.fill();

  ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=1.4;
  ctx.beginPath();ctx.moveTo(0,-104);ctx.lineTo(0,-64);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-12,-80);ctx.lineTo(12,-80);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-11,-71);ctx.lineTo(11,-71);ctx.stroke();

  const trunkG=ctx.createLinearGradient(-24,-64,24,-38);
  trunkG.addColorStop(0,trunkDark);
  trunkG.addColorStop(0.42,trunkBase);
  trunkG.addColorStop(0.7,trunkLight);
  trunkG.addColorStop(1,trunkDark);
  ctx.fillStyle=trunkG;
  ctx.beginPath();
  ctx.moveTo(-21,-64);ctx.lineTo(21,-64);
  ctx.lineTo(25,-40);ctx.lineTo(7,-40);ctx.lineTo(0,-49);ctx.lineTo(-7,-40);ctx.lineTo(-25,-40);
  ctx.closePath();ctx.fill();
  ctx.fillStyle=trunkLight;
  ctx.fillRect(-21,-65,42,4);
  ctx.fillStyle='rgba(255,255,255,.24)';
  ctx.fillRect(-19,-60,12,3);

  ctx.fillStyle=skinDark;
  rr(ctx,-6,-118,12,12,4);ctx.fill();
  ctx.fillStyle=skinBase;
  rr(ctx,-5,-116,9,8,3);ctx.fill();

  limb(-16,-104,-24,-90,11,skinDark,skinBase,shade(skin,-0.4));
  const backGloveX=-6,backGloveY=-116+swing*0.5;
  limb(-24,-90,backGloveX,backGloveY,9,skinDark,skinBase,shade(skin,-0.4));
  ctx.fillStyle=sphere(backGloveX,backGloveY,10,gloveDark,gloveBase,shade(gloveColor,-0.45));
  ctx.beginPath();ctx.arc(backGloveX,backGloveY,10,0,Math.PI*2);ctx.fill();

  const headX=1,headY=-134,headR=17;
  ctx.fillStyle=sphere(headX,headY,headR,skinBase,skinLight,skinDark);
  ctx.beginPath();ctx.arc(headX,headY,headR,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=skinDark;
  ctx.beginPath();ctx.ellipse(headX-15,headY+2,4,5,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=sphere(headX-14,headY+2,4,skinBase,skinLight,skinDark);
  ctx.beginPath();ctx.ellipse(headX-14,headY+2,4,5,0,0,Math.PI*2);ctx.fill();

  ctx.fillStyle=flash?'#ddd':'#2a1a10';
  ctx.beginPath();
  ctx.arc(headX,headY-1,headR,Math.PI*1.02,Math.PI*1.98);
  ctx.quadraticCurveTo(headX+headR*0.4,headY-headR*0.55,headX-headR*0.9,headY-1);
  ctx.fill();
  ctx.fillStyle=trunkDark;
  ctx.fillRect(headX-headR,headY-7,headR*2,4);

  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.ellipse(headX+7,headY+1,4,3,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(headX-1,headY+1,3.4,2.8,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';
  ctx.beginPath();ctx.arc(headX+8,headY+1,1.9,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(headX,headY+1,1.6,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#2a1a10';ctx.lineWidth=1.7;
  ctx.beginPath();ctx.moveTo(headX+3,headY-4);ctx.lineTo(headX+11,headY-3);ctx.stroke();
  ctx.beginPath();ctx.moveTo(headX-5,headY-4);ctx.lineTo(headX+0,headY-4);ctx.stroke();

  ctx.fillStyle=skinLight;
  ctx.beginPath();ctx.moveTo(headX+14,headY+2);ctx.lineTo(headX+20,headY+5);ctx.lineTo(headX+14,headY+6);ctx.closePath();ctx.fill();

  ctx.fillStyle=flash?'#fff':'#b91c1c';
  rr(ctx,headX+6,headY+9,10,4,2);ctx.fill();

  let frontElbowX,frontElbowY,frontGloveX,frontGloveY;
  if(punch>0){
    frontElbowX=26+punch*16;frontElbowY=-101;
    frontGloveX=32+punch*72;frontGloveY=-104+punch*3;
  }else if(block){
    frontElbowX=20;frontElbowY=-98;
    frontGloveX=13;frontGloveY=-122;
  }else{
    frontElbowX=22;frontElbowY=-96;
    frontGloveX=18;frontGloveY=-116+swing;
  }
  limb(17,-104,frontElbowX,frontElbowY,12,skinBase,skinLight,skinDark);
  limb(frontElbowX,frontElbowY,frontGloveX,frontGloveY,10,skinBase,skinLight,skinDark);

  if(block){
    ctx.fillStyle=sphere(backGloveX+9,backGloveY-4,10,gloveDark,gloveBase,gloveLight);
    ctx.beginPath();ctx.arc(backGloveX+9,backGloveY-4,10,0,Math.PI*2);ctx.fill();
  }

  if(punch>0.15){
    ctx.strokeStyle='rgba(255,255,255,.28)';
    ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(frontGloveX,frontGloveY,16+punch*8,-Math.PI*0.8,-Math.PI*0.15);ctx.stroke();
  }

  ctx.fillStyle=sphere(frontGloveX,frontGloveY,11,gloveDark,gloveBase,shade(gloveColor,-0.45));
  ctx.beginPath();ctx.arc(frontGloveX,frontGloveY,11,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.3)';
  ctx.beginPath();ctx.arc(frontGloveX-3.5,frontGloveY-3.5,3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=trunkDark;
  rr(ctx,frontGloveX-12,frontGloveY+7,10,5,2);ctx.fill();

  if(block){
    ctx.strokeStyle='rgba(96,165,250,.85)';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(frontGloveX-2,frontGloveY,24,-Math.PI*0.75,Math.PI*0.35);ctx.stroke();
  }

  ctx.restore();
}

function drawFighterShadow(cx,feetY,scale){
  ctx.save();
  ctx.translate(cx,feetY+6);
  ctx.scale(1,0.28);
  const g=ctx.createRadialGradient(0,0,4,0,0,36*scale);
  g.addColorStop(0,'rgba(0,0,0,.62)');
  g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.arc(0,0,36*scale,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawImpact(x,y,size,color){
  ctx.save();ctx.translate(x,y);
  ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.lineCap='round';
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4+0.3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*size*0.35,Math.sin(a)*size*0.35);
    ctx.lineTo(Math.cos(a)*size,Math.sin(a)*size);
    ctx.stroke();
  }
  ctx.fillStyle=color;
  ctx.beginPath();ctx.arc(0,0,size*0.3,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function healthBar(x,y,w,h,ratio,color){
  ratio=Math.max(0,Math.min(1,ratio||0));
  ctx.fillStyle='rgba(0,0,0,.55)';
  rr(ctx,x-1,y-1,w+2,h+2,4);ctx.fill();
  const bg=ctx.createLinearGradient(0,y,0,y+h);
  bg.addColorStop(0,'#212436');bg.addColorStop(1,'#0b0d16');
  ctx.fillStyle=bg;rr(ctx,x,y,w,h,3);ctx.fill();
  if(ratio>0){
    const g=ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0,shade(color,0.3));g.addColorStop(1,shade(color,-0.22));
    ctx.fillStyle=g;rr(ctx,x,y,w*ratio,h,3);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.18)';
    rr(ctx,x+1,y+1,w*ratio-2,Math.max(1,h*0.3),2);ctx.fill();
  }
  ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=1;
  rr(ctx,x+0.5,y+0.5,w-1,h-1,3);ctx.stroke();
}

function drawArena(tsec){
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#05060e');bg.addColorStop(0.45,'#0e1426');bg.addColorStop(1,'#06070d');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

  const starN=LOW_GFX?34:80;
  for(let i=0;i<starN;i++){
    const x=(i*97+13)%W;
    const y=20+((i*53)%170);
    const tw=0.12+0.4*Math.abs(Math.sin(tsec*1.4+i*0.7));
    ctx.fillStyle='rgba(150,175,255,'+tw.toFixed(2)+')';
    ctx.fillRect(x,y,2,2);
  }
  const colors=['rgba(255,120,160,','rgba(120,200,255,','rgba(255,220,120,'];
  for(let i=0;i<10;i++){
    const x=(i*131+40)%W,y=50+((i*71)%150);
    const r=2+((i*7)%4);
    ctx.fillStyle=colors[i%3]+(0.18+0.1*Math.sin(tsec*2+i)).toFixed(2)+')';
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  const crowdN=LOW_GFX?12:26;
  for(let i=0;i<crowdN;i++){
    const x=(i*43+7)%W;
    const y=150+((i*29)%70);
    ctx.fillStyle='rgba(24,30,48,.85)';
    ctx.beginPath();ctx.arc(x,y,7+((i*3)%5),0,Math.PI*2);ctx.fill();
  }

  for(let i=0;i<3;i++){
    const bx=i===0?70:i===1?W-70:W/2;
    const sway=Math.sin(tsec*0.8+i*1.3)*12;
    const grad=ctx.createLinearGradient(bx+sway,0,bx+sway*0.4,350);
    grad.addColorStop(0,'rgba(255,245,210,.20)');
    grad.addColorStop(1,'rgba(255,245,210,0)');
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.moveTo(bx+sway-10,0);ctx.lineTo(bx+sway+10,0);
    ctx.lineTo(bx+sway*0.4+95,340);ctx.lineTo(bx+sway*0.4-95,340);
    ctx.closePath();ctx.fill();
  }
}
function drawRing(){
  ctx.fillStyle='#150b14';ctx.fillRect(0,330,W,H-330);

  const bx1=60,bx2=W-60,by=246;
  const g=ctx.createLinearGradient(0,by,0,H);
  g.addColorStop(0,'#2b3a63');g.addColorStop(0.4,'#3d548a');g.addColorStop(1,'#1a2547');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.moveTo(bx1,by);ctx.lineTo(bx2,by);ctx.lineTo(W+40,H);ctx.lineTo(-40,H);ctx.closePath();ctx.fill();

  ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;
  for(let i=1;i<=5;i++){
    const k=i/6,y=by+(H-by)*(k*k*0.85+k*0.15);
    const half=((bx2-bx1)/2)+((W+40-(bx2-bx1))/2)*k;
    ctx.beginPath();ctx.moveTo(W/2-half,y);ctx.lineTo(W/2+half,y);ctx.stroke();
  }
  ctx.save();ctx.translate(W/2,by+(H-by)*0.56);ctx.scale(1,0.42);
  ctx.strokeStyle='rgba(255,220,120,.22)';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(0,0,72,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(0,0,48,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}
function drawRopesBack(){
  const x1=52,x2=W-52;
  [190,214,238].forEach((y,i)=>{
    ctx.strokeStyle=i===1?'rgba(236,241,255,.82)':'rgba(180,192,220,.66)';
    ctx.lineWidth=4-i*0.7;
    ctx.beginPath();ctx.moveTo(x1,y);
    ctx.quadraticCurveTo(W/2,y+7+i*2,x2,y);ctx.stroke();
  });
  [x1,x2].forEach(x=>{
    const pg=ctx.createLinearGradient(x-5,0,x+5,0);
    pg.addColorStop(0,'#4b5262');pg.addColorStop(0.5,'#8b93a5');pg.addColorStop(1,'#3d4351');
    ctx.fillStyle=pg;ctx.fillRect(x-4,176,8,120);
    ctx.fillStyle='#b91c1c';ctx.fillRect(x-7,184,14,26);
    ctx.fillStyle='#ef4444';ctx.fillRect(x-7,184,14,6);
  });
}
function drawRopesFront(){
  [424,452,476].forEach((y,i)=>{
    ctx.strokeStyle=i===1?'rgba(236,241,255,.9)':'rgba(180,192,220,.72)';
    ctx.lineWidth=5-i*0.8;
    ctx.beginPath();ctx.moveTo(-12,y);
    ctx.quadraticCurveTo(W/2,y+9,W+12,y);ctx.stroke();
  });
}

function draw(){
  const f=fighter();
  const now=performance.now();
  const tsec=now/1000;
  const bob=Math.sin(tsec*2.4)*2;

  ctx.save();
  const shake=(fight.pHitT*4+fight.eHitT*5)+(fight.hitFlash>0?3:0);
  if(shake>0)ctx.translate((Math.random()-0.5)*shake,(Math.random()-0.5)*shake);

  drawArena(tsec);
  drawRing();
  drawRopesBack();

  const pX=LANES[0]+fight.pSlide;
  const eX=LANES[1]+fight.eSlide;

  const pPunchExt=fight.pPunchDur>0?Math.sin((1-fight.pPunchAnim/fight.pPunchDur)*Math.PI):0;
  const ePunchExt=fight.ePunchDur>0?Math.sin((1-fight.ePunchAnim/fight.ePunchDur)*Math.PI):0;
  const eLean=ePunchExt*0.05-(fight.eWind>0?0.055:0);
  const pLean=pPunchExt*0.05;

  drawFighterShadow(eX,FEET,1.05);
  drawFighterShadow(pX,FEET,1.08);

  drawBoxer3D(eX-(ePunchExt>0?ePunchExt*10:0),FEET,1.02,-1,'#b97b52','#c2410c','#1d4ed8',{
    punch:ePunchExt,block:fight.eBlocking,flash:fight.eHitT>0,
    bob:-bob*0.6,walk:fight.eWalk,lean:eLean
  });
  drawBoxer3D(pX+ (pPunchExt>0?pPunchExt*10:0),FEET,1.05,1,f.skin||'#e0a878',f.trunk||f.color,f.glove||'#dc2626',{
    punch:pPunchExt,block:fight.pBlock,flash:fight.pHitT>0,
    bob:bob,walk:fight.pWalk,lean:pLean
  });

  hitFx.forEach(p=>{
    ctx.globalAlpha=Math.max(0,p.life/p.max);
    ctx.fillStyle=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
  });
  ctx.globalAlpha=1;

  if(fight.pHitT>0)drawImpact(pX+20,222,17,'#fca5a5');
  if(fight.eHitT>0)drawImpact(eX-20,222,19,'#fde047');

  ctx.restore();

  drawRopesFront();

  const flashA=fight.hitFlash>0?fight.hitFlash*0.5:0;
  if(flashA>0){ctx.fillStyle='rgba(255,60,60,'+flashA+')';ctx.fillRect(0,0,W,H);}

  healthBar(14,32,130,12,fight.php/fight.phpMax,'#22c55e');
  healthBar(W-144,32,130,12,fight.ehp/fight.ehpMax,'#ef4444');
  ctx.textAlign='left';ctx.fillStyle='#dfe6ff';ctx.font='bold 12px system-ui,-apple-system,sans-serif';
  ctx.fillText(f.name,14,26);
  ctx.textAlign='right';
  ctx.fillText('Rival Lv'+state.level,W-14,26);
  ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 20px system-ui,-apple-system,sans-serif';
  ctx.fillText(Math.ceil(fight.time),W/2,30);
  ctx.font='9px system-ui,-apple-system,sans-serif';ctx.fillStyle='#8c93ab';
  ctx.fillText('TIME',W/2,42);

  ctx.textAlign='left';ctx.font='9px system-ui,-apple-system,sans-serif';ctx.fillStyle='#aab0c6';
  ctx.fillText('SKILL',14,60);
  healthBar(14,64,120,8,fight.energy/100,'#facc15');
  if(fight.energy>=100){
    const a=0.55+0.45*Math.abs(Math.sin(now/140));
    ctx.fillStyle='rgba(250,204,21,'+a.toFixed(2)+')';
    ctx.font='bold 10px system-ui,-apple-system,sans-serif';
    ctx.textAlign='right';ctx.fillText('SKILL READY!',W-14,71);
    ctx.textAlign='left';
  }

  if(fight.phase==='fight'&&fight.eWind>0&&!fight.over){
    const s=1+Math.sin(now/80)*0.18;
    ctx.save();ctx.translate(eX,214);ctx.scale(s,s);
    ctx.fillStyle='rgba(239,68,68,.25)';
    ctx.beginPath();ctx.arc(0,-8,21,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ef4444';ctx.textAlign='center';
    ctx.font='bold 30px system-ui,-apple-system,sans-serif';
    ctx.fillText('!',0,2);
    ctx.restore();
    ctx.textAlign='center';ctx.fillStyle='#fca5a5';
    ctx.font='bold 9px system-ui,-apple-system,sans-serif';
    ctx.fillText('BLOCK NOW',eX,196);
    ctx.textAlign='left';
  }
  if(fight.pBlock){
    ctx.fillStyle='#60a5fa';ctx.textAlign='center';
    ctx.font='bold 11px system-ui,-apple-system,sans-serif';
    ctx.fillText('BLOCKING',pX,200);
    ctx.textAlign='left';
  }

  if(fight.phase==='intro'){
    const pt=fight.phaseT;
    ctx.save();ctx.textAlign='center';
    if(pt>=1.1&&pt<2.9){
      ctx.globalAlpha=Math.min(1,(pt-1.1)*3);
      ctx.fillStyle='#fff';ctx.font='bold 30px system-ui,-apple-system,sans-serif';
      ctx.shadowColor='#3b82f6';ctx.shadowBlur=20;
      ctx.fillText('ROUND 1',W/2,150);
      ctx.shadowBlur=0;
      if(pt>=1.7&&pt<2.5){
        ctx.font='bold 12px system-ui,-apple-system,sans-serif';
        ctx.fillStyle='#ffd166';
        ctx.fillText('TOUCH GLOVES',W/2,174);
      }
    }
    ctx.restore();
  }
  if(fight.fightFlash>0){
    const k=1-fight.fightFlash/1.2;
    ctx.save();ctx.translate(W/2,170);
    const s=1+k*0.55;ctx.scale(s,s);
    ctx.globalAlpha=Math.max(0,Math.min(1,fight.fightFlash*1.6));
    ctx.textAlign='center';ctx.fillStyle='#fff';
    ctx.font='bold 42px system-ui,-apple-system,sans-serif';
    ctx.shadowColor='#ef4444';ctx.shadowBlur=26;
    ctx.fillText('FIGHT!',0,0);
    ctx.restore();
  }
}

function loop(ts){
  if(!running)return;
  const dt=last?Math.min((ts-last)/1000,0.05):0.016;
  last=ts;
  update(dt);
  if(!running)return;
  draw();
  requestAnimationFrame(loop);
}

function setBlock(v){if(fight&&!fight.over&&fight.phase==='fight')fight.pBlock=v;}

window.addEventListener('keydown',e=>{
  unlockAudio();
  const k=e.key||'';
  const c=e.keyCode;
  let act='';
  if(k==='5'||c===53||k==='Enter'||c===13||k===' '||c===32)act='punch';
  else if(k==='8'||c===56||k==='ArrowDown'||c===40)act='block';
  else if(k==='0'||c===48||k==='ArrowUp'||c===38)act='skill';
  if(!act)return;
  e.preventDefault();
  if(act==='punch')playerPunch();
  else if(act==='skill')useSkill();
  else setBlock(true);
});
window.addEventListener('keyup',e=>{
  const k=e.key||'',c=e.keyCode;
  if(k==='8'||c===56||k==='ArrowDown'||c===40)setBlock(false);
});

const btnBlock=$('btnBlock');
['touchstart','mousedown'].forEach(ev=>{
  btnBlock.addEventListener(ev,e=>{e.preventDefault();setBlock(true);},{passive:false});
});
['touchend','touchcancel','mouseup','mouseleave'].forEach(ev=>{
  btnBlock.addEventListener(ev,e=>{if(e.preventDefault)e.preventDefault();setBlock(false);});
});
$('btnPunch').addEventListener('click',()=>{unlockAudio();playerPunch();});
$('btnSkill').addEventListener('click',()=>{unlockAudio();useSkill();});

$('fight').onclick=startFight;
$('fighters').onclick=()=>{renderFighters();show('fghv');};
$('missions').onclick=()=>{renderMissions();show('missv');};
$('back1').onclick=()=>{updateMenu();show('menu');};
$('back2').onclick=()=>{updateMenu();show('menu');};
$('retry').onclick=startFight;
$('menu2').onclick=()=>{updateMenu();show('menu');hideControls();};
$('home').onclick=()=>{stopMusic();location.href='../../index.html';};

updateMenu();
show('menu');
hideControls();
save();
