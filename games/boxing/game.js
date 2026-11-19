/* ===== Boxing 2D ===== */
'use strict';
let params;
try{params=new URLSearchParams(location.search);}catch(e){params={get:function(){return null;}};}
try{
  if(typeof CanvasRenderingContext2D!=='undefined'&&CanvasRenderingContext2D.prototype&&!CanvasRenderingContext2D.prototype.ellipse){
    CanvasRenderingContext2D.prototype.ellipse=function(x,y,rx,ry,rot,start,end,ccw){
      this.save();this.translate(x,y);if(rot)this.rotate(rot);this.scale(rx,ry);
      this.arc(0,0,1,start,end,ccw);this.restore();
    };
  }
}catch(e){}
function storeGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function storeSet(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}}

let user=params.get('user');
if(!user){try{const u=JSON.parse(storeGet('wg_user')||'null');if(u&&u.name)user=u.name;}catch(e){}}
if(!user)user='guest';
const KEY='boxing_'+user;
const MUTE_KEY='boxing_muted';
const MAX_LEVEL=100;

const FIGHTERS=[
  {id:'rookie',  name:'Rookie',  price:0,    pow:10,spd:10,sta:10,skin:'#e0a878',trunk:'#2563eb',glove:'#dc2626',desc:'Balanced all-rounder'},
  {id:'pro',     name:'Pro',     price:500,  pow:15,spd:13,sta:13,skin:'#c98a5b',trunk:'#b91c1c',glove:'#f97316',desc:'Seasoned and dependable'},
  {id:'champion',name:'Champion',price:2000, pow:20,spd:17,sta:18,skin:'#d69a6a',trunk:'#15803d',glove:'#facc15',desc:'Title-winning technique'},
  {id:'legend',  name:'Legend',  price:8000, pow:26,spd:22,sta:24,skin:'#f0c8a0',trunk:'#312e81',glove:'#fde047',desc:'Hall-of-fame power and pace'},
  {id:'maharaja',name:'Maharaja',price:15000,pow:32,spd:27,sta:30,skin:'#b97b52',trunk:'#7e22ce',glove:'#fb7185',desc:'Royal silk, iron fists'},
  {id:'titan',   name:'Titan',   price:30000,pow:39,spd:31,sta:37,skin:'#a06a45',trunk:'#0f766e',glove:'#e11d48',desc:'The unstoppable force'}
];
const ENEMY_NAMES=['Eddie "Viper" Cole','Marcus "Hammer" Stone','Rico "El Toro" Mendez','Dmitri "Volga" Kovac','Andre "Anvil" Bell','Kofi "Thunder" Asante','Rocco "Bull" Marchetti','Tommy "Two-Ton" Reed','Luis "Cobra" Herrera','Viktor "Glacier" Petrov'];
const ENEMY_LOOKS=[
  {skin:'#b97b52',trunk:'#c2410c',glove:'#1d4ed8'},
  {skin:'#e0a878',trunk:'#0f766e',glove:'#111827'},
  {skin:'#7c4a2d',trunk:'#7f1d1d',glove:'#f8fafc'},
  {skin:'#c98a5b',trunk:'#1e3a8a',glove:'#dc2626'},
  {skin:'#a06a45',trunk:'#365314',glove:'#eab308'},
  {skin:'#f2c89b',trunk:'#4c1d95',glove:'#22c55e'}
];
const MISSIONS=[
  {id:'win1',     title:'Win 1 match',      type:'wins',   target:1,  reward:100},
  {id:'win10',    title:'Win 10 matches',   type:'wins',   target:10, reward:400},
  {id:'punches50',title:'Land 50 punches',  type:'punches',target:50, reward:300},
  {id:'ko5',      title:'Score 5 KOs',      type:'kos',    target:5,  reward:500},
  {id:'skills10', title:'Use 10 skills',    type:'skills', target:10, reward:350},
  {id:'level10',  title:'Reach Level 10',   type:'level',  target:10, reward:600},
  {id:'level50',  title:'Reach Level 50',   type:'level',  target:50, reward:2000},
  {id:'king',     title:'Become Level 100', type:'level',  target:100,reward:10000}
];
const ATTACKS={
  jab:     {dur:0.30,cd:0.15,stam:7, dmg:5, range:97, hitAt:0.11,stun:0.22,head:0.35},
  cross:   {dur:0.40,cd:0.23,stam:11,dmg:8, range:103,hitAt:0.15,stun:0.30,head:0.45},
  hook:    {dur:0.48,cd:0.29,stam:14,dmg:11,range:89, hitAt:0.19,stun:0.36,head:0.55},
  uppercut:{dur:0.60,cd:0.37,stam:21,dmg:15,range:85, hitAt:0.26,stun:0.48,head:0.85}
};
const AI_ATTACKS=['jab','jab','jab','cross','cross','hook','uppercut'];

/* ---------- Save state ---------- */
function num(v,def){return (typeof v==='number'&&isFinite(v))?v:def;}
function fighterIndexById(id){for(let i=0;i<FIGHTERS.length;i++)if(FIGHTERS[i].id===id)return i;return -1;}
function defaultState(){
  return {user:user,money:0,xp:0,level:1,wins:0,losses:0,streak:0,bestStreak:0,totalEarned:0,
    owned:[0],selected:0,punches:0,kos:0,skills:0,
    missions:MISSIONS.map(m=>({id:m.id,progress:0,done:false}))};
}
function loadState(){
  let s=null;
  try{s=JSON.parse(storeGet(KEY)||'null');}catch(e){s=null;}
  if(!s||typeof s!=='object'||!s.user)return defaultState();
  s.user=String(s.user);
  s.money=Math.max(0,Math.floor(num(s.money,0)));
  s.xp=Math.max(0,num(s.xp,0));
  s.level=Math.max(1,Math.min(MAX_LEVEL,Math.floor(num(s.level,1))));
  s.wins=Math.max(0,Math.floor(num(s.wins,0)));
  s.losses=Math.max(0,Math.floor(num(s.losses,0)));
  s.streak=Math.max(0,Math.floor(num(s.streak,0)));
  s.bestStreak=Math.max(0,Math.floor(num(s.bestStreak,0)));
  s.totalEarned=Math.max(0,Math.floor(num(s.totalEarned,0)));
  s.punches=Math.max(0,Math.floor(num(s.punches,0)));
  s.kos=Math.max(0,Math.floor(num(s.kos,0)));
  s.skills=Math.max(0,Math.floor(num(s.skills,0)));
  if(!Array.isArray(s.owned)||!s.owned.length)s.owned=[0];
  const ownedIdx=[];
  s.owned.forEach(o=>{
    let i=-1;
    if(typeof o==='number')i=Math.floor(o);
    else if(typeof o==='string')i=fighterIndexById(o);
    if(i>=0&&i<FIGHTERS.length&&ownedIdx.indexOf(i)<0)ownedIdx.push(i);
  });
  if(ownedIdx.indexOf(0)<0)ownedIdx.unshift(0);
  s.owned=ownedIdx;
  s.selected=Math.floor(num(s.selected,0));
  if(s.owned.indexOf(s.selected)<0)s.selected=s.owned[0];
  if(!Array.isArray(s.missions))s.missions=[];
  s.missions=s.missions.filter(m=>m&&typeof m.id==='string');
  MISSIONS.forEach(def=>{
    if(!s.missions.some(m=>m.id===def.id))s.missions.push({id:def.id,progress:0,done:false});
  });
  s.missions=s.missions.map(m=>({id:m.id,progress:Math.max(0,num(m.progress,0)),done:!!m.done}));
  return s;
}
let state=loadState();
function save(){storeSet(KEY,JSON.stringify(state));}
function fighter(){return FIGHTERS[state.selected]||FIGHTERS[0];}
function fightNumber(){return state.wins+state.losses;}

/* ---------- XP / missions ---------- */
function xpNeeded(l){return Math.floor(60*Math.pow(l,1.15));}
function addXp(x){
  if(state.level>=MAX_LEVEL)return 0;
  const before=state.level;
  state.xp+=x;
  while(state.level<MAX_LEVEL&&state.xp>=xpNeeded(state.level)){
    state.xp-=xpNeeded(state.level);
    state.level++;
    state.money+=state.level*25;
  }
  if(state.level>=MAX_LEVEL)state.xp=0;
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
  const doneNow=[];
  state.missions.forEach(m=>{
    if(m.done)return;
    const def=MISSIONS.find(x=>x.id===m.id);
    if(!def)return;
    m.progress=missionProgress(m);
    if(m.progress>=def.target){m.done=true;state.money+=def.reward;state.totalEarned+=def.reward;doneNow.push(def);}
  });
  return doneNow;
}

const $=id=>document.getElementById(id);
const canvas=$('c');
const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height;
const FEET=470;
const LOW_GFX=/KAIOS/i.test(navigator.userAgent||'')||((window.innerWidth||999)<=320)||((window.innerHeight||999)<=380);

