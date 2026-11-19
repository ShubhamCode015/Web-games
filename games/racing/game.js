/* ===== Racing 2D ===== */
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
function num(v,def){return (typeof v==='number'&&isFinite(v))?v:def;}
function hash(n){var x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}
function clamp(v,a,b){return v<a?a:(v>b?b:v);}

let user=params.get('user');
if(!user){try{const u=JSON.parse(storeGet('wg_user')||'null');if(u&&u.name)user=u.name;}catch(e){}}
if(!user)user='guest';
const KEY='racing_'+user;
const MUTE_KEY='racing_muted';

const VEHICLES=[
  {name:'Starter',price:0,maxSpeed:9.0,accel:0.12,handling:0.62,color:'#3b82f6',desc:'Reliable city cruiser'},
  {name:'Sport',price:500,maxSpeed:10.3,accel:0.16,handling:0.76,color:'#22c55e',desc:'Balanced street racer'},
  {name:'Turbo',price:2000,maxSpeed:11.6,accel:0.20,handling:0.86,color:'#f59e0b',desc:'High-boost speed machine'},
  {name:'Rocket',price:8000,maxSpeed:13.2,accel:0.26,handling:0.96,color:'#ef4444',desc:'Top-tier hyper car'},
  {name:'Viper',price:15000,maxSpeed:14.6,accel:0.30,handling:0.93,color:'#a855f7',desc:'Track-bred predator'},
  {name:'Apex GT',price:30000,maxSpeed:16.2,accel:0.34,handling:1.00,color:'#e5e7eb',desc:'The ultimate grand tourer'}
];
const MISSIONS=[
  {id:'lvl5',title:'Reach Level 5',target:5,type:'level',reward:300},
  {id:'money1000',title:'Earn ₹1000 total money',target:1000,type:'totalMoney',reward:500},
  {id:'overtake100',title:'Overtake 100 cars',target:100,type:'overtakes',reward:800},
  {id:'dist10000',title:'Drive 10000 distance',target:10000,type:'distance',reward:1000}
];

function defaultState(){
  return {user,money:0,xp:0,level:1,distance:0,best:0,totalMoneyEarned:0,overtakes:0,
    owned:[0],selected:0,
    missions:MISSIONS.map(m=>({id:m.id,progress:0,done:false}))};
}
function loadState(){
  let s=null;
  try{s=JSON.parse(storeGet(KEY)||'null');}catch(e){s=null;}
  if(!s||typeof s!=='object'||!s.user)s=defaultState();
  s.money=Math.max(0,Math.floor(num(s.money,0)));
  s.xp=Math.max(0,num(s.xp,0));
  s.level=Math.max(1,Math.floor(num(s.level,1)));
  s.distance=Math.max(0,num(s.distance,0));
  s.best=Math.max(0,num(s.best,0));
  s.totalMoneyEarned=Math.max(0,num(s.totalMoneyEarned,0));
  s.overtakes=Math.max(0,Math.floor(num(s.overtakes,0)));
  const rawOwned=Array.isArray(s.owned)?s.owned:[0];
  const seen={};
  s.owned=[];
  for(let i=0;i<rawOwned.length;i++){
    const v=rawOwned[i];
    if(typeof v!=='number'||!isFinite(v))continue;
    const idx=Math.floor(v);
    if(idx<0||idx>=VEHICLES.length)continue;
    if(seen[idx])continue;
    seen[idx]=1;s.owned.push(idx);
  }
  if(s.owned.indexOf(0)<0)s.owned.push(0);
  if(typeof s.selected!=='number'||!isFinite(s.selected))s.selected=s.owned[0];
  s.selected=Math.floor(s.selected);
  if(s.owned.indexOf(s.selected)<0)s.selected=s.owned[0];
  if(!Array.isArray(s.missions))s.missions=[];
  MISSIONS.forEach(def=>{
    let m=null;
    for(let i=0;i<s.missions.length;i++){if(s.missions[i]&&s.missions[i].id===def.id){m=s.missions[i];break;}}
    if(!m){m={id:def.id,progress:0,done:false};s.missions.push(m);}
    m.type=def.type;m.target=def.target;m.reward=def.reward;m.title=def.title;
    m.progress=Math.max(0,num(m.progress,0));m.done=!!m.done;
  });
  return s;
}
let state=loadState();
function save(){storeSet(KEY,JSON.stringify(state));}
function xpNeeded(l){return l*100;}
function isMuted(){return storeGet(MUTE_KEY)==='1';}
function vehicle(){return VEHICLES[state.selected]||VEHICLES[0];}

const $=id=>document.getElementById(id);
const canvas=$('c');
const LOW_GFX=/KAIOS/i.test(navigator.userAgent||'')||((window.innerWidth||999)<=320)||((window.innerHeight||999)<=380);
if(LOW_GFX){canvas.width=320;canvas.height=480;}else{canvas.width=360;canvas.height=540;}
const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height,HORIZON=Math.round(H*0.295);
const VIEW=95;
const HAS_TOUCH=('ontouchstart' in window)||(navigator.maxTouchPoints>0);
let running=false,paused=false,last=0,loopGen=0;
function scheduleLoop(gen){requestAnimationFrame(function(ts){if(gen!==loopGen||!running)return;loop(ts,gen);});}
let drawAcc=0,hudAcc=0;

/* ---------- Audio ---------- */
let audioCtx=null,master=null,noiseBuf=null;
let engine=null;
function unlockAudio(){
  try{
    if(!audioCtx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;
      audioCtx=new AC();
      master=audioCtx.createGain();
      master.gain.value=isMuted()?0:0.8;
      master.connect(audioCtx.destination);
    }
    if(audioCtx.state==='suspended')audioCtx.resume();
    if(!musicTimer&&!isMuted())startMusic();
  }catch(e){}
}
function tone(freq,dur,type,vol,slideTo){
  if(!audioCtx||isMuted())return;
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
function noise(dur,vol,freq,type,atTime){
  if(!audioCtx||isMuted())return;
  try{
    const b=getNoise();if(!b)return;
    const t=atTime||audioCtx.currentTime;
    const s=audioCtx.createBufferSource();s.buffer=b;
    const f=audioCtx.createBiquadFilter();f.type=type||'bandpass';f.frequency.setValueAtTime(freq||800,t);f.Q.value=0.8;
    const g=audioCtx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vol||0.12,t+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(f);f.connect(g);g.connect(master);
    s.start(t);s.stop(t+dur+0.02);
  }catch(e){}
}
function sfxClick(){tone(620,0.05,'square',0.05);}
function sfxCoin(){tone(1319,0.07,'sine',0.09);setTimeout(()=>tone(1760,0.11,'sine',0.09),65);}
function sfxHorn(){tone(392,0.16,'square',0.07);tone(493,0.16,'square',0.06);}
function sfxNitro(){
  if(!audioCtx||isMuted())return;
  try{
    const t=audioCtx.currentTime;
    const b=getNoise();
    if(b){
      const s=audioCtx.createBufferSource();s.buffer=b;s.loop=true;
      const f=audioCtx.createBiquadFilter();f.type='bandpass';f.Q.value=1.4;
      f.frequency.setValueAtTime(320,t);
      f.frequency.exponentialRampToValueAtTime(2600,t+0.5);
      const g=audioCtx.createGain();
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(0.22,t+0.08);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.62);
      s.connect(f);f.connect(g);g.connect(master);
      s.start(t);s.stop(t+0.65);
    }
    const o=audioCtx.createOscillator();o.type='sawtooth';
    o.frequency.setValueAtTime(160,t);
    o.frequency.exponentialRampToValueAtTime(420,t+0.45);
    const og=audioCtx.createGain();
    og.gain.setValueAtTime(0.0001,t);
    og.gain.exponentialRampToValueAtTime(0.07,t+0.08);
    og.gain.exponentialRampToValueAtTime(0.0001,t+0.5);
    o.connect(og);og.connect(master);o.start(t);o.stop(t+0.52);
  }catch(e){}
}
function sfxCrash(){
  noise(0.5,0.3,240,'lowpass');
  tone(72,0.55,'sine',0.22,38);
  noise(0.18,0.16,3400,'highpass');
}
function sfxThud(){noise(0.16,0.2,320,'lowpass');tone(95,0.2,'sine',0.14,55);}
function sfxBuy(){tone(760,0.1,'square',0.09,980);}
function sfxSelect(){tone(520,0.08,'square',0.07,660);}
function sfxLevel(){const seq=[523,659,784,1047];for(let i=0;i<seq.length;i++)(function(f,d){setTimeout(()=>tone(f,0.22,'triangle',0.11),d);})(seq[i],i*115);}

const MUSIC_BPM=112;
const STEP_SEC=60/MUSIC_BPM/4;
const LOOP_STEPS=32;
const BASS=[0,null,0,null,3,null,2,null,0,null,10,null,7,null,7,null,
            8,null,8,null,12,null,10,null,7,null,7,null,10,null,7,null];
