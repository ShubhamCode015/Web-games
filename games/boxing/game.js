const params=new URLSearchParams(location.search);
const user=params.get('user')||prompt('Username')||'guest';
const KEY='boxing_'+user;
const MAX_LEVEL=100;

const FIGHTERS=[
  {id:'rookie',name:'Rookie',price:0,levelReq:0,pow:10,spd:10,def:10,skill:'Jab Combo',skillType:'combo',skillVal:1.7,color:'#3b82f6',desc:'Basic all-rounder'},
  {id:'bull',name:'Street Bull',price:500,levelReq:0,pow:16,spd:7,def:12,skill:'Haymaker',skillType:'heavy',skillVal:2.5,color:'#ef4444',desc:'Slow but heavy hands'},
  {id:'flash',name:'Flash',price:1500,levelReq:0,pow:9,spd:18,def:8,skill:'Rapid Fire',skillType:'multi',skillVal:1.6,color:'#22c55e',desc:'Fast puncher'},
  {id:'iron',name:'Iron Guard',price:5000,levelReq:0,pow:12,spd:9,def:20,skill:'Iron Wall',skillType:'shield',skillVal:1.8,color:'#a855f7',desc:'Tank with healing guard'},
  {id:'spark',name:'Spark',price:0,levelReq:15,pow:14,spd:14,def:12,skill:'Static Shock',skillType:'stun',skillVal:2.1,color:'#f59e0b',desc:'Free at Level 15'},
  {id:'blaze',name:'Blaze',price:0,levelReq:35,pow:18,spd:15,def:13,skill:'Flame Rush',skillType:'heavy',skillVal:2.9,color:'#f97316',desc:'Free at Level 35'},
  {id:'shadow',name:'Shadow',price:12000,levelReq:0,pow:17,spd:17,def:14,skill:'Shadow Strike',skillType:'crit',skillVal:3.2,color:'#6366f1',desc:'Critical striker'},
  {id:'legend',name:'Legend',price:0,levelReq:60,pow:20,spd:18,def:16,skill:'Legend Fury',skillType:'multi',skillVal:2.4,color:'#eab308',desc:'Free at Level 60'},
  {id:'king',name:'K.O. King',price:0,levelReq:100,pow:25,spd:22,def:20,skill:'Final Knockout',skillType:'ko',skillVal:5,color:'#e11d48',desc:'Ultimate - Level 100'}
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
    user:user,money:0,xp:0,level:1,selected:0,owned:['rookie'],
    wins:0,losses:0,punches:0,kos:0,skills:0,
    missions:MISSIONS.map(function(m){return {id:m.id,progress:0,done:false};})
  };
}

function loadState(){
  let s=null;
  try{s=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){s=null;}
  if(!s||!s.user)return defaultState();
  if(!s.owned)s.owned=['rookie'];
  if(!s.missions)s.missions=[];
  MISSIONS.forEach(function(m){
    let has=false;
    for(let i=0;i<s.missions.length;i++){if(s.missions[i].id===m.id)has=true;}
    if(!has)s.missions.push({id:m.id,progress:0,done:false});
  });
  if(typeof s.selected!=='number')s.selected=0;
  if(!s.level)s.level=1;
  return s;
}

let state=loadState();

function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}

const $=function(id){return document.getElementById(id);};
const canvas=$('c');
const ctx=canvas.getContext('2d');
const W=300,H=400;
const LANES=[80,220];

let running=false;
let last=0;
let fight=null;
let audioCtx=null;

function beep(freq,dur,type){
  try{
    if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    const o=audioCtx.createOscillator();
    const g=audioCtx.createGain();
    o.type=type||'square';
    o.frequency.value=freq;
    g.gain.value=0.08;
    g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+dur);
    o.connect(g);g.connect(audioCtx.destination);
    o.start();o.stop(audioCtx.currentTime+dur);
  }catch(e){}
}

function xpNeeded(l){return Math.floor(60*Math.pow(l,1.15));}
function fighter(){return FIGHTERS[state.selected]||FIGHTERS[0];}
function isOwned(f){return state.owned.indexOf(f.id)>=0;}

function grantLevelUnlocks(){
  let unlocked=false;
  FIGHTERS.forEach(function(f){
    if(f.levelReq>0&&state.level>=f.levelReq&&state.owned.indexOf(f.id)<0){
      state.owned.push(f.id);unlocked=true;
    }
  });
  return unlocked;
}

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
  grantLevelUnlocks();
  return state.level-before;
}

