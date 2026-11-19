/* ===== Hill Climb ===== */
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
const KEY='hillclimb_'+user;

const UPGRADES=[
  {key:'engine',name:'Engine',desc:'More power, climbs steeper hills',costs:[250,600,1200,2000,3200]},
  {key:'tires',name:'Tires',desc:'Better grip and braking force',costs:[200,500,1000,1800,2800]},
  {key:'suspension',name:'Suspension',desc:'Stiffer springs, smoother ride',costs:[200,500,1000,1800,2800]},
  {key:'tank',name:'Fuel Tank',desc:'Bigger tank, longer range',costs:[250,600,1200,2000,3200]}
];
const MISSIONS=[
  {id:'lvl5',title:'Reach Level 5',target:5,type:'level',reward:300},
  {id:'dist10k',title:'Drive 10 km total',target:10000,type:'distance',reward:1000},
  {id:'money5000',title:'Earn $5000 total',target:5000,type:'totalMoney',reward:800},
  {id:'coins300',title:'Collect 300 coins',target:300,type:'coins',reward:600},
  {id:'best1000',title:'Reach 1000m in one run',target:1000,type:'best',reward:1200}
];

function defaultState(){
  return {user,money:0,xp:0,level:1,distance:0,best:0,totalMoneyEarned:0,coinsCollected:0,
    owned:{engine:0,tires:0,suspension:0,tank:0},
    missions:MISSIONS.map(m=>({id:m.id,progress:0,done:false}))};
}
function loadState(){
  let s=null;
  try{s=JSON.parse(storeGet(KEY)||'null');}catch(e){s=null;}
  if(!s||!s.user)s=defaultState();
  if(typeof s.money!=='number'||!isFinite(s.money))s.money=0;
  if(typeof s.xp!=='number'||!isFinite(s.xp))s.xp=0;
  if(typeof s.level!=='number'||!isFinite(s.level)||s.level<1)s.level=1;
  if(typeof s.distance!=='number'||!isFinite(s.distance))s.distance=0;
  if(typeof s.best!=='number'||!isFinite(s.best))s.best=0;
  if(typeof s.totalMoneyEarned!=='number'||!isFinite(s.totalMoneyEarned))s.totalMoneyEarned=0;
  if(typeof s.coinsCollected!=='number'||!isFinite(s.coinsCollected))s.coinsCollected=0;
  if(!s.owned||typeof s.owned!=='object')s.owned={engine:0,tires:0,suspension:0,tank:0};
  UPGRADES.forEach(u=>{
    let v=s.owned[u.key];
    if(typeof v!=='number'||!isFinite(v))v=0;
    s.owned[u.key]=Math.max(0,Math.min(5,Math.floor(v)));
  });
  if(!Array.isArray(s.missions))s.missions=[];
  MISSIONS.forEach(def=>{
    if(!s.missions.some(m=>m&&m.id===def.id))s.missions.push({id:def.id,progress:0,done:false});
    const m=s.missions.find(m=>m&&m.id===def.id);
    if(m){m.type=def.type;m.target=def.target;m.reward=def.reward;m.title=def.title;
      if(typeof m.progress!=='number'||!isFinite(m.progress))m.progress=0;m.done=!!m.done;}
  });
  return s;
}
let state=loadState();
function save(){storeSet(KEY,JSON.stringify(state));}

const $=id=>document.getElementById(id);
const canvas=$('c');
const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height;
let running=false,paused=false,last=0;
const HAS_TOUCH=('ontouchstart' in window)||(navigator.maxTouchPoints>0);
const LOW_GFX=/KAIOS/i.test(navigator.userAgent||'')||((window.innerWidth||999)<=320)||((window.innerHeight||999)<=380);
let hudAcc=0,drawAcc=0;
let MUTED=false;
try{MUTED=storeGet('hillclimb_muted')==='1';}catch(e){}

