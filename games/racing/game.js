const params=new URLSearchParams(location.search);
const user=params.get('user')||prompt('Username')||'guest';
const KEY='racing_'+user;
const VEHICLES=[
  {name:'Starter',price:0,maxSpeed:4,accel:0.12,color:'#3b82f6'},
  {name:'Sport',price:500,maxSpeed:5.5,accel:0.16,color:'#22c55e'},
  {name:'Turbo',price:2000,maxSpeed:7,accel:0.2,color:'#f59e0b'},
  {name:'Rocket',price:8000,maxSpeed:9,accel:0.26,color:'#ef4444'}
];
const MISSIONS=[
  {id:'lvl5',title:'Reach Level 5',target:5,type:'level',reward:300},
  {id:'money1000',title:'Earn 1000 total money',target:1000,type:'totalMoney',reward:500},
  {id:'overtake100',title:'Overtake 100 cars',target:100,type:'overtakes',reward:800},
  {id:'dist10000',title:'Drive 10000 distance',target:10000,type:'distance',reward:1000}
];
function defaultState(){return {user,money:0,xp:0,level:1,totalMoneyEarned:0,overtakes:0,distance:0,owned:[0],selected:0,missions:MISSIONS.map(m=>({...m,progress:0,done:false}))};}
let state=JSON.parse(localStorage.getItem(KEY)||'null')||defaultState();
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
const $=id=>document.getElementById(id);
const canvas=$('c');const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height;
let running=false,paused=false;
let audioCtx=null,engineOsc=null,engineOsc2=null,engineGain=null;
function unlockAudio(){
  try{
    if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended')audioCtx.resume();
  }catch(e){}
}
function beep(freq,dur,type,vol){
  unlockAudio();
  if(!audioCtx)return;
  try{
    const t=audioCtx.currentTime;
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.type=type||'square';
    o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vol||0.09,t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g);g.connect(audioCtx.destination);
    o.start(t);o.stop(t+dur+0.03);
  }catch(e){}
}
function startEngine(){
  unlockAudio();
  if(!audioCtx||engineOsc)return;
  try{
    const t=audioCtx.currentTime;
    engineGain=audioCtx.createGain();
    engineGain.gain.setValueAtTime(0.0001,t);
    engineGain.gain.exponentialRampToValueAtTime(0.03,t+0.4);
    engineGain.connect(audioCtx.destination);
    const lp=audioCtx.createBiquadFilter();
    lp.type='lowpass';lp.frequency.value=380;
    lp.connect(engineGain);
    engineOsc=audioCtx.createOscillator();
    engineOsc.type='sawtooth';engineOsc.frequency.value=70;
    engineOsc.connect(lp);engineOsc.start();
    const g2=audioCtx.createGain();g2.gain.value=0.3;g2.connect(engineGain);
    engineOsc2=audioCtx.createOscillator();
    engineOsc2.type='square';engineOsc2.frequency.value=105;
    engineOsc2.connect(g2);engineOsc2.start();
  }catch(e){engineOsc=null;engineOsc2=null;engineGain=null;}
}
function updateEngine(){
  if(!audioCtx||!engineOsc)return;
  try{
    const t=audioCtx.currentTime;
    const f=68+race.speed*10+Math.sin(t*9)*2.5;
    engineOsc.frequency.setTargetAtTime(f,t,0.07);
    if(engineOsc2)engineOsc2.frequency.setTargetAtTime(f*1.5,t,0.07);
  }catch(e){}
}
function stopEngine(){
  if(!audioCtx)return;
  try{
    const t=audioCtx.currentTime;
    if(engineGain){engineGain.gain.cancelScheduledValues(t);engineGain.gain.setTargetAtTime(0.0001,t,0.06);}
    if(engineOsc){engineOsc.stop(t+0.2);engineOsc=null;}
    if(engineOsc2){engineOsc2.stop(t+0.2);engineOsc2=null;}
    engineGain=null;
  }catch(e){engineOsc=null;engineOsc2=null;engineGain=null;}
}
let player={lane:1,x:160,y:400},enemies=[],coins=[],roadOffset=0,scenery=[];
let race={dist:0,earned:0,overtakes:0,speed:0,spawnT:0,coinT:0,time:0};
const LANES=[80,160,240];
const CAR_COLORS=['#94a3b8','#64748b','#c2410c','#0ea5e9','#a855f7','#f43f5e','#eab308'];
function xpNeeded(l){return Math.floor(100*Math.pow(l,1.5));}
function vehicle(){return VEHICLES[state.selected];}
function show(id){document.querySelectorAll('.overlay').forEach(o=>o.classList.add('hidden'));if(id)$(id).classList.remove('hidden');}
function hideHud(){ $('hud').classList.add('hidden');}
function showHud(){ $('hud').classList.remove('hidden');}
function updateMenu(){
  $('userinfo').textContent='Player: '+state.user;
  $('mlevel').textContent=state.level;
  $('mxp').textContent=state.xp;
  $('mneed').textContent=xpNeeded(state.level);
  $('mmoney').textContent=state.money;
}
function renderVehicles(){
  const el=$('vlist');el.innerHTML='';
  VEHICLES.forEach((v,i)=>{
    const owned=state.owned.includes(i);
    const sel=state.selected===i;
    const d=document.createElement('div');d.className='vitem';
    d.innerHTML=`<b>${v.name}</b>Speed ${v.maxSpeed} | Price ${v.price}${owned?' | Owned':''}${sel?' | Selected':''}`;
    const btn=document.createElement('button');
    if(!owned){btn.textContent='Buy ('+v.price+')';btn.onclick=()=>{if(state.money>=v.price){state.money-=v.price;state.owned.push(i);save();renderVehicles();updateMenu();beep(760,0.12,'square');}else alert('Not enough money');};}
    else if(!sel){btn.textContent='Select';btn.onclick=()=>{state.selected=i;save();renderVehicles();beep(520,0.08,'square');};}
    else {btn.textContent='Selected';btn.disabled=true;}
    d.appendChild(btn);el.appendChild(d);
  });
}
function renderMissions(){
  const el=$('mlist');el.innerHTML='';
  state.missions.forEach(m=>{
    const d=document.createElement('div');d.className='mitem';
    d.innerHTML=`<b>${m.title}</b>Progress ${Math.min(m.progress,m.target)}/${m.target} | Reward ${m.reward}${m.done?' | DONE':''}`;
    el.appendChild(d);
  });
}
function checkMissions(){
  state.missions.forEach(m=>{
    if(m.done)return;
    if(m.type==='level')m.progress=state.level;
    if(m.type==='totalMoney')m.progress=state.totalMoneyEarned;
    if(m.type==='overtakes')m.progress=state.overtakes;
    if(m.type==='distance')m.progress=state.distance;
    if(m.progress>=m.target){m.done=true;state.money+=m.reward;state.totalMoneyEarned+=m.reward;beep(900,0.18,'triangle',0.12);alert('Mission complete: '+m.title+' (+'+m.reward+')');}
  });
}
function initScenery(){
  scenery=[];
  for(let i=0;i<10;i++)scenery.push({side:i%2,xOffset:8+Math.random()*20,y:-i*60-20,type:i%3});
}
function startRace(){
  unlockAudio();
  player.lane=1;player.x=LANES[1];player.y=H-80;
  enemies=[];coins=[];roadOffset=0;initScenery();
  race={dist:0,earned:0,overtakes:0,speed:vehicle().maxSpeed,spawnT:0.9,coinT:0.6,time:0};
  running=true;paused=false;
  show(null);showHud();
  $('touch').classList.remove('hidden');
  startEngine();
  beep(520,0.1,'square');
  last=0;
  requestAnimationFrame(loop);
}
function endRace(){
  running=false;stopEngine();beep(120,0.4,'sawtooth',0.16);
  state.money+=race.earned;
  state.totalMoneyEarned+=race.earned;
  state.xp+=Math.floor(race.dist/10)+race.overtakes*2;
  state.distance+=Math.floor(race.dist);
  state.overtakes+=race.overtakes;
  let leveled=false;
  while(state.xp>=xpNeeded(state.level)){state.xp-=xpNeeded(state.level);state.level++;state.money+=state.level*50;state.totalMoneyEarned+=state.level*50;leveled=true;}
  if(leveled)beep(660,0.15,'square',0.12);
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
  const speed=2+Math.random()*2+state.level*0.15;
  const color=CAR_COLORS[Math.floor(Math.random()*CAR_COLORS.length)];
  enemies.push({lane,y:-95,speed,color});
}
function spawnCoin(){
  const lane=Math.floor(Math.random()*3);
  coins.push({lane,y:-20});
}
function update(dt){
  const v=vehicle();
  race.speed=Math.min(v.maxSpeed+state.level*0.05, v.maxSpeed+3);
  race.time+=dt;
  roadOffset=(roadOffset+race.speed*2.6)%60;
  race.dist+=race.speed;
  player.x+=(LANES[player.lane]-player.x)*0.22;
  scenery.forEach(s=>{s.y+=race.speed*2.6;if(s.y>H+30){s.y=-30;}});
  race.spawnT-=dt;
  if(race.spawnT<=0){spawnEnemy();race.spawnT=Math.max(0.45,1.2-state.level*0.05);}
  race.coinT-=dt;
  if(race.coinT<=0){spawnCoin();race.coinT=1.5+Math.random()*2;}
  enemies.forEach(e=>{e.y+=e.speed+race.speed*0.42;});
  enemies=enemies.filter(e=>{
    if(e.y>H+50){race.overtakes++;return false;}
    return true;
  });
  coins.forEach(c=>{c.y+=race.speed*1.25;});
  coins=coins.filter(c=>{
    if(c.y>H+25)return false;
    if(c.lane===player.lane&&Math.abs(c.y-player.y)<26){race.earned+=10;beep(980,0.07,'triangle',0.08);return false;}
    return true;
  });
  for(const e of enemies){
    if(e.lane===player.lane&&Math.abs(e.y-player.y)<36){endRace();return;}
  }
  updateEngine();
  $('hlevel').textContent='Lv'+state.level;
  $('hscore').textContent='Dist '+Math.floor(race.dist);
  $('hmny').textContent='$'+race.earned;
}
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function shade(hex,amt){
  let c=hex.replace('#','');
  if(c.length===3)c=c.split('').map(ch=>ch+ch).join('');
  const n=parseInt(c,16)||0;
  const clamp=v=>Math.max(0,Math.min(255,Math.round(v)));
  const r=clamp(((n>>16)&255)+255*amt);
  const g=clamp(((n>>8)&255)+255*amt);
  const b=clamp((n&255)+255*amt);
  return `rgb(${r},${g},${b})`;
}
function drawCar(x,y,color,opts){
  opts=opts||{};
  ctx.save();
  ctx.translate(x,y);
  ctx.fillStyle='rgba(0,0,0,.35)';
  roundRect(-24,-35,48,71,13);ctx.fill();
  for(const wx of [-24,24]){
    for(const wy of [-22,20]){
      ctx.fillStyle='#0b0b0b';
      roundRect(wx-5,wy-9,10,18,4);ctx.fill();
      ctx.fillStyle='#3a3a3a';
      roundRect(wx-2,wy-5,4,10,2);ctx.fill();
    }
  }
  const g=ctx.createLinearGradient(-19,0,19,0);
  g.addColorStop(0,shade(color,-0.34));
  g.addColorStop(0.42,color);
  g.addColorStop(0.6,shade(color,0.12));
  g.addColorStop(1,shade(color,-0.42));
  ctx.fillStyle=g;
  roundRect(-19,-32,38,64,10);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=1.5;roundRect(-19,-32,38,64,10);ctx.stroke();
  ctx.fillStyle=shade(color,0.1);
  roundRect(-15,-29,30,18,6);ctx.fill();
  ctx.fillStyle='rgba(130,205,255,.9)';
  roundRect(-13,-14,26,13,5);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.28)';
  roundRect(-11,-12,22,4,2);ctx.fill();
  ctx.fillStyle=shade(color,-0.14);
  roundRect(-13,0,26,14,5);ctx.fill();
  ctx.fillStyle='rgba(105,175,235,.8)';
  roundRect(-12,12,24,9,4);ctx.fill();
  ctx.fillStyle=shade(color,-0.24);
  roundRect(-15,20,30,9,4);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.6)';
  ctx.fillRect(-2,-29,4,17);
  ctx.fillRect(-2,21,4,9);
  ctx.fillStyle='#fff8b8';
  roundRect(-14,-33,8,4,2);ctx.fill();
  roundRect(6,-33,8,4,2);ctx.fill();
  ctx.fillStyle='#ff3b3b';
  roundRect(-14,28,8,4,2);ctx.fill();
  roundRect(6,28,8,4,2);ctx.fill();
  ctx.fillStyle=shade(color,-0.28);
  ctx.fillRect(-23,-13,4,7);
  ctx.fillRect(19,-13,4,7);
  if(opts.player){
    const fl=8+Math.random()*12;
    const fg=ctx.createLinearGradient(0,31,0,31+fl);
    fg.addColorStop(0,'rgba(255,225,130,.95)');
    fg.addColorStop(1,'rgba(255,70,0,0)');
    ctx.fillStyle=fg;
    ctx.beginPath();ctx.moveTo(-7,31);ctx.lineTo(0,31+fl);ctx.lineTo(7,31);ctx.closePath();ctx.fill();
  }
  ctx.restore();
}
function drawCoin(x,y,t){
  const bob=Math.sin(t*3+x)*2;
  const r=9;
  ctx.save();
  ctx.translate(x,y+bob);
  ctx.fillStyle='rgba(0,0,0,.3)';
  ctx.beginPath();ctx.ellipse(0,r+3,r*0.9,3,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f59e0b';
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fde047';
  ctx.beginPath();ctx.arc(0,0,r-2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#b45309';
  ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('$',0,1);
  ctx.textBaseline='alphabetic';
  ctx.restore();
}
function drawScenery(){
  scenery.forEach(s=>{
    const x=s.side?W-16-s.xOffset:16+s.xOffset;
    if(s.type===0){
      ctx.fillStyle='#14532d';ctx.fillRect(x-2,s.y,4,14);
      ctx.fillStyle='#166534';
      ctx.beginPath();ctx.arc(x,s.y-4,11,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#22c55e';
      ctx.beginPath();ctx.arc(x-3,s.y-8,6,0,Math.PI*2);ctx.fill();
    }else if(s.type===1){
      ctx.fillStyle='#3f3f46';ctx.fillRect(x-2,s.y-16,4,26);
      ctx.fillStyle='#71717a';ctx.fillRect(x-8,s.y-20,16,5);
    }else{
      ctx.fillStyle='#475569';ctx.fillRect(x-7,s.y-6,14,12);
      ctx.fillStyle='#facc15';ctx.fillRect(x-4,s.y-2,8,3);
    }
  });
}
function draw(){
  ctx.fillStyle='#0d4a26';ctx.fillRect(0,0,W,H);
  const stripe=60,off=roadOffset%stripe;
  for(let y=-stripe;y<H+stripe;y+=stripe){
    ctx.fillStyle='rgba(255,255,255,.03)';
    ctx.fillRect(0,y+off,40,stripe/2);
    ctx.fillRect(W-40,y+off,40,stripe/2);
  }
  const rg=ctx.createLinearGradient(40,0,W-40,0);
  rg.addColorStop(0,'#343434');rg.addColorStop(0.5,'#4a4a4a');rg.addColorStop(1,'#343434');
  ctx.fillStyle=rg;ctx.fillRect(40,0,W-80,H);
  drawScenery();
  ctx.fillStyle='#e8e8e8';
  ctx.fillRect(44,0,4,H);ctx.fillRect(W-48,0,4,H);
  const dash=30,gap=30,dOff=roadOffset%(dash+gap);
  for(let y=-60+dOff;y<H+60;y+=dash+gap){
    ctx.fillRect(120,y,3,dash);
    ctx.fillRect(200,y,3,dash);
  }
  coins.forEach(c=>drawCoin(LANES[c.lane],c.y,race.time));
  enemies.forEach(e=>drawCar(LANES[e.lane],e.y,e.color));
  drawCar(player.x,player.y,vehicle().color,{player:true});
  if(paused){
    ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fff';ctx.font='bold 22px sans-serif';ctx.textAlign='center';
    ctx.fillText('PAUSED',W/2,H/2);
    ctx.font='11px sans-serif';ctx.fillStyle='#bbb';
    ctx.fillText('Press P to resume',W/2,H/2+22);
    ctx.textAlign='left';
  }
}
let last=0;
function loop(ts){
  if(!running)return;
  if(paused){last=ts;requestAnimationFrame(loop);return;}
  const dt=last?Math.min((ts-last)/1000,0.05):0.016;last=ts;
  update(dt);
  if(!running)return;
  draw();
  requestAnimationFrame(loop);
}
window.addEventListener('keydown',e=>{
  if(!running)return;
  if(e.key==='ArrowLeft'||e.key==='4'){if(player.lane>0){player.lane--;beep(420,0.05,'square',0.05);}}
  if(e.key==='ArrowRight'||e.key==='6'){if(player.lane<2){player.lane++;beep(420,0.05,'square',0.05);}}
  if(e.key==='p'||e.key==='P')paused=!paused;
});
function moveLeft(){if(running&&player.lane>0){player.lane--;beep(420,0.05,'square',0.05);}}
function moveRight(){if(running&&player.lane<2){player.lane++;beep(420,0.05,'square',0.05);}}
$('tleft').addEventListener('touchstart',e=>{e.preventDefault();unlockAudio();moveLeft();});
$('tleft').addEventListener('mousedown',e=>{unlockAudio();moveLeft();});
$('tright').addEventListener('touchstart',e=>{e.preventDefault();unlockAudio();moveRight();});
$('tright').addEventListener('mousedown',e=>{unlockAudio();moveRight();});
$('start').onclick=startRace;
$('shop').onclick=()=>{unlockAudio();renderVehicles();show('shopv');};
$('missions').onclick=()=>{unlockAudio();renderMissions();show('missv');};
$('back1').onclick=()=>{updateMenu();show('menu');};
$('back2').onclick=()=>{updateMenu();show('menu');};
$('retry').onclick=startRace;
$('menu2').onclick=()=>{updateMenu();show('menu');};
const homeBtn=$('home');
if(homeBtn)homeBtn.onclick=()=>{stopEngine();location.href='../../index.html';};
updateMenu();show('menu');save();