function missionProgress(m){
  for(let i=0;i<MISSIONS.length;i++){
    if(MISSIONS[i].id!==m.id)continue;
    const t=MISSIONS[i].type;
    if(t==='wins')return state.wins;
    if(t==='punches')return state.punches;
    if(t==='kos')return state.kos;
    if(t==='skills')return state.skills;
    if(t==='level')return state.level;
  }
  return 0;
}

function checkMissions(){
  state.missions.forEach(function(m){
    if(m.done)return;
    let def=null;
    for(let i=0;i<MISSIONS.length;i++){if(MISSIONS[i].id===m.id)def=MISSIONS[i];}
    if(!def)return;
    m.progress=missionProgress(m);
    if(m.progress>=def.target){m.done=true;state.money+=def.reward;}
  });
}

function show(id){
  const list=document.querySelectorAll('.overlay');
  for(let i=0;i<list.length;i++)list[i].classList.add('hidden');
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
  $('mstats').textContent='Wins '+state.wins+' | KO '+state.kos+' | '+
    f.name+' (POW '+f.pow+' SPD '+f.spd+' DEF '+f.def+')';
}

function renderFighters(){
  const el=$('flist');
  el.innerHTML='';
  FIGHTERS.forEach(function(f,i){
    const owned=isOwned(f);
    const sel=state.selected===i;
    const d=document.createElement('div');
    d.className='fitem';
    let html='<b>'+f.name+'</b>';
    html+='<span>POW '+f.pow+' | SPD '+f.spd+' | DEF '+f.def+'</span>';
    html+='<span>Skill: '+f.skill+'</span>';
    if(f.levelReq>0&&!owned)html+='<span>Unlocks free at Level '+f.levelReq+'</span>';
    d.innerHTML=html;
    const btn=document.createElement('button');
    if(sel){btn.textContent='Selected';btn.disabled=true;}
    else if(owned){btn.textContent='Select';btn.onclick=function(){state.selected=i;save();renderFighters();updateMenu();};}
    else if(f.levelReq>0){btn.textContent='Locked - Lv '+f.levelReq;btn.disabled=true;}
    else if(state.money>=f.price){
      btn.textContent='Buy $'+f.price;
      btn.onclick=function(){
        if(state.money<f.price)return;
        state.money-=f.price;state.owned.push(f.id);state.selected=i;
        save();renderFighters();updateMenu();
      };
    }
    else{btn.textContent='Need $'+(f.price-state.money);btn.disabled=true;}
    d.appendChild(btn);
    el.appendChild(d);
  });
}

function renderMissions(){
  const el=$('mlist');
  el.innerHTML='';
  state.missions.forEach(function(m){
    let def=null;
    for(let i=0;i<MISSIONS.length;i++){if(MISSIONS[i].id===m.id)def=MISSIONS[i];}
    if(!def)return;
    const prog=Math.min(missionProgress(m),def.target);
    const d=document.createElement('div');
    d.className='mitem';
    d.innerHTML='<b>'+def.title+'</b><span>'+prog+'/'+def.target+
      ' | Reward $'+def.reward+(m.done?' | DONE':'')+'</span>';
    el.appendChild(d);
  });
}

function startFight(){
  const f=fighter();
  fight={
    time:45,
    phpMax:80+f.def*4+state.level*2,
    ehpMax:90+state.level*9,
    php:0,ehp:0,energy:0,
    pBlock:false,pPunchCd:0,pHitT:0,eHitT:0,
    pPunchAnim:0,ePunchAnim:0,
    eAtkCd:1.3,eWind:0,eStun:0,
    eBlocking:false,eBlockCd:0,
    over:false
  };
  fight.php=fight.phpMax;
  fight.ehp=fight.ehpMax;
  running=true;
  last=0;
  show(null);
  showControls();
  requestAnimationFrame(loop);
}

function enemyAttack(){
  fight.ePunchAnim=0.22;
  const f=fighter();
  let dmg=6+state.level*0.35+Math.random()*3;
  dmg=dmg*(100/(100+f.def*2.5));
  if(fight.pBlock)dmg*=0.3;
  dmg=Math.max(2,dmg);
  fight.php-=dmg;
  fight.pHitT=0.18;
  fight.energy=Math.min(100,fight.energy+8);
  if(fight.php<=0){fight.php=0;endFight(false,'KO');return;}
  fight.eAtkCd=Math.max(0.7,1.6-state.level*0.004)+Math.random()*0.6;
  beep(150,0.08,'sawtooth');
}