/* ---------- Audio ---------- */
let audioCtx=null,master=null,noiseBuf=null,engine=null,musicTimer=null,musicGain=null,musicStep=0;
function unlockAudio(){
  try{
    if(!audioCtx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;
      audioCtx=new AC();
      master=audioCtx.createGain();master.gain.value=MUTED?0:0.85;master.connect(audioCtx.destination);
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
    g.gain.exponentialRampToValueAtTime(0.05,t+0.4);g.connect(master);
    const lp=audioCtx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=400;lp.connect(g);
    const o=audioCtx.createOscillator();o.type='sawtooth';o.frequency.value=64;o.connect(lp);o.start();
    const o2=audioCtx.createOscillator();o2.type='square';o2.frequency.value=96;
    const g2=audioCtx.createGain();g2.gain.value=0.22;o2.connect(g2);g2.connect(g);o2.start();
    engine={o,o2,g,lp};
  }catch(e){engine=null;}
}
function updateEngine(){
  if(!engine||!audioCtx)return;
  try{
    const t=audioCtx.currentTime;
    const spd=Math.abs(car.vx);
    const f=58+spd*0.22+(input.gas?22:0);
    engine.o.frequency.setTargetAtTime(f,t,0.08);
    engine.o2.frequency.setTargetAtTime(f*1.5,t,0.08);
    engine.lp.frequency.setTargetAtTime(300+spd*1.1+(input.gas?220:0),t,0.1);
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
  if(!audioCtx||LOW_GFX||MUTED)return;
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
        g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.045,t+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001,t+0.22);
        o.connect(g);g.connect(musicGain);o.start(t);o.stop(t+0.24);
        if(i%2===0){
          const bo=audioCtx.createOscillator(),bg=audioCtx.createGain();
          bo.type='sine';bo.frequency.setValueAtTime(noteFreq(MUSIC_BASS[i]+12)/2,t);
          bg.gain.setValueAtTime(0.0001,t);bg.gain.exponentialRampToValueAtTime(0.07,t+0.02);
          bg.gain.exponentialRampToValueAtTime(0.0001,t+0.4);
          bo.connect(bg);bg.connect(musicGain);bo.start(t);bo.stop(t+0.42);
        }
      }catch(e){}
    },240);
  }catch(e){}
}
function stopMusic(){
  if(musicTimer){clearInterval(musicTimer);musicTimer=null;}
  if(musicGain){try{musicGain.disconnect();}catch(e){}musicGain=null;}
}
function setMuted(m){
  MUTED=!!m;
  try{storeSet('hillclimb_muted',MUTED?'1':'0');}catch(e){}
  try{if(master)master.gain.value=MUTED?0:0.85;}catch(e){}
  const b=$('mutebtn');if(b)b.innerHTML=MUTED?'&#128263;':'&#128266;';
  if(MUTED)stopMusic();
}

/* ---------- Physics / world ---------- */
const PX_M=14;
const GRAV=1500;
const WHEEL_BASE=60,WHEEL_R=12,REST_LEN=15;
const ROT_I=0.00018;
let terrainSeed=1;
function hash1(n){const s=Math.sin(n*127.1+terrainSeed*311.7)*43758.5453;return s-Math.floor(s);}
function noise1(x){
  const i=Math.floor(x),f=x-i;
  const u=f*f*(3-2*f);
  return hash1(i)*(1-u)+hash1(i+1)*u;
}
function elevRaw(x){
  let e=Math.sin(x*0.0035+terrainSeed)*118
       +Math.sin(x*0.0093+terrainSeed*1.7+2.1)*56
       +Math.sin(x*0.021+terrainSeed*2.3+4.2)*17
       +Math.sin(x*0.047+terrainSeed*3.1+1.3)*6;
  e+=(noise1(x*0.0016+terrainSeed*7)-0.5)*175;
  e+=(noise1(x*0.0081+terrainSeed*13)-0.5)*44;
  return e;
}
function elevAt(x){
  const diff=Math.max(0.35,Math.min(1,0.35+Math.max(0,x)/2100));
  return elevRaw(x)*diff;
}
function groundY(x){return -elevAt(x);}
function slopeAt(x){return (groundY(x+4)-groundY(x-4))/8;}

let car={x:0,y:0,vx:0,vy:0,angle:0,angVel:0,wheelSpin:0,grounded:false,roofTimer:0,fuelEmptyT:0,
  wheels:[{x:0,y:0},{x:0,y:0}],compression:[0,0]};
let routeCoins=[],canisters=[],dust=[];
let nextCoinX=0,nextFuelX=0;
let camX=0,camY=0;
let runDist=0,runCoins=0,runEarned=0,fuel=100,fuelCap=100;
let input={gas:false,brake:false};
const clouds=[];
for(let i=0;i<6;i++)clouds.push({x:Math.random()*720-180,y:24+Math.random()*120,s:0.6+Math.random()*0.9,v:2+Math.random()*3});

function normAngle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
function rotX(x,y,a){return x*Math.cos(a)-y*Math.sin(a);}
function rotY(x,y,a){return x*Math.sin(a)+y*Math.cos(a);}
function xpNeeded(l){return l*100;}
function engineMult(){return 1+0.18*state.owned.engine;}
function gripMult(){return 1+0.12*state.owned.tires;}
function suspensionMult(){return 1+0.25*state.owned.suspension;}
function tankCapacity(){return 100+45*state.owned.tank;}

function show(id){var list=document.querySelectorAll('.overlay');for(var i=0;i<list.length;i++)list[i].classList.add('hidden');if(id){$(id).classList.remove('hidden');var b=$(id).querySelector('button');if(b){try{b.focus();}catch(e){}}}}
function showHud(){$('hud').classList.remove('hidden');}
function hideHud(){$('hud').classList.add('hidden');}

