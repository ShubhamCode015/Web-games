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
let running=false,paused=false;
let audioCtx=null;
function beep(freq,dur,type){try{if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator();const g=audioCtx.createGain();o.type=type||'square';o.frequency.value=freq;g.gain.value=0.12;g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+dur);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur);}catch(e){}}
let player={lane:1,x:0,y:0},enemies=[],coins=[],roadOffset=0;
let race={dist:0,earned:0,overtakes:0,speed:0,spawnT:0,coinT:0};
const LANES=[60,160,260]; // x centers
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
    if(!owned){btn.textContent='Buy ('+v.price+')';btn.onclick=()=>{if(state.money>=v.price){state.money-=v.price;state.owned.push(i);save();renderVehicles();updateMenu();}else alert('Not enough money');};}
    else if(!sel){btn.textContent='Select';btn.onclick=()=>{state.selected=i;save();renderVehicles();};}
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
    if(m.progress>=m.target){m.done=true;state.money+=m.reward;state.totalMoneyEarned+=m.reward;alert('Mission complete: '+m.title+' (+'+m.reward+')');}
  });
}
function startRace(){
  player.lane=1;player.x=LANES[1];player.y=canvas.height-80;
  enemies=[];coins=[];roadOffset=0;
  race={dist:0,earned:0,overtakes:0,speed:vehicle().maxSpeed,spawnT:0,coinT:0};
  running=true;paused=false;
  show(null);showHud();
  $('touch').classList.remove('hidden');
  requestAnimationFrame(loop);
}
function endRace(){
  running=false;beep(120,0.4,'sawtooth');
  state.money+=race.earned;
  state.totalMoneyEarned+=race.earned;
  state.xp+=Math.floor(race.dist/10)+race.overtakes*2;
  state.distance+=Math.floor(race.dist);
  state.overtakes+=race.overtakes;
  // level up
  let leveled=false;
  while(state.xp>=xpNeeded(state.level)){state.xp-=xpNeeded(state.level);state.level++;state.money+=state.level*50;state.totalMoneyEarned+=state.level*50;leveled=true;}
  if(leveled)beep(660,0.15,'square');
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
  enemies.push({lane,y:-40,speed,color:'#999'});
}
function spawnCoin(){
  const lane=Math.floor(Math.random()*3);
  coins.push({lane,y:-20});
}
function update(dt){
  const v=vehicle();
  race.speed=Math.min(v.maxSpeed+state.level*0.05, v.maxSpeed+3);
  roadOffset=(roadOffset+race.speed*2)%40;
  race.dist+=race.speed;
  player.x+=(LANES[player.lane]-player.x)*0.2;
  // enemies
  race.spawnT-=dt;
  if(race.spawnT<=0){spawnEnemy();race.spawnT=Math.max(0.4,1.2-state.level*0.05);}
  race.coinT-=dt;
  if(race.coinT<=0){spawnCoin();race.coinT=1.5+Math.random()*2;}
  enemies.forEach(e=>{e.y+=e.speed+race.speed*0.5;});
  // overtake count
  enemies=enemies.filter(e=>{
    if(e.y>canvas.height+40){
      // passed bottom without collision -> overtake
      race.overtakes++;
      return false;
    }
    return true;
  });
  coins.forEach(c=>{c.y+=race.speed*1.2;});
  coins=coins.filter(c=>{
    if(c.y>canvas.height+20)return false;
    if(c.lane===player.lane && Math.abs(c.y-player.y)<24){race.earned+=10;beep(880,0.08,'triangle');return false;}
    return true;
  });
  // collision
  for(const e of enemies){
    if(e.lane===player.lane && Math.abs(e.y-player.y)<34){endRace();return;}
  }
  // hud
  $('hlevel').textContent='Lv'+state.level;
  $('hscore').textContent='Dist '+Math.floor(race.dist);
  $('hmny').textContent='$'+race.earned;
}
function draw(){
  ctx.fillStyle='#222';ctx.fillRect(0,0,canvas.width,canvas.height);
  // road
  ctx.fillStyle='#333';ctx.fillRect(40,0,240,canvas.height);
  // lane lines
  ctx.strokeStyle='#555';ctx.setLineDash([20,20]);ctx.lineDashOffset=-roadOffset;
  for(let x=110;x<=210;x+=100){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
  ctx.setLineDash([]);
  // coins
  coins.forEach(c=>{ctx.fillStyle='#facc15';ctx.beginPath();ctx.arc(LANES[c.lane],c.y,8,0,Math.PI*2);ctx.fill();});
  // enemies
  enemies.forEach(e=>{ctx.fillStyle='#999';ctx.fillRect(LANES[e.lane]-14,e.y-20,28,40);});
  // player
  ctx.fillStyle=vehicle().color;ctx.fillRect(player.x-14,player.y-20,28,40);
}
let last=0;
function loop(ts){
  if(!running)return;
  if(paused){last=ts;requestAnimationFrame(loop);return;}
  const dt=(ts-last)/1000;last=ts;
  update(Math.min(dt,0.05));
  if(!running)return;
  draw();
  requestAnimationFrame(loop);
}
// input
window.addEventListener('keydown',e=>{
  if(!running)return;
  if(e.key==='ArrowLeft'||e.key==='4'){if(player.lane>0)player.lane--;}
  if(e.key==='ArrowRight'||e.key==='6'){if(player.lane<2)player.lane++;}
  if(e.key==='p'||e.key==='P')paused=!paused;
});
// touch
function moveLeft(){if(running&&player.lane>0)player.lane--;}
function moveRight(){if(running&&player.lane<2)player.lane++;}
$('tleft').addEventListener('touchstart',e=>{e.preventDefault();moveLeft();});
$('tleft').addEventListener('mousedown',moveLeft);
$('tright').addEventListener('touchstart',e=>{e.preventDefault();moveRight();});
$('tright').addEventListener('mousedown',moveRight);
// buttons
$('start').onclick=startRace;
$('shop').onclick=()=>{renderVehicles();show('shopv');};
$('missions').onclick=()=>{renderMissions();show('missv');};
$('back1').onclick=()=>{updateMenu();show('menu');};
$('back2').onclick=()=>{updateMenu();show('menu');};
$('retry').onclick=startRace;
$('menu2').onclick=()=>{updateMenu();show('menu');};
// init
updateMenu();show('menu');save();