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
    const o=audioCtx.createOscillator();
    const g=audioCtx.createGain();
    o.type=type||'square';
    o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vol||0.08,t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g);g.connect(audioCtx.destination);
    o.start(t);o.stop(t+dur+0.03);
  }catch(e){}
}
function bell(){beep(880,0.14,'triangle',0.12);setTimeout(function(){beep(880,0.14,'triangle',0.12);},170);}

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
  unlockAudio();
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
  bell();
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
  beep(150,0.09,'sawtooth',0.1);
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
  beep(blocked?260:560,0.06,'square',0.07);
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
  beep(90,0.4,'sawtooth',0.14);
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
  if(fight.time<=0){fight.time=0;endFight((fight.php/fight.phpMax)>=(fight.ehp/fight.ehpMax),'TIME');return;}

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

function rrect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function drawImpact(x,y,size,color){
  ctx.save();
  ctx.translate(x,y);
  ctx.strokeStyle=color;
  ctx.lineWidth=2.5;
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4+0.3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*size*0.35,Math.sin(a)*size*0.35);
    ctx.lineTo(Math.cos(a)*size,Math.sin(a)*size);
    ctx.stroke();
  }
  ctx.fillStyle=color;
  ctx.beginPath();ctx.arc(0,0,size*0.28,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawBoxer(cx,dir,col,punch,block,flash,bob){
  bob=bob||0;
  const skinL=dir>0, skin=skinL?'#e8b48a':'#c98a5b';
  const body=flash>0?'#ffffff':skin;
  const trunk=flash>0?'#ffffff':col;
  const glove=flash>0?'#ffffff':'#dc2626';
  const feetY=356+bob,hipY=294+bob,chestY=240+bob,shoulderY=247+bob,headY=207+bob,headR=17;

  ctx.save();
  ctx.translate(cx,feetY+5);ctx.scale(1,0.26);
  ctx.beginPath();ctx.arc(0,0,34,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,.42)';ctx.fill();
  ctx.restore();

  ctx.strokeStyle=body;ctx.lineWidth=13;ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(cx-8,hipY-2);ctx.lineTo(cx-15,feetY-7);
  ctx.moveTo(cx+8,hipY-2);ctx.lineTo(cx+16,feetY-7);
  ctx.stroke();
  ctx.fillStyle=flash>0?'#fff':'#1f2937';
  rrect(cx-26,feetY-8,22,9,3);ctx.fill();
  rrect(cx+5,feetY-8,22,9,3);ctx.fill();

  ctx.fillStyle=trunk;
  ctx.beginPath();
  ctx.moveTo(cx-16,hipY-16);ctx.lineTo(cx+16,hipY-16);
  ctx.lineTo(cx+19,hipY+12);ctx.lineTo(cx+3,hipY+12);
  ctx.lineTo(cx,hipY+1);ctx.lineTo(cx-3,hipY+12);
  ctx.lineTo(cx-19,hipY+12);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.8)';
  ctx.fillRect(cx-16,hipY-17,32,4);

  ctx.fillStyle=body;
  ctx.beginPath();
  ctx.moveTo(cx-17,chestY);
  ctx.quadraticCurveTo(cx-23,chestY+22,cx-13,hipY-6);
  ctx.lineTo(cx+13,hipY-6);
  ctx.quadraticCurveTo(cx+23,chestY+22,cx+17,chestY);
  ctx.quadraticCurveTo(cx,chestY-13,cx-17,chestY);
  ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.16)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(cx,chestY+13);ctx.lineTo(cx,hipY-8);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx-8,chestY+23);ctx.lineTo(cx+8,chestY+23);ctx.stroke();

  ctx.fillStyle=body;
  ctx.beginPath();ctx.arc(cx-16,shoulderY,9,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(cx+16,shoulderY,9,0,Math.PI*2);ctx.fill();

  ctx.beginPath();ctx.arc(cx-headR+1,headY+2,4.5,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(cx+headR-1,headY+2,4.5,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(cx,headY,headR,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=flash>0?'#fff':'#3b2418';
  ctx.beginPath();ctx.arc(cx,headY-3,headR,Math.PI*1.03,Math.PI*1.97);ctx.fill();
  ctx.fillStyle=trunk;
  ctx.fillRect(cx-headR,headY-8,headR*2,5);

  ctx.fillStyle='#111';
  ctx.fillRect(cx-8+dir*2,headY+3,4,4);
  ctx.fillRect(cx+4+dir*2,headY+3,4,4);
  ctx.strokeStyle='#3b2418';ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(cx-10+dir*2,headY-1);ctx.lineTo(cx-3+dir*2,headY);
  ctx.moveTo(cx+3+dir*2,headY);ctx.lineTo(cx+10+dir*2,headY-1);
  ctx.stroke();
  ctx.strokeStyle='#7f1d1d';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(cx+dir,headY+10,4,0.15*Math.PI,0.85*Math.PI);ctx.stroke();

  const sway=Math.sin(bob*1.5)*2;
  let g1x,g1y,g2x,g2y;
  if(punch){g1x=cx+dir*58;g1y=headY+5;}
  else if(block){g1x=cx+dir*18;g1y=headY+12;}
  else {g1x=cx+dir*25;g1y=chestY+8+sway;}
  if(block){g2x=cx-dir*12;g2y=headY+22;}
  else {g2x=cx-dir*4;g2y=chestY+22+sway;}

  ctx.strokeStyle=body;ctx.lineWidth=13;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(cx-dir*4,shoulderY);ctx.lineTo(g1x,g1y);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx-dir*10,shoulderY+7);ctx.lineTo(g2x,g2y);ctx.stroke();

  ctx.fillStyle=glove;
  ctx.beginPath();ctx.arc(g1x,g1y,11,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(g2x,g2y,11,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.35)';
  ctx.beginPath();ctx.arc(g1x-3,g1y-3,3.5,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(g2x-3,g2y-3,3.5,0,Math.PI*2);ctx.fill();

  if(block){
    ctx.strokeStyle='rgba(96,165,250,.9)';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(cx+dir*16,chestY+4,30,-Math.PI/2,Math.PI/2,dir<0);ctx.stroke();
  }
  if(punch){
    ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(g1x,g1y,17,0,Math.PI*2);ctx.stroke();
  }
}

function draw(){
  const f=fighter();
  const now=performance.now();
  const bob=Math.sin(now/330)*1.8;
  const tsec=now/1000;

  const shake=Math.max(fight.pHitT,fight.eHitT)*6;
  ctx.save();
  if(shake>0)ctx.translate((Math.random()-0.5)*shake,(Math.random()-0.5)*shake);

  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,'#090914');bg.addColorStop(0.6,'#121228');bg.addColorStop(1,'#07070f');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

  for(let i=0;i<58;i++){
    const x=(i*71)%W,y=(i*37)%170;
    const tw=0.25+0.5*Math.abs(Math.sin(tsec*2+i));
    ctx.fillStyle='rgba(255,220,160,'+tw.toFixed(2)+')';
    ctx.fillRect(x,y,3,3);
  }
  const sp1=ctx.createRadialGradient(80,0,10,80,0,220);
  sp1.addColorStop(0,'rgba(255,255,255,.14)');sp1.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=sp1;ctx.fillRect(0,0,W,300);
  const sp2=ctx.createRadialGradient(225,0,10,225,0,220);
  sp2.addColorStop(0,'rgba(120,170,255,.12)');sp2.addColorStop(1,'rgba(120,170,255,0)');
  ctx.fillStyle=sp2;ctx.fillRect(0,0,W,300);

  ctx.fillStyle='#241a10';ctx.fillRect(0,300,W,100);
  const floor=ctx.createLinearGradient(0,300,0,400);
  floor.addColorStop(0,'#4a3420');floor.addColorStop(1,'#221708');
  ctx.fillStyle=floor;
  ctx.beginPath();ctx.moveTo(18,300);ctx.lineTo(282,300);ctx.lineTo(300,400);ctx.lineTo(0,400);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=1;
  for(let i=0;i<5;i++){
    ctx.beginPath();ctx.moveTo(18+i*66,300);ctx.lineTo(0+i*75,400);ctx.stroke();
  }

  ctx.strokeStyle='#9ca3af';ctx.lineWidth=3;
  const ropes=[205,240,275];
  for(let i=0;i<ropes.length;i++){
    ctx.strokeStyle=i===1?'#e5e7eb':'#9ca3af';
    ctx.beginPath();ctx.moveTo(8,ropes[i]);ctx.lineTo(292,ropes[i]);ctx.stroke();
  }
  ctx.fillStyle='#6b7280';ctx.fillRect(6,195,6,140);ctx.fillRect(288,195,6,140);
  ctx.fillStyle='#ef4444';ctx.fillRect(10,193,14,6);ctx.fillRect(276,193,14,6);

  drawBoxer(LANES[0],1,f.color,fight.pPunchAnim>0,fight.pBlock,fight.pHitT>0,bob);
  drawBoxer(LANES[1],-1,'#c2410c',fight.ePunchAnim>0,fight.eBlocking,fight.eHitT>0,-bob);

  if(fight.pHitT>0)drawImpact(LANES[0]+22,225,18,'#fde047');
  if(fight.eHitT>0)drawImpact(LANES[1]-22,225,18,'#f87171');

  ctx.restore();

  drawBar(10,10,120,10,fight.php/fight.phpMax,'#22c55e');
  drawBar(170,10,120,10,fight.ehp/fight.ehpMax,'#ef4444');
  ctx.fillStyle='rgba(255,255,255,.35)';
  ctx.font='8px sans-serif';ctx.textAlign='center';
  ctx.fillText(Math.ceil(fight.php)+'/'+Math.ceil(fight.phpMax),70,30);
  ctx.fillText(Math.ceil(fight.ehp)+'/'+Math.ceil(fight.ehpMax),230,30);

  ctx.fillStyle='#ddd';ctx.font='11px sans-serif';ctx.textAlign='left';
  ctx.fillText(f.name,10,47);
  ctx.textAlign='right';ctx.fillText('Rival Lv'+state.level,290,47);

  ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 18px sans-serif';
  ctx.fillText(Math.ceil(fight.time),150,30);
  ctx.font='9px sans-serif';ctx.fillStyle='#888';ctx.fillText('TIME',150,41);

  ctx.textAlign='left';ctx.font='9px sans-serif';ctx.fillStyle='#aaa';
  ctx.fillText('SKILL',10,57);
  drawBar(10,61,120,7,fight.energy/100,'#facc15');
  if(fight.energy>=100){
    ctx.fillStyle='#facc15';ctx.font='bold 9px sans-serif';ctx.textAlign='right';
    ctx.fillText('READY!',130,68);ctx.textAlign='left';
  }

  if(fight.eWind>0&&!fight.over){
    const s=1+Math.sin(now/80)*0.18;
    ctx.save();ctx.translate(225,180);ctx.scale(s,s);
    ctx.fillStyle='rgba(239,68,68,.25)';
    ctx.beginPath();ctx.arc(0,-6,20,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ef4444';ctx.textAlign='center';ctx.font='bold 30px sans-serif';
    ctx.fillText('!',0,4);ctx.restore();
    ctx.textAlign='center';ctx.fillStyle='#fca5a5';ctx.font='bold 9px sans-serif';
    ctx.fillText('BLOCK NOW',225,210);
  }
  if(fight.pBlock){
    ctx.fillStyle='#60a5fa';ctx.textAlign='center';ctx.font='bold 11px sans-serif';
    ctx.fillText('BLOCKING',80,180);
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

$('btnPunch').addEventListener('click',function(){unlockAudio();playerPunch();});
$('btnSkill').addEventListener('click',function(){unlockAudio();useSkill();});

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