/* ---------- Audio (WebAudio only) ---------- */
let muted=storeGet(MUTE_KEY)==='1';
let audioCtx=null,master=null,noiseBuf=null;
let musicTimer=null,musicGain=null,musicStep=0,musicVol=0.4;
let crowdGain=null,crowdSrc=null,crowdLfo=null,crowdLfoGain=null,whistleTimer=null;
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
  if(!audioCtx||muted)return;
  try{
    const b=getNoise();if(!b)return;
    const t=audioCtx.currentTime;
    const s=audioCtx.createBufferSource();s.buffer=b;
    const f=audioCtx.createBiquadFilter();f.type=type||'bandpass';f.frequency.value=freq||800;f.Q.value=0.8;
    const g=audioCtx.createGain();g.gain.setValueAtTime(vol||0.12,t);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+dur+0.02);
  }catch(e){}
}
function startCrowd(){
  if(!audioCtx||muted||crowdSrc)return;
  try{
    const b=getNoise();if(!b)return;
    const t=audioCtx.currentTime;
    const s=audioCtx.createBufferSource();s.buffer=b;s.loop=true;
    const f=audioCtx.createBiquadFilter();f.type='bandpass';f.frequency.value=520;f.Q.value=0.45;
    crowdGain=audioCtx.createGain();
    crowdGain.gain.setValueAtTime(0.0001,t);
    crowdGain.gain.linearRampToValueAtTime(0.028,t+1.2);
    crowdLfo=audioCtx.createOscillator();crowdLfo.frequency.value=0.14;crowdLfo.type='sine';
    crowdLfoGain=audioCtx.createGain();crowdLfoGain.gain.value=0.013;
    crowdLfo.connect(crowdLfoGain);crowdLfoGain.connect(crowdGain.gain);
    s.connect(f);f.connect(crowdGain);crowdGain.connect(master);
    s.start(t);crowdLfo.start(t);
    crowdSrc=s;
    scheduleWhistle();
  }catch(e){}
}
function scheduleWhistle(){
  clearTimeout(whistleTimer);
  whistleTimer=setTimeout(function(){
    if(crowdSrc&&!muted&&Math.random()<0.75)tone(2000+Math.random()*800,0.24,'sine',0.035,3200+Math.random()*600);
    scheduleWhistle();
  },2800+Math.random()*4200);
}
function crowdSwell(v){
  if(!audioCtx||muted||!crowdGain)return;
  try{
    const t=audioCtx.currentTime;
    crowdGain.gain.cancelScheduledValues(t);
    crowdGain.gain.setValueAtTime(Math.max(0.028,crowdGain.gain.value),t);
    crowdGain.gain.linearRampToValueAtTime(0.028+(v||1)*0.055,t+0.14);
    crowdGain.gain.exponentialRampToValueAtTime(0.028,t+2.1);
  }catch(e){}
}
function stopCrowd(){
  clearTimeout(whistleTimer);whistleTimer=null;
  if(crowdSrc){try{crowdSrc.stop();}catch(e){}}
  if(crowdLfo){try{crowdLfo.stop();}catch(e){}}
  try{if(crowdGain)crowdGain.disconnect();}catch(e){}
  try{if(crowdLfoGain)crowdLfoGain.disconnect();}catch(e){}
  crowdSrc=null;crowdLfo=null;crowdLfoGain=null;crowdGain=null;
}
function bell(){
  [880,1320,1760].forEach(function(f,i){setTimeout(function(){tone(f,0.55,'triangle',0.11-i*0.02);},i*10);});
  setTimeout(function(){[880,1320].forEach(function(f,i){tone(f,0.5,'triangle',0.1-i*0.02);});},200);
}
function punchSound(heavy,blocked,head){
  if(blocked){
    noise(0.09,0.16,2600,'bandpass');
    tone(720,0.07,'square',0.055,540);
    return;
  }
  if(head){
    noise(0.12,0.2,1700,'bandpass');
    tone(220+Math.random()*60,0.1,'square',0.1,130);
    tone(95,0.12,'sine',0.12,55);
  }else{
    noise(0.16,0.24,750,'lowpass');
    tone(135+Math.random()*35,0.15,'sine',0.16,58);
  }
  if(heavy){noise(0.3,0.22,420,'lowpass');tone(70,0.32,'sawtooth',0.12,38);}
}
function whiffSound(){noise(0.13,0.07,950,'bandpass');}
function blockClack(){noise(0.07,0.15,3200,'highpass');tone(900,0.05,'square',0.04,700);}
function koBoom(){
  noise(0.7,0.42,220,'lowpass');
  tone(82,0.7,'sawtooth',0.2,36);
  tone(55,0.9,'sine',0.22,30);
  crowdSwell(1.6);
}
function coinDing(){tone(1250,0.06,'square',0.06);setTimeout(function(){tone(1700,0.14,'square',0.06);},65);}
function fanfare(){
  const seq=[523,659,784,1047,784,1047];
  seq.forEach(function(f,i){setTimeout(function(){tone(f,0.26,'triangle',0.12);},i*120);});
  setTimeout(function(){[523,659,784].forEach(function(f){tone(f,0.5,'triangle',0.1);});},760);
}
function startMusic(vol){
  unlockAudio();
  if(!audioCtx||muted)return;
  stopMusic();
  musicVol=(typeof vol==='number')?vol:0.4;
  try{
    musicGain=audioCtx.createGain();musicGain.gain.value=musicVol;musicGain.connect(master);
    musicStep=0;
    // arena rock: E2 power riff, kick 4-floor, snare backbeat, palm-muted chugs
    const BASS=[0,0,12,0, 3,3,10,0, 5,5,12,5, 3,2,0,0];
    const STEP=Math.round(60000/126/2);
    musicTimer=setInterval(function(){
      if(!audioCtx||!musicGain||muted)return;
      try{
        const i=musicStep++%16,t=audioCtx.currentTime;
        if(i%4===0){ // kick
          const o=audioCtx.createOscillator(),g=audioCtx.createGain();
          o.type='sine';o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(42,t+0.14);
          g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.32,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+0.17);
          o.connect(g);g.connect(musicGain);o.start(t);o.stop(t+0.19);
        }
        if(i===4||i===12){ // snare
          const b=getNoise();
          if(b){const s=audioCtx.createBufferSource();s.buffer=b;
            const f=audioCtx.createBiquadFilter();f.type='bandpass';f.frequency.value=1900;f.Q.value=0.7;
            const g=audioCtx.createGain();g.gain.setValueAtTime(0.2,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.13);
            s.connect(f);f.connect(g);g.connect(musicGain);s.start(t);s.stop(t+0.15);}
          tone(190,0.08,'triangle',0.06,150);
        }
        if(i%2===0){ // hats
          const b=getNoise();
          if(b){const s=audioCtx.createBufferSource();s.buffer=b;
            const f=audioCtx.createBiquadFilter();f.type='highpass';f.frequency.value=7500;
            const g=audioCtx.createGain();g.gain.setValueAtTime(i%4===2?0.05:0.028,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.04);
            s.connect(f);f.connect(g);g.connect(musicGain);s.start(t);s.stop(t+0.05);}
        }
        // palm-muted bass chug
        const semi=BASS[i];
        const bo=audioCtx.createOscillator(),bg=audioCtx.createGain(),bf=audioCtx.createBiquadFilter();
        bo.type='sawtooth';bo.frequency.setValueAtTime(82.4*Math.pow(2,semi/12),t);
        bf.type='lowpass';bf.frequency.setValueAtTime(900,t);bf.Q.value=7;
        bg.gain.setValueAtTime(0.0001,t);bg.gain.exponentialRampToValueAtTime(0.11,t+0.008);bg.gain.exponentialRampToValueAtTime(0.0001,t+0.16);
        bo.connect(bf);bf.connect(bg);bg.connect(musicGain);bo.start(t);bo.stop(t+0.18);
      }catch(e){}
    },STEP);
  }catch(e){}
}
function stopMusic(){
  if(musicTimer){clearInterval(musicTimer);musicTimer=null;}
  if(musicGain){try{musicGain.disconnect();}catch(e){}musicGain=null;}
}
function toggleMute(){
  unlockAudio();
  muted=!muted;
  storeSet(MUTE_KEY,muted?'1':'0');
  if(muted){stopMusic();stopCrowd();}
  else{startMusic(running?0.18:0.4);}
  updateMenu();
}

/* ---------- Overlay helpers (KaiOS-friendly) ---------- */
function show(id){
  var list=document.querySelectorAll('.overlay');
  for(var i=0;i<list.length;i++)list[i].classList.add('hidden');
  if(id){
    var el=$(id);
    if(el){el.classList.remove('hidden');focusFirst(el);}
  }
}
function focusFirst(ov){
  if(!ov)return;
  var btns=ov.querySelectorAll('button');
  for(var i=0;i<btns.length;i++){
    if(!btns[i].disabled){try{btns[i].focus();}catch(e){}return;}
  }
}
function visibleOverlay(){
  const list=document.querySelectorAll('.overlay');
  for(let i=0;i<list.length;i++){if(!list[i].classList.contains('hidden'))return list[i];}
  return null;
}
function overlayButtons(ov){
  const out=[];
  if(!ov)return out;
  const all=ov.querySelectorAll('button');
  for(let i=0;i<all.length;i++){if(!all[i].disabled)out.push(all[i]);}
  return out;
}
function focusStep(dir){
  const btns=overlayButtons(visibleOverlay());
  if(!btns.length)return;
  let idx=-1;
  for(let i=0;i<btns.length;i++){if(btns[i]===document.activeElement){idx=i;break;}}
  const next=idx<0?0:(idx+dir+btns.length)%btns.length;
  try{btns[next].focus();}catch(e){}
}
function activateFocused(){
  const ov=visibleOverlay();if(!ov)return false;
  const btns=overlayButtons(ov);if(!btns.length)return false;
  let idx=-1;
  for(let i=0;i<btns.length;i++){if(btns[i]===document.activeElement){idx=i;break;}}
  if(idx<0){try{btns[0].focus();}catch(e){}return true;}
  try{btns[idx].click();}catch(e){}
  return true;
}
function showControls(){$('controls').classList.remove('hidden');}
function hideControls(){$('controls').classList.add('hidden');}
function inFight(){return running&&fight&&fight.phase==='fight'&&!fight.over&&!fight.phaseDone;}

/* ---------- Menu / screens ---------- */
function updateMenu(){
  $('userinfo').textContent='Player: '+state.user;
  $('mlevel').textContent=state.level;
  $('mxp').textContent=Math.floor(state.xp);
  $('mneed').textContent=state.level>=MAX_LEVEL?'MAX':xpNeeded(state.level);
  $('mxpfill').style.width=Math.min(100,state.xp/xpNeeded(state.level)*100)+'%';
  $('mmoney').textContent=state.money;
  $('mstats').textContent='Wins '+state.wins+' · Losses '+state.losses+' · Streak '+state.streak+' · Best '+state.bestStreak;
  $('muteMenu').textContent=muted?'Sound: Off':'Sound: On';
}
function statBar(label,val,max,color){
  const pct=Math.round(Math.max(0.06,Math.min(1,val/max))*100);
  return '<div class="fstat"><span>'+label+'</span><div class="bar"><i style="width:'+pct+'%;background:'+color+'"></i></div></div>';
}
function drawFighterIcon(cv,f){
  try{
    const g=cv.getContext('2d');
    const cw=cv.width,ch=cv.height;
    g.clearRect(0,0,cw,ch);
    if(LOW_GFX){g.fillStyle='#1b2236';g.fillRect(0,0,cw,ch);}
    else{
      const bg=g.createLinearGradient(0,0,0,ch);
      bg.addColorStop(0,'#2a2440');bg.addColorStop(1,'#10141f');
      g.fillStyle=bg;g.fillRect(0,0,cw,ch);
    }
    const cx=cw/2,base=ch-6,sc=cw/58;
    g.strokeStyle=shade(f.skin,-0.25);g.lineWidth=5*sc;g.lineCap='round';
    g.beginPath();g.moveTo(cx-7*sc,base-15*sc);g.lineTo(cx-12*sc,base);g.stroke();
    g.beginPath();g.moveTo(cx+7*sc,base-15*sc);g.lineTo(cx+12*sc,base);g.stroke();
    g.fillStyle=shade(f.trunk,-0.3);
    rr(g,cx-12*sc,base-6*sc,10*sc,6*sc,2*sc);g.fill();
    rr(g,cx+2*sc,base-6*sc,10*sc,6*sc,2*sc);g.fill();
    g.fillStyle=f.skin;
    g.beginPath();
    g.moveTo(cx-10*sc,base-36*sc);
    g.quadraticCurveTo(cx-13*sc,base-22*sc,cx-9*sc,base-17*sc);
    g.lineTo(cx+9*sc,base-17*sc);
    g.quadraticCurveTo(cx+13*sc,base-22*sc,cx+10*sc,base-36*sc);
    g.quadraticCurveTo(cx,base-41*sc,cx-10*sc,base-36*sc);
    g.closePath();g.fill();
    g.fillStyle=f.trunk;
    g.beginPath();
    g.moveTo(cx-9*sc,base-19*sc);g.lineTo(cx+9*sc,base-19*sc);g.lineTo(cx+10*sc,base-11*sc);g.lineTo(cx-10*sc,base-11*sc);
    g.closePath();g.fill();
    g.fillStyle='#fbbf24';
    g.beginPath();g.arc(cx,base-15*sc,2.2*sc,0,Math.PI*2);g.fill();
    g.fillStyle=shade(f.skin,0.12);
    g.beginPath();g.arc(cx,base-44*sc,9*sc,0,Math.PI*2);g.fill();
    g.fillStyle='#241610';
    g.beginPath();g.arc(cx,base-46*sc,9*sc,Math.PI*1.05,Math.PI*1.95);g.fill();
    g.fillStyle=f.glove;
    g.beginPath();g.arc(cx-13*sc,base-27*sc,6*sc,0,Math.PI*2);g.fill();
    g.beginPath();g.arc(cx+13*sc,base-27*sc,6*sc,0,Math.PI*2);g.fill();
    g.fillStyle='#fff';
    g.beginPath();g.arc(cx+3.5*sc,base-44*sc,1.8*sc,0,Math.PI*2);g.fill();
    g.beginPath();g.arc(cx-3.5*sc,base-44*sc,1.6*sc,0,Math.PI*2);g.fill();
    g.fillStyle='#111';
    g.beginPath();g.arc(cx+4*sc,base-44*sc,0.9*sc,0,Math.PI*2);g.fill();
    g.beginPath();g.arc(cx-3*sc,base-44*sc,0.8*sc,0,Math.PI*2);g.fill();
  }catch(e){}
}
function isOwned(i){return state.owned.indexOf(i)>=0;}
function renderFighters(){
  const el=$('flist');el.innerHTML='';
  FIGHTERS.forEach(function(f,i){
    const owned=isOwned(i),sel=state.selected===i;
    const d=document.createElement('div');
    d.className='fitem'+(sel?' selected':'');
    const priceTxt=owned?'Owned':('Price $'+f.price);
    let html='<div class="fhead"><canvas class="fprev" width="56" height="66"></canvas>';
    html+='<div class="fmeta"><b>'+f.name+'</b><span class="fdesc">'+f.desc+'</span><span class="fprice">'+priceTxt+'</span></div></div>';
    html+='<div class="fstats">';
    html+=statBar('POW',f.pow,40,'#ef4444');
    html+=statBar('SPD',f.spd,32,'#22c55e');
    html+=statBar('STA',f.sta,37,'#3b82f6');
    html+='</div>';
    d.innerHTML=html;
    const pcv=d.querySelector('canvas');
    if(pcv)drawFighterIcon(pcv,f);
    const btn=document.createElement('button');
    if(sel){btn.textContent='Selected';btn.disabled=true;}
    else if(owned){btn.textContent='Select';btn.addEventListener('click',function(){state.selected=i;save();coinDing();renderFighters();updateMenu();});}
    else if(state.money>=f.price){
      btn.textContent='Buy $'+f.price;
      btn.addEventListener('click',function(){
        if(state.money<f.price)return;
        state.money-=f.price;state.owned.push(i);state.selected=i;
        save();fanfare();renderFighters();updateMenu();
      });
    }
    else{btn.textContent='Need $'+(f.price-state.money);btn.disabled=true;}
    d.appendChild(btn);el.appendChild(d);
  });
}
function renderMissions(){
  const el=$('mlist');el.innerHTML='';
  state.missions.forEach(function(m){
    const def=MISSIONS.find(function(x){return x.id===m.id;});
    if(!def)return;
    const prog=Math.min(missionProgress(m),def.target);
    const pct=Math.round(prog/def.target*100);
    const d=document.createElement('div');d.className='mitem';
    d.innerHTML='<b>'+def.title+'</b><span>'+prog+'/'+def.target+' · Reward $'+def.reward+(m.done?' · DONE':'')+'</span>'+
      '<div class="bar mini"><i style="width:'+pct+'%;background:'+(m.done?'#22c55e':'#3b82f6')+'"></i></div>';
    el.appendChild(d);
  });
}

