/* ===== Racing - pseudo 3D ===== */
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
const KEY='racing_'+user;

const VEHICLES=[
  {name:'Starter',price:0,maxSpeed:4,accel:0.12,handling:0.62,color:'#3b82f6',desc:'Reliable city cruiser'},
  {name:'Sport',price:500,maxSpeed:5.5,accel:0.16,handling:0.76,color:'#22c55e',desc:'Balanced street racer'},
  {name:'Turbo',price:2000,maxSpeed:7,accel:0.2,handling:0.86,color:'#f59e0b',desc:'High-boost speed machine'},
  {name:'Rocket',price:8000,maxSpeed:9,accel:0.26,handling:0.96,color:'#ef4444',desc:'Top-tier hyper car'}
];
const MISSIONS=[
  {id:'lvl5',title:'Reach Level 5',target:5,type:'level',reward:300},
  {id:'money1000',title:'Earn 1000 total money',target:1000,type:'totalMoney',reward:500},
  {id:'overtake100',title:'Overtake 100 cars',target:100,type:'overtakes',reward:800},
  {id:'dist10000',title:'Drive 10000 distance',target:10000,type:'distance',reward:1000}
];

function defaultState(){
  return {user,money:0,xp:0,level:1,totalMoneyEarned:0,overtakes:0,distance:0,owned:[0],selected:0,
    missions:MISSIONS.map(m=>({id:m.id,progress:0,done:false}))};
}
function loadState(){
  let s=null;
  try{s=JSON.parse(storeGet(KEY)||'null');}catch(e){s=null;}
  if(!s||!s.user)s=defaultState();
  if(!Array.isArray(s.owned)||!s.owned.length)s.owned=[0];
  if(typeof s.selected!=='number'||s.owned.indexOf(s.selected)<0)s.selected=s.owned[0];
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
const canvas=$('c');
const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height;
const HORIZON=Math.round(H*0.31);
const ZFAR=58;
let running=false,paused=false,last=0;
const HAS_TOUCH=('ontouchstart' in window)||(navigator.maxTouchPoints>0);
const LOW_GFX=/KAIOS/i.test(navigator.userAgent||'')||((window.innerWidth||999)<=320)||((window.innerHeight||999)<=380);
let drawAcc=0,hudAcc=0;

/* ---------- Audio ---------- */
let audioCtx=null,master=null,noiseBuf=null,engine=null,musicTimer=null,musicGain=null,musicStep=0;
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
    const len=Math.floor(audioCtx.sampleRate*0.5);
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
    s.connect(f);f.connect(g);g.connect(master);
    s.start(t);s.stop(t+dur+0.02);
  }catch(e){}
}
function startEngine(){
  unlockAudio();
  if(!audioCtx||engine)return;
  try{
    const t=audioCtx.currentTime;
    const g=audioCtx.createGain();g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(0.05,t+0.5);g.connect(master);
    const lp=audioCtx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;lp.connect(g);
    const o=audioCtx.createOscillator();o.type='sawtooth';o.frequency.value=72;o.connect(lp);o.start();
    const o2=audioCtx.createOscillator();o2.type='square';o2.frequency.value=108;
    const g2=audioCtx.createGain();g2.gain.value=0.25;o2.connect(g2);g2.connect(g);o2.start();
    engine={o,o2,g,lp};
  }catch(e){engine=null;}
}
function updateEngine(){
  if(!engine||!audioCtx)return;
  try{
    const t=audioCtx.currentTime;
    const f=70+race.speed*11;
    engine.o.frequency.setTargetAtTime(f,t,0.06);
    engine.o2.frequency.setTargetAtTime(f*1.5,t,0.06);
    engine.lp.frequency.setTargetAtTime(320+race.speed*70,t,0.1);
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
function noteFreq(semi){return 220*Math.pow(2,semi/12);}
const MUSIC_NOTES=[0,7,12,7,3,10,15,10];
const MUSIC_BASS=[0,0,-5,-5,3,3,-2,-2];
function startMusic(){
  unlockAudio();
  if(!audioCtx||LOW_GFX)return;
  stopMusic();
  try{
    musicGain=audioCtx.createGain();musicGain.gain.value=0.55;musicGain.connect(master);
    musicStep=0;
    musicTimer=setInterval(()=>{
      if(!audioCtx||!musicGain)return;
      try{
        const i=musicStep++%8,t=audioCtx.currentTime;
        const o=audioCtx.createOscillator(),g=audioCtx.createGain();
        o.type='triangle';o.frequency.setValueAtTime(noteFreq(MUSIC_NOTES[i]+12),t);
        g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.045,t+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001,t+0.2);
        o.connect(g);g.connect(musicGain);o.start(t);o.stop(t+0.22);
        if(i%2===0){
          const bo=audioCtx.createOscillator(),bg=audioCtx.createGain();
          bo.type='sine';bo.frequency.setValueAtTime(noteFreq(MUSIC_BASS[i]+12)/2,t);
          bg.gain.setValueAtTime(0.0001,t);bg.gain.exponentialRampToValueAtTime(0.075,t+0.02);
          bg.gain.exponentialRampToValueAtTime(0.0001,t+0.4);
          bo.connect(bg);bg.connect(musicGain);bo.start(t);bo.stop(t+0.42);
        }else{
          noise(0.035,0.025,6500,'highpass');
        }
      }catch(e){}
    },220);
  }catch(e){}
}
function stopMusic(){
  if(musicTimer){clearInterval(musicTimer);musicTimer=null;}
  if(musicGain){try{musicGain.disconnect();}catch(e){}musicGain=null;}
}

/* ---------- Game state ---------- */
let player={lane:1,wx:0,tilt:0};
let enemies=[],coins=[],sparks=[],scenery=[];
let race={dist:0,earned:0,overtakes:0,speed:0,curve:0,curveT:0,travel:0,time:0,
  spawnT:0,coinT:0,shake:0,flash:0,startFx:0};
const LANES_W=[-0.62,0,0.62];
const CAR_COLORS=['#94a3b8','#64748b','#c2410c','#0ea5e9','#a855f7','#f43f5e','#eab308','#10b981'];

function xpNeeded(l){return Math.floor(100*Math.pow(l,1.5));}
function vehicle(){return VEHICLES[state.selected]||VEHICLES[0];}
function show(id){var list=document.querySelectorAll('.overlay');for(var i=0;i<list.length;i++)list[i].classList.add('hidden');if(id)$(id).classList.remove('hidden');}
function hideHud(){$('hud').classList.add('hidden');}
function showHud(){$('hud').classList.remove('hidden');}

function updateMenu(){
  $('userinfo').textContent='Player: '+state.user;
  $('mlevel').textContent=state.level;
  $('mxp').textContent=state.xp;
  $('mneed').textContent=xpNeeded(state.level);
  $('mmoney').textContent=state.money;
  const v=vehicle();
  const carEl=$('mcar');
  if(carEl)carEl.textContent=v.name+' · Top '+Math.round(v.maxSpeed*25)+' km/h';
}

/* ---------- Shop with previews ---------- */
function statRow(label,val,color){
  const pct=Math.round(Math.max(0.05,Math.min(1,val))*100);
  return `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${pct}%;background:${color}"></i></div><em>${pct}</em></div>`;
}
function renderVehicles(){
  const el=$('vlist');el.innerHTML='';
  const maxSpeed=Math.max.apply(null,VEHICLES.map(v=>v.maxSpeed));
  const maxAccel=Math.max.apply(null,VEHICLES.map(v=>v.accel));
  VEHICLES.forEach((v,i)=>{
    const owned=state.owned.indexOf(i)>=0;
    const sel=state.selected===i;
    const d=document.createElement('div');
    d.className='vitem'+(sel?' selected':'');
    d.innerHTML=`
      <div class="vhead">
        <canvas class="vprev" width="122" height="88"></canvas>
        <div class="vinfo">
          <b>${v.name}</b>
          <span class="vdesc">${v.desc}</span>
          <span class="vperf">Top ${Math.round(v.maxSpeed*25)} km/h · ${owned?'Owned':'$'+v.price}</span>
          ${sel?'<span class="vtag">SELECTED</span>':''}
        </div>
      </div>
      <div class="vstats">
        ${statRow('Speed',v.maxSpeed/maxSpeed,'#22c55e')}
        ${statRow('Accel',v.accel/maxAccel,'#f59e0b')}
        ${statRow('Handling',v.handling,'#3b82f6')}
      </div>`;
    drawPreview(d.querySelector('canvas'),v);
    const btn=document.createElement('button');
    if(!owned){
      btn.textContent='Buy ($'+v.price+')';
      btn.onclick=()=>{
        if(state.money>=v.price){state.money-=v.price;state.owned.push(i);save();renderVehicles();updateMenu();tone(760,0.12,'square',0.1,980);}
        else alert('Not enough money');
      };
    }else if(!sel){
      btn.textContent='Select';
      btn.onclick=()=>{state.selected=i;save();renderVehicles();updateMenu();tone(520,0.09,'square',0.08,660);};
    }else{btn.textContent='Selected';btn.disabled=true;}
    const wrap=document.createElement('div');wrap.className='vbtn';wrap.appendChild(btn);
    d.appendChild(wrap);
    el.appendChild(d);
  });
}
function drawPreview(cv,v){
  const g=cv.getContext('2d');
  const cw=cv.width,ch=cv.height;
  g.clearRect(0,0,cw,ch);
  const bg=g.createLinearGradient(0,0,0,ch);
  bg.addColorStop(0,'#2b3558');bg.addColorStop(0.6,'#1b2238');bg.addColorStop(1,'#10131f');
  g.fillStyle=bg;g.fillRect(0,0,cw,ch);
  g.fillStyle='rgba(255,255,255,.06)';
  g.beginPath();g.arc(cw*0.5,ch*0.35,cw*0.34,0,Math.PI*2);g.fill();
  g.fillStyle='rgba(0,0,0,.45)';
  g.beginPath();g.ellipse(cw/2,ch*0.86,cw*0.36,ch*0.1,0,0,Math.PI*2);g.fill();
  drawCarShape(g,cw/2,ch*0.6,cw*0.52,v.color,{});
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
    const d=document.createElement('div');d.className='mitem';
    const prog=Math.min(missionValue(def),def.target);
    const pct=Math.round(prog/def.target*100);
    d.innerHTML=`<b>${def.title}</b><span>${prog}/${def.target} · Reward $${def.reward}${m.done?' · DONE':''}</span>
      <div class="bar mini"><i style="width:${pct}%;background:${m.done?'#22c55e':'#3b82f6'}"></i></div>`;
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
      m.done=true;state.money+=def.reward;state.totalMoneyEarned+=def.reward;
      tone(900,0.20,'triangle',0.12,1200);
      setTimeout(()=>alert('Mission complete: '+def.title+' (+'+def.reward+')'),120);
    }
  });
}