function playerPunch(){
  if(!running||!fight||fight.over)return;
  if(fight.pPunchCd>0)return;
  const f=fighter();
  fight.pPunchCd=Math.max(0.2,0.8-f.spd*0.02);
  fight.pPunchAnim=0.18;
  let dmg=(4+f.pow*0.9)*(0.9+Math.random()*0.2);
  const blocked=fight.eBlocking;
  if(blocked)dmg*=0.4;
  fight.ehp-=dmg;
  fight.eHitT=0.16;
  state.punches++;
  fight.energy=Math.min(100,fight.energy+(blocked?4:12));
  if(!blocked&&Math.random()<0.25){fight.eBlocking=true;fight.eBlockCd=0.7;}
  beep(blocked?300:520,0.04,'square');
  if(fight.ehp<=0){fight.ehp=0;endFight(true,'KO');}
}

function useSkill(){
  if(!running||!fight||fight.over)return;
  if(fight.energy<100)return;
  const f=fighter();
  let dmg=(4+f.pow*0.9)*f.skillVal;
  fight.energy=0;
  fight.pPunchAnim=0.4;
  state.skills++;
  if(f.skillType==='shield'){fight.php=Math.min(fight.phpMax,fight.php+12+f.def);}
  else if(f.skillType==='stun'){fight.eStun=2.2;}
  else if(f.skillType==='multi'){dmg*=1.15;}
  else if(f.skillType==='crit'){dmg*=1.3;}
  else if(f.skillType==='ko'){dmg*=1.45;}
  fight.ehp-=dmg;
  fight.eHitT=0.32;
  beep(90,0.35,'sawtooth');
  if(fight.ehp<=0){fight.ehp=0;endFight(true,'KO');}
}

function endFight(won,reason){
  if(!fight||fight.over)return;
  fight.over=true;
  running=false;
  let money=0,xp=0,ups=0;
  if(won){
    state.wins++;
    if(reason==='KO')state.kos++;
    money=40+state.level*8+(reason==='KO'?40:0);
    xp=50+state.level*10+(reason==='KO'?25:0);
    state.money+=money;
    ups=addXp(xp);
  }else{
    state.losses++;
  }
  grantLevelUnlocks();
  checkMissions();
  save();
  $('otitle').textContent=won?'You Win!':'You Lose';
  let txt=(reason==='KO'?'Knockout! ':'Time up! ');
  if(won)txt+='+$'+money+'  +'+xp+' XP';
  else txt+='Try blocking when the red ! appears.';
  if(ups>0)txt+='  LEVEL UP x'+ups;
  if(ups>0&&state.level>=MAX_LEVEL)txt+='  K.O. King unlocked!';
  $('otext').textContent=txt;
  show('over');
  hideControls();
  beep(won?660:120,0.4,won?'square':'sawtooth');
}

function update(dt){
  if(!fight||fight.over)return;
  fight.time-=dt;
  if(fight.time<=0){fight.time=0;endFight(fight.php>=fight.ehp,'TIME');return;}

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
      if(fight.eAtkCd<=0)fight.eWind=0.75;
    }
  }
}

function drawBar(x,y,w,h,r,color){
  if(r<0)r=0;if(r>1)r=1;
  ctx.fillStyle='#333';ctx.fillRect(x,y,w,h);
  ctx.fillStyle=color;ctx.fillRect(x,y,w*r,h);
  ctx.strokeStyle='#000';ctx.lineWidth=1;ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
}