/* ---------- Fight state ---------- */
let running=false,paused=false,last=0,fight=null,hitFx=[],confetti=[],floatTexts=[];
let raf=0,drawAcc=0,loopQueued=false;
function requestLoop(){
  if(loopQueued)return;
  loopQueued=true;
  raf=requestAnimationFrame(loop);
}
const input={left:{key:false,touch:false},right:{key:false,touch:false},block:{key:false,touch:false}};

function seededRand(seed){
  let s=seed>>>0;
  return function(){s=(s*1664525+1013904223)>>>0;return s/4294967296;};
}
const rand=seededRand(1337);
const CROWD=[];
(function buildCrowd(){
  const tones=['#f2c89b','#e0a878','#c98a5b','#a06a45','#7c4a2d','#5b3423','#f7d7b0'];
  const shirts=['#ef4444','#f97316','#facc15','#22c55e','#3b82f6','#a855f7','#ec4899','#14b8a6','#e2e8f0','#64748b'];
  const rows=LOW_GFX?[236,278]:[204,244,284];
  rows.forEach(function(ry,ri){
    const n=LOW_GFX?16:26;
    for(let i=0;i<n;i++){
      CROWD.push({x:8+(i*(W-16)/(n-1))+(rand()-0.5)*14,y:ry+(rand()-0.5)*8,
        skin:tones[Math.floor(rand()*tones.length)],shirt:shirts[Math.floor(rand()*shirts.length)],
        phase:rand()*6.28,speed:1.5+rand()*1.4,size:6.5+rand()*3,row:ri});
    }
  });
})();
const SCUFFS=[];
(function(){for(let i=0;i<16;i++){SCUFFS.push({x:60+rand()*240,y:380+rand()*130,len:6+rand()*26,a:rand()*Math.PI});}})();

function enemyLook(){return ENEMY_LOOKS[(state.wins+state.losses)%ENEMY_LOOKS.length];}
function enemyName(){return ENEMY_NAMES[(state.wins+state.losses)%ENEMY_NAMES.length];}
function difficulty(){
  const fn=fightNumber();
  return {
    fn:fn,
    aggression:Math.min(0.92,0.48+fn*0.045),
    blockChance:Math.min(0.6,0.12+fn*0.04),
    windTime:Math.max(0.26,0.58-fn*0.03),
    moveSpeed:Math.min(178,112+fn*7),
    cooldown:Math.max(0.55,1.38-fn*0.085),
    dmgBase:Math.min(15.5,5.5+fn*0.65),
    regen:Math.min(24,15+fn*0.8)
  };
}
function newCombatant(isPlayer,x,name){
  const f=fighter();
  const diff=difficulty();
  const maxStam=isPlayer?Math.round(78+f.sta*2.2):100;
  return {
    isPlayer:isPlayer,name:name||f.name,x:x,hp:100,maxHp:100,
    stamina:maxStam,maxStamina:maxStam,regen:isPlayer?15+f.sta*0.42:diff.regen,
    attackT:0,attackDur:0,attackType:null,attackHitDone:false,attackCd:0,
    blockHeld:false,blockT:0,blockSparkT:0,perfectT:0,
    hitT:0,headSnap:0,bodyRecoil:0,
    fallen:false,fallT:0,celebrateT:0,
    aiThink:1.1,aiMode:'approach',windT:0,windType:null,punishT:0,retreatT:0,blockHoldT:0,
    phase:Math.random()*6.28,walkPhase:0,combo:0,comboT:0
  };
}
function startFight(){
  unlockAudio();
  const f=fighter();
  const look=enemyLook();
  fight={
    time:99,phase:'intro',phaseT:0,over:false,suddenDeath:false,sdT:0,sdFlash:0,
    p:newCombatant(true,118,f.name),
    e:newCombatant(false,242,enemyName()),
    eLook:{skin:look.skin,trunk:look.trunk,glove:look.glove},
    phaseDone:false,fightFlash:0,hitFlash:0,shake:0,crowdWave:0,
    slowT:0,koLoser:null,koZoom:1,resultShown:false,
    superMeter:0,elapsed:0,lastHitT:-99,combo:0,comboT:0
  };
  hitFx=[];confetti=[];floatTexts=[];
  running=true;paused=false;last=0;
  show(null);showControls();
  startMusic(0.18);startCrowd();
  requestLoop();
}

function spawnHit(x,y,color,power,n){
  const count=LOW_GFX?Math.round(3+power*3):Math.round((n||6)+power*7);
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2,sp=50+Math.random()*210;
    hitFx.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-40,life:0.34+Math.random()*0.32,max:0.65,color:color,r:1+Math.random()*2.3});
  }
}
function spawnSweat(x,y,dir){
  for(let i=0;i<4;i++){
    hitFx.push({x:x,y:y,vx:dir*(40+Math.random()*90),vy:-60-Math.random()*70,life:0.5+Math.random()*0.3,max:0.8,color:'#7dd3fc',r:0.9+Math.random()*1.1});
  }
}
function spawnConfetti(){
  if(LOW_GFX)return;
  const colors=['#ef4444','#f97316','#facc15','#22c55e','#3b82f6','#a855f7','#ec4899','#fde047'];
  for(let i=0;i<90;i++){
    confetti.push({x:Math.random()*W,y:-20-Math.random()*H*0.5,vx:(Math.random()-0.5)*60,vy:60+Math.random()*70,
      rot:Math.random()*6.28,vr:(Math.random()-0.5)*6,w:3+Math.random()*4,h:5+Math.random()*6,
      color:colors[Math.floor(Math.random()*colors.length)],phase:Math.random()*6.28});
  }
}
function addFloatText(x,y,text,color,size){
  floatTexts.push({x:x,y:y,vy:-46,life:1.5,max:1.5,text:text,color:color||'#fde047',size:size||15});
}

function playerAttack(type){
  if(!inFight())return;
  const p=fight.p;
  if(p.attackT>0||p.attackCd>0||p.hitT>0||p.fallen)return;
  const def=ATTACKS[type];
  if(p.stamina<def.stam){addFloatText(p.x,316,'EXHAUSTED','#f87171',12);return;}
  p.stamina-=def.stam;
  p.attackType=type;p.attackDur=def.dur;p.attackT=def.dur;p.attackHitDone=false;
  const f=fighter();
  p.attackCd=(def.cd+0.06)*Math.max(0.72,1.16-f.spd*0.011);
  whiffSound();
}
function useSpecial(){
  if(!inFight())return;
  const p=fight.p;
  if(p.attackT>0||p.attackCd>0||p.hitT>0||p.fallen)return;
  // super full: fighter skill finisher; otherwise uppercut
  if(fight.superMeter>=100){useSkill();return;}
  playerAttack('uppercut');
}
function useSkill(){
  const p=fight.p,e=fight.e;
  if(fight.superMeter<100)return;
  const f=fighter();
  fight.superMeter=0;
  state.skills++;
  p.attackType='uppercut';p.attackDur=0.62;p.attackT=0.62;p.attackHitDone=true;p.attackCd=0.5;
  const def=ATTACKS.uppercut;
  let dmg=(6+f.pow*0.42)*2.6;
  if(e.blockHeld){dmg*=0.3;blockClack();}
  else{
    e.hp-=dmg;e.hitT=0.55;e.headSnap=1;e.bodyRecoil=1;
    spawnHit(e.x-18,336,'#fde047',1.6,10);spawnHit(e.x-10,366,'#fbbf24',1.2,6);
    punchSound(true,false,true);
    if(fight.e.hp<45)spawnSweat(e.x-8,308,-1);
  }
  fight.shake=Math.max(fight.shake,9);
  fight.crowdWave=1;crowdSwell(1.2);
  addFloatText(e.x,272,'SKILL!','#fde047',22);
  if(e.hp<=0){e.hp=0;startKO(e);}
}
function resolveHit(attacker,defender,def,isPlayer){
  const dist=Math.abs(attacker.x-defender.x);
  if(dist>def.range){
    if(isPlayer){defender.punishT=1.35;defender.aiMode='approach';defender.aiThink=0;}
    return false;
  }
  const f=isPlayer?fighter():null;
  const diff=difficulty();
  let dmg=def.dmg*(0.9+Math.random()*0.25);
  if(isPlayer)dmg*=(0.8+f.pow*0.036);
  else dmg*=(0.72+diff.dmgBase*0.055);
  if(fight.suddenDeath)dmg*=2;
  // block?
  let blocked=false,perfect=false;
  if(defender.blockHeld){
    blocked=true;
    if(defender.perfectT>0){perfect=true;dmg=0;}else{dmg*=0.27;defender.stamina=Math.max(0,defender.stamina-5);}
  }
  if(blocked){
    defender.blockT=0.24;defender.blockSparkT=0.3;
    if(isPlayer)punchSound(false,true,false);else blockClack();
    if(perfect){addFloatText(defender.x,318,'PERFECT','#7dd3fc',13);}
    spawnHit(defender.x+(isPlayer?-1:1)*16,330,'#93c5fd',0.45,4);
    defender.hitT=Math.max(defender.hitT,0.1);
  }else{
    defender.hp-=dmg;
    defender.hitT=def.stun;defender.headSnap=def.head;defender.bodyRecoil=1;
    const headHit=Math.random()<def.head;
    const hitX=defender.x+(isPlayer?-1:1)*17,hitY=headHit?336:392;
    spawnHit(hitX,hitY,headHit?'#fde047':'#fca5a5',headHit?0.9:0.7,headHit?7:5);
    if(!isPlayer)fight.hitFlash=0.22;
    punchSound(def.dmg>=11,false,headHit);
    if(defender.hp<50)spawnSweat(defender.x,310,isPlayer?-1:1);
    fight.shake=Math.max(fight.shake,def.dmg>=11?8:4);
    fight.crowdWave=Math.min(1.2,fight.crowdWave+0.4);
    if(headHit)crowdSwell(0.7);
    if(isPlayer){
      state.punches++;
      const nowT=fight.elapsed;
      if(nowT-fight.lastHitT<2.1)fight.combo=Math.min(fight.combo+1,99);else fight.combo=1;
      fight.lastHitT=nowT;fight.comboT=2.1;
      if(fight.combo>=2)addFloatText(defender.x,284,fight.combo+' HITS!','#fde047',15);
      fight.superMeter=Math.min(100,fight.superMeter+9);
    }else{
      fight.superMeter=Math.min(100,fight.superMeter+6);
      fight.combo=0;fight.comboT=0;
    }
  }
  if(defender.hp<=0){defender.hp=0;startKO(defender);}
  return true;
}
function startKO(loser){
  if(fight.phase==='ko')return;
  fight.phase='ko';
  fight.slowT=LOW_GFX?1.6:2.35;
  fight.koLoser=loser;
  loser.fallen=true;loser.fallT=0;loser.attackT=0;loser.windT=0;loser.blockHeld=false;
  const winner=loser.isPlayer?fight.e:fight.p;
  winner.celebrateT=0.0001;winner.attackT=0;winner.blockHeld=false;
  fight.shake=14;
  koBoom();
  if(!loser.isPlayer)spawnConfetti();
  addFloatText(loser.x,250,'K.O.!','#f87171',34);
}