/* ---------- Perspective ---------- */
function roadAtP(p){
  const cx=W/2+race.curve*(1-p)*(1-p)*90;
  const half=26+(W*0.47-26)*p;
  const y=HORIZON+(H-HORIZON)*p;
  return {p,cx,half,y};
}
function proj(z){
  const p=1/(1+Math.max(z,0)*0.16);
  return roadAtP(p);
}
function worldQuad(z1,z2,wx1,wx2,color){
  const a=proj(z1),b=proj(z2);
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.moveTo(a.cx+wx1*a.half,a.y);
  ctx.lineTo(a.cx+wx2*a.half,a.y);
  ctx.lineTo(b.cx+wx2*b.half,b.y);
  ctx.lineTo(b.cx+wx1*b.half,b.y);
  ctx.closePath();ctx.fill();
}

function initScenery(){
  scenery=[];
  const count=LOW_GFX?10:16;
  for(let i=0;i<count;i++){
    scenery.push({z:2+i*3.7,side:i%2?1:-1,type:(i*5)%3});
  }
}

function startRace(){
  unlockAudio();
  player.lane=1;player.wx=LANES_W[1];player.tilt=0;
  enemies=[];coins=[];sparks=[];
  initScenery();
  race={dist:0,earned:0,overtakes:0,speed:vehicle().maxSpeed*0.4,curve:0,curveT:Math.random()*10,
    travel:0,time:0,spawnT:0.8,coinT:0.7,shake:0,flash:0,startFx:1.3};
  running=true;paused=false;
  show(null);showHud();
  if(HAS_TOUCH)$('touch').classList.remove('hidden');
  startMusic();
  startEngine();
  tone(420,0.12,'square',0.1,760);
  last=0;
  requestAnimationFrame(loop);
}