const LEAD={0:19,6:15,10:19,16:20,22:19,26:15};
const KICK=[0,4,8,12,16,20,24,28];
const CLAP=[4,12,20,28];
let musicTimer=null,musicGain=null,musicDelay=null,musicStep=0,nextNoteTime=0;
function startMusic(){
  if(!audioCtx||musicTimer||isMuted())return;
  try{
    const comp=audioCtx.createDynamicsCompressor();
    comp.threshold.value=-18;comp.ratio.value=6;comp.connect(master);
    musicGain=audioCtx.createGain();musicGain.gain.value=0.4;musicGain.connect(comp);
    musicDelay=audioCtx.createDelay(1.0);
    musicDelay.delayTime.value=STEP_SEC*3;
    const fb=audioCtx.createGain();fb.gain.value=0.33;
    const wet=audioCtx.createGain();wet.gain.value=0.18;
    musicDelay.connect(fb);fb.connect(musicDelay);musicDelay.connect(wet);wet.connect(musicGain);
    musicStep=0;nextNoteTime=audioCtx.currentTime+0.09;
    musicTimer=setInterval(scheduleMusic,25);
  }catch(e){stopMusic();}
}
function scheduleMusic(){
  if(!audioCtx||!musicGain)return;
  try{
    while(nextNoteTime<audioCtx.currentTime+0.24){
      scheduleStep(musicStep%LOOP_STEPS,nextNoteTime);
      nextNoteTime+=STEP_SEC;
      musicStep++;
    }
  }catch(e){}
}
function noteAt(base,semi){return base*Math.pow(2,semi/12);}
function scheduleStep(i,t){
  try{
    if(KICK.indexOf(i)>=0){
      const o=audioCtx.createOscillator();o.type='sine';
      o.frequency.setValueAtTime(132,t);
      o.frequency.exponentialRampToValueAtTime(41,t+0.11);
      const g=audioCtx.createGain();
      g.gain.setValueAtTime(0.9,t);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.24);
      o.connect(g);g.connect(musicGain);o.start(t);o.stop(t+0.26);
    }
    if(CLAP.indexOf(i)>=0)noise(0.09,0.11,1800,'bandpass',t);
    if(i%2===0)noise(0.035,i%4===2?0.05:0.028,7600,'highpass',t);
    const b=BASS[i];
    if(b!==null&&b!==undefined){
      const o=audioCtx.createOscillator();o.type='sawtooth';
      o.frequency.setValueAtTime(noteAt(55,b),t);
      const f=audioCtx.createBiquadFilter();f.type='lowpass';f.Q.value=9;
      f.frequency.setValueAtTime(120,t);
      f.frequency.exponentialRampToValueAtTime(900,t+0.02);
      f.frequency.exponentialRampToValueAtTime(160,t+STEP_SEC*1.9);
      const g=audioCtx.createGain();
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(0.2,t+0.012);
      g.gain.exponentialRampToValueAtTime(0.0001,t+STEP_SEC*1.9);
      o.connect(f);f.connect(g);g.connect(musicGain);o.start(t);o.stop(t+STEP_SEC*2);
    }
    const l=LEAD[i];
    if(l!==undefined){
      const o=audioCtx.createOscillator();o.type='square';
      o.frequency.setValueAtTime(noteAt(220,l),t);
      const g=audioCtx.createGain();
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(0.055,t+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.42);
      o.connect(g);g.connect(musicGain);g.connect(musicDelay);o.start(t);o.stop(t+0.44);
    }
  }catch(e){}
}
function stopMusic(){
  if(musicTimer){clearInterval(musicTimer);musicTimer=null;}
  if(musicGain){try{musicGain.disconnect();}catch(e){}musicGain=null;}
  if(musicDelay){try{musicDelay.disconnect();}catch(e){}musicDelay=null;}
}

function startEngine(){
  unlockAudio();
  if(!audioCtx||engine)return;
  try{
    const t=audioCtx.currentTime;
    const g=audioCtx.createGain();g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.055,t+0.4);g.connect(master);
    const lp=audioCtx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=380;lp.Q.value=6;lp.connect(g);
    const o=audioCtx.createOscillator();o.type='sawtooth';o.frequency.value=68;o.connect(lp);o.start();
    const o2=audioCtx.createOscillator();o2.type='sawtooth';o2.frequency.value=68*1.008;o2.connect(lp);o2.start();
    engine={o,o2,g,lp};
  }catch(e){engine=null;}
}
function updateEngine(){
  if(!engine||!audioCtx)return;
  try{
    const t=audioCtx.currentTime;
    const boost=race.boost>0?26:0;
    const f=58+race.speed*8.2+boost;
    engine.o.frequency.setTargetAtTime(f,t,0.06);
    engine.o2.frequency.setTargetAtTime(f*1.008,t,0.06);
    engine.lp.frequency.setTargetAtTime(300+race.speed*52+boost*9,t,0.1);
  }catch(e){}
}
function stopEngine(){
  if(!engine)return;
  try{
    const t=audioCtx.currentTime;
    engine.g.gain.cancelScheduledValues(t);
    engine.g.gain.setTargetAtTime(0.0001,t,0.05);
    engine.o.stop(t+0.2);engine.o2.stop(t+0.2);
  }catch(e){}
  engine=null;
}
function startRace(){
  unlockAudio();
  sfxClick();
  const v=vehicle();
  player={wx:0,tilt:0,spin:0,spinDir:1};
  enemies=[];pickups=[];obstacles=[];particles=[];floats=[];
  initScenery();
  race=newRace();
  race.speed=v.maxSpeed*0.35;
  running=true;paused=false;last=0;drawAcc=0;hudAcc=0;
  held.left=held.right=held.boost=held.brake=false;
  touchLeft=touchRight=touchBoost=false;
  show(null);showHud();
  if(HAS_TOUCH)$('touch').classList.remove('hidden');
  startMusic();
  startEngine();
  tone(420,0.12,'square',0.1,760);
  updateHud();
  loopGen++;
  scheduleLoop(loopGen);
}
function endRace(crashed){
  if(!running)return;
  running=false;
  stopEngine();
  startMusic();
  if(crashed){
    race.shake=1.2;race.flash=1;
    const px=W/2+player.wx*W*0.465*0.78;
    spawnDebris(px,H*0.8,vehicle().color,30);
    sfxCrash();
  }
  const distM=Math.floor(race.dist);
  state.money+=race.earned;
  state.totalMoneyEarned+=race.earned;
  state.xp+=Math.floor(distM/10)+race.overtakes*2;
  state.distance+=distM;
  state.overtakes+=race.overtakes;
  const newBest=distM>state.best;
  if(newBest)state.best=distM;
  let leveled=false;
  while(state.xp>=xpNeeded(state.level)){
    state.xp-=xpNeeded(state.level);
    state.level++;
    state.money+=state.level*50;
    state.totalMoneyEarned+=state.level*50;
    leveled=true;
  }
  if(leveled)sfxLevel();
  checkMissions();
  save();
  $('odist').textContent=distM;
  $('ocoins').textContent=race.coins;
  $('oearn').textContent=race.earned;
  $('obest').textContent=Math.floor(state.best);
  $('onewbest').classList.toggle('hidden',!newBest);
  $('over').querySelector('h2').textContent=crashed?'CRASHED!':'RUN OVER';
  show('over');
  hideHud();
  $('touch').classList.add('hidden');
}
function togglePause(){
  if(!running)return;
  paused=!paused;
  if(paused){stopEngine();stopMusic();show('pausev');}
  else{show(null);startEngine();startMusic();}
}
function showMenu(){updateMenu();show('menu');}