/* ---------- Update ---------- */
function update(dt){
  if(!fight||fight.over)return;
  fight.elapsed+=dt;
  if(fight.fightFlash>0)fight.fightFlash-=dt;
  if(fight.hitFlash>0)fight.hitFlash-=dt;
  if(fight.crowdWave>0)fight.crowdWave=Math.max(0,fight.crowdWave-dt*0.55);
  if(fight.shake>0)fight.shake=Math.max(0,fight.shake-dt*22);
  if(fight.comboT>0){fight.comboT-=dt;if(fight.comboT<=0)fight.combo=0;}

  if(fight.phase==='intro'){
    fight.phaseT+=dt;
    const pt=fight.phaseT;
    const p=fight.p,e=fight.e;
    let pSlide=0,eSlide=0,walk=0;
    if(pt<1.15){const k=1-pt/1.15,e2=k*k;pSlide=-260*e2;eSlide=260*e2;walk=Math.abs(Math.sin(pt*15));}
    else if(pt<1.75){/* settle */ walk=0;}
    else if(pt<2.55){const k=(pt-1.75)/0.8,a=Math.sin(k*Math.PI);pSlide=52*a;eSlide=-52*a;}
    else if(pt<2.95){const k=(pt-2.55)/0.4;pSlide=52*(1-k);eSlide=-52*(1-k);}
    p.x=118+pSlide;e.x=242+eSlide;
    p.walkPhase=walk;e.walkPhase=walk;
    p.phase+=dt*2.2;e.phase+=dt*2.2;
    if(pt>=3.05){
      fight.phase='fight';fight.p.x=118;fight.e.x=242;
      fight.p.walkPhase=0;fight.e.walkPhase=0;
      fight.fightFlash=1.15;bell();crowdSwell(1.1);
      fight.e.aiThink=0.9;
    }
    updateFx(dt);
    return;
  }

  const p=fight.p,e=fight.e;

  if(fight.phase==='ko'){
    // slow-mo knockdown
    const sdt=dt*0.32;
    if(fight.koLoser.fallen&&fight.koLoser.fallT<1)fight.koLoser.fallT=Math.min(1,fight.koLoser.fallT+sdt*1.6);
    const winner=fight.koLoser.isPlayer?fight.e:fight.p;
    winner.celebrateT+=dt*2;
    p.phase+=sdt*3;e.phase+=sdt*3;
    fight.slowT-=dt;
    fight.koZoom=1+0.24*easeOutCubic(Math.min(1,(2.35-fight.slowT)/1.5));
    updateFx(dt);
    if(fight.slowT<=0)endFight(!fight.koLoser.isPlayer?true:false,'KO');
    return;
  }

  // timer / sudden death
  if(!fight.suddenDeath){
    fight.time-=dt;
    if(fight.time<=0){
      fight.time=0;
      fight.suddenDeath=true;fight.sdT=15;fight.sdFlash=2.2;
      addFloatText(W/2,220,'SUDDEN DEATH','#f87171',26);
      bell();crowdSwell(1.3);
    }
  }else{
    fight.sdT-=dt;
    if(fight.sdFlash>0)fight.sdFlash-=dt;
    if(fight.sdT<=0){
      fight.sdT=0;
      const pFrac=fight.p.hp/fight.p.maxHp,eFrac=fight.e.hp/fight.e.maxHp;
      endFight(pFrac>=eFrac,'DECISION');
      return;
    }
  }

  // timers
  [p,e].forEach(function(c){
    c.attackCd=Math.max(0,c.attackCd-dt);
    c.hitT=Math.max(0,c.hitT-dt);
    c.headSnap=Math.max(0,c.headSnap-dt*2.4);
    c.bodyRecoil=Math.max(0,c.bodyRecoil-dt*2.6);
    c.blockT=Math.max(0,c.blockT-dt);
    c.blockSparkT=Math.max(0,c.blockSparkT-dt);
    c.perfectT=Math.max(0,c.perfectT-dt);
    c.punishT=Math.max(0,c.punishT-dt);
    c.retreatT=Math.max(0,c.retreatT-dt);
    c.blockHoldT=Math.max(0,c.blockHoldT-dt);
    c.phase+=dt*2.3;
    if(c.attackT>0){
      c.attackT-=dt;
      const def=ATTACKS[c.attackType];
      const elapsed=c.attackDur-c.attackT;
      if(!c.attackHitDone&&elapsed>=def.hitAt){
        c.attackHitDone=true;
        resolveHit(c,c.isPlayer?e:p,def,c.isPlayer);
      }
      if(c.attackT<=0){c.attackT=0;c.attackType=null;}
    }
    // stamina regen (not while attacking)
    if(c.attackT<=0)c.stamina=Math.min(c.maxStamina,c.stamina+c.regen*dt);
  });

  // player movement
  const moveL=input.left.key||input.left.touch,moveR=input.right.key||input.right.touch;
  const spd=150;
  if(moveL&&!moveR){p.x-=spd*dt;p.walkPhase+=dt*11;}
  else if(moveR&&!moveL){p.x+=spd*dt;p.walkPhase+=dt*11;}
  else p.walkPhase*=0.9;
  // enemy AI
  updateEnemyAI(e,p,dt);
  // separation + ring bounds
  if(e.x-p.x<52){const mid=(p.x+e.x)/2;p.x=mid-26;e.x=mid+26;}
  p.x=Math.max(44,Math.min(300,p.x));
  e.x=Math.max(60,Math.min(316,e.x));
  // player block state
  const wantBlock=input.block.key||input.block.touch;
  if(wantBlock&&!p.blockHeld)p.perfectT=0.16;
  p.blockHeld=!!wantBlock;

  updateFx(dt);
}
function updateFx(dt){
  hitFx.forEach(function(q){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=430*dt;q.life-=dt;});
  hitFx=hitFx.filter(function(q){return q.life>0;});
  confetti.forEach(function(c){
    c.x+=c.vx*dt+Math.sin(fight.elapsed*3+c.phase)*0.6;c.y+=c.vy*dt;c.rot+=c.vr*dt;c.vy=Math.min(150,c.vy+30*dt);
  });
  confetti=confetti.filter(function(c){return c.y<H+20;});
  floatTexts.forEach(function(t){t.y+=t.vy*dt;t.vy*=0.96;t.life-=dt;});
  floatTexts=floatTexts.filter(function(t){return t.life>0;});
}
function updateEnemyAI(e,p,dt){
  const diff=difficulty();
  // blocking hold expires
  if(e.blockHoldT<=0&&e.blockHeld)e.blockHeld=false;
  if(e.hitT>0||e.fallen||e.attackT>0)return;
  const dist=p.x-e.x; // positive: enemy right of player
  const absDist=Math.abs(dist);
  e.aiThink-=dt;
  // block when player is mid-attack and in range
  if(p.attackT>0&&absDist<130&&Math.random()<diff.blockChance*dt*9){
    e.blockHeld=true;e.blockHoldT=0.62;
  }
  // wind-up in progress
  if(e.windT>0){
    e.windT-=dt;
    if(e.windT<=0){
      const type=e.windType||'jab';
      const def=ATTACKS[type];
      e.attackType=type;e.attackDur=def.dur;e.attackT=def.dur;e.attackHitDone=false;
      e.attackCd=diff.cooldown*(0.75+Math.random()*0.6);
      whiffSound();
    }
    return;
  }
  if(e.aiThink>0){
    // spacing behavior while thinking
    if(e.retreatT>0)e.x+=diff.moveSpeed*0.55*dt;
    else if(absDist>108)e.x-=diff.moveSpeed*(e.punishT>0?1.35:1)*dt;
    return;
  }
  // decision
  if(e.blockHeld){e.aiThink=0.35;return;}
  const canReach=absDist<ATTACKS[AI_ATTACKS[0]].range+6;
  if(!canReach){
    e.aiThink=0.22;
    e.x-=diff.moveSpeed*(e.punishT>0?1.4:1)*dt;
    return;
  }
  if(Math.random()<diff.aggression+(e.punishT>0?0.3:0)){
    e.windType=AI_ATTACKS[Math.floor(Math.random()*AI_ATTACKS.length)];
    e.windT=diff.windTime;
    noise(0.16,0.05,620,'bandpass');
  }else{
    // circle / retreat
    e.retreatT=0.45+Math.random()*0.35;
    e.aiThink=0.5+Math.random()*0.5;
    if(Math.random()<diff.blockChance){e.blockHeld=true;e.blockHoldT=0.5;}
    return;
  }
  e.aiThink=diff.cooldown*(0.8+Math.random()*0.7);
}
function easeOutCubic(k){return 1-Math.pow(1-k,3);}
function strikeCurve(k){
  // fast out, short hold, retract
  if(k<0.32)return easeOutCubic(k/0.32);
  if(k<0.52)return 1;
  return 1-easeOutCubic((k-0.52)/0.48);
}