function endRace(){
  if(!running)return;
  running=false;
  stopEngine();stopMusic();
  noise(0.5,0.35,300,'lowpass');
  tone(140,0.5,'sawtooth',0.16,60);
  race.shake=1;race.flash=1;
  state.money+=race.earned;
  state.totalMoneyEarned+=race.earned;
  state.xp+=Math.floor(race.dist/10)+race.overtakes*2;
  state.distance+=Math.floor(race.dist);
  state.overtakes+=race.overtakes;
  let leveled=false;
  while(state.xp>=xpNeeded(state.level)){state.xp-=xpNeeded(state.level);state.level++;state.money+=state.level*50;state.totalMoneyEarned+=state.level*50;leveled=true;}
  if(leveled)tone(660,0.16,'square',0.12,990);
  checkMissions();
  save();
  $('odist').textContent=Math.floor(race.dist);
  $('oearn').textContent=race.earned;
  show('over');
  hideHud();
  $('touch').classList.add('hidden');
}

function spawnEnemy(){
  const lane=Math.floor(Math.random()*3);
  enemies.push({
    wx:LANES_W[lane],
    z:ZFAR+Math.random()*10,
    spd:1.4+Math.random()*2+state.level*0.1,
    color:CAR_COLORS[Math.floor(Math.random()*CAR_COLORS.length)]
  });
}
function spawnCoin(){
  coins.push({wx:LANES_W[Math.floor(Math.random()*3)],z:ZFAR});
}
function addSparks(x,y,color){
  for(let i=0;i<10;i++){
    sparks.push({x,y,vx:(Math.random()-0.5)*160,vy:(Math.random()-0.5)*160-30,life:0.5,color});
  }
}