/* ---------- HUD / menus ---------- */
function updateMuteLabels(){
  const m=$('mute');if(m)m.textContent=isMuted()?'Sound: Off':'Sound: On';
  const hm=$('hmute');if(hm)hm.textContent=isMuted()?'🔇':'🔊';
}
function toggleMute(){
  const nowMuted=!isMuted();
  storeSet(MUTE_KEY,nowMuted?'1':'0');
  if(master)master.gain.value=nowMuted?0:0.8;
  if(nowMuted)stopMusic();else if(audioCtx)startMusic();
  updateMuteLabels();
}
function show(id){
  const list=document.querySelectorAll('.overlay');
  for(let i=0;i<list.length;i++)list[i].classList.add('hidden');
  if(id){
    const ov=$(id);
    ov.classList.remove('hidden');
    focusFirstButton(ov);
  }
}
function focusFirstButton(ov){
  const btns=overlayButtons(ov);
  if(btns.length){try{btns[0].focus();}catch(e){}}
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
function hideHud(){$('hud').classList.add('hidden');}
function showHud(){$('hud').classList.remove('hidden');}

function updateMenu(){
  $('userinfo').textContent='Player: '+state.user;
  $('mlevel').textContent=state.level;
  $('mxp').textContent=Math.floor(state.xp);
  $('mneed').textContent=xpNeeded(state.level);
  const fill=$('mxpfill');if(fill)fill.style.width=clamp(state.xp/xpNeeded(state.level)*100,0,100)+'%';
  $('mmoney').textContent=state.money;
  $('mbest').textContent=Math.floor(state.best);
  const v=vehicle();
  $('mcar').textContent=v.name+' · Top '+Math.round(v.maxSpeed*16)+' km/h';
}
function statRow(label,val,color){
  const pct=Math.round(clamp(val,0.05,1)*100);
  return '<div class="stat"><span>'+label+'</span><div class="bar"><i style="width:'+pct+'%;background:'+color+'"></i></div><em>'+pct+'</em></div>';
}
function renderVehicles(){
  const el=$('vlist');el.innerHTML='';
  let maxSpeed=1,maxAccel=0.3;
  for(let i=0;i<VEHICLES.length;i++){maxSpeed=Math.max(maxSpeed,VEHICLES[i].maxSpeed);maxAccel=Math.max(maxAccel,VEHICLES[i].accel);}
  VEHICLES.forEach((v,i)=>{
    const owned=state.owned.indexOf(i)>=0;
    const sel=state.selected===i;
    const d=document.createElement('div');
    d.className='vitem'+(sel?' selected':'');
    d.innerHTML=
      '<div class="vhead">'+
        '<canvas class="vprev" width="104" height="76"></canvas>'+
        '<div class="vinfo">'+
          '<b>'+v.name+'</b>'+
          '<span class="vdesc">'+v.desc+'</span>'+
          '<span class="vperf">Top '+Math.round(v.maxSpeed*16)+' km/h · '+(owned?'Owned':'₹'+v.price)+'</span>'+
          (sel?'<span class="vtag">SELECTED</span>':'')+
        '</div>'+
      '</div>'+
      '<div class="vstats">'+
        statRow('Speed',v.maxSpeed/maxSpeed,'#22c55e')+
        statRow('Accel',v.accel/maxAccel,'#f59e0b')+
        statRow('Handling',v.handling,'#3b82f6')+
      '</div>';
    drawPreview(d.querySelector('canvas'),v);
    const btn=document.createElement('button');
    if(!owned){
      btn.textContent='Buy (₹'+v.price+')';
      bindPress(btn,()=>{
        if(state.money>=v.price){
          state.money-=v.price;state.owned.push(i);
          save();renderVehicles();updateMenu();sfxBuy();
          toast(v.name+' added to your garage');
        }else{
          sfxThud();toast('Not enough money');
        }
      });
    }else if(!sel){
      btn.textContent='Select';
      bindPress(btn,()=>{state.selected=i;save();renderVehicles();updateMenu();sfxSelect();});
    }else{btn.textContent='Selected';btn.disabled=true;}
    const wrap=document.createElement('div');wrap.className='vbtn';wrap.appendChild(btn);
    d.appendChild(wrap);
    el.appendChild(d);
  });
}
function drawPreview(cv,v){
  if(!cv)return;
  const g=cv.getContext('2d');
  const cw=cv.width,ch=cv.height;
  g.clearRect(0,0,cw,ch);
  const bg=g.createLinearGradient(0,0,0,ch);
  bg.addColorStop(0,'#2b2138');bg.addColorStop(0.55,'#191324');bg.addColorStop(1,'#0d0a16');
  g.fillStyle=bg;g.fillRect(0,0,cw,ch);
  g.fillStyle='rgba(255,170,90,.16)';
  g.beginPath();g.arc(cw*0.5,ch*0.32,cw*0.36,0,Math.PI*2);g.fill();
  g.fillStyle='rgba(0,0,0,.45)';
  g.beginPath();g.ellipse(cw/2,ch*0.86,cw*0.36,ch*0.1,0,0,Math.PI*2);g.fill();
  drawVehicle(g,cw/2,ch*0.56,cw*0.5,v.color,{player:true});
}
function missionValue(def){
  if(def.type==='level')return state.level;
  if(def.type==='totalMoney')return state.totalMoneyEarned;
  if(def.type==='overtakes')return state.overtakes;
  if(def.type==='distance')return state.distance;
  return 0;
}
function renderMissions(){
  const el=$('mlist');el.innerHTML='';
  state.missions.forEach(m=>{
    const def=MISSIONS.find(x=>x.id===m.id);
    if(!def)return;
    const prog=Math.min(missionValue(def),def.target);
    const pct=Math.round(prog/def.target*100);
    const d=document.createElement('div');d.className='mitem'+(m.done?' done':'');
    d.innerHTML='<b>'+def.title+'</b><span>'+Math.floor(prog)+'/'+def.target+' · Reward ₹'+def.reward+(m.done?' · DONE':'')+'</span>'+
      '<div class="bar mini"><i style="width:'+pct+'%;background:'+(m.done?'#22c55e':'#3b82f6')+'"></i></div>';
    el.appendChild(d);
  });
}
function checkMissions(){
  let changed=false;
  state.missions.forEach(m=>{
    if(m.done)return;
    const def=MISSIONS.find(x=>x.id===m.id);
    if(!def)return;
    m.progress=Math.min(missionValue(def),def.target);
    if(m.progress>=def.target){
      m.done=true;changed=true;
      state.money+=def.reward;state.totalMoneyEarned+=def.reward;
      toast('Mission complete: '+def.title+' (+₹'+def.reward+')');
    }
  });
  if(changed)sfxLevel();
}
let toastTimer=null;
function toast(msg){
  const t=$('toast');if(!t)return;
  t.textContent=msg;t.classList.remove('hidden');t.classList.add('show');
  if(toastTimer)clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{t.classList.add('hidden');t.classList.remove('show');},2400);
}

/* ---------- Drawing ---------- */
function rr(g,x,y,w,h,r){
  r=Math.max(0,Math.min(r,Math.min(w,h)/2));
  g.beginPath();
  g.moveTo(x+r,y);
  g.arcTo(x+w,y,x+w,y+h,r);
  g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r);
  g.arcTo(x,y,x+w,y,r);
  g.closePath();
}
function shade(hex,amt){
  let c=String(hex||'#888888').replace('#','');
  if(c.length===3)c=c.split('').map(ch=>ch+ch).join('');
  const n=parseInt(c,16)||0;
  const cl=v=>Math.max(0,Math.min(255,Math.round(v+255*amt)));
  return 'rgb('+cl((n>>16)&255)+','+cl((n>>8)&255)+','+cl(n&255)+')';
}
function drawVehicle(g,x,y,w,color,opts){
  opts=opts||{};
  const type=opts.type||'small';
  const isTruck=type==='truck',isVan=type==='van',isSports=type==='sports';
  const h=w*(isTruck?2.0:isVan?1.78:isSports?1.42:1.58);
  g.save();
  g.translate(x,y);
  if(opts.spin)g.rotate(opts.spin);
  if(opts.tilt)g.rotate(opts.tilt);

  g.fillStyle='rgba(0,0,0,.45)';
  g.beginPath();g.ellipse(0,h*0.42,w*0.62,w*0.16,0,0,Math.PI*2);g.fill();

  const wheelY=[-h*0.26,h*0.14];
  for(let si=0;si<2;si++){
    const wy=wheelY[si];
    for(let sxi=0;sxi<2;sxi++){
      const sx=sxi===0?-1:1;
      g.fillStyle='#07070c';
      rr(g,sx*w*0.44-w*0.085,wy,w*0.17,h*0.21,w*0.05);g.fill();
      g.fillStyle='#2b2b34';
      rr(g,sx*w*0.44-w*0.05,wy+h*0.045,w*0.1,h*0.12,w*0.03);g.fill();
    }
  }

  const bodyG=g.createLinearGradient(-w*0.5,0,w*0.5,0);
  bodyG.addColorStop(0,shade(color,-0.48));
  bodyG.addColorStop(0.3,shade(color,-0.08));
  bodyG.addColorStop(0.52,shade(color,0.26));
  bodyG.addColorStop(0.72,shade(color,-0.05));
  bodyG.addColorStop(1,shade(color,-0.52));
  g.fillStyle=bodyG;
  rr(g,-w*0.46,-h*0.34,w*0.92,h*0.74,w*(isVan||isTruck?0.10:0.17));g.fill();

  if(isTruck){
    const boxG=g.createLinearGradient(0,-h*0.52,0,h*0.1);
    boxG.addColorStop(0,shade(color,0.14));boxG.addColorStop(0.5,shade(color,-0.08));boxG.addColorStop(1,shade(color,-0.3));
    g.fillStyle=boxG;
    rr(g,-w*0.47,-h*0.52,w*0.94,h*0.5,w*0.07);g.fill();
    g.strokeStyle='rgba(255,255,255,.09)';g.lineWidth=Math.max(1,w*0.02);
    for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(i*w*0.24,-h*0.5);g.lineTo(i*w*0.24,-h*0.03);g.stroke();}
    g.fillStyle='#f59e0b';
    for(let i=-1;i<=1;i++){g.beginPath();g.arc(i*w*0.26,h*0.135,w*0.035,0,Math.PI*2);g.fill();}
  }else if(isVan){
    const roofG=g.createLinearGradient(0,-h*0.5,0,h*0.05);
    roofG.addColorStop(0,shade(color,0.1));roofG.addColorStop(1,shade(color,-0.24));
    g.fillStyle=roofG;
    rr(g,-w*0.4,-h*0.5,w*0.8,h*0.56,w*0.08);g.fill();
    const vanWin=g.createLinearGradient(0,-h*0.44,0,-h*0.2);
    vanWin.addColorStop(0,'rgba(160,215,255,.92)');vanWin.addColorStop(1,'rgba(30,58,96,.95)');
    g.fillStyle=vanWin;
    rr(g,-w*0.33,-h*0.44,w*0.66,h*0.2,w*0.05);g.fill();
  }else{
    const roofG=g.createLinearGradient(0,-h*0.52,0,-h*0.08);
    roofG.addColorStop(0,shade(color,0.16));roofG.addColorStop(0.6,shade(color,-0.08));roofG.addColorStop(1,shade(color,-0.3));
    g.fillStyle=roofG;
    rr(g,-w*0.335,-h*0.5,w*0.67,h*0.4,w*(isSports?0.07:0.11));g.fill();
    const winG=g.createLinearGradient(0,-h*0.47,0,-h*0.16);
    winG.addColorStop(0,'rgba(165,220,255,.95)');winG.addColorStop(1,'rgba(26,52,92,.96)');
    g.fillStyle=winG;
    rr(g,-w*0.275,-h*0.46,w*0.55,h*0.15,w*0.05);g.fill();
    rr(g,-w*0.255,-h*0.235,w*0.51,h*0.11,w*0.05);g.fill();
    g.fillStyle='rgba(255,255,255,.25)';
    rr(g,-w*0.22,-h*0.445,w*0.44,h*0.04,w*0.02);g.fill();
    if(isSports){
      g.fillStyle='rgba(255,255,255,.85)';
      rr(g,-w*0.07,-h*0.5,w*0.14,h*0.86,w*0.03);g.fill();
      g.fillStyle=shade(color,-0.4);
      rr(g,-w*0.5,h*0.18,w,h*0.075,w*0.03);g.fill();
    }
  }

  g.fillStyle=shade(color,-0.38);
  rr(g,-w*0.48,h*0.2,w*0.96,h*0.12,w*0.05);g.fill();

  const brake=opts.brake?1:0.78;
  g.fillStyle='rgba(255,62,62,'+brake+')';
  rr(g,-w*0.4,h*0.045,w*0.21,h*0.1,w*0.03);g.fill();
  rr(g,w*0.19,h*0.045,w*0.21,h*0.1,w*0.03);g.fill();
  if(!LOW_GFX){
    const tg=g.createRadialGradient(0,h*0.1,1,0,h*0.1,w*0.5);
    tg.addColorStop(0,'rgba(255,70,60,.5)');tg.addColorStop(1,'rgba(255,70,60,0)');
    g.fillStyle=tg;g.beginPath();g.ellipse(0,h*0.1,w*0.52,w*0.2,0,0,Math.PI*2);g.fill();
  }
  g.fillStyle='rgba(255,246,205,.92)';
  rr(g,-w*0.4,-h*0.325,w*0.19,h*0.07,w*0.025);g.fill();
  rr(g,w*0.21,-h*0.325,w*0.19,h*0.07,w*0.025);g.fill();

  g.strokeStyle='rgba(255,255,255,.16)';
  g.lineWidth=Math.max(1,w*0.017);
  rr(g,-w*0.46,-h*0.34,w*0.92,h*0.74,w*0.17);g.stroke();

  if(opts.player){
    g.fillStyle=shade(color,-0.42);
    rr(g,-w*0.52,h*0.06,w*0.08,h*0.3,w*0.03);g.fill();
    rr(g,w*0.44,h*0.06,w*0.08,h*0.3,w*0.03);g.fill();
  }
  if(opts.hitFlash){
    g.globalAlpha=clamp(opts.hitFlash,0,0.65);
    g.fillStyle='#ffffff';
    rr(g,-w*0.46,-h*0.34,w*0.92,h*0.74,w*0.17);g.fill();
    g.globalAlpha=1;
  }
  g.restore();
}