/* ---------- End of fight / rewards ---------- */
function endFight(won,reason){
  if(!fight||fight.resultShown)return;
  fight.over=true;fight.phaseDone=true;fight.resultShown=true;running=false;
  stopMusic();stopCrowd();
  const ko=reason==='KO';
  const preStreak=state.streak;
  const mult=1+Math.min(preStreak,10)*0.15;
  let money=0,xp=0,ups=0,missionDefs=[];
  if(won){
    state.wins++;
    if(ko)state.kos++;
    money=Math.round((60+state.level*10+(ko?50:0))*mult);
    xp=Math.round(60+state.level*12+(ko?30:0));
    state.streak=preStreak+1;
    state.bestStreak=Math.max(state.bestStreak,state.streak);
    state.money+=money;state.totalEarned+=money;
    ups=addXp(xp);
    if(!ko){bell();crowdSwell(1.2);}
    coinDing();
  }else{
    state.losses++;
    state.streak=0;
    xp=15+state.level*2;
    ups=addXp(xp);
    tone(140,0.5,'sawtooth',0.13,62);
  }
  missionDefs=checkMissions();
  if(ups>0||missionDefs.length)fanfare();
  save();
  $('otitle').textContent=won?'YOU WIN!':'YOU LOSE';
  $('otitle').style.color=won?'#4ade80':'#f87171';
  let html='';
  if(won){
    html+='<span class="win">'+(ko?'KNOCKOUT VICTORY!':(reason==='DECISION'?'WIN BY DECISION!':'TIME UP — POINTS WIN!'))+'</span><br>';
    html+='<b>+$'+money+'</b>'+(preStreak>1?' (streak x'+(1+Math.min(preStreak,10)*0.15).toFixed(2)+')':'');
    html+='<br><b>+'+xp+' XP</b>';
    if(ups>0)html+='<br><b>LEVEL UP! Level '+state.level+'</b>';
    html+='<br>Streak: '+state.streak+' · Best: '+state.bestStreak;
  }else{
    html+='<span class="lose">'+(ko?'KNOCKED OUT':(reason==='DECISION'?'DECISION — RIVAL TAKES IT':'TIME UP — RIVAL TAKES IT'))+'</span><br>';
    html+='<b>+'+xp+' XP</b> consolation<br>Win next time and build your streak!';
  }
  missionDefs.forEach(function(def){html+='<span class="miss">Mission complete: '+def.title+' (+$'+def.reward+')</span>';});
  $('otext').innerHTML=html;
  hideControls();
  show('over');
}

/* ---------- Draw helpers ---------- */
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
  if(c.length===3)c=c.split('').map(function(ch){return ch+ch;}).join('');
  const n=parseInt(c,16)||0;
  const cl=function(v){return Math.max(0,Math.min(255,Math.round(v)));};
  return 'rgb('+cl(((n>>16)&255)+255*amt)+','+cl(((n>>8)&255)+255*amt)+','+cl((n&255)+255*amt)+')';
}
function sphere(x,y,r,base,light,dark){
  if(LOW_GFX)return base;
  const g=ctx.createRadialGradient(x-r*0.35,y-r*0.42,r*0.12,x,y,r*1.05);
  g.addColorStop(0,light);
  g.addColorStop(0.55,base);
  g.addColorStop(1,dark);
  return g;
}
function limb(x1,y1,x2,y2,w,base,light,dark){
  ctx.lineCap='round';
  ctx.strokeStyle=dark;ctx.lineWidth=w+3.2;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  ctx.strokeStyle=base;ctx.lineWidth=w;
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  ctx.strokeStyle=light;ctx.lineWidth=Math.max(1,w*0.32);ctx.globalAlpha=0.9;
  ctx.beginPath();ctx.moveTo(x1-w*0.2,y1);ctx.lineTo(x2-w*0.2,y2);ctx.stroke();
  ctx.globalAlpha=1;
}
function drawShadow(cx,feetY,sc){
  ctx.save();
  ctx.translate(cx,feetY+8);ctx.scale(1,0.3);
  if(LOW_GFX){ctx.fillStyle='rgba(0,0,0,.45)';}
  else{
    const g=ctx.createRadialGradient(0,0,4,0,0,40*sc);
    g.addColorStop(0,'rgba(0,0,0,.6)');g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;
  }
  ctx.beginPath();ctx.arc(0,0,40*sc,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function drawImpact(x,y,size,color){
  ctx.save();ctx.translate(x,y);
  ctx.strokeStyle=color;ctx.lineWidth=2.4;ctx.lineCap='round';
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4+0.35;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*size*0.35,Math.sin(a)*size*0.35);
    ctx.lineTo(Math.cos(a)*size,Math.sin(a)*size);
    ctx.stroke();
  }
  ctx.fillStyle='#ffffff';
  ctx.beginPath();ctx.arc(0,0,size*0.28,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function hpBar(x,y,w,h,ratio,color,alignRight){
  ratio=Math.max(0,Math.min(1,ratio||0));
  ctx.fillStyle='rgba(0,0,0,.6)';
  rr(ctx,x-2,y-2,w+4,h+4,5);ctx.fill();
  const bg=ctx.createLinearGradient(0,y,0,y+h);
  bg.addColorStop(0,'#1f2333');bg.addColorStop(1,'#0b0d16');
  ctx.fillStyle=bg;rr(ctx,x,y,w,h,4);ctx.fill();
  if(ratio>0){
    const fw=Math.max(2,w*ratio);
    const fx=alignRight?x+w-fw:x;
    const g=ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0,shade(color,0.32));g.addColorStop(0.5,color);g.addColorStop(1,shade(color,-0.25));
    ctx.fillStyle=g;rr(ctx,fx,y,fw,h,4);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.22)';
    rr(ctx,fx+1,y+1,Math.max(1,fw-2),Math.max(1,h*0.34),3);ctx.fill();
  }
  ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1;
  rr(ctx,x+0.5,y+0.5,w-1,h-1,4);ctx.stroke();
}
function miniBar(x,y,w,h,ratio,color){
  ctx.fillStyle='rgba(0,0,0,.55)';rr(ctx,x,y,w,h,h/2);ctx.fill();
  if(ratio>0){
    ctx.fillStyle=color;
    rr(ctx,x+1,y+1,Math.max(1,(w-2)*Math.min(1,ratio)),h-2,(h-2)/2);ctx.fill();
  }
}

/* ---------- Arena / ring ---------- */
function drawArena(tsec,wave){
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#060713');bg.addColorStop(0.42,'#121a33');bg.addColorStop(0.75,'#0a0e1f');bg.addColorStop(1,'#06070d');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  // stars
  const starN=LOW_GFX?30:70;
  for(let i=0;i<starN;i++){
    const x=(i*97+13)%W,y=14+((i*53)%120);
    const tw=0.12+0.42*Math.abs(Math.sin(tsec*1.3+i*0.7));
    ctx.fillStyle='rgba(170,190,255,'+tw.toFixed(2)+')';
    ctx.fillRect(x,y,2,2);
  }
  // 4 spotlights
  const lamps=[46,138,222,314];
  const spotN=LOW_GFX?2:4;
  for(let i=0;i<spotN;i++){
    const bx=lamps[LOW_GFX?i*2:i];
    const sway=Math.sin(tsec*0.55+i*1.7)*16;
    const g=ctx.createLinearGradient(0,0,0,360);
    g.addColorStop(0,'rgba(255,246,214,.34)');g.addColorStop(1,'rgba(255,246,214,0)');
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.moveTo(bx-9,0);ctx.lineTo(bx+9,0);
    ctx.lineTo(bx+sway*0.35+96,355);ctx.lineTo(bx+sway*0.35-96,355);
    ctx.closePath();ctx.fill();
    ctx.fillStyle='#fffbe8';
    ctx.beginPath();ctx.arc(bx,4,5+Math.sin(tsec*2+i)*0.6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,251,232,.35)';
    ctx.beginPath();ctx.arc(bx,4,10,0,Math.PI*2);ctx.fill();
  }
  // crowd — 3 rows of bobbing heads + shirts
  for(let i=0;i<CROWD.length;i++){
    const c=CROWD[i];
    const amp=(c.row===2?1.7:1.2)+wave*4.5;
    const bobY=Math.sin(tsec*c.speed+c.phase)*amp;
    const s=c.size;
    // shirt / shoulders
    ctx.fillStyle=shade(c.shirt,c.row===0?-0.35:c.row===1?-0.15:0);
    ctx.beginPath();
    ctx.moveTo(c.x-s*1.35,c.y+s*2.6);
    ctx.quadraticCurveTo(c.x-s*1.2,c.y+s*0.6+bobY,c.x,c.y+s*0.5+bobY);
    ctx.quadraticCurveTo(c.x+s*1.2,c.y+s*0.6+bobY,c.x+s*1.35,c.y+s*2.6);
    ctx.closePath();ctx.fill();
    // head
    ctx.fillStyle=c.skin;
    ctx.beginPath();ctx.arc(c.x,c.y+bobY,s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.22)';
    ctx.beginPath();ctx.arc(c.x,c.y+bobY-s*0.28,s*0.86,Math.PI*1.05,Math.PI*1.95);ctx.fill();
    if(wave>0.55&&(i%5===0)){
      ctx.strokeStyle=c.skin;ctx.lineWidth=2.2;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(c.x-s*0.9,c.y+s*0.6+bobY);ctx.lineTo(c.x-s*1.5,c.y-s*0.7+bobY-wave*3);ctx.stroke();
      ctx.beginPath();ctx.moveTo(c.x+s*0.9,c.y+s*0.6+bobY);ctx.lineTo(c.x+s*1.5,c.y-s*0.7+bobY-wave*3);ctx.stroke();
    }
  }
  // corner banners
  drawBanner(17,86,'BOXING');
  drawBanner(W-17,86,'2D');
  // corner men silhouettes
  drawCornerMan(26,352,1);
  drawCornerMan(W-26,352,-1);
}
function drawBanner(x,y,text){
  ctx.save();
  ctx.translate(x,y);
  const g=ctx.createLinearGradient(-13,0,13,0);
  g.addColorStop(0,'#7f1d1d');g.addColorStop(0.5,'#b91c1c');g.addColorStop(1,'#7f1d1d');
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(-13,0);ctx.lineTo(13,0);ctx.lineTo(13,96);ctx.lineTo(0,84);ctx.lineTo(-13,96);
  ctx.closePath();ctx.fill();
  ctx.strokeStyle='#fbbf24';ctx.lineWidth=1.6;
  ctx.beginPath();ctx.moveTo(-13,5);ctx.lineTo(13,5);ctx.stroke();
  ctx.fillStyle='#fde68a';
  ctx.font='bold 10px system-ui,sans-serif';ctx.textAlign='center';
  const chars=text.split('');
  for(let i=0;i<chars.length;i++)ctx.fillText(chars[i],0,17+i*11.5);
  ctx.restore();
}
function drawCornerMan(x,y,dir){
  ctx.save();
  ctx.translate(x,y);ctx.scale(dir,1);
  ctx.fillStyle='rgba(8,10,18,.92)';
  ctx.beginPath();
  ctx.moveTo(-16,40);ctx.quadraticCurveTo(-17,-6,-9,-12);
  ctx.quadraticCurveTo(-8,-24,0,-24);
  ctx.quadraticCurveTo(9,-24,10,-12);
  ctx.quadraticCurveTo(18,-4,17,40);
  ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(40,46,66,.9)';
  ctx.beginPath();ctx.arc(0,-15,7.5,0,Math.PI*2);ctx.fill();
  // towel over shoulder
  ctx.fillStyle='rgba(226,232,240,.85)';
  rr(ctx,4,-12,7,22,3);ctx.fill();
  ctx.restore();
}
function drawRing(){
  // floor perspective trapezoid
  const g=ctx.createLinearGradient(0,330,0,H);
  g.addColorStop(0,'#3b4d85');g.addColorStop(0.35,'#2c3a68');g.addColorStop(1,'#141d3d');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.moveTo(46,352);ctx.lineTo(W-46,352);ctx.lineTo(W+34,H);ctx.lineTo(-34,H);ctx.closePath();ctx.fill();
  // canvas weave lines
  ctx.strokeStyle='rgba(255,255,255,.05)';ctx.lineWidth=1;
  for(let i=1;i<=4;i++){
    const k=i/5;
    const y=352+(H-352)*(k*k*0.8+k*0.2);
    const half=((W-46-46)/2)+(((W+34+34)/2)-((W-46-46)/2))*k;
    ctx.beginPath();ctx.moveTo(W/2-half,y);ctx.lineTo(W/2+half,y);ctx.stroke();
  }
  // scuff marks
  ctx.strokeStyle='rgba(255,255,255,.09)';
  SCUFFS.forEach(function(s){
    ctx.beginPath();ctx.moveTo(s.x-Math.cos(s.a)*s.len/2,s.y-Math.sin(s.a)*s.len/2);
    ctx.lineTo(s.x+Math.cos(s.a)*s.len/2,s.y+Math.sin(s.a)*s.len/2);ctx.stroke();
  });
  // center logo
  ctx.save();
  ctx.translate(W/2,462);ctx.scale(1,0.4);
  ctx.strokeStyle='rgba(251,191,36,.34)';ctx.lineWidth=5;
  ctx.beginPath();ctx.arc(0,0,86,0,Math.PI*2);ctx.stroke();
  ctx.lineWidth=2;ctx.strokeStyle='rgba(251,191,36,.22)';
  ctx.beginPath();ctx.arc(0,0,62,0,Math.PI*2);ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(W/2,462);ctx.scale(1,0.5);
  ctx.fillStyle='rgba(251,191,36,.3)';
  drawStar(0,-4,17,7.5,5);ctx.fill();
  ctx.restore();
  ctx.fillStyle='rgba(251,191,36,.4)';
  ctx.font='bold 10px system-ui,sans-serif';ctx.textAlign='center';
  ctx.fillText('B O X I N G',W/2,487);
}
function drawStar(x,y,ro,ri,points){
  ctx.beginPath();
  for(let i=0;i<points*2;i++){
    const r=i%2===0?ro:ri;
    const a=(i*Math.PI/points)-Math.PI/2;
    const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;
    if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  }
  ctx.closePath();
}
function drawBackPostsRopes(){
  const x1=18,x2=W-18;
  // posts
  [x1,x2].forEach(function(x){
    const pg=ctx.createLinearGradient(x-5,0,x+5,0);
    pg.addColorStop(0,'#1e3a8a');pg.addColorStop(0.45,'#3b82f6');pg.addColorStop(1,'#172554');
    ctx.fillStyle=pg;rr(ctx,x-4.5,262,9,122,4);ctx.fill();
    ctx.fillStyle='#1d4ed8';rr(ctx,x-6.5,268,13,16,3);ctx.fill();
    ctx.fillStyle='#ef4444';rr(ctx,x-6.5,292,13,16,3);ctx.fill();
    ctx.fillStyle='#1d4ed8';rr(ctx,x-6.5,316,13,16,3);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.35)';
    ctx.fillRect(x-6.5,272,13,2);ctx.fillRect(x-6.5,296,13,2);ctx.fillRect(x-6.5,320,13,2);
  });
  // blue ropes (behind fighters)
  [292,316,340].forEach(function(y,i){
    ctx.strokeStyle=i===1?'rgba(147,197,253,.95)':'rgba(59,130,246,.8)';
    ctx.lineWidth=4.6-i*0.7;
    ctx.beginPath();ctx.moveTo(x1,y);ctx.quadraticCurveTo(W/2,y+6+i*2,x2,y);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=1.1;
    ctx.beginPath();ctx.moveTo(x1,y-1.4);ctx.quadraticCurveTo(W/2,y+4.6+i*2,x2,y-1.4);ctx.stroke();
  });
}
function drawFrontRopes(){
  [486,505,524].forEach(function(y,i){
    ctx.strokeStyle=i===1?'rgba(147,197,253,.95)':'rgba(59,130,246,.85)';
    ctx.lineWidth=5.2-i*0.8;
    ctx.beginPath();ctx.moveTo(-14,y);ctx.quadraticCurveTo(W/2,y+8,W+14,y);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(-14,y-1.6);ctx.quadraticCurveTo(W/2,y+6.4,W+14,y-1.6);ctx.stroke();
  });
}