function updateMenu(){
  $('userinfo').textContent='Player: '+state.user;
  $('mlevel').textContent=state.level;
  $('mxp').textContent=Math.floor(state.xp);
  $('mneed').textContent=xpNeeded(state.level);
  $('mmoney').textContent=state.money;
  $('mbest').textContent=Math.floor(state.best);
}

function statPips(lvl){
  let h='<div class="upip">';
  for(let i=0;i<5;i++)h+='<div class="pip'+(i<lvl?' on':'')+'"></div>';
  return h+'</div>';
}
function renderUpgrades(){
  $('upmoney').textContent='Money: $'+state.money;
  const el=$('ulist');el.innerHTML='';
  UPGRADES.forEach(u=>{
    const lvl=state.owned[u.key];
    const maxed=lvl>=5;
    const cost=maxed?0:u.costs[lvl];
    const d=document.createElement('div');
    d.className='uitem'+(maxed?' maxed':'');
    d.innerHTML='<b>'+u.name+' <span style="color:#7fd0ff">Lv '+lvl+'/5</span></b>'+
      '<span>'+u.desc+'</span>'+statPips(lvl);
    const btn=document.createElement('button');
    if(maxed){btn.textContent='MAXED OUT';btn.disabled=true;}
    else{
      btn.textContent='Upgrade ($'+cost+')';
      btn.onclick=()=>{
        unlockAudio();
        if(state.money>=cost){
          state.money-=cost;state.owned[u.key]=lvl+1;save();renderUpgrades();updateMenu();
          tone(760,0.12,'square',0.1,980);
        }else{
          tone(200,0.15,'sawtooth',0.08,120);
        }
      };
    }
    d.appendChild(btn);
    el.appendChild(d);
  });
}

function missionValue(def){
  if(def.type==='level')return state.level;
  if(def.type==='totalMoney')return state.totalMoneyEarned;
  if(def.type==='distance')return state.distance;
  if(def.type==='coins')return state.coinsCollected;
  if(def.type==='best')return state.best;
  return 0;
}
function renderMissions(){
  const el=$('mlist');el.innerHTML='';
  state.missions.forEach(m=>{
    const def=MISSIONS.find(x=>x.id===m.id);
    if(!def)return;
    const d=document.createElement('div');d.className='mitem';
    const prog=Math.min(Math.floor(missionValue(def)),def.target);
    const pct=Math.round(prog/def.target*100);
    d.innerHTML='<b>'+def.title+'</b><span>'+prog+'/'+def.target+' &middot; Reward $'+def.reward+(m.done?' &middot; DONE':'')+'</span>'+
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
      m.done=true;state.money+=def.reward;state.totalMoneyEarned+=def.reward;
      tone(900,0.20,'triangle',0.12,1200);
      setTimeout(()=>{try{alert('Mission complete: '+def.title+' (+'+def.reward+')');}catch(e){}},150);
    }
  });
}

function resetCar(){
  terrainSeed=Math.random()*100+1;
  const gy=groundY(0);
  car={x:0,y:gy-40,vx:0,vy:0,angle:0,angVel:0,wheelSpin:0,grounded:false,roofTimer:0,fuelEmptyT:0,
    wheels:[{x:-WHEEL_BASE/2,y:gy-10},{x:WHEEL_BASE/2,y:gy-10}],compression:[0,0]};
  routeCoins=[];canisters=[];dust=[];
  nextCoinX=340;nextFuelX=1150;
  camX=car.x-W*0.34;camY=car.y-H*0.55;
  runDist=0;runCoins=0;runEarned=0;
  fuelCap=tankCapacity();fuel=fuelCap;
  input.gas=false;input.brake=false;
}

function startRun(){
  unlockAudio();
  resetCar();
  running=true;paused=false;
  show(null);showHud();
  if(HAS_TOUCH)$('touch').classList.remove('hidden');
  startMusic();
  startEngine();
  tone(420,0.12,'square',0.1,760);
  last=0;
  updateHud();
  requestAnimationFrame(loop);
}