function update(dt){
  const v=vehicle();
  const target=v.maxSpeed+state.level*0.04;
  race.speed+=(target-race.speed)*Math.min(1,dt*2.2);
  race.curveT+=dt;
  race.curve=Math.sin(race.curveT*0.45)*0.55+Math.sin(race.curveT*0.17+1)*0.45;
  race.time+=dt;
  race.travel+=race.speed*dt*9;
  race.dist+=race.speed*dt*60;
  race.startFx=Math.max(0,race.startFx-dt);
  race.shake=Math.max(0,race.shake-dt*2.5);
  race.flash=Math.max(0,race.flash-dt*2);

  const targetW=LANES_W[player.lane];
  player.wx+=(targetW-player.wx)*Math.min(1,dt*11);
  player.tilt+=((targetW-player.wx)-player.tilt)*Math.min(1,dt*12);

  race.spawnT-=dt;
  if(race.spawnT<=0){
    spawnEnemy();
    race.spawnT=Math.max(0.5,1.25-state.level*0.045);
  }
  race.coinT-=dt;
  if(race.coinT<=0){spawnCoin();race.coinT=1.2+Math.random()*1.8;}

  const rel=Math.max(1.2,race.speed*1.1);
  enemies.forEach(e=>{e.z-=(rel-e.spd)*dt*6;});
  enemies=enemies.filter(e=>{
    if(e.z<0.4){race.overtakes++;return false;}
    return true;
  });
  coins.forEach(c=>{c.z-=rel*dt*6;});
  coins=coins.filter(c=>{
    if(c.z<0.3)return false;
    if(c.z<2.5&&Math.abs(c.wx-player.wx)<0.34){
      race.earned+=10;
      tone(980,0.09,'triangle',0.09,1400);
      const pr=proj(c.z);addSparks(pr.cx+c.wx*pr.half,pr.y,'#fde047');
      return false;
    }
    return true;
  });
  for(const e of enemies){
    if(e.z<2.3&&Math.abs(e.wx-player.wx)<0.33){endRace();return;}
  }
  scenery.forEach(s=>{
    s.z-=rel*dt*6;
    if(s.z<0.35){s.z=ZFAR+Math.random()*6;s.side=Math.random()<0.5?-1:1;s.type=Math.floor(Math.random()*3);}
  });
  sparks.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=260*dt;p.life-=dt;});
  sparks=sparks.filter(p=>p.life>0);

  updateEngine();
  hudAcc+=dt;
  if(!LOW_GFX||hudAcc>=0.25){
    hudAcc=0;
    $('hlevel').textContent='Lv'+state.level;
    $('hscore').textContent='Dist '+Math.floor(race.dist);
    $('hmny').textContent='$'+race.earned;
  }
}

/* ---------- Drawing helpers ---------- */
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
  let c=String(hex||'#888').replace('#','');
  if(c.length===3)c=c.split('').map(ch=>ch+ch).join('');
  const n=parseInt(c,16)||0;
  const clamp=v=>Math.max(0,Math.min(255,Math.round(v)));
  return 'rgb('+clamp(((n>>16)&255)+255*amt)+','+clamp(((n>>8)&255)+255*amt)+','+clamp((n&255)+255*amt)+')';
}