/* ---------- Boxer rendering ---------- */
function drawBoxer(o){
  // o: {c:combatant, x,feetY,sc,dir, skin,trunk,glove, look, tsec}
  const c=o.c;
  const skin=o.skin,trunk=o.trunk,glove=o.glove;
  const flash=c.hitT>0.02;
  const bob=c.fallen?0:Math.sin(o.tsec*5.4+c.phase)*2.5;
  const walk=c.walkPhase||0;

  ctx.save();
  ctx.translate(o.x,o.feetY);
  if(c.fallen){
    const k=easeOutCubic(Math.min(1,c.fallT));
    let ang=-1.42*k*(o.dir||1);
    if(c.fallT>0.72)ang+=Math.sin((c.fallT-0.72)/0.28*Math.PI)*0.1;
    ctx.translate(0,-6*k);
    ctx.rotate(ang);
    ctx.translate(0,10*k);
  }
  ctx.scale(o.sc*o.dir,o.sc);

  const skinBase=flash?'#fff':skin;
  const skinLight=flash?'#fff':shade(skin,0.2);
  const skinDark=flash?'#d8d8d8':shade(skin,-0.3);
  const trunkBase=flash?'#fff':trunk;
  const trunkLight=flash?'#fff':shade(trunk,0.24);
  const trunkDark=flash?'#d8d8d8':shade(trunk,-0.34);
  const gloveBase=flash?'#fff':glove;
  const gloveLight=flash?'#fff':shade(glove,0.3);
  const gloveDark=flash?'#cfcfcf':shade(glove,-0.4);

  // ---- Legs & boots (no twist) ----
  const backLift=Math.sin(walk)*7,frontLift=Math.max(0,Math.sin(walk+Math.PI))*7;
  const backFootX=-19-walk*1.1,frontFootX=19+walk*1.1;
  limb(-8,-60,-16,-31,13.5,skinDark,skinBase,shade(skin,-0.42));
  limb(-16,-31,backFootX,-6-backLift,11,skinDark,skinBase,shade(skin,-0.42));
  // boot (back)
  ctx.fillStyle='#111827';
  rr(ctx,backFootX-11,-9-backLift,21,10,4.5);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.2)';
  rr(ctx,backFootX-9,-7-backLift,17,3,1.5);ctx.fill();
  limb(8,-60,16,-33,13.5,skinBase,skinLight,skinDark);
  limb(16,-33,frontFootX,-6-frontLift,11,skinBase,skinLight,skinDark);
  // boot (front)
  ctx.fillStyle='#1f2937';
  rr(ctx,frontFootX-11,-9-frontLift,21,10,4.5);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.3)';
  rr(ctx,frontFootX-9,-7-frontLift,17,3,1.5);ctx.fill();
  // toe caps
  ctx.fillStyle='rgba(255,255,255,.16)';
  rr(ctx,frontFootX+4,-8-frontLift,6,6,2);ctx.fill();

  // ---- Attack pose math ----
  const atk=c.attackT>0?{type:c.attackType,k:1-c.attackT/c.attackDur}:null;
  const ext=atk?strikeCurve(Math.min(1,atk.k)):0;
  let twist=0,headBack=0,crouch=0,lead={x:23,y:-112+Math.sin(o.tsec*5.4+1.1)*2.4},rear={x:-6,y:-117+Math.sin(o.tsec*5.4+2.2)*2.2};
  let leadElbow={x:27,y:-96},rearElbow={x:-20,y:-99};
  let hideRear=false;
  if(atk){
    if(atk.type==='jab'){
      lead={x:23+ext*76,y:-112+ext*3};leadElbow={x:26+ext*30,y:-97};
      headBack=ext*4.5;twist=ext*0.05;
    }else if(atk.type==='cross'){
      rear={x:-6+ext*88,y:-114+ext*2};rearElbow={x:-16+ext*40,y:-96};
      twist=ext*0.17;headBack=ext*2;hideRear=true;
    }else if(atk.type==='hook'){
      const ang=Math.PI*1.02-ext*1.42;
      lead={x:Math.cos(ang)*48+8,y:-100+Math.sin(ang)*40};
      leadElbow={x:26,y:-92};twist=ext*0.22;headBack=-ext*1.5;
    }else if(atk.type==='uppercut'){
      const wind=atk.k<0.4?atk.k/0.4:1;
      const rise=atk.k<0.4?0:Math.min(1,(atk.k-0.4)/0.32);
      crouch=wind*13*(1-rise*0.8);
      lead={x:26,y:-74-rise*62};leadElbow={x:29,y:-88+crouch*0.4};
      twist=-0.1+rise*0.22;headBack=-rise*3;
    }
  }
  if(c.hitT>0){
    headBack+=c.headSnap*7;
  }
  const block=c.blockHeld;
  if(block){
    lead={x:15,y:-124};rear={x:-8,y:-120};
    leadElbow={x:24,y:-100};rearElbow={x:-19,y:-101};
    twist=-0.06;
  }
  const celebrate=c.celebrateT>0;
  if(celebrate){
    const s=Math.sin(c.celebrateT*6)*4;
    lead={x:14,y:-158+s};rear={x:-12,y:-156-s};
    leadElbow={x:24,y:-130};rearElbow={x:-22,y:-128};
    twist=0;headBack=-3;
  }

  // recoil shift for hit reactions (applied to whole upper body via twist center)
  const recoil=-c.bodyRecoil*7;

  // ---- Upper body group (rotates around hip for twist) ----
  ctx.translate(recoil*0.4,crouch);
  ctx.translate(0,-58);
  ctx.rotate(twist);
  ctx.translate(0,58);
  ctx.translate(-headBack*0.55,headBack*0.38);

  // back (rear) arm — behind torso unless cross extends it
  function drawRearArm(){
    limb(-15,-103,rearElbow.x,rearElbow.y,11.5,skinDark,skinBase,shade(skin,-0.42));
    limb(rearElbow.x,rearElbow.y,rear.x,rear.y,9,skinDark,skinBase,shade(skin,-0.42));
    ctx.fillStyle=sphere(rear.x,rear.y,9.5,gloveBase,gloveLight,gloveDark);
    ctx.beginPath();ctx.arc(rear.x,rear.y,9.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.32)';
    ctx.beginPath();ctx.arc(rear.x-3,rear.y-3.4,2.7,0,Math.PI*2);ctx.fill();
  }
  if(!hideRear)drawRearArm();

  // torso — tapered muscular shape with radial shading
  let torsoG;
  if(LOW_GFX){torsoG=skinBase;}
  else{
    torsoG=ctx.createLinearGradient(-24,-116,22,-58);
    torsoG.addColorStop(0,skinDark);torsoG.addColorStop(0.28,skinBase);
    torsoG.addColorStop(0.52,skinLight);torsoG.addColorStop(0.78,skinBase);torsoG.addColorStop(1,skinDark);
  }
  ctx.fillStyle=torsoG;
  ctx.beginPath();
  ctx.moveTo(-17,-107);
  ctx.quadraticCurveTo(-27,-95,-23,-79);
  ctx.quadraticCurveTo(-21,-63,-15,-57);
  ctx.lineTo(15,-57);
  ctx.quadraticCurveTo(21,-63,23,-79);
  ctx.quadraticCurveTo(27,-95,17,-107);
  ctx.quadraticCurveTo(0,-116,-17,-107);
  ctx.closePath();ctx.fill();
  // pec shading
  ctx.fillStyle=sphere(-7.5,-93,9.5,skinBase,skinLight,skinDark);
  ctx.beginPath();ctx.ellipse(-7.5,-93,9.5,6.6,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=sphere(8.5,-93,10,skinBase,skinLight,skinDark);
  ctx.beginPath();ctx.ellipse(8.5,-93,10,6.9,0,0,Math.PI*2);ctx.fill();
  // pec separation + abs
  ctx.strokeStyle='rgba(0,0,0,.22)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(0.4,-103);ctx.lineTo(0.4,-64);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-11,-80);ctx.quadraticCurveTo(0.4,-77.5,12,-80);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-10,-71);ctx.quadraticCurveTo(0.4,-68.8,10,-71);ctx.stroke();
  // obliques
  ctx.beginPath();ctx.moveTo(-13,-66);ctx.quadraticCurveTo(-8,-62,-6,-58);ctx.stroke();
  ctx.beginPath();ctx.moveTo(13,-66);ctx.quadraticCurveTo(8,-62,6,-58);ctx.stroke();
  // serratus ticks
  ctx.strokeStyle='rgba(0,0,0,.16)';ctx.lineWidth=1.1;
  [-14,14].forEach(function(sx){for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(sx,-84+i*6);ctx.lineTo(sx*0.72,-82+i*6);ctx.stroke();}});

  // trunks + championship belt (no boxy shapes — curved waist)
  let trunkG;
  if(LOW_GFX){trunkG=trunkBase;}
  else{
    trunkG=ctx.createLinearGradient(-24,-62,24,-36);
    trunkG.addColorStop(0,trunkDark);trunkG.addColorStop(0.35,trunkBase);
    trunkG.addColorStop(0.62,trunkLight);trunkG.addColorStop(0.85,trunkBase);trunkG.addColorStop(1,trunkDark);
  }
  ctx.fillStyle=trunkG;
  ctx.beginPath();
  ctx.moveTo(-18,-60);
  ctx.quadraticCurveTo(0,-63.5,18,-60);
  ctx.lineTo(24,-37);
  ctx.lineTo(8,-37);
  ctx.lineTo(4.5,-47);
  ctx.lineTo(-4.5,-47);
  ctx.lineTo(-8,-37);
  ctx.lineTo(-24,-37);
  ctx.closePath();ctx.fill();
  // side stripe
  ctx.fillStyle='rgba(255,255,255,.28)';
  ctx.beginPath();ctx.moveTo(-22,-46);ctx.lineTo(-12,-46);ctx.lineTo(-14,-51);ctx.lineTo(-23,-51);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(22,-46);ctx.lineTo(12,-46);ctx.lineTo(14,-51);ctx.lineTo(23,-51);ctx.closePath();ctx.fill();
  // belt
  let beltG;
  if(LOW_GFX){beltG='#b45309';}
  else{beltG=ctx.createLinearGradient(0,-63,0,-56);beltG.addColorStop(0,'#fde68a');beltG.addColorStop(0.5,'#d97706');beltG.addColorStop(1,'#92400e');}
  ctx.fillStyle=beltG;
  ctx.beginPath();ctx.moveTo(-18.5,-62.5);ctx.quadraticCurveTo(0,-66,18.5,-62.5);ctx.lineTo(18.5,-56.5);ctx.quadraticCurveTo(0,-60,-18.5,-56.5);ctx.closePath();ctx.fill();
  ctx.fillStyle='#fef3c7';
  ctx.beginPath();ctx.ellipse(2,-60.5,5.4,4.6,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#b45309';
  drawStar(2,-60.5,3.1,1.3,5);ctx.fill();

  if(hideRear)drawRearArm();

  // neck + head
  ctx.fillStyle=skinDark;
  rr(ctx,-6.5,-118,13,12,5);ctx.fill();
  ctx.fillStyle=skinBase;
  rr(ctx,-5.5,-117,10,8,4);ctx.fill();

  const headX=1.5,headY=-134,headR=16.5;
  // head with determined face
  ctx.fillStyle=sphere(headX,headY,headR,skinBase,skinLight,skinDark);
  ctx.beginPath();ctx.arc(headX,headY,headR,0,Math.PI*2);ctx.fill();
  // jaw shadow
  ctx.fillStyle='rgba(0,0,0,.18)';
  ctx.beginPath();ctx.ellipse(headX+2,headY+8.5,11,5.5,0,0,Math.PI);ctx.fill();
  // ear
  ctx.fillStyle=skinDark;
  ctx.beginPath();ctx.ellipse(headX-13.5,headY+1.5,3.8,5,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=sphere(headX-13.5,headY+1.5,3.4,skinBase,skinLight,skinDark);
  ctx.beginPath();ctx.ellipse(headX-13.5,headY+1.5,3.4,4.6,0,0,Math.PI*2);ctx.fill();
  // nose (bridge shadow + tip highlight)
  ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=1.4;
  ctx.beginPath();ctx.moveTo(headX+12.5,headY-2);ctx.lineTo(headX+15,headY+4);ctx.stroke();
  ctx.fillStyle=skinLight;
  ctx.beginPath();ctx.moveTo(headX+13,headY+1);ctx.lineTo(headX+18.5,headY+4.2);ctx.lineTo(headX+13,headY+5);ctx.closePath();ctx.fill();
  // hair + headband
  ctx.fillStyle=flash?'#dcdcdc':'#231209';
  ctx.beginPath();
  ctx.arc(headX,headY-1,headR,Math.PI*1.02,Math.PI*1.98);
  ctx.quadraticCurveTo(headX+headR*0.42,headY-headR*0.5,headX-headR*0.92,headY-1);
  ctx.closePath();ctx.fill();
  ctx.fillStyle=flash?'#fff':glove;
  ctx.beginPath();ctx.moveTo(headX-headR+1,headY-6.5);ctx.lineTo(headX+headR-1,headY-6.5);ctx.lineTo(headX+headR-1,headY-2.5);ctx.lineTo(headX-headR+1,headY-2.5);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.25)';
  ctx.fillRect(headX-headR+1,headY-6.2,headR*2-2,1.4);
  // determined eyes + brows (angled down toward center)
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.ellipse(headX+7.2,headY+0.6,3.7,2.9,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(headX-1.6,headY+0.6,3.2,2.6,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#141414';
  ctx.beginPath();ctx.arc(headX+8.1,headY+0.7,1.8,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(headX-0.7,headY+0.7,1.55,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=flash?'#bbb':'#241209';ctx.lineWidth=1.9;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(headX+3.2,headY-3.6);ctx.lineTo(headX+11,headY-1.6);ctx.stroke();
  ctx.beginPath();ctx.moveTo(headX-4.6,headY-3.2);ctx.lineTo(headX+1.6,headY-2.2);ctx.stroke();
  // gritted mouth (grimace) — open when hurt, flat otherwise
  const hurt=c.hp<55;
  if(hurt||atk){
    ctx.fillStyle='#3d1414';
    rr(ctx,headX+4,headY+9.5,10,4.6,2);ctx.fill();
    ctx.fillStyle='#f8fafc';
    ctx.fillRect(headX+4.6,headY+9.9,8.8,1.5);
  }else{
    ctx.strokeStyle='#5b2b16';ctx.lineWidth=1.6;
    ctx.beginPath();ctx.moveTo(headX+5,headY+11);ctx.lineTo(headX+13.4,headY+11.3);ctx.stroke();
  }
  // sweat glisten when hurt
  if(c.hp<50){
    const sy=headY-6+((o.tsec*30+c.phase*10)%14);
    ctx.fillStyle='rgba(125,211,252,.85)';
    ctx.beginPath();ctx.ellipse(headX-8,sy,1.4,2.1,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(headX+13,headY+3+((o.tsec*24+40)%9),1.1,1.7,0,0,Math.PI*2);ctx.fill();
  }

  // lead arm (front)
  limb(16,-103,leadElbow.x,leadElbow.y,12,skinBase,skinLight,skinDark);
  limb(leadElbow.x,leadElbow.y,lead.x,lead.y,9.5,skinBase,skinLight,skinDark);
  // deltoid cap
  ctx.fillStyle=sphere(15,-103,7.5,skinBase,skinLight,skinDark);
  ctx.beginPath();ctx.arc(15,-103,7.5,0,Math.PI*2);ctx.fill();
  // hook trail
  if(atk&&atk.type==='hook'&&ext>0.12){
    ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=3.4;ctx.lineCap='round';
    ctx.beginPath();ctx.arc(8,-100,44,Math.PI*1.02-ext*1.42-0.35,Math.PI*1.02-ext*1.42+0.35);ctx.stroke();
  }
  if(atk&&atk.type==='jab'&&ext>0.12){
    ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=2.6;
    ctx.beginPath();ctx.moveTo(lead.x-ext*30,lead.y);ctx.lineTo(lead.x-4,lead.y);ctx.stroke();
  }
  // block shield flash
  if(block&&c.blockSparkT>0){
    ctx.strokeStyle='rgba(147,197,253,'+(0.4+c.blockSparkT*1.6).toFixed(2)+')';
    ctx.lineWidth=3.4;
    ctx.beginPath();ctx.arc(lead.x+2,lead.y,21,-Math.PI*0.78,Math.PI*0.4);ctx.stroke();
  }
  // lead glove
  ctx.fillStyle=sphere(lead.x,lead.y,10.5,gloveBase,gloveLight,gloveDark);
  ctx.beginPath();ctx.arc(lead.x,lead.y,10.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.34)';
  ctx.beginPath();ctx.arc(lead.x-3.6,lead.y-3.8,3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=trunkDark;
  rr(ctx,lead.x-11,lead.y+7.4,9.6,4.8,2);ctx.fill();

  // KO stars orbiting fallen head
  if(c.fallen&&c.fallT>0.75){
    for(let i=0;i<3;i++){
      const a=o.tsec*3.4+i*2.094;
      const sx=headX+Math.cos(a)*17,sy=headY-14+Math.sin(a)*4.5;
      ctx.fillStyle='#fde047';
      drawStar(sx,sy,3.6,1.5,5);ctx.fill();
      ctx.strokeStyle='#b45309';ctx.lineWidth=0.7;
      drawStar(sx,sy,3.6,1.5,5);ctx.stroke();
    }
  }
  ctx.restore();
}

/* ---------- Scene ---------- */
function draw(){
  const tsec=performance.now()/1000;
  const f=fighter();
  const p=fight.p,e=fight.e;
  // camera: intro zoom-out + KO zoom toward loser
  let zoom=1,focusX=W/2,focusY=H*0.58;
  if(fight.phase==='intro'){zoom=1+0.08*Math.max(0,1-fight.phaseT/3.05);}
  if(fight.phase==='ko'){zoom=fight.koZoom;focusX=Math.max(90,Math.min(W-90,fight.koLoser.x));focusY=H*0.66;}

  ctx.save();
  if(fight.shake>0)ctx.translate((Math.random()-0.5)*fight.shake,(Math.random()-0.5)*fight.shake);
  ctx.translate(W/2,focusY);ctx.scale(zoom,zoom);ctx.translate(-focusX,-focusY);

  drawArena(tsec,fight.crowdWave);
  drawRing();
  drawBackPostsRopes();

  // shadows
  const pSquash=p.fallen?0.75:1,eSquash=e.fallen?0.75:1;
  drawShadow(e.x,FEET,1.05*eSquash);
  drawShadow(p.x,FEET,1.1*pSquash);

  const look=fight.eLook;
  // enemy first (behind), then player
  drawBoxer({c:e,x:e.x,feetY:FEET,sc:1.04,dir:-1,skin:look.skin,trunk:look.trunk,glove:look.glove,tsec:tsec});
  drawBoxer({c:p,x:p.x,feetY:FEET,sc:1.08,dir:1,skin:f.skin,trunk:f.trunk,glove:f.glove,tsec:tsec});

  // particles — star bursts & sweat
  hitFx.forEach(function(q){
    ctx.globalAlpha=Math.max(0,q.life/q.max);
    ctx.fillStyle=q.color;
    ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fill();
  });
  ctx.globalAlpha=1;
  // impact star flashes
  if(p.hitT>0.12)drawImpact(p.x+16,336,15,'#fca5a5');
  if(e.hitT>0.12)drawImpact(e.x-16,336,17,'#fde047');

  drawFrontRopes();

  // KO confetti
  confetti.forEach(function(c){
    ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.rot);
    ctx.fillStyle=c.color;ctx.fillRect(-c.w/2,-c.h/2,c.w,c.h);
    ctx.restore();
  });

  // floating texts
  floatTexts.forEach(function(t){
    ctx.globalAlpha=Math.max(0,Math.min(1,t.life/t.max));
    ctx.font='900 '+t.size+'px system-ui,sans-serif';ctx.textAlign='center';
    ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.7)';
    ctx.strokeText(t.text,t.x,t.y);ctx.fillStyle=t.color;ctx.fillText(t.text,t.x,t.y);
  });
  ctx.globalAlpha=1;
  ctx.restore();

  // hit flash vignette
  if(fight.hitFlash>0){ctx.fillStyle='rgba(255,70,50,'+(fight.hitFlash*0.4).toFixed(2)+')';ctx.fillRect(0,0,W,H);}

  drawHud(tsec);

  // intro banners
  if(fight.phase==='intro'){
    const pt=fight.phaseT;
    ctx.save();ctx.textAlign='center';
    if(pt>=1.15&&pt<2.95){
      ctx.globalAlpha=Math.min(1,(pt-1.15)*3);
      ctx.font='900 34px system-ui,sans-serif';
      ctx.shadowColor='#ef4444';ctx.shadowBlur=22;
      ctx.fillStyle='#fff';ctx.fillText('ROUND 1',W/2,180);
      ctx.shadowBlur=0;
      if(pt>=1.75&&pt<2.55){
        ctx.font='700 13px system-ui,sans-serif';ctx.fillStyle='#ffd166';
        ctx.fillText('TOUCH GLOVES',W/2,204);
      }
    }
    ctx.restore();
  }
  if(fight.fightFlash>0){
    const k=1-fight.fightFlash/1.15;
    ctx.save();ctx.translate(W/2,190);
    const s=1+k*0.6;ctx.scale(s,s);
    ctx.globalAlpha=Math.max(0,Math.min(1,fight.fightFlash*1.5));
    ctx.textAlign='center';ctx.fillStyle='#fff';
    ctx.font='900 46px system-ui,sans-serif';
    ctx.shadowColor='#ef4444';ctx.shadowBlur=28;
    ctx.fillText('FIGHT!',0,0);
    ctx.restore();
  }
  if(fight.phase==='ko'&&fight.slowT>0.4){
    ctx.save();ctx.textAlign='center';
    ctx.globalAlpha=Math.min(1,(2.35-fight.slowT)*1.6);
    ctx.font='900 44px system-ui,sans-serif';
    ctx.fillStyle='#fde047';ctx.shadowColor='#f59e0b';ctx.shadowBlur=30;
    ctx.fillText('K.O.!',W/2,152);
    ctx.restore();
  }
}
function drawHud(tsec){
  const p=fight.p,e=fight.e;
  const f=fighter();
  // names
  ctx.textAlign='left';ctx.font='800 10px system-ui,sans-serif';
  ctx.fillStyle='#dfe6ff';ctx.fillText((f.name||'YOU').toUpperCase(),12,17);
  ctx.textAlign='right';
  ctx.fillStyle='#fecaca';ctx.fillText((e.name||'RIVAL').toUpperCase().slice(0,24),W-12,17);
  // HP bars
  hpBar(12,22,152,13,p.hp/p.maxHp,'#22c55e',false);
  hpBar(W-164,22,152,13,e.hp/e.maxHp,'#ef4444',true);
  // center timer
  ctx.textAlign='center';
  ctx.fillStyle=fight.suddenDeath?'#f87171':'#ffffff';
  ctx.font='900 21px system-ui,sans-serif';
  ctx.fillText(fight.suddenDeath?'SD':String(Math.ceil(fight.time)),W/2,33);
  ctx.font='700 7px system-ui,sans-serif';ctx.fillStyle=fight.suddenDeath?'#fca5a5':'#8c93ab';
  ctx.fillText(fight.suddenDeath?'SUDDEN DEATH':'TIME',W/2,43);
  // stamina bar bottom-left
  ctx.textAlign='left';ctx.font='800 8px system-ui,sans-serif';ctx.fillStyle='#aab0c6';
  ctx.fillText('STAMINA',12,446);
  miniBar(12,451,118,7,p.stamina/p.maxStamina,p.stamina<22?'#f87171':'#facc15');
  // special meter bottom-right
  ctx.textAlign='right';ctx.fillStyle='#aab0c6';
  ctx.fillText(fight.superMeter>=100?'SPECIAL READY!':'SPECIAL',W-12,446);
  miniBar(W-130,451,118,7,fight.superMeter/100,'#fb923c');
  if(fight.superMeter>=100){
    const a=0.55+0.45*Math.abs(Math.sin(tsec*6));
    ctx.globalAlpha=a;ctx.fillStyle='#fdba74';
    ctx.fillRect(W-130,451,118,1.4);
    ctx.globalAlpha=1;
  }
  // combo counter
  if(fight.combo>=2&&fight.comboT>0){
    const pop=1+Math.max(0,fight.comboT-1.7)*1.4;
    ctx.save();ctx.translate(W/2,120);ctx.scale(pop,pop);
    ctx.textAlign='center';ctx.font='900 21px system-ui,sans-serif';
    ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.65)';
    ctx.strokeText(fight.combo+' HITS!',0,0);
    ctx.fillStyle='#fde047';ctx.fillText(fight.combo+' HITS!',0,0);
    ctx.restore();
  }
  // enemy wind-up telegraph
  if(fight.phase==='fight'&&e.windT>0&&!fight.over){
    const s=1+Math.sin(tsec*17)*0.2;
    ctx.save();ctx.translate(e.x,300);ctx.scale(s,s);
    ctx.fillStyle='rgba(239,68,68,.28)';
    ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#ef4444';ctx.lineWidth=2.4;ctx.stroke();
    ctx.fillStyle='#ef4444';ctx.textAlign='center';
    ctx.font='900 27px system-ui,sans-serif';ctx.fillText('!',0,9);
    ctx.restore();
    ctx.textAlign='center';ctx.fillStyle='#fca5a5';
    ctx.font='800 8px system-ui,sans-serif';
    ctx.fillText('BLOCK!',e.x,272);
  }
  if(p.blockHeld){
    ctx.textAlign='center';ctx.fillStyle='#93c5fd';
    ctx.font='800 9px system-ui,sans-serif';
    ctx.fillText('BLOCKING',p.x,300);
  }
  if(fight.suddenDeath&&Math.sin(tsec*8)>0){
    ctx.textAlign='center';ctx.fillStyle='rgba(248,113,113,.9)';
    ctx.font='900 12px system-ui,sans-serif';
    ctx.fillText('2x DAMAGE',W/2,58);
  }
}

/* ---------- Loop ---------- */
function loop(ts){
  loopQueued=false;
  if(!running||paused)return;
  const dt=last?Math.min((ts-last)/1000,0.05):0.016;
  last=ts;
  update(dt);
  if(!running)return;
  drawAcc+=dt;
  if(!LOW_GFX||drawAcc>=0.033){drawAcc=0;draw();}
  requestLoop();
}
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden'){
    paused=true;
    stopMusic();stopCrowd();
  }else{
    paused=false;last=0;
    if(fight&&!fight.over&&(fight.phase==='fight'||fight.phase==='ko')){
      startMusic(0.18);startCrowd();
      running=true;
      requestLoop();
    }else if(audioCtx&&!muted){
      startMusic(0.4);
    }
  }
});