function drawSky(){
  const sky=ctx.createLinearGradient(0,0,0,HORIZON+36);
  if(LOW_GFX){
    sky.addColorStop(0,'#241533');sky.addColorStop(0.7,'#572a44');sky.addColorStop(1,'#c56a3e');
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,HORIZON+36);
  }else{
    sky.addColorStop(0,'#160b2e');
    sky.addColorStop(0.34,'#3c1d54');
    sky.addColorStop(0.62,'#83354f');
    sky.addColorStop(0.84,'#c2543a');
    sky.addColorStop(1,'#f0a04b');
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,HORIZON+36);
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,.5)';
    for(let i=0;i<26;i++){
      const sx=hash(i*3.1+0.7)*W, sy=hash(i*7.7+4.2)*HORIZON*0.45;
      const sr=hash(i*5.3+2.2)>0.75?1.3:0.8;
      ctx.globalAlpha=0.25+hash(i*9.1+1.1)*0.5;
      ctx.fillRect(sx,sy,sr,sr);
    }
    ctx.globalAlpha=1;
    ctx.fillStyle='rgba(240,150,110,.28)';
    for(let i=0;i<4;i++){
      const cy=HORIZON*0.42+i*(HORIZON*0.13);
      const off=(race?race.time*(3+i):i*20)%(W+340)-170;
      ctx.beginPath();ctx.ellipse(W-off,cy,150+i*40,7+i*2,0,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  const sunX=W*0.5-roadBend(race.dist,0)*0.6, sunY=HORIZON-16;
  const sun=ctx.createRadialGradient(sunX,sunY,2,sunX,sunY,96);
  sun.addColorStop(0,'rgba(255,236,170,.95)');
  sun.addColorStop(0.32,'rgba(255,186,96,.55)');
  sun.addColorStop(1,'rgba(255,160,80,0)');
  ctx.fillStyle=sun;
  ctx.fillRect(sunX-100,sunY-100,200,200);
  ctx.fillStyle='#ffe9b0';
  ctx.beginPath();ctx.arc(sunX,sunY,15,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(194,84,58,.9)';
  ctx.fillRect(0,HORIZON-3,W,5);

  if(!LOW_GFX){
    drawSkyline(0.32,'#251433',HORIZON,86,1.9);
    drawSkyline(0.55,'#150f24',HORIZON,52,7.7);
  }else{
    drawSkyline(0.45,'#1c1228',HORIZON,60,3.3);
  }
}
function drawSkyline(parallax,color,baseY,maxH,seed){
  const off=roadBend(race.dist,0)*parallax*0.9;
  ctx.fillStyle=color;
  const bw=26;
  const start=Math.floor((off-W)/bw)-1, end=Math.floor((off+2*W)/bw)+1;
  ctx.beginPath();
  ctx.moveTo(-4,baseY+2);
  for(let i=start;i<end;i++){
    const h=12+hash(i*seed+13.1)*maxH;
    const x=i*bw-off;
    ctx.lineTo(x,baseY+2);
    ctx.lineTo(x,baseY-h);
    ctx.lineTo(x+bw*0.62,baseY-h);
    ctx.lineTo(x+bw*0.62,baseY+2);
  }
  ctx.lineTo(W+4,baseY+2);
  ctx.closePath();ctx.fill();
  if(parallax>0.4){
    ctx.fillStyle='rgba(255,209,102,.75)';
    for(let i=start;i<end;i++){
      const h=12+hash(i*seed+13.1)*maxH;
      const x=i*bw-off;
      for(let w=0;w<3;w++){
        if(hash(i*31.7+w*7.9+seed)>0.82){
          ctx.fillRect(x+4+w*7,baseY-h+6+hash(i*3.1+w)*Math.max(4,h-12),2,2);
        }
      }
    }
  }
}
function drawGround(){
  const g=ctx.createLinearGradient(0,HORIZON,0,H);
  if(LOW_GFX){g.addColorStop(0,'#31202c');g.addColorStop(1,'#16101c');}
  else{g.addColorStop(0,'#3a2331');g.addColorStop(0.25,'#2b1d29');g.addColorStop(1,'#14101b');}
  ctx.fillStyle=g;ctx.fillRect(0,HORIZON,W,H-HORIZON);
}
function drawRoad(){
  const steps=LOW_GFX?20:36;
  ctx.beginPath();
  for(let i=0;i<=steps;i++){
    const t=i/steps;
    const r=projT(t);
    const x=roadX(race.dist,t)-r.half;
    if(i===0)ctx.moveTo(x,r.y);else ctx.lineTo(x,r.y);
  }
  for(let i=steps;i>=0;i--){
    const t=i/steps;
    const r=projT(t);
    ctx.lineTo(roadX(race.dist,t)+r.half,r.y);
  }
  ctx.closePath();
  if(LOW_GFX){
    ctx.fillStyle='#2e2c34';ctx.fill();
  }else{
    const rg=ctx.createLinearGradient(0,HORIZON,0,H);
    rg.addColorStop(0,'#4b444e');
    rg.addColorStop(0.2,'#38343e');
    rg.addColorStop(0.75,'#2a2730');
    rg.addColorStop(1,'#211e27');
    ctx.fillStyle=rg;ctx.fill();
  }
  for(let side=-1;side<=1;side+=2){
    for(let i=0;i<steps;i++){
      const t0=i/steps,t1=(i+1)/steps;
      const a=projT(t0),b=projT(t1);
      const xa=roadX(race.dist,t0),xb=roadX(race.dist,t1);
      const wa=Math.max(1,a.half*0.022),wb=Math.max(1,b.half*0.022);
      ctx.fillStyle='rgba(240,234,214,.85)';
      ctx.beginPath();
      ctx.moveTo(xa+side*(a.half-wa),a.y);
      ctx.lineTo(xb+side*(b.half-wb),b.y);
      ctx.lineTo(xb+side*b.half,b.y);
      ctx.lineTo(xa+side*a.half,a.y);
      ctx.closePath();ctx.fill();
    }
  }
  ctx.globalAlpha=0.3;
  for(let side=-1;side<=1;side+=2){
    for(let i=0;i<steps;i++){
      const t0=i/steps,t1=(i+1)/steps;
      const a=projT(t0),b=projT(t1);
      const xa=roadX(race.dist,t0),xb=roadX(race.dist,t1);
      ctx.strokeStyle='#dcd8cc';
      ctx.lineWidth=Math.max(1,a.half*0.008);
      ctx.beginPath();
      ctx.moveTo(xa+side*a.half*0.36,a.y);
      ctx.lineTo(xb+side*b.half*0.36,b.y);
      ctx.stroke();
    }
  }
  ctx.globalAlpha=1;
  const dashLen=16,dashGap=34,cycle=dashLen+dashGap;
  const off=race.dist*2.4%cycle;
  for(let d=off;d<VIEW;d+=cycle){
    const z0=VIEW-d, z1=Math.max(0.5,VIEW-d-dashLen);
    const t0=1-z0/VIEW, t1=1-z1/VIEW;
    const p0=projT(t0), p1=projT(t1);
    const x0=roadX(race.dist,t0), x1=roadX(race.dist,t1);
    const w0=Math.max(1,p0.half*0.018), w1=Math.max(1,p1.half*0.018);
    ctx.fillStyle='rgba(245,240,220,.9)';
    ctx.beginPath();
    ctx.moveTo(x0-w0,p0.y);ctx.lineTo(x0+w0,p0.y);
    ctx.lineTo(x1+w1,p1.y);ctx.lineTo(x1-w1,p1.y);
    ctx.closePath();ctx.fill();
  }
  if(!LOW_GFX){
    ctx.globalAlpha=0.05;
    ctx.fillStyle='#ffffff';
    for(let i=0;i<3;i++){
      const yy=HORIZON+(((race.dist*3.1+i*173)%(H-HORIZON)));
      ctx.fillRect(0,yy,W,3);
    }
    ctx.globalAlpha=1;
  }
  const hz=ctx.createLinearGradient(0,HORIZON-8,0,HORIZON+42);
  hz.addColorStop(0,'rgba(240,160,75,.4)');
  hz.addColorStop(1,'rgba(240,160,75,0)');
  ctx.fillStyle=hz;ctx.fillRect(0,HORIZON-8,W,50);
}
function drawBuilding(x,baseY,scale,seed,hMul){
  const w=(30+hash(seed*1.3)*26)*scale+6;
  const h=(46+hash(seed*2.1)*44)*scale*hMul+6;
  const bx=x-w/2;
  const body=ctx.createLinearGradient(bx,0,bx+w,0);
  body.addColorStop(0,'#231c33');body.addColorStop(0.5,'#322a44');body.addColorStop(1,'#1b1526');
  ctx.fillStyle=body;
  ctx.fillRect(bx,baseY-h,w,h);
  ctx.fillStyle='#3d3454';
  ctx.fillRect(bx-2*scale-1,baseY-h-3*scale-1,w+4*scale+2,3*scale+1);
  const cols=Math.max(2,Math.floor(w/(9*scale+4)));
  const rows=Math.max(2,Math.floor(h/(11*scale+5)));
  const cw=w/(cols+0.6), rh=h/(rows+1);
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const lit=hash(seed*17.3+r*5.1+c*3.7+Math.floor(seed))>0.58;
      ctx.fillStyle=lit?'rgba(255,209,102,.9)':'rgba(16,20,38,.9)';
      ctx.fillRect(bx+cw*0.5+c*cw, baseY-h+rh*0.8+r*rh, cw*0.52, rh*0.4);
    }
  }
}
function drawTree(x,baseY,scale){
  const s=13*scale+3;
  ctx.fillStyle='#241812';
  ctx.fillRect(x-s*0.09,baseY-s*0.85,s*0.18,s*0.85);
  const g=ctx.createRadialGradient(x-s*0.3,baseY-s*1.35,s*0.15,x,baseY-s*1.05,s*1.15);
  g.addColorStop(0,'#3f6b3a');g.addColorStop(0.55,'#1e3d24');g.addColorStop(1,'#0d1f13');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.arc(x,baseY-s*1.1,s,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(x-s*0.66,baseY-s*0.82,s*0.62,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(x+s*0.66,baseY-s*0.86,s*0.62,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(255,170,90,.35)';
  ctx.lineWidth=Math.max(1,s*0.07);
  ctx.beginPath();ctx.arc(x,baseY-s*1.1,s*0.92,Math.PI*1.15,Math.PI*1.75);ctx.stroke();
}
function drawLamp(x,baseY,scale){
  const s=15*scale+2;
  ctx.strokeStyle='#3a3f52';
  ctx.lineWidth=Math.max(1.2,s*0.16);
  ctx.beginPath();ctx.moveTo(x,baseY);ctx.lineTo(x,baseY-s*2.6);ctx.stroke();
  ctx.fillStyle='#4b5064';
  rr(ctx,x-s*0.62,baseY-s*2.8,s*1.24,s*0.22,s*0.08);ctx.fill();
  const glow=ctx.createRadialGradient(x,baseY-s*2.55,1,x,baseY-s*2.55,s*1.7);
  glow.addColorStop(0,'rgba(255,228,150,.85)');glow.addColorStop(1,'rgba(255,228,150,0)');
  ctx.fillStyle=glow;
  ctx.beginPath();ctx.arc(x,baseY-s*2.55,s*1.7,0,Math.PI*2);ctx.fill();
  const pool=ctx.createRadialGradient(x,baseY,1,x,baseY,s*2.6);
  pool.addColorStop(0,'rgba(255,214,120,.30)');pool.addColorStop(1,'rgba(255,214,120,0)');
  ctx.fillStyle=pool;
  ctx.beginPath();ctx.ellipse(x,baseY,s*2.4,s*0.9,0,0,Math.PI*2);ctx.fill();
}
function drawBillboard(x,baseY,scale,side,seed){
  const s=scale;
  const w=54*s+14, h=26*s+8;
  const y=baseY-(30*s+8);
  ctx.fillStyle='#2c2430';
  const px=side>0?x+w*0.14:x-w*0.14;
  ctx.fillRect(px-2*s-1,y+h*0.4,4*s+2,baseY-(y+h*0.4));
  const bg=ctx.createLinearGradient(x,y,x,y+h);
  bg.addColorStop(0,'#1e293b');bg.addColorStop(1,'#0b1220');
  ctx.fillStyle=bg;
  rr(ctx,x-w/2,y,w,h,4*s+2);ctx.fill();
  ctx.strokeStyle='rgba(96,165,250,.8)';
  ctx.lineWidth=Math.max(1,1.6*s);
  rr(ctx,x-w/2,y,w,h,4*s+2);ctx.stroke();
  ctx.fillStyle='#7fd0ff';
  ctx.font='bold '+Math.max(6,Math.round(9*s+4))+'px system-ui,sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(BILLBOARDS[Math.floor(hash(seed*3.3)*BILLBOARDS.length)],x,y+h*0.42);
  ctx.fillStyle='#ffd166';
  ctx.font='bold '+Math.max(5,Math.round(6*s+3))+'px system-ui,sans-serif';
  ctx.fillText('★ RACING 2D ★',x,y+h*0.74);
  ctx.textAlign='left';ctx.textBaseline='alphabetic';
}
function drawSceneryObject(s){
  const t=clamp(1-s.z/VIEW,0,1);
  const p=projT(t);
  const scale=entityScale(t);
  const side=s.side;
  const x=roadX(race.dist,t)+side*(p.half+ (s.type==='building'?26:14)*scale+6);
  if(x<-70||x>W+70)return;
  if(s.type==='building')drawBuilding(x,p.y,scale,s.seed,s.h);
  else if(s.type==='lamp')drawLamp(x,p.y,scale);
  else if(s.type==='billboard')drawBillboard(x,p.y,scale,side,s.seed);
  else drawTree(x,p.y,scale);
}

function drawCoin(x,y,r,seed,time){
  const bob=Math.sin(time*4+seed*7)*2.4*Math.min(1,r*0.3+0.4);
  ctx.save();
  ctx.translate(x,y+bob);
  ctx.fillStyle='rgba(0,0,0,.35)';
  ctx.beginPath();ctx.ellipse(0,r*0.95,r*0.85,r*0.32,0,0,Math.PI*2);ctx.fill();
  const g=ctx.createRadialGradient(-r*0.3,-r*0.35,r*0.1,0,0,r);
  g.addColorStop(0,'#fff6bd');g.addColorStop(0.45,'#fbbf24');g.addColorStop(0.85,'#d97706');g.addColorStop(1,'#92400e');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(146,64,14,.9)';ctx.lineWidth=Math.max(1,r*0.12);
  ctx.beginPath();ctx.arc(0,0,r*0.72,0,Math.PI*2);ctx.stroke();
  if(r>5){
    ctx.fillStyle='#78350f';
    ctx.font='bold '+Math.round(r*1.15)+'px system-ui,sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('₹',0,1);
  }
  ctx.restore();
}
function drawNitro(x,y,r,seed,time){
  const bob=Math.sin(time*3.2+seed*5)*2.2;
  ctx.save();
  ctx.translate(x,y+bob);
  ctx.rotate(Math.sin(time*2+seed)*0.08);
  ctx.fillStyle='rgba(0,0,0,.35)';
  ctx.beginPath();ctx.ellipse(0,r*1.1,r*0.8,r*0.3,0,0,Math.PI*2);ctx.fill();
  const bg=ctx.createLinearGradient(-r*0.7,0,r*0.7,0);
  bg.addColorStop(0,'#0e7490');bg.addColorStop(0.4,'#22d3ee');bg.addColorStop(0.6,'#67e8f9');bg.addColorStop(1,'#155e75');
  ctx.fillStyle=bg;
  rr(ctx,-r*0.52,-r*0.9,r*1.04,r*1.7,r*0.32);ctx.fill();
  ctx.fillStyle='#164e63';
  rr(ctx,-r*0.28,-r*1.18,r*0.56,r*0.36,r*0.1);ctx.fill();
  ctx.fillStyle='#a5f3fc';
  rr(ctx,-r*0.36,-r*0.7,r*0.18,r*1.28,r*0.09);ctx.fill();
  ctx.fillStyle='#ecfeff';
  ctx.font='bold '+Math.round(r*0.9)+'px system-ui,sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('N',r*0.08,r*0.18);
  if(!LOW_GFX){
    const gl=ctx.createRadialGradient(0,0,1,0,0,r*1.9);
    gl.addColorStop(0,'rgba(103,232,249,.5)');gl.addColorStop(1,'rgba(103,232,249,0)');
    ctx.fillStyle=gl;ctx.beginPath();ctx.arc(0,0,r*1.9,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawCone(x,y,scale){
  const s=scale;
  ctx.fillStyle='rgba(0,0,0,.4)';
  ctx.beginPath();ctx.ellipse(x,y+2*s,16*s,5*s,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#7c2d12';
  rr(ctx,x-13*s,y-3*s,26*s,6*s,2*s);ctx.fill();
  const g=ctx.createLinearGradient(x-8*s,0,x+8*s,0);
  g.addColorStop(0,'#c2410c');g.addColorStop(0.45,'#fb923c');g.addColorStop(0.55,'#fdba74');g.addColorStop(1,'#9a3412');
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(x-8.5*s,y);ctx.lineTo(x,y-24*s);ctx.lineTo(x+8.5*s,y);
  ctx.closePath();ctx.fill();
  ctx.fillStyle='#f8fafc';
  ctx.beginPath();
  ctx.moveTo(x-5.4*s,y-8.5*s);ctx.lineTo(x,y-14.5*s);ctx.lineTo(x+5.4*s,y-8.5*s);
  ctx.closePath();ctx.fill();
}
function drawBarrier(x,y,scale,time){
  const s=scale;
  ctx.fillStyle='rgba(0,0,0,.42)';
  ctx.beginPath();ctx.ellipse(x,y+2*s,30*s,6*s,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#1f2937';
  ctx.fillRect(x-24*s,y-4*s,5*s,10*s);
  ctx.fillRect(x+19*s,y-4*s,5*s,10*s);
  const w=52*s,h=14*s,bx=x-w/2,by=y-20*s;
  ctx.save();
  rr(ctx,bx,by,w,h,3*s);
  ctx.fillStyle='#e2e8f0';ctx.fill();
  ctx.clip();
  ctx.fillStyle='#dc2626';
  for(let i=-3;i<4;i++){
    ctx.save();
    ctx.translate(x+i*14*s,by+h/2);
    ctx.rotate(Math.PI/4);
    ctx.fillRect(-5*s,-h,10*s,h*2);
    ctx.restore();
  }
  ctx.restore();
  ctx.strokeStyle='#0f172a';ctx.lineWidth=Math.max(1,1.4*s);
  rr(ctx,bx,by,w,h,3*s);ctx.stroke();
  const blink=(Math.sin(time*9)>0)?1:0.25;
  ctx.fillStyle='rgba(251,191,36,'+blink+')';
  ctx.beginPath();ctx.arc(x,by-4*s,3.4*s,0,Math.PI*2);ctx.fill();
}
function drawSpeedLines(){
  const n=Math.min(16,Math.floor(race.speed*1.15));
  if(n<=2)return;
  ctx.strokeStyle='rgba(255,255,255,.13)';
  ctx.lineWidth=1.4;
  for(let i=0;i<n;i++){
    const y=HORIZON+Math.random()*(H-HORIZON);
    const side=Math.random()<0.5?-1:1;
    const x=side<0?Math.random()*W*0.16:W-Math.random()*W*0.16;
    const len=8+Math.random()*26*(race.speed/16);
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+len);ctx.stroke();
  }
}
function drawPlayer(){
  const v=vehicle();
  const px=W/2+player.wx*W*0.465*0.78;
  const py=H*0.805;
  const blink=race.invuln>0&&Math.floor(race.time*9)%2===0;
  ctx.save();
  ctx.translate(px,py);
  let rot=player.tilt*0.35;
  if(player.spin>0)rot=player.spinDir*(1.05-player.spin)*7.5;
  ctx.rotate(rot);
  if(race.boost>0&&!LOW_GFX){
    ctx.globalAlpha=0.75;
    const fg=ctx.createLinearGradient(0,24,0,72);
    fg.addColorStop(0,'rgba(255,230,140,.95)');
    fg.addColorStop(0.45,'rgba(255,120,25,.75)');
    fg.addColorStop(1,'rgba(255,60,0,0)');
    ctx.fillStyle=fg;
    ctx.beginPath();ctx.moveTo(-13,24);ctx.lineTo(0,72);ctx.lineTo(13,24);ctx.closePath();ctx.fill();
    ctx.globalAlpha=1;
  }
  if(blink)ctx.globalAlpha=0.42;
  drawVehicle(ctx,0,0,54,v.color,{player:true,brake:held.brake});
  ctx.restore();
  ctx.globalAlpha=1;
  if(!LOW_GFX){
    const beam=ctx.createRadialGradient(px,py-30,4,px,py-30,150);
    beam.addColorStop(0,'rgba(255,244,190,.34)');
    beam.addColorStop(1,'rgba(255,244,190,0)');
    ctx.fillStyle=beam;
    ctx.beginPath();ctx.ellipse(px,py-58,70,86,0,0,Math.PI*2);ctx.fill();
  }
}
function drawParticles(){
  for(let i=0;i<particles.length;i++){
    const p=particles[i];
    const a=clamp(p.life/p.maxLife,0,1);
    if(p.type==='smoke'){
      ctx.globalAlpha=a*0.4;
      ctx.fillStyle='rgb('+p.color+')';
      ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    }else if(p.type==='flame'){
      ctx.globalAlpha=a*0.9;
      ctx.fillStyle='rgb('+p.color+')';
      ctx.beginPath();ctx.arc(p.x,p.y,Math.max(0.5,p.size*a),0,Math.PI*2);ctx.fill();
    }else if(p.type==='debris'){
      ctx.globalAlpha=a;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
      ctx.fillStyle=p.color;
      ctx.fillRect(-p.size,-p.size*0.6,p.size*2,p.size*1.2);
      ctx.restore();
    }else{
      ctx.globalAlpha=a;
      ctx.fillStyle='rgb('+p.color+')';
      ctx.fillRect(p.x-p.size,p.y-p.size,p.size*2,p.size*2);
    }
  }
  ctx.globalAlpha=1;
}
function drawFloats(){
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(let i=0;i<floats.length;i++){
    const f=floats[i];
    ctx.globalAlpha=clamp(f.life,0,1);
    ctx.font='bold 12px system-ui,sans-serif';
    ctx.strokeStyle='rgba(0,0,0,.7)';ctx.lineWidth=3;
    ctx.strokeText(f.text,f.x,f.y);
    ctx.fillStyle=f.color;
    ctx.fillText(f.text,f.x,f.y);
  }
  ctx.globalAlpha=1;ctx.textAlign='left';ctx.textBaseline='alphabetic';
}

function draw(){
  ctx.save();
  if(race.shake>0)ctx.translate((Math.random()-0.5)*race.shake*13,(Math.random()-0.5)*race.shake*13);
  drawSky();
  drawGround();
  drawRoad();

  const slist=scenery.slice().sort((a,b)=>b.z-a.z);
  for(let i=0;i<slist.length;i++)drawSceneryObject(slist[i]);

  const ents=[];
  for(let i=0;i<enemies.length;i++)ents.push({z:enemies[i].z,kind:'car',ref:enemies[i]});
  for(let i=0;i<obstacles.length;i++)ents.push({z:obstacles[i].z,kind:'obst',ref:obstacles[i]});
  for(let i=0;i<pickups.length;i++)ents.push({z:pickups[i].z,kind:'pick',ref:pickups[i]});
  ents.sort((a,b)=>b.z-a.z);
  for(let i=0;i<ents.length;i++){
    const e=ents[i];
    const t=clamp(1-e.ref.z/VIEW,0,1);
    const p=projT(t);
    const x=roadX(race.dist,t)+e.ref.wx*p.half*0.78;
    const sc=entityScale(t);
    if(e.kind==='car'){
      const base=44*(e.ref.wdt/0.6);
      drawVehicle(ctx,x,p.y,base*sc,e.ref.color,{type:e.ref.type,hitFlash:e.ref.hitFlash});
    }else if(e.kind==='obst'){
      if(e.ref.type==='cone')drawCone(x,p.y,Math.max(0.35,sc*1.15));
      else drawBarrier(x,p.y,Math.max(0.4,sc*1.2),race.time);
    }else{
      if(e.ref.kind==='coin')drawCoin(x,p.y,Math.max(3,13*sc),e.ref.seed,race.time);
      else drawNitro(x,p.y,Math.max(4,12*sc),e.ref.seed,race.time);
    }
  }

  drawParticles();
  drawPlayer();
  if(!LOW_GFX)drawSpeedLines();
  ctx.restore();

  if(!LOW_GFX){
    const vg=ctx.createRadialGradient(W/2,H*0.55,H*0.34,W/2,H*0.55,H*0.78);
    vg.addColorStop(0,'rgba(0,0,0,0)');
    vg.addColorStop(1,'rgba(10,4,16,.46)');
    ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
  }
  if(race.flash>0){
    ctx.fillStyle='rgba(255,72,52,'+(race.flash*0.42)+')';
    ctx.fillRect(0,0,W,H);
  }
  if(race.startFx>0){
    const k=1-race.startFx/1.25;
    ctx.save();
    ctx.translate(W/2,H*0.4);
    ctx.scale(1+k*0.55,1+k*0.55);
    ctx.globalAlpha=clamp(race.startFx*1.6,0,1);
    ctx.font='800 44px system-ui,sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.shadowColor='#3b82f6';ctx.shadowBlur=24;
    ctx.fillStyle='#fff';
    ctx.fillText('GO!',0,0);
    ctx.restore();
    ctx.shadowBlur=0;
  }
  drawFloats();
}
function loop(ts,gen){
  if(gen!==loopGen)return;
  if(!running)return;
  if(paused){last=ts;scheduleLoop(gen);return;}
  const dt=last?Math.min((ts-last)/1000,0.05):0.016;
  last=ts;
  update(dt);
  if(!running)return;
  drawAcc+=dt;
  if(!LOW_GFX||drawAcc>=0.033){
    drawAcc=0;
    draw();
  }
  scheduleLoop(gen);
}

/* ---------- World model ---------- */
const LANES_W=[-0.58,0,0.58];
const CAR_COLORS=['#94a3b8','#64748b','#c2410c','#0ea5e9','#a855f7','#f43f5e','#eab308','#10b981','#fb7185','#38bdf8'];
const TRAFFIC_TYPES=[
  {type:'small',weight:0.38,len:1.55,wdt:0.60,spdMin:5.4,spdMax:7.6},
  {type:'van',weight:0.24,len:1.78,wdt:0.66,spdMin:4.6,spdMax:6.2},
  {type:'truck',weight:0.16,len:2.05,wdt:0.72,spdMin:3.8,spdMax:5.2},
  {type:'sports',weight:0.22,len:1.5,wdt:0.66,spdMin:6.6,spdMax:8.6}
];
const BILLBOARDS=['NITRO COLA','APEX GT','₹ COIN FEST','SUNSET FM 112','TURBO X','RACING 2D'];

let player={wx:0,tilt:0,spin:0,spinDir:1};
let enemies=[],pickups=[],scenery=[],obstacles=[];
let particles=[],particlePool=[],floats=[];
let race=null;
const held={left:false,right:false,boost:false,brake:false};
let touchLeft=false,touchRight=false,touchBoost=false;

function newRace(){
  return {dist:0,earned:0,coins:0,coinCount:0,overtakes:0,speed:0,time:0,
    spawnT:1.1,pickupT:0.9,obstT:1.6,trickle:0,
    damage:0,invuln:0,boost:0,nitro:35,shake:0,flash:0,startFx:1.25,
    smokeT:0,flameT:0};
}
function curveAt(s){return Math.sin(s*0.0032)*0.6+Math.sin(s*0.0011+1.7)*0.4;}
function roadCenterAt(s){return -(0.6*Math.cos(0.0032*s)/0.0032)-(0.4*Math.cos(0.0011*s+1.7)/0.0011);}
function roadBend(dist,t){
  const ahead=(1-t)*VIEW;
  const b=(roadCenterAt(dist+ahead)-roadCenterAt(dist))*0.85;
  return clamp(b,-W*0.3,W*0.3);
}
function projT(t){
  const tc=clamp(t,0,1);
  const p=Math.pow(tc,1.6);
  const y=HORIZON+(H-HORIZON)*p;
  const half=W*0.055+(W*0.465-W*0.055)*Math.pow(tc,1.18);
  return {t:tc,p,y,half};
}
function roadX(dist,t){return W/2+roadBend(dist,t);}
function entityScale(t){return 0.2+0.8*Math.pow(clamp(t,0,1),1.35);}

function initScenery(){
  scenery=[];
  const count=LOW_GFX?14:24;
  for(let i=0;i<count;i++){
    scenery.push(makeScenery((i/count)*VIEW+Math.random()*3,i));
  }
}
function makeScenery(z,seed){
  const side=(seed%2===0)?-1:1;
  const r=hash(seed*3.7+11.3);
  let type='tree';
  if(r<0.34)type='building';else if(r<0.52)type='lamp';else if(r<0.62)type='billboard';
  return {z:z,side:side,type:type,seed:seed*13.7+5.1,h:0.7+hash(seed*7.3+2.9)*0.9,variant:Math.floor(hash(seed*5.1+9.4)*4)};
}
function resetScenery(s){
  s.z=VIEW+Math.random()*8;
  s.side=Math.random()<0.5?-1:1;
  const r=Math.random();
  s.type=r<0.34?'building':(r<0.52?'lamp':(r<0.62?'billboard':'tree'));
  s.seed=Math.random()*1000+7;
  s.h=0.7+Math.random()*0.9;
  s.variant=Math.floor(Math.random()*4);
}
function pickTrafficType(){
  const r=Math.random();
  let acc=0;
  for(let i=0;i<TRAFFIC_TYPES.length;i++){acc+=TRAFFIC_TYPES[i].weight;if(r<=acc)return TRAFFIC_TYPES[i];}
  return TRAFFIC_TYPES[0];
}
function laneFree(wx,zMin){
  for(let i=0;i<enemies.length;i++){
    const e=enemies[i];
    if(e.z>zMin&&Math.abs(e.wx-wx)<0.3)return false;
  }
  return true;
}
function spawnEnemy(){
  const diff=clamp(race.dist/1700,0,1);
  const t=pickTrafficType();
  const order=[0,1,2].sort(()=>Math.random()-0.5);
  let lane=order[0];
  for(let i=0;i<order.length;i++){
    if(laneFree(LANES_W[order[i]],VIEW-34)){lane=order[i];break;}
    lane=order[i];
  }
  enemies.push({
    wx:LANES_W[lane]+(Math.random()-0.5)*0.08,
    z:VIEW-2+Math.random()*6,
    spd:t.spdMin+Math.random()*(t.spdMax-t.spdMin)+diff*2.4,
    color:CAR_COLORS[Math.floor(Math.random()*CAR_COLORS.length)],
    type:t.type,len:t.len,wdt:t.wdt,hitFlash:0
  });
}
function spawnPickup(){
  const isNitro=Math.random()<0.3;
  pickups.push({wx:LANES_W[Math.floor(Math.random()*3)]+(Math.random()-0.5)*0.1,z:VIEW-2,kind:isNitro?'nitro':'coin',seed:Math.random()*10});
}
function spawnObstacle(){
  const diff=clamp(race.dist/1700,0,1);
  const barrier=Math.random()<0.3+diff*0.15;
  const lane=Math.floor(Math.random()*3);
  obstacles.push({wx:LANES_W[lane]+(Math.random()-0.5)*0.06,z:VIEW-2,type:barrier?'barrier':'cone',seed:Math.random()*10});
}
function spawnParticle(p){
  if(LOW_GFX)return;
  if(particles.length>=80)return;
  const o=particlePool.pop()||{};
  o.x=p.x;o.y=p.y;o.vx=p.vx;o.vy=p.vy;o.life=p.life;o.maxLife=p.life;
  o.size=p.size;o.grow=p.grow||0;o.grav=p.grav||0;o.drag=p.drag||0;
  o.color=p.color;o.type=p.type||'dot';o.rot=p.rot||0;o.vr=p.vr||0;
  particles.push(o);
}
function killParticle(i){const o=particles[i];if(particlePool.length<120)particlePool.push(o);particles[i]=particles[particles.length-1];particles.pop();}
function spawnSmoke(x,y){
  spawnParticle({x:x+(Math.random()-0.5)*8,y:y,vx:(Math.random()-0.5)*36,vy:60+Math.random()*40,
    life:0.55+Math.random()*0.3,size:5+Math.random()*4,grow:26,color:'200,200,205',type:'smoke'});
}
function spawnFlame(x,y){
  spawnParticle({x:x+(Math.random()-0.5)*14,y:y,vx:(Math.random()-0.5)*60,vy:230+Math.random()*90,
    life:0.28+Math.random()*0.14,size:5+Math.random()*5,grow:-8,color:Math.random()<0.5?'255,190,60':'255,110,30',type:'flame'});
}
function spawnDebris(x,y,baseColor,n){
  const cols=[baseColor||'#888888','#2a2a33','#ffb020','#e6e6e6','#ff5533'];
  for(let i=0;i<n;i++){
    spawnParticle({x:x,y:y,vx:(Math.random()-0.5)*330,vy:(Math.random()-0.5)*330-70,
      life:0.7+Math.random()*0.4,size:2+Math.random()*4,grav:520,color:cols[Math.floor(Math.random()*cols.length)],type:'debris',rot:Math.random()*3,vr:(Math.random()-0.5)*14});
  }
}
function spawnEdgeSpark(x,y){
  spawnParticle({x:x,y:y,vx:(Math.random()-0.5)*220,vy:-Math.random()*160-30,
    life:0.32,size:2,grav:600,color:'255,220,120',type:'dot'});
}
function floatText(x,y,text,color){
  if(floats.length>=6)floats.shift();
  floats.push({x:x,y:y,text:text,color:color||'#ffd166',life:1.15});
}

/* ---------- Update ---------- */
function update(dt){
  const v=vehicle();
  const diff=clamp(race.dist/1700,0,1);
  const braking=held.brake;
  const wantNitro=(held.boost||touchBoost)&&race.nitro>0;
  if(wantNitro){race.nitro=Math.max(0,race.nitro-38*dt);race.boost=Math.max(race.boost,1.0);}
  if(race.boost>0)race.boost=Math.max(0,race.boost-dt* (wantNitro?0:1));
  const topSpeed=v.maxSpeed*(race.boost>0?1.42:1)*(braking?0.28:1);
  race.speed+=(topSpeed-race.speed)*Math.min(1,dt*(1.35+v.accel*6.5));
  race.time+=dt;
  race.dist+=race.speed*dt*2.4;
  race.trickle+=race.speed*dt*2.4;
  while(race.trickle>=100){race.trickle-=100;race.earned+=10;}
  race.startFx=Math.max(0,race.startFx-dt);
  race.shake=Math.max(0,race.shake-dt*2.2);
  race.flash=Math.max(0,race.flash-dt*2.1);
  race.invuln=Math.max(0,race.invuln-dt);
  if(player.spin>0)player.spin=Math.max(0,player.spin-dt);

  const steer=((held.right||touchRight)?1:0)-((held.left||touchLeft)?1:0);
  if(player.spin<=0){
    player.wx+=steer*dt*(1.15+v.handling*1.6);
  }
  player.wx-=curveAt(race.dist+55)*race.speed*dt*0.030;
  player.wx=clamp(player.wx,-0.92,0.92);
  const edgeScrape=Math.abs(player.wx)>0.9&&race.speed>3;
  if(edgeScrape){
    race.speed=Math.max(3,race.speed*(1-1.1*dt));
    if(!LOW_GFX&&Math.random()<0.6){
      spawnEdgeSpark(W/2+player.wx*W*0.465*0.78,H*0.805+22);
    }
  }
  player.tilt+=((steer*0.34+(player.spin>0?player.spinDir*0.7:0))-player.tilt)*Math.min(1,dt*8);

  race.spawnT-=dt;
  if(race.spawnT<=0){spawnEnemy();race.spawnT=0.72-0.40*diff+Math.random()*0.28;}
  race.pickupT-=dt;
  if(race.pickupT<=0){spawnPickup();race.pickupT=2.1+Math.random()*2.6;}
  race.obstT-=dt;
  if(race.obstT<=0){spawnObstacle();race.obstT=Math.max(0.72,2.05-1.25*diff)+Math.random()*0.7;}

  const rel=race.speed*2.4;
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    e.z-=(rel-e.spd*2.4)*dt;
    e.hitFlash=Math.max(0,(e.hitFlash||0)-dt);
    if(e.z<-3){
      race.overtakes++;race.earned+=20;
      floatText(W/2+e.wx*120,H*0.62,'+₹20 OVERTAKE','#fde047');
      if(Math.random()<0.35)sfxHorn();
      enemies.splice(i,1);continue;
    }
    if(e.z>VIEW+12){enemies.splice(i,1);continue;}
    if(e.z<4.4&&e.z>0&&Math.abs(e.wx-player.wx)<0.155+(e.wdt-0.6)*0.22){
      hitCar(e);
      if(!running)return;
    }
  }
  for(let i=pickups.length-1;i>=0;i--){
    const p=pickups[i];
    p.z-=rel*dt;
    if(p.z<0.6){pickups.splice(i,1);continue;}
    if(p.z<3.4&&Math.abs(p.wx-player.wx)<0.17){
      if(p.kind==='coin'){
        race.coins++;race.coinCount=race.coins;race.earned+=15;
        sfxCoin();
        floatText(W/2+p.wx*140,H*0.7,'+₹15','#fde047');
      }else{
        race.nitro=Math.min(100,race.nitro+35);race.boost=Math.max(race.boost,1.5);
        sfxNitro();
        floatText(W/2+p.wx*140,H*0.7,'NITRO!','#67e8f9');
      }
      pickups.splice(i,1);
    }
  }
  for(let i=obstacles.length-1;i>=0;i--){
    const o=obstacles[i];
    o.z-=rel*dt;
    if(o.z<0.6){obstacles.splice(i,1);continue;}
    if(o.z<4.0&&o.z>0&&Math.abs(o.wx-player.wx)<(o.type==='barrier'?0.21:0.115)){
      hitObstacle(o);
      if(!running)return;
      obstacles.splice(i,1);
    }
  }
  for(let i=0;i<scenery.length;i++){
    const s=scenery[i];
    s.z-=rel*dt;
    if(s.z<0.8)resetScenery(s);
  }

  if(race.boost>0){
    race.flameT-=dt;
    if(race.flameT<=0){race.flameT=0.016;const px=W/2+player.wx*W*0.465*0.78;spawnFlame(px,H*0.805+34);}
  }
  const hardSteer=Math.abs(steer)>0.55&&race.speed>vehicle().maxSpeed*0.72;
  if(hardSteer||player.spin>0){
    race.smokeT-=dt;
    if(race.smokeT<=0){
      race.smokeT=0.03;
      const px=W/2+player.wx*W*0.465*0.78;
      spawnSmoke(px-16,H*0.805+18);spawnSmoke(px+16,H*0.805+18);
    }
  }
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.vy+=p.grav*dt;
    p.vx*=(1-(p.drag||0)*dt);
    p.x+=p.vx*dt;p.y+=p.vy*dt;
    p.size+=p.grow*dt;
    p.rot+=p.vr*dt;
    p.life-=dt;
    if(p.life<=0||p.size<=0.1)killParticle(i);
  }
  for(let i=floats.length-1;i>=0;i--){
    const f=floats[i];
    f.y-=42*dt;f.life-=dt;
    if(f.life<=0)floats.splice(i,1);
  }
  updateEngine();
  hudAcc+=dt;
  if(!LOW_GFX||hudAcc>=0.25){
    hudAcc=0;
    updateHud();
  }
}
function hitCar(e){
  if(race.invuln>0)return;
  race.damage++;race.invuln=1.7;
  player.spin=1.05;player.spinDir=player.wx<e.wx?-1:1;
  race.shake=1;race.flash=0.75;
  race.speed*=0.42;
  race.boost=0;
  e.hitFlash=0.6;
  const px=W/2+player.wx*W*0.465*0.78;
  spawnDebris(px,H*0.805-10,e.color,26);
  sfxCrash();
  if(race.damage>=3){endRace(true);}else{updateHud();}
}
function hitObstacle(o){
  if(race.invuln>0)return;
  race.damage++;race.invuln=1.4;
  player.spin=o.type==='barrier'?0.9:0.6;player.spinDir=Math.random()<0.5?-1:1;
  race.shake=o.type==='barrier'?0.9:0.55;
  race.flash=0.5;
  race.speed*=o.type==='barrier'?0.38:0.62;
  race.boost=0;
  const scale=entityScale(clamp(1-o.z/VIEW,0,1));
  const px=W/2+o.wx*W*0.465*0.78;
  spawnDebris(px,H*0.8,o.type==='barrier'?'#ef4444':'#fb923c',o.type==='barrier'?16:12);
  if(o.type==='barrier')sfxCrash();else sfxThud();
  if(race.damage>=3){endRace(true);}else{updateHud();}
}
function updateHud(){
  $('hdist').textContent=Math.floor(race.dist)+' m';
  $('hcoins').textContent=race.coins;
  $('hmny').textContent=race.earned;
  $('hlevel').textContent='Lv'+state.level;
  const pips=document.querySelectorAll('#pips .pip');
  for(let i=0;i<pips.length;i++){
    if(i<3-race.damage)pips[i].classList.add('on');else pips[i].classList.remove('on');
  }
  $('nitrofill').style.width=Math.round(race.nitro)+'%';
}

/* ---------- Input ---------- */
function bindPress(el,fn){
  if(!el)return;
  el.addEventListener('touchend',function(e){
    e.preventDefault();
    unlockAudio();
    el._touchAt=Date.now();
    fn();
  },{passive:false});
  el.addEventListener('click',function(){
    if(Date.now()-(el._touchAt||0)<350)return;
    unlockAudio();
    fn();
  });
}
function bindClick(id,fn){
  bindPress($(id),fn);
}
function bindHold(id,on,off){
  const el=$(id);if(!el)return;
  const start=function(e){if(e&&e.preventDefault)e.preventDefault();unlockAudio();on();};
  const end=function(e){if(e&&e.preventDefault)e.preventDefault();off();};
  el.addEventListener('touchstart',start,{passive:false});
  el.addEventListener('touchend',end,{passive:false});
  el.addEventListener('touchcancel',end,{passive:false});
  el.addEventListener('mousedown',start);
  el.addEventListener('mouseup',end);
  el.addEventListener('mouseleave',end);
}

window.addEventListener('keydown',function(e){
  const k=e.key||'',c=e.keyCode||0;
  if(k==='m'||k==='M'){e.preventDefault();unlockAudio();toggleMute();return;}
  const driving=running&&!paused;
  if(driving){
    if(k==='ArrowLeft'||c===37||k==='4'||c===52){e.preventDefault();held.left=true;}
    else if(k==='ArrowRight'||c===39||k==='6'||c===54){e.preventDefault();held.right=true;}
    else if(k==='ArrowUp'||c===38||k==='2'||c===50){e.preventDefault();held.boost=true;}
    else if(k==='ArrowDown'||c===40||k==='8'||c===56){e.preventDefault();held.brake=true;}
    else if(k==='p'||k==='P'||k==='Escape'||c===27){e.preventDefault();togglePause();}
    return;
  }
  if(k==='ArrowDown'||c===40||k==='8'||c===56){e.preventDefault();focusStep(1);}
  else if(k==='ArrowUp'||c===38||k==='2'||c===50){e.preventDefault();focusStep(-1);}
  else if(k==='Enter'||c===13||k===' '||c===32||k==='5'||c===53||k==='SoftLeft'){e.preventDefault();activateFocused();}
  else if(k==='p'||k==='P'||k==='Escape'||c===27){if(running&&paused){e.preventDefault();togglePause();}}
});
window.addEventListener('keyup',function(e){
  const k=e.key||'',c=e.keyCode||0;
  if(k==='ArrowLeft'||c===37||k==='4'||c===52)held.left=false;
  else if(k==='ArrowRight'||c===39||k==='6'||c===54)held.right=false;
  else if(k==='ArrowUp'||c===38||k==='2'||c===50)held.boost=false;
  else if(k==='ArrowDown'||c===40||k==='8'||c===56)held.brake=false;
});

bindClick('start',startRace);
bindClick('shop',()=>{sfxClick();renderVehicles();show('shopv');});
bindClick('missions',()=>{sfxClick();renderMissions();show('missv');});
bindClick('back1',()=>{sfxClick();showMenu();});
bindClick('back2',()=>{sfxClick();showMenu();});
bindClick('retry',startRace);
bindClick('menu2',()=>{sfxClick();showMenu();});
bindClick('mute',()=>{toggleMute();});
bindClick('home',()=>{stopEngine();stopMusic();location.href='../../index.html';});
bindClick('hpause',()=>{togglePause();});
bindClick('hmute',()=>{toggleMute();});
bindClick('resume',()=>{sfxClick();togglePause();});
bindClick('restart',()=>{sfxClick();startRace();});
bindClick('quit',()=>{sfxClick();endRace(false);});

bindHold('tleft',()=>{touchLeft=true;},()=>{touchLeft=false;});
bindHold('tright',()=>{touchRight=true;},()=>{touchRight=false;});
bindHold('tnitro',()=>{touchBoost=true;},()=>{touchBoost=false;});

document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden'){
    if(running&&!paused)togglePause();
    save();
  }
});
window.addEventListener('beforeunload',save);

/* ---------- Init ---------- */
updateMuteLabels();
updateMenu();
show('menu');
save();