function endRun(reason){
  if(!running)return;
  running=false;
  stopEngine();stopMusic();
  if(reason==='Wrecked!'){noise(0.6,0.4,240,'lowpass');tone(120,0.6,'sawtooth',0.16,50);}
  else tone(340,0.4,'sine',0.12,180);
  const distM=Math.max(0,Math.floor(car.x/PX_M));
  runEarned=runCoins*10+Math.floor(distM/4);
  state.money+=runEarned;
  state.totalMoneyEarned+=runEarned;
  state.coinsCollected+=runCoins;
  state.distance+=distM;
  if(distM>state.best)state.best=distM;
  state.xp+=Math.floor(distM/10)+runCoins*2;
  let leveled=false;
  while(state.xp>=xpNeeded(state.level)){
    state.xp-=xpNeeded(state.level);state.level++;
    state.money+=state.level*50;state.totalMoneyEarned+=state.level*50;leveled=true;
  }
  if(leveled){tone(660,0.16,'square',0.12,990);setTimeout(()=>tone(880,0.22,'square',0.12,1320),140);}
  checkMissions();
  save();
  $('otitle').textContent=reason;
  $('odist').textContent=distM;
  $('obest').textContent=Math.floor(state.best);
  $('ocoins').textContent=runCoins;
  $('oearn').textContent=runEarned;
  show('over');
  hideHud();
  $('touch').classList.add('hidden');
}

function spawnAhead(){
  const ahead=car.x+W+420;
  while(nextCoinX<ahead){
    for(let k=-1;k<=1;k++){
      const cx=nextCoinX+k*30;
      routeCoins.push({x:cx,y:groundY(cx)-36-(1-Math.abs(k))*15});
    }
    nextCoinX+=520+Math.random()*480;
  }
  while(nextFuelX<ahead){
    canisters.push({x:nextFuelX,y:groundY(nextFuelX)-26});
    nextFuelX+=2300+Math.random()*1300;
  }
}

function updatePhysics(dt){
  const eng=880*engineMult()*gripMult();
  const suspK=78*suspensionMult();
  const suspD=9*suspensionMult();
  const slope=slopeAt(car.x);
  const inv=1/Math.sqrt(1+slope*slope);
  const tx=inv,ty=slope*inv;

  car.vy+=GRAV*dt;

  let grounded=false;
  for(let i=0;i<2;i++){
    const sx=(i===0?-1:1)*WHEEL_BASE/2;
    const ax=car.x+rotX(sx,2,car.angle);
    const ay=car.y+rotY(sx,2,car.angle);
    const dx=rotX(0,1,car.angle);
    const dy=rotY(0,1,car.angle);
    const wx=ax+dx*REST_LEN,wy=ay+dy*REST_LEN;
    const ground=groundY(wx);
    const penetration=(wy+WHEEL_R)-ground;
    car.wheels[i].x=wx;car.wheels[i].y=wy;car.compression[i]=0;
    if(penetration>0){
      grounded=true;
      const comp=penetration;
      car.compression[i]=Math.min(comp,50);
      car.compression[i]=comp;
      const velAlong=car.vx*dx+car.vy*dy;
      let F=comp*suspK+velAlong*suspD;
      if(F<0)F=0;
      car.vx-=dx*F*dt;
      car.vy-=dy*F*dt;
      const torque=(ax-car.x)*(-dy*F)-(ay-car.y)*(-dx*F);
      car.angVel+=torque*ROT_I*dt;
    }
  }
  car.grounded=grounded;
  if(grounded){
    const targetA=Math.atan(slope);
    car.angVel+=normAngle(targetA-car.angle)*1.55*dt;
    car.angVel-=car.angVel*1.15*dt;
  }

  const gas=input.gas,brake=input.brake;
  if(fuel>0&&gas){
    car.vx+=tx*eng*dt;
    car.vy+=ty*eng*dt;
  }
  if(brake){
    const vT=car.vx*tx+car.vy*ty;
    const brk=1250*gripMult();
    if(Math.abs(vT)>25){
      const s=vT>0?1:-1;
      car.vx-=tx*s*brk*dt;
      car.vy-=ty*s*brk*dt;
    }else if(fuel>0){
      car.vx-=tx*eng*0.55*dt;
      car.vy-=ty*eng*0.55*dt;
    }
  }
  if(!grounded){
    if(gas)car.angVel-=2.7*dt;
    else if(brake)car.angVel+=2.7*dt;
  }

  car.vx-=car.vx*0.22*dt;
  car.vy-=car.vy*0.02*dt;
  const drag=0.0009*car.vx*Math.abs(car.vx);
  car.vx-=drag*dt;
  car.angVel-=car.angVel*1.0*dt;
  car.angle+=car.angVel*dt;
  car.angVel=Math.max(-9,Math.min(9,car.angVel));

  car.x+=car.vx*dt;
  car.y+=car.vy*dt;

  const maxSpd=470+state.owned.engine*42;
  const spd=Math.sqrt(car.vx*car.vx+car.vy*car.vy);
  if(spd>maxSpd){car.vx*=maxSpd/spd;car.vy*=maxSpd/spd;}

  const vt=car.vx*tx+car.vy*ty;
  car.wheelSpin+=vt/WHEEL_R*dt;

  const roofX=car.x+rotX(0,-9,car.angle);
  const roofY=car.y+rotY(0,-9,car.angle);
  if(Math.abs(normAngle(car.angle))>1.75&&roofY>=groundY(roofX)-2){
    car.roofTimer+=dt;
    if(car.roofTimer>0.75){endRun('Wrecked!');return;}
  }else{
    car.roofTimer=Math.max(0,car.roofTimer-dt*2);
  }

  if(grounded&&(gas||Math.abs(vt)>60)&&Math.random()<(gas?0.55:0.2)){
    const back=car.wheels[0];
    if(dust.length<(LOW_GFX?16:60)){
      dust.push({x:back.x+(Math.random()-0.5)*10,y:back.y+WHEEL_R-2,
        vx:-vt*0.18+(Math.random()-0.5)*40,vy:-20-Math.random()*40,
        life:0.6+Math.random()*0.4,size:2+Math.random()*3});
    }
  }

  if(fuel>0){
    fuel-=(1.6+(gas?2.3:0))*dt;
    if(fuel<=0){fuel=0;tone(300,0.3,'sine',0.1,150);}
  }else{
    car.fuelEmptyT+=dt;
    if(Math.abs(car.vx)<25||car.fuelEmptyT>4){endRun('Out of fuel!');return;}
  }
}