/* ---------- Input ---------- */
function setBlock(v){
  input.block.key=v;
  const p=fight?fight.p:null;
  if(p&&!p.blockHeld&&v)p.perfectT=0.16;
}
window.addEventListener('keydown',function(e){
  unlockAudio();
  const k=e.key||'',c=e.keyCode||0;
  if(inFight()){
    let handled=true;
    if(k==='4'||c===52)playerAttack('jab');
    else if(k==='6'||c===54)playerAttack('cross');
    else if(k==='1'||c===49)playerAttack('hook');
    else if(k==='3'||c===51)useSpecial();
    else if(k==='2'||c===50||k==='8'||c===56)setBlock(true);
    else if(k==='ArrowLeft'||c===37)input.left.key=true;
    else if(k==='ArrowRight'||c===39)input.right.key=true;
    else handled=false;
    if(handled)e.preventDefault();
    return;
  }
  if(k==='ArrowDown'||c===40||k==='8'||c===56){e.preventDefault();focusStep(1);}
  else if(k==='ArrowUp'||c===38||k==='2'||c===50){e.preventDefault();focusStep(-1);}
  else if(k==='ArrowLeft'||c===37||k==='4'||c===52){e.preventDefault();focusStep(-1);}
  else if(k==='ArrowRight'||c===39||k==='6'||c===54){e.preventDefault();focusStep(1);}
  else if(k==='Enter'||c===13||k===' '||c===32||k==='5'||c===53||k==='SoftLeft'||k==='SoftRight'){e.preventDefault();activateFocused();}
},false);
window.addEventListener('keyup',function(e){
  const k=e.key||'',c=e.keyCode||0;
  if(k==='2'||c===50||k==='8'||c===56)setBlock(false);
  else if(k==='ArrowLeft'||c===37)input.left.key=false;
  else if(k==='ArrowRight'||c===39)input.right.key=false;
},false);