function drawCarShape(g,x,y,w,color,opts){
  opts=opts||{};
  const h=w*1.55;
  g.save();
  g.translate(x,y);

  if(LOW_GFX){
    g.fillStyle='rgba(0,0,0,.5)';
    g.beginPath();g.ellipse(0,h*0.42,w*0.62,w*0.18,0,0,Math.PI*2);g.fill();
    g.fillStyle='#08080b';
    rr(g,-w*0.51,h*0.12,w*0.18,h*0.44,w*0.06);g.fill();
    rr(g,w*0.33,h*0.12,w*0.18,h*0.44,w*0.06);g.fill();
    g.fillStyle=color;
    rr(g,-w*0.46,-h*0.34,w*0.92,h*0.74,w*0.16);g.fill();
    g.fillStyle=shade(color,-0.3);
    rr(g,-w*0.34,-h*0.52,w*0.68,h*0.36,w*0.10);g.fill();
    g.fillStyle='#6fa8d8';
    rr(g,-w*0.27,-h*0.48,w*0.54,h*0.24,w*0.06);g.fill();
    g.fillStyle='rgba(255,60,60,.9)';
    rr(g,-w*0.40,h*0.02,w*0.22,h*0.11,w*0.03);g.fill();
    rr(g,w*0.18,h*0.02,w*0.22,h*0.11,w*0.03);g.fill();
    if(opts.player){
      g.fillStyle='rgba(255,140,40,.85)';
      g.beginPath();
      g.moveTo(-w*0.16,h*0.28);g.lineTo(0,h*0.28+w*0.3);g.lineTo(w*0.16,h*0.28);
      g.closePath();g.fill();
    }
    g.restore();
    return;
  }

  g.fillStyle='rgba(0,0,0,.5)';
  g.beginPath();g.ellipse(0,h*0.42,w*0.62,w*0.18,0,0,Math.PI*2);g.fill();

  for(const sx of [-1,1]){
    g.fillStyle='#08080b';
    rr(g,sx*w*0.42-w*0.09,h*0.12,w*0.18,h*0.44,w*0.06);g.fill();
    g.fillStyle='#24242e';
    rr(g,sx*w*0.42-w*0.05,h*0.22,w*0.10,h*0.24,w*0.03);g.fill();
  }

  let bodyG=g.createLinearGradient(-w*0.5,0,w*0.5,0);
  bodyG.addColorStop(0,shade(color,-0.45));
  bodyG.addColorStop(0.34,shade(color,-0.02));
  bodyG.addColorStop(0.55,shade(color,0.2));
  bodyG.addColorStop(1,shade(color,-0.5));
  g.fillStyle=bodyG;
  rr(g,-w*0.46,-h*0.34,w*0.92,h*0.74,w*0.16);g.fill();

  const roofG=g.createLinearGradient(0,-h*0.52,0,-h*0.1);
  roofG.addColorStop(0,shade(color,0.08));
  roofG.addColorStop(1,shade(color,-0.28));
  g.fillStyle=roofG;
  rr(g,-w*0.34,-h*0.52,w*0.68,h*0.36,w*0.10);g.fill();

  const winG=g.createLinearGradient(0,-h*0.5,0,-h*0.2);
  winG.addColorStop(0,'rgba(150,210,255,.9)');
  winG.addColorStop(1,'rgba(28,58,100,.95)');
  g.fillStyle=winG;
  rr(g,-w*0.27,-h*0.48,w*0.54,h*0.24,w*0.06);g.fill();
  g.fillStyle='rgba(255,255,255,.22)';
  rr(g,-w*0.22,-h*0.46,w*0.44,h*0.05,w*0.02);g.fill();

  g.fillStyle=shade(color,-0.34);
  rr(g,-w*0.44,-h*0.42,w*0.88,w*0.07,w*0.025);g.fill();

  g.fillStyle=shade(color,-0.36);
  rr(g,-w*0.48,h*0.22,w*0.96,h*0.15,w*0.05);g.fill();

  const glow=opts.brake?1:0.72;
  g.fillStyle='rgba(255,60,60,'+glow+')';
  rr(g,-w*0.40,h*0.02,w*0.22,h*0.11,w*0.03);g.fill();
  rr(g,w*0.18,h*0.02,w*0.22,h*0.11,w*0.03);g.fill();
  g.fillStyle='rgba(255,215,130,.9)';
  rr(g,-w*0.40,h*0.13,w*0.09,h*0.05,w*0.02);g.fill();
  rr(g,w*0.31,h*0.13,w*0.09,h*0.05,w*0.02);g.fill();

  g.strokeStyle='rgba(255,255,255,.16)';
  g.lineWidth=Math.max(1,w*0.018);
  rr(g,-w*0.46,-h*0.34,w*0.92,h*0.74,w*0.16);g.stroke();

  if(opts.player){
    const fl=w*(0.3+Math.random()*0.5);
    const fg=g.createLinearGradient(0,h*0.30,0,h*0.30+fl);
    fg.addColorStop(0,'rgba(255,230,140,.95)');
    fg.addColorStop(0.5,'rgba(255,120,20,.7)');
    fg.addColorStop(1,'rgba(255,60,0,0)');
    g.fillStyle=fg;
    g.beginPath();
    g.moveTo(-w*0.16,h*0.28);g.lineTo(0,h*0.28+fl);g.lineTo(w*0.16,h*0.28);
    g.closePath();g.fill();
  }
  g.restore();
}
function drawCar(x,y,w,color,opts){drawCarShape(ctx,x,y,w,color,opts);}

function drawCoin(x,y,w){
  const r=Math.max(3,w*0.5);
  ctx.save();ctx.translate(x,y);
  ctx.translate(0,Math.sin(race.time*4+x*0.05)*2);
  if(LOW_GFX){
    ctx.fillStyle='#fbbf24';
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle='rgba(0,0,0,.35)';
  ctx.beginPath();ctx.ellipse(0,r*0.9,r*0.85,r*0.3,0,0,Math.PI*2);ctx.fill();
  const g=ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.1,0,0,r);
  g.addColorStop(0,'#fff6bd');g.addColorStop(0.5,'#fbbf24');g.addColorStop(1,'#b45309');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
  if(r>6){
    ctx.fillStyle='#7c4a03';
    ctx.font='bold '+Math.round(r*1.1)+'px sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('$',0,1);
  }
  ctx.restore();
}