function update(dt){
  updatePhysics(dt);
  if(!running)return;
  spawnAhead();

  const carCX=car.x,carCY=car.y;
  routeCoins=routeCoins.filter(c=>{
    const dx=c.x-carCX,dy=c.y-carCY;
    if(dx*dx+dy*dy<900){
      runCoins++;
      tone(980,0.09,'triangle',0.09,1400);
      return false;
    }
    return c.x>car.x-140;
  });
  canisters=canisters.filter(c=>{
    const dx=c.x-carCX,dy=c.y-carCY;
    if(dx*dx+dy*dy<1100){
      fuel=Math.min(fuelCap,fuel+fuelCap*0.4);
      car.fuelEmptyT=0;
      tone(520,0.16,'sine',0.11,840);
      setTimeout(()=>tone(700,0.14,'sine',0.09,1050),90);
      return false;
    }
    return c.x>car.x-140;
  });
  dust.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=320*dt;p.life-=dt;});
  dust=dust.filter(p=>p.life>0);
  clouds.forEach(c=>{c.x+=c.v*dt;if(c.x>W+160)c.x=-200-Math.random()*80;});

  camX=car.x-W*0.34;
  const targetCamY=car.y-H*0.55;
  camY+=(targetCamY-camY)*Math.min(1,dt*4);

  runDist=Math.max(0,car.x/PX_M);
  updateEngine();
  hudAcc+=dt;
  if(!LOW_GFX||hudAcc>=0.25){hudAcc=0;updateHud();}
}

function updateHud(){
  $('hlevel').textContent='Lv'+state.level;
  $('hdist').textContent=Math.floor(Math.max(0,car.x/PX_M))+'m';
  $('hcoins').textContent='Coins '+runCoins;
  const pct=Math.max(0,Math.min(1,fuel/fuelCap));
  const bar=$('hfuel');
  bar.style.width=Math.round(pct*100)+'%';
  if(pct<0.25)bar.classList.add('low');else bar.classList.remove('low');
  $('hmny').textContent='$'+(runCoins*10+Math.floor(runDist/4));
}

/* ---------- Drawing ---------- */
function shade(hex,amt){
  let c=String(hex||'#888').replace('#','');
  if(c.length===3)c=c.split('').map(ch=>ch+ch).join('');
  const n=parseInt(c,16)||0;
  const clamp=v=>Math.max(0,Math.min(255,Math.round(v)));
  return 'rgb('+clamp(((n>>16)&255)+255*amt)+','+clamp(((n>>8)&255)+255*amt)+','+clamp((n&255)+255*amt)+')';
}
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
function sx(wx){return wx-camX;}
function sy(wy){return wy-camY;}