function bindTap(id,fn){
  const el=$(id);if(!el)return;
  let lastTap=0;
  const fire=function(e){
    if(e&&e.preventDefault)e.preventDefault();
    const now=Date.now();
    if(now-lastTap<120)return;
    lastTap=now;
    unlockAudio();fn();
  };
  el.addEventListener('touchstart',fire,{passive:false});
  el.addEventListener('touchend',fire,{passive:false});
  el.addEventListener('mousedown',fire);
}
function bindHold(id,prop){
  const el=$(id);if(!el)return;
  const on=function(e){if(e&&e.preventDefault)e.preventDefault();unlockAudio();input[prop].touch=true;if(prop==='block'&&fight){const p=fight.p;if(!p.blockHeld)p.perfectT=0.16;}};
  const off=function(){input[prop].touch=false;};
  el.addEventListener('touchstart',on,{passive:false});
  el.addEventListener('touchend',off,{passive:false});
  el.addEventListener('touchcancel',off,{passive:false});
  el.addEventListener('mousedown',on);
  el.addEventListener('mouseup',off);
  el.addEventListener('mouseleave',off);
}
bindTap('btnJab',function(){playerAttack('jab');});
bindTap('btnCross',function(){playerAttack('cross');});
bindTap('btnSpecial',function(){useSpecial();});
bindHold('btnLeft','left');
bindHold('btnRight','right');
bindHold('btnBlock','block');

function bindClick(id,fn){
  const el=$(id);if(!el)return;
  el.addEventListener('click',function(){unlockAudio();fn();});
}
bindClick('fight',function(){startMusic(0.4);startFight();});
bindClick('fighters',function(){renderFighters();show('fghv');});
bindClick('missions',function(){renderMissions();show('missv');});
bindClick('back1',function(){updateMenu();show('menu');});
bindClick('back2',function(){updateMenu();show('menu');});
bindClick('retry',function(){startFight();});
bindClick('menu2',function(){updateMenu();show('menu');hideControls();startMusic(0.4);});
bindClick('muteMenu',toggleMute);
bindClick('home',function(){stopMusic();stopCrowd();location.href='../../index.html';});

/* ---------- Boot ---------- */
updateMenu();
show('menu');
hideControls();
save();