function drawTree(x,y,scl){
  const s=18*scl+2;
  ctx.fillStyle='#3b2a16';
  ctx.fillRect(x-s*0.08,y-s*0.9,s*0.16,s*0.9);
  if(LOW_GFX){
    ctx.fillStyle='#15803d';
    ctx.beginPath();ctx.arc(x,y-s*1.15,s,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(x-s*0.7,y-s*0.9,s*0.62,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(x+s*0.7,y-s*0.95,s*0.66,0,Math.PI*2);ctx.fill();
    return;
  }
  const g=ctx.createRadialGradient(x-s*0.25,y-s*1.3,s*0.1,x,y-s*1.1,s);
  g.addColorStop(0,'#4ade80');g.addColorStop(0.6,'#15803d');g.addColorStop(1,'#0b3d1e');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.arc(x,y-s*1.15,s,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(x-s*0.7,y-s*0.9,s*0.62,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(x+s*0.7,y-s*0.95,s*0.66,0,Math.PI*2);ctx.fill();
}
function drawLamp(x,y,scl){
  const s=22*scl+1;
  ctx.strokeStyle='#4b5563';ctx.lineWidth=Math.max(1,s*0.12);
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-s*2.2);ctx.stroke();
  ctx.fillStyle='#6b7280';
  ctx.fillRect(x-s*0.5,y-s*2.4,s,s*0.2);
  if(LOW_GFX){
    ctx.fillStyle='rgba(255,235,160,.55)';
    ctx.beginPath();ctx.arc(x,y-s*2.1,s*0.9,0,Math.PI*2);ctx.fill();
    return;
  }
  const g=ctx.createRadialGradient(x,y-s*2.1,1,x,y-s*2.1,s*1.4);
  g.addColorStop(0,'rgba(255,235,160,.8)');g.addColorStop(1,'rgba(255,235,160,0)');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.arc(x,y-s*2.1,s*1.4,0,Math.PI*2);ctx.fill();
}
function drawBuilding(x,y,scl,side){
  const w=26*scl+2,h=(34+((x|0)%20))*scl+4;
  const bx=x-(side>0?w:0);
  ctx.fillStyle='#2a2f45';
  ctx.fillRect(bx,y-h,w,h);
  if(!LOW_GFX){
    ctx.fillStyle='rgba(120,150,220,.25)';
    for(let r=0;r<4;r++)for(let c=0;c<3;c++){
      if(Math.random()<0.75)continue;
      ctx.fillRect(bx+w*(0.15+c*0.28),y-h+h*(0.12+r*0.2),w*0.13,h*0.1);
    }
  }
}

function drawSky(){
  if(LOW_GFX){
    ctx.fillStyle='#0d1b33';ctx.fillRect(0,0,W,HORIZON+40);
    const sx=W/2-race.curve*55,sy=HORIZON-26;
    ctx.fillStyle='#d99a55';
    ctx.beginPath();ctx.arc(sx,sy,16,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#141f38';
    const mountOff=(race.curveT*8)%160;
    for(let i=-1;i<5;i++){
      const x2=i*70+(W/2-mountOff);
      ctx.beginPath();
      ctx.moveTo(x2-60,HORIZON+4);
      ctx.lineTo(x2,HORIZON-32-((i*17)%22));
      ctx.lineTo(x2+66,HORIZON+4);
      ctx.closePath();ctx.fill();
    }
    ctx.fillStyle='#0d2a18';ctx.fillRect(0,HORIZON,W,H-HORIZON);
    return;
  }
  const sky=ctx.createLinearGradient(0,0,0,HORIZON+30);
  sky.addColorStop(0,'#081228');
  sky.addColorStop(0.5,'#1d3a6b');
  sky.addColorStop(1,'#f2a95f');
  ctx.fillStyle=sky;ctx.fillRect(0,0,W,HORIZON+40);

  const sx=W/2-race.curve*55,sy=HORIZON-26;
  const sun=ctx.createRadialGradient(sx,sy,2,sx,sy,90);
  sun.addColorStop(0,'rgba(255,230,160,.95)');
  sun.addColorStop(0.35,'rgba(255,190,110,.4)');
  sun.addColorStop(1,'rgba(255,170,90,0)');
  ctx.fillStyle=sun;
  ctx.beginPath();ctx.arc(sx,sy,90,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,240,200,.95)';
  ctx.beginPath();ctx.arc(sx,sy,13,0,Math.PI*2);ctx.fill();

  const mountOff=((race.curveT*8)%160);
  ctx.fillStyle='#141f38';
  for(let i=-1;i<5;i++){
    const bx=i*70+ (W/2 - mountOff);
    ctx.beginPath();
    ctx.moveTo(bx-60,HORIZON+4);
    ctx.lineTo(bx,HORIZON-32-((i*17)%22));
    ctx.lineTo(bx+66,HORIZON+4);
    ctx.closePath();ctx.fill();
  }

  const grass=ctx.createLinearGradient(0,HORIZON,0,H);
  grass.addColorStop(0,'#12351f');grass.addColorStop(1,'#08200f');
  ctx.fillStyle=grass;ctx.fillRect(0,HORIZON,W,H-HORIZON);
}

function drawRoad(){
  const steps=LOW_GFX?18:38;
  ctx.beginPath();
  for(let i=0;i<=steps;i++){const r=roadAtP(i/steps);const x=r.cx-r.half;if(i===0)ctx.moveTo(x,r.y);else ctx.lineTo(x,r.y);}
  for(let i=steps;i>=0;i--){const r=roadAtP(i/steps);ctx.lineTo(r.cx+r.half,r.y);}
  ctx.closePath();
  if(LOW_GFX){
    ctx.fillStyle='#2c2c36';ctx.fill();
  }else{
    const rg=ctx.createLinearGradient(0,HORIZON,0,H);
    rg.addColorStop(0,'#3c3c48');
    rg.addColorStop(0.15,'#33333e');
    rg.addColorStop(1,'#191920');
    ctx.fillStyle=rg;ctx.fill();
  }

  for(const sgn of [-1,1]){
    for(let i=0;i<steps;i++){
      const a=roadAtP(i/steps),b=roadAtP((i+1)/steps);
      const on=Math.floor(i*0.6-race.travel*0.5)%2===0;
      ctx.fillStyle=on?'#e6e6e6':'#c0392b';
      const wa=Math.max(1,a.half*0.035),wb=Math.max(1,b.half*0.035);
      ctx.beginPath();
      ctx.moveTo(a.cx+sgn*a.half,a.y);
      ctx.lineTo(b.cx+sgn*b.half,b.y);
      ctx.lineTo(b.cx+sgn*(b.half-wb),b.y);
      ctx.lineTo(a.cx+sgn*(a.half-wa),a.y);
      ctx.closePath();ctx.fill();
    }
  }

  const cyc=5.0,dash=2.4,off=race.travel%cyc;
  for(let z=ZFAR-off;z>0.6;z-=cyc){
    worldQuad(z,z-dash,-1/3-0.024,-1/3+0.024,'rgba(240,240,240,.8)');
    worldQuad(z,z-dash,1/3-0.024,1/3+0.024,'rgba(240,240,240,.8)');
  }

  const hz=ctx.createLinearGradient(0,HORIZON-12,0,HORIZON+28);
  hz.addColorStop(0,'rgba(242,169,95,0)');
  hz.addColorStop(1,'rgba(242,169,95,.22)');
  ctx.fillStyle=hz;ctx.fillRect(0,HORIZON-12,W,40);
}

function drawScenery(){
  const list=scenery.slice().sort((a,b)=>b.z-a.z);
  list.forEach(s=>{
    const pr=proj(s.z);
    const x=pr.cx+s.side*1.5*pr.half;
    if(x<-40||x>W+40)return;
    if(s.type===0)drawTree(x,pr.y,pr.p);
    else if(s.type===1)drawLamp(x,pr.y,pr.p);
    else drawBuilding(x,pr.y,pr.p,s.side);
  });
}

function drawPlayer(){
  const v=vehicle();
  const bottom=roadAtP(1);
  const x=W/2+player.wx*bottom.half;
  const y=H-58;
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(player.tilt*0.13);
  drawCar(0,0,52,v.color,{player:true});
  ctx.restore();
}

function drawSpeedLines(){
  const n=LOW_GFX?4:Math.min(18,Math.floor(race.speed*1.8));
  ctx.strokeStyle='rgba(255,255,255,.13)';
  ctx.lineWidth=1.2;
  for(let i=0;i<n;i++){
    const x=Math.random()*W;
    const y=HORIZON+Math.random()*(H-HORIZON);
    const len=6+Math.random()*20;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+len);ctx.stroke();
  }
}

function draw(){
  ctx.save();
  if(race.shake>0)ctx.translate((Math.random()-0.5)*race.shake*12,(Math.random()-0.5)*race.shake*12);

  drawSky();
  drawRoad();
  drawScenery();

  const ents=[];
  enemies.forEach(e=>ents.push({z:e.z,kind:'car',e}));
  coins.forEach(c=>ents.push({z:c.z,kind:'coin',e:c}));
  ents.sort((a,b)=>b.z-a.z);
  ents.forEach(o=>{
    const pr=proj(o.e.z);
    const x=pr.cx+o.e.wx*pr.half;
    if(o.kind==='car')drawCar(x,pr.y,50*pr.p,o.e.color,{});
    else drawCoin(x,pr.y,22*pr.p);
  });

  sparks.forEach(p=>{
    ctx.globalAlpha=Math.max(0,p.life*2);
    ctx.fillStyle=p.color;
    ctx.fillRect(p.x-1.5,p.y-1.5,3,3);
    ctx.globalAlpha=1;
  });

  drawPlayer();
  if(!LOW_GFX)drawSpeedLines();
  ctx.restore();

  if(!LOW_GFX){
    const vg=ctx.createRadialGradient(W/2,H/2,H*0.32,W/2,H/2,H*0.8);
    vg.addColorStop(0,'rgba(0,0,0,0)');
    vg.addColorStop(1,'rgba(0,0,0,.42)');
    ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
  }

  if(race.flash>0){
    ctx.fillStyle='rgba(255,80,60,'+(race.flash*0.45)+')';
    ctx.fillRect(0,0,W,H);
  }
  if(race.startFx>0){
    const k=1-race.startFx/1.3;
    const s=1+k*0.6;
    ctx.save();
    ctx.translate(W/2,H*0.42);
    ctx.scale(s,s);
    ctx.globalAlpha=Math.min(1,race.startFx*1.5);
    ctx.fillStyle='#fff';
    ctx.font='bold 44px system-ui,sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.shadowColor='#3b82f6';ctx.shadowBlur=22;
    ctx.fillText('GO!',0,0);
    ctx.restore();
  }

  if(paused){
    ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fff';ctx.font='bold 22px system-ui,sans-serif';
    ctx.textAlign='center';
    ctx.fillText('PAUSED',W/2,H/2);
    ctx.font='11px system-ui,sans-serif';ctx.fillStyle='#bbb';
    ctx.fillText('Press P / tap to resume',W/2,H/2+22);
    ctx.textAlign='left';
  }
}

function loop(ts){
  if(!running)return;
  if(paused){last=ts;requestAnimationFrame(loop);return;}
  const dt=last?Math.min((ts-last)/1000,0.05):0.016;
  last=ts;
  update(dt);
  if(!running)return;
  drawAcc+=dt;
  if(!LOW_GFX||drawAcc>=0.033){
    drawAcc=0;
    draw();
  }
  requestAnimationFrame(loop);
}

function togglePause(){
  if(!running)return;
  paused=!paused;
  if(paused){stopEngine();stopMusic();}
  else{startEngine();startMusic();}
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

window.addEventListener('keydown',e=>{
  const k=e.key||'',c=e.keyCode||0;
  if(!running){
    if(k==='ArrowDown'||c===40||k==='8'||c===56){e.preventDefault();focusStep(1);}
    else if(k==='ArrowUp'||c===38||k==='2'||c===50){e.preventDefault();focusStep(-1);}
    else if(k==='Enter'||c===13||k===' '||c===32||k==='SoftLeft'||c===53){e.preventDefault();activateFocused();}
    return;
  }
  if(k==='ArrowLeft'||c===37||k==='4'||c===52){e.preventDefault();if(player.lane>0){player.lane--;tone(420,0.05,'square',0.05);}}
  if(k==='ArrowRight'||c===39||k==='6'||c===54){e.preventDefault();if(player.lane<2){player.lane++;tone(420,0.05,'square',0.05);}}
  if(k==='p'||k==='P'||k==='Escape'||k==='SoftRight')togglePause();
});
function moveLeft(){if(running&&!paused&&player.lane>0){player.lane--;tone(420,0.05,'square',0.05);}}
function moveRight(){if(running&&!paused&&player.lane<2){player.lane++;tone(420,0.05,'square',0.05);}}
const tleft=$('tleft'),tright=$('tright');
if(tleft){
  tleft.addEventListener('touchstart',e=>{e.preventDefault();unlockAudio();moveLeft();},{passive:false});
  tleft.addEventListener('mousedown',e=>{unlockAudio();moveLeft();});
}
if(tright){
  tright.addEventListener('touchstart',e=>{e.preventDefault();unlockAudio();moveRight();},{passive:false});
  tright.addEventListener('mousedown',e=>{unlockAudio();moveRight();});
}

function bindClick(id,fn){
  const el=$(id);if(!el)return;
  el.addEventListener('click',fn);
}
bindClick('start',startRace);
bindClick('shop',()=>{unlockAudio();tone(500,0.07,'square',0.06);renderVehicles();show('shopv');});
bindClick('missions',()=>{unlockAudio();renderMissions();show('missv');});
bindClick('back1',()=>{updateMenu();show('menu');});
bindClick('back2',()=>{updateMenu();show('menu');});
bindClick('retry',startRace);
bindClick('menu2',()=>{updateMenu();show('menu');});
bindClick('home',()=>{stopEngine();stopMusic();location.href='../../index.html';});

updateMenu();
show('menu');
save();