function drawSky(){
  if(LOW_GFX){
    ctx.fillStyle='#79a8d8';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#f5d78e';
    ctx.beginPath();ctx.arc(W*0.76,64,26,0,Math.PI*2);ctx.fill();
    return;
  }
  const g=ctx.createLinearGradient(0,0,0,H*0.8);
  g.addColorStop(0,'#3b6ea5');
  g.addColorStop(0.45,'#7fb2dd');
  g.addColorStop(0.8,'#cfe8d8');
  g.addColorStop(1,'#eef3d8');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);

  const sunX=W*0.76-camX*0.05,sunY=62;
  const sg=ctx.createRadialGradient(sunX,sunY,4,sunX,sunY,110);
  sg.addColorStop(0,'rgba(255,246,200,1)');
  sg.addColorStop(0.25,'rgba(255,236,160,.9)');
  sg.addColorStop(1,'rgba(255,236,160,0)');
  ctx.fillStyle=sg;ctx.fillRect(0,0,W,H*0.5);
  ctx.fillStyle='#fffbe0';
  ctx.beginPath();ctx.arc(sunX,sunY,24,0,Math.PI*2);ctx.fill();

  ctx.fillStyle='rgba(255,255,255,.85)';
  clouds.forEach(c=>{
    ctx.beginPath();
    ctx.ellipse(c.x,c.y,34*c.s,12*c.s,0,0,Math.PI*2);
    ctx.ellipse(c.x-20*c.s,c.y+5*c.s,20*c.s,9*c.s,0,0,Math.PI*2);
    ctx.ellipse(c.x+22*c.s,c.y+5*c.s,22*c.s,9*c.s,0,0,Math.PI*2);
    ctx.fill();
  });
}
function drawRidge(factor,amp,base,color){
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.moveTo(0,H);
  const off=camX*factor;
  for(let x=0;x<=W;x+=12){
    const wx=x+off;
    const y=base-(Math.sin(wx*0.004+factor*9)*amp+Math.sin(wx*0.011+factor*5+2)*amp*0.5);
    ctx.lineTo(x,y);
  }
  ctx.lineTo(W,H);
  ctx.closePath();ctx.fill();
}
function drawBackground(){
  drawRidge(0.12,60,H*0.52,LOW_GFX?'#5b7a94':'#6f93b3');
  drawRidge(0.28,38,H*0.6,LOW_GFX?'#3f5a44':'#47705c');
}
function drawTerrain(){
  const step=8;
  ctx.beginPath();
  ctx.moveTo(-12,H+12);
  for(let x=-12;x<=W+12;x+=step){
    ctx.lineTo(x,sy(groundY(x+camX)));
  }
  ctx.lineTo(W+12,H+12);
  ctx.closePath();
  if(LOW_GFX){
    ctx.fillStyle='#5a4028';ctx.fill();
  }else{
    const g=ctx.createLinearGradient(0,H*0.35,0,H);
    g.addColorStop(0,'#6b4a2b');
    g.addColorStop(0.35,'#54401f');
    g.addColorStop(1,'#2e1f0e');
    ctx.fillStyle=g;ctx.fill();
  }

  if(!LOW_GFX){
    ctx.fillStyle='rgba(0,0,0,.18)';
    const startK=Math.floor((camX-20)/130);
    for(let k=startK;k<startK+8;k++){
      const wx=k*130+hash1(k*3.3)*80;
      const gy=sy(groundY(wx));
      ctx.beginPath();ctx.ellipse(sx(wx),gy+26+hash1(k*7.7)*40,5,3,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(sx(wx+60),gy+52+hash1(k*9.1)*34,4,3,0,0,Math.PI*2);ctx.fill();
    }
  }

  ctx.beginPath();
  for(let x=-12;x<=W+12;x+=step){
    const y=sy(groundY(x+camX));
    if(x===-12)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.strokeStyle='#3f6212';ctx.lineWidth=7;ctx.stroke();
  ctx.strokeStyle='#65a30d';ctx.lineWidth=2.5;ctx.stroke();

  if(Math.abs(camX)<220){
    const fx=sx(0);
    ctx.strokeStyle='#f8fafc';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(fx,sy(groundY(0)));ctx.lineTo(fx,sy(groundY(0))-64);ctx.stroke();
    for(let r=0;r<4;r++)for(let c=0;c<3;c++){
      ctx.fillStyle=(r+c)%2?'#0f172a':'#f8fafc';
      ctx.fillRect(fx+2+c*8,sy(groundY(0))-64+r*8,8,8);
    }
  }
}
function drawCoin(c,t){
  const x=sx(c.x),y=sy(c.y);
  const wob=Math.cos(t*5+c.x*0.05);
  const rx=Math.max(2.5,9*Math.abs(wob));
  ctx.save();ctx.translate(x,y+Math.sin(t*3+c.x*0.02)*2);
  ctx.fillStyle='rgba(0,0,0,.25)';
  ctx.beginPath();ctx.ellipse(0,13,9,3.4,0,0,Math.PI*2);ctx.fill();
  if(LOW_GFX){
    ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.ellipse(0,0,rx,9,0,0,Math.PI*2);ctx.fill();
    ctx.restore();return;
  }
  const g=ctx.createRadialGradient(-rx*0.4,-3,1,0,0,10);
  g.addColorStop(0,'#fff6bd');g.addColorStop(0.55,'#fbbf24');g.addColorStop(1,'#b45309');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.ellipse(0,0,rx,10,0,0,Math.PI*2);ctx.fill();
  if(rx>4){
    ctx.fillStyle='#7c4a03';
    ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('$',0,1);
  }
  ctx.restore();
}
function drawCanister(c){
  const x=sx(c.x),y=sy(c.y);
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='rgba(0,0,0,.3)';
  ctx.beginPath();ctx.ellipse(0,15,11,3.6,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#dc2626';
  rr(ctx,-8,-12,16,22,3);ctx.fill();
  ctx.fillStyle='#991b1b';
  ctx.fillRect(-3,-16,6,5);
  ctx.fillStyle='#f8fafc';
  ctx.fillRect(-8,-3,16,6);
  ctx.fillStyle='#dc2626';
  ctx.font='bold 7px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('F',0,0.5);
  ctx.restore();
}
function drawWheel(x,y,spin){
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='#0a0a0f';
  ctx.beginPath();ctx.arc(0,0,WHEEL_R,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#1f2937';
  ctx.beginPath();ctx.arc(0,0,WHEEL_R*0.62,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#9ca3af';
  ctx.beginPath();ctx.arc(0,0,WHEEL_R*0.34,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#4b5563';ctx.lineWidth=2;
  for(let i=0;i<5;i++){
    const a=spin+i*(Math.PI*2/5);
    ctx.beginPath();ctx.moveTo(Math.cos(a)*WHEEL_R*0.3,Math.sin(a)*WHEEL_R*0.3);
    ctx.lineTo(Math.cos(a)*WHEEL_R*0.58,Math.sin(a)*WHEEL_R*0.58);ctx.stroke();
  }
  ctx.restore();
}
function drawCar(){
  const px=sx(car.x),py=sy(car.y);

  const gy=sy(groundY(car.x));
  ctx.fillStyle='rgba(0,0,0,.28)';
  ctx.beginPath();ctx.ellipse(px,gy+8,44,7,0,0,Math.PI*2);ctx.fill();

  for(let i=0;i<2;i++){
    drawWheel(sx(car.wheels[i].x),sy(car.wheels[i].y),car.wheelSpin);
  }

  ctx.save();
  ctx.translate(px,py);
  ctx.rotate(car.angle);

  ctx.strokeStyle='#111827';ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(-WHEEL_BASE/2,2);ctx.lineTo(-WHEEL_BASE/2,10);ctx.stroke();
  ctx.beginPath();ctx.moveTo(WHEEL_BASE/2,2);ctx.lineTo(WHEEL_BASE/2,10);ctx.stroke();

  const bg=ctx.createLinearGradient(0,-14,0,12);
  bg.addColorStop(0,shade('#dc2626',0.12));
  bg.addColorStop(0.55,'#dc2626');
  bg.addColorStop(1,shade('#dc2626',-0.38));
  ctx.fillStyle=bg;
  ctx.beginPath();
  ctx.moveTo(-37,8);
  ctx.lineTo(-37,-2);
  ctx.lineTo(-24,-5);
  ctx.lineTo(-15,-15);
  ctx.lineTo(13,-15);
  ctx.lineTo(24,-4);
  ctx.lineTo(37,-1);
  ctx.lineTo(37,8);
  ctx.closePath();ctx.fill();

  ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1.2;ctx.stroke();

  if(!LOW_GFX){
    const wg=ctx.createLinearGradient(0,-14,0,-2);
    wg.addColorStop(0,'rgba(190,225,255,.95)');
    wg.addColorStop(1,'rgba(40,70,110,.95)');
    ctx.fillStyle=wg;
    ctx.beginPath();
    ctx.moveTo(-12,-13);ctx.lineTo(10,-13);ctx.lineTo(17,-5);ctx.lineTo(-19,-5);
    ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.3)';
    ctx.fillRect(-13,-13,8,2);
  }else{
    ctx.fillStyle='#a5d8ff';
    ctx.fillRect(-15,-13,26,7);
  }

  ctx.strokeStyle='rgba(17,24,39,.8)';ctx.lineWidth=2.4;
  ctx.beginPath();ctx.moveTo(-31,-3);ctx.lineTo(-20,-12);ctx.moveTo(20,-6);ctx.lineTo(13,-13);ctx.stroke();

  ctx.fillStyle='#fde68a';
  ctx.beginPath();ctx.arc(35.5,1,2.6,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ef4444';
  ctx.beginPath();ctx.arc(-36.5,1,2.2,0,Math.PI*2);ctx.fill();

  ctx.restore();

  if(!LOW_GFX){
    const hx=px+rotX(37,1,car.angle),hy=py+rotY(37,1,car.angle);
    const hg=ctx.createRadialGradient(hx,hy,1,hx+30,hy+6,46);
    hg.addColorStop(0,'rgba(255,244,190,.34)');
    hg.addColorStop(1,'rgba(255,244,190,0)');
    ctx.fillStyle=hg;
    ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(hx+64,hy-16);ctx.lineTo(hx+64,hy+22);ctx.closePath();ctx.fill();
  }
}
function draw(){
  const t=performance.now()/1000;
  drawSky();
  drawBackground();
  drawTerrain();

  canisters.forEach(drawCanister);
  routeCoins.forEach(c=>drawCoin(c,t));

  dust.forEach(p=>{
    ctx.globalAlpha=Math.max(0,Math.min(1,p.life*1.4))*0.55;
    ctx.fillStyle='#b9a37c';
    ctx.beginPath();ctx.arc(sx(p.x),sy(p.y),p.size,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  });

  drawCar();

  if(!LOW_GFX){
    const vg=ctx.createRadialGradient(W/2,H/2,H*0.36,W/2,H/2,H*0.82);
    vg.addColorStop(0,'rgba(0,0,0,0)');
    vg.addColorStop(1,'rgba(0,0,0,.38)');
    ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
  }

  if(fuel/fuelCap<0.22&&running){
    const a=0.18+0.14*Math.sin(t*6);
    ctx.fillStyle='rgba(239,68,68,'+Math.max(0,a)+')';
    ctx.fillRect(0,0,W,4);ctx.fillRect(0,H-4,W,4);
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
  if(paused){last=ts;draw();requestAnimationFrame(loop);return;}
  const dt=last?Math.min((ts-last)/1000,0.05):0.016;
  last=ts;
  update(dt);
  if(!running)return;
  drawAcc+=dt;
  if(!LOW_GFX||drawAcc>=0.033){drawAcc=0;draw();}
  requestAnimationFrame(loop);
}

function togglePause(){
  if(!running)return;
  paused=!paused;
  if(paused){stopEngine();stopMusic();}
  else{startEngine();if(!MUTED)startMusic();}
}

window.addEventListener('keydown',e=>{
  const k=e.key||'',c=e.keyCode||0;
  if(!running)return;
  if(k==='ArrowRight'||k==='ArrowUp'||c===39||c===38){e.preventDefault();input.gas=true;}
  else if(k==='ArrowLeft'||k==='ArrowDown'||c===37||c===40){e.preventDefault();input.brake=true;}
  else if(k===' '||c===32){e.preventDefault();input.gas=true;}
  else if(k==='p'||k==='P'||k==='Escape'){togglePause();}
  else if(k==='m'||k==='M'){unlockAudio();setMuted(!MUTED);}
});
window.addEventListener('keyup',e=>{
  const k=e.key||'',c=e.keyCode||0;
  if(k==='ArrowRight'||k==='ArrowUp'||c===39||c===38||k===' '||c===32)input.gas=false;
  else if(k==='ArrowLeft'||k==='ArrowDown'||c===37||c===40)input.brake=false;
});
function bindHold(id,prop){
  const el=$(id);if(!el)return;
  const on=e=>{e.preventDefault();unlockAudio();input[prop]=true;};
  const off=e=>{if(e)e.preventDefault();input[prop]=false;};
  el.addEventListener('touchstart',on,{passive:false});
  el.addEventListener('touchend',off,{passive:false});
  el.addEventListener('touchcancel',off,{passive:false});
  el.addEventListener('mousedown',on);
  el.addEventListener('mouseup',off);
  el.addEventListener('mouseleave',off);
  el.addEventListener('pointerdown',on);
  el.addEventListener('pointerup',off);
  el.addEventListener('pointercancel',off);
  el.addEventListener('contextmenu',e=>e.preventDefault());
}
bindHold('tgas','gas');
bindHold('tbrake','brake');

document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&running&&!paused)togglePause();
});

function bindClick(id,fn){
  const el=$(id);if(!el)return;
  el.addEventListener('click',fn);
}
bindClick('start',()=>{unlockAudio();tone(500,0.08,'square',0.07,700);startRun();});
bindClick('upgrades',()=>{unlockAudio();tone(500,0.07,'square',0.06);renderUpgrades();show('upv');});
bindClick('missions',()=>{unlockAudio();tone(500,0.07,'square',0.06);renderMissions();show('missv');});
bindClick('back1',()=>{updateMenu();show('menu');});
bindClick('back2',()=>{updateMenu();show('menu');});
bindClick('retry',()=>{unlockAudio();tone(500,0.08,'square',0.07,700);startRun();});
bindClick('menu2',()=>{updateMenu();show('menu');});
bindClick('home',()=>{stopEngine();stopMusic();location.href='../../index.html';});
bindClick('mutebtn',()=>{unlockAudio();setMuted(!MUTED);tone(500,0.06,'square',0.05);});

setMuted(MUTED);
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