function drawBoxer(cx,dir,col,punch,block,flash){
  const body=flash>0?'#ffffff':col;
  const feetY=335,hipY=270,topY=205,headY=185,shoulderY=222;
  ctx.save();
  ctx.translate(cx,338);ctx.scale(1,0.28);
  ctx.beginPath();ctx.arc(0,0,30,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.fill();
  ctx.restore();

  ctx.strokeStyle=body;ctx.lineWidth=10;ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(cx-9,hipY);ctx.lineTo(cx-15,feetY);
  ctx.moveTo(cx+9,hipY);ctx.lineTo(cx+15,feetY);
  ctx.stroke();

  ctx.fillStyle=body;
  ctx.fillRect(cx-18,topY,36,hipY-topY+4);

  ctx.beginPath();ctx.arc(cx,headY,18,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#e11d48';ctx.fillRect(cx-18,headY-6,36,6);
  ctx.fillStyle='#111';
  ctx.fillRect(cx-8+dir*3,headY+1,4,4);
  ctx.fillRect(cx+4+dir*3,headY+1,4,4);

  let g1x=cx+dir*18,g1y=block?headY+8:208;
  let g2x=cx+dir*24,g2y=block?headY+12:232;
  if(punch>0){g1x=cx+dir*56;g1y=headY+2;}
  ctx.strokeStyle=body;ctx.lineWidth=11;
  ctx.beginPath();
  ctx.moveTo(cx-dir*4,shoulderY);ctx.lineTo(g1x,g1y);
  ctx.moveTo(cx-dir*8,shoulderY+4);ctx.lineTo(g2x,g2y);
  ctx.stroke();
  ctx.fillStyle='#e11d48';
  ctx.beginPath();ctx.arc(g1x,g1y,10,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(g2x,g2y,10,0,Math.PI*2);ctx.fill();
}

function draw(){
  const f=fighter();
  ctx.fillStyle='#0a0a12';ctx.fillRect(0,0,W,H);

  ctx.fillStyle='#15152a';
  for(let i=0;i<46;i++){ctx.fillRect((i*71)%W,(i*29)%180,3,3);}

  ctx.fillStyle='#241a10';ctx.fillRect(0,300,W,100);
  ctx.fillStyle='#3b2a18';ctx.fillRect(18,300,264,64);

  ctx.strokeStyle='#666';ctx.lineWidth=3;
  const ropes=[205,240,275];
  for(let i=0;i<ropes.length;i++){
    ctx.beginPath();ctx.moveTo(8,ropes[i]);ctx.lineTo(292,ropes[i]);ctx.stroke();
  }
  ctx.fillStyle='#777';ctx.fillRect(6,195,5,140);ctx.fillRect(289,195,5,140);

  drawBoxer(LANES[0],1,f.color,fight.pPunchAnim>0,fight.pBlock,fight.pHitT>0);
  drawBoxer(LANES[1],-1,'#c2410c',fight.ePunchAnim>0,fight.eBlocking,fight.eHitT>0);

  drawBar(10,10,120,10,fight.php/fight.phpMax,'#22c55e');
  drawBar(170,10,120,10,fight.ehp/fight.ehpMax,'#ef4444');

  ctx.fillStyle='#ddd';ctx.font='11px sans-serif';ctx.textAlign='left';
  ctx.fillText(f.name,10,34);
  ctx.textAlign='right';ctx.fillText('Rival Lv'+state.level,290,34);

  ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 18px sans-serif';
  ctx.fillText(Math.ceil(fight.time),150,30);
  ctx.font='9px sans-serif';ctx.fillStyle='#888';ctx.fillText('TIME',150,41);

  ctx.textAlign='left';ctx.font='9px sans-serif';ctx.fillStyle='#aaa';
  ctx.fillText('SKILL',10,50);
  drawBar(10,54,120,7,fight.energy/100,'#facc15');

  if(fight.eWind>0&&!fight.over){
    const s=1+Math.sin(new Date().getTime()/90)*0.15;
    ctx.save();ctx.translate(220,148);ctx.scale(s,s);
    ctx.fillStyle='#ef4444';ctx.textAlign='center';ctx.font='bold 26px sans-serif';
    ctx.fillText('!',0,0);ctx.restore();
  }
  if(fight.pBlock){
    ctx.fillStyle='#3b82f6';ctx.textAlign='center';ctx.font='bold 10px sans-serif';
    ctx.fillText('BLOCK',80,158);
  }
  ctx.textAlign='left';
}

function loop(ts){
  if(!running)return;
  let dt=0;
  if(last)dt=Math.min((ts-last)/1000,0.05);
  last=ts;
  update(dt);
  if(!running)return;
  draw();
  requestAnimationFrame(loop);
}

function setBlock(v){
  if(fight&&!fight.over)fight.pBlock=v;
}

window.addEventListener('keydown',function(e){
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

window.addEventListener('keyup',function(e){
  const k=e.key||'';
  const c=e.keyCode;
  if(k==='8'||c===56||k==='ArrowDown'||c===40)setBlock(false);
});

let btnBlock=$('btnBlock');
['touchstart','mousedown'].forEach(function(ev){
  btnBlock.addEventListener(ev,function(e){e.preventDefault();setBlock(true);});
});
['touchend','touchcancel','mouseup','mouseleave'].forEach(function(ev){
  btnBlock.addEventListener(ev,function(e){if(e.preventDefault)e.preventDefault();setBlock(false);});
});

$('btnPunch').addEventListener('click',playerPunch);
$('btnSkill').addEventListener('click',useSkill);

$('fight').onclick=startFight;
$('fighters').onclick=function(){renderFighters();show('fghv');};
$('missions').onclick=function(){renderMissions();show('missv');};
$('back1').onclick=function(){updateMenu();show('menu');};
$('back2').onclick=function(){updateMenu();show('menu');};
$('retry').onclick=startFight;
$('menu2').onclick=function(){updateMenu();show('menu');hideControls();};
$('home').onclick=function(){location.href='../../index.html';};

updateMenu();
show('menu');
hideControls();
save();
