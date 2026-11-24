'use strict';
let params;
try{params=new URLSearchParams(location.search);}catch(e){params={get:function(){return null;}};}
function storeGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function storeSet(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}}

let user=params.get('user');
if(!user){try{const u=JSON.parse(storeGet('wg_user')||'null');if(u&&u.name)user=u.name;}catch(e){}}
if(!user)user='guest';
const KEY='bounce_'+user;
const MUTE_KEY='bounce_muted';

try{
  if(typeof CanvasRenderingContext2D!=='undefined'&&CanvasRenderingContext2D.prototype&&!CanvasRenderingContext2D.prototype.ellipse){
    CanvasRenderingContext2D.prototype.ellipse=function(x,y,rx,ry,rot,start,end,ccw){
      this.save();this.translate(x,y);if(rot)this.rotate(rot);this.scale(rx,ry);
      this.arc(0,0,1,start,end,ccw);this.restore();
    };
  }
}catch(e){}

const W=360,H=480,GROUND=440,BALL_R=14;
const GRAV=1700,JUMP_V=760,AUTO_V=360,AIR_V=470,MOVE_V=185;

const LEVELS=[
  {name:'First Hop',length:1300,hearts:3,checkpoints:[700],
   rings:[[250,375],[380,330],[510,365],[650,335],[770,370],[900,330],[1030,365],[1140,340]],
   spikes:[[320,2],[560,3],[830,2],[980,3]],hazards:[]},
  {name:'Ring Trail',length:1600,hearts:3,checkpoints:[460,1080],
   rings:[[230,370],[340,320],[470,370],[600,335],[740,370],[880,320],[1010,365],[1130,335],[1270,370],[1400,330]],
   spikes:[[300,2],[560,2],[700,3],[900,2],[1180,3],[1360,2]],hazards:[]},
  {name:'High Hopes',length:1800,hearts:3,checkpoints:[620,1250],
   rings:[[220,330],[360,300],[500,330],[640,295],[780,330],[920,300],[1060,330],[1200,295],[1340,330],[1500,300],[1640,340]],
   spikes:[[290,2],[520,2],[820,3],[1120,2],[1400,3],[1560,2]],hazards:[]},
  {name:'Buzz Zone',length:2000,hearts:3,checkpoints:[680,1360],
   rings:[[240,370],[400,320],[550,365],[720,320],[880,365],[1030,330],[1200,370],[1330,330],[1500,370],[1640,340],[1820,365]],
   spikes:[[300,2],[580,2],[850,3],[1080,2],[1450,3],[1660,2],[1800,2]],
   hazards:[{x1:440,x2:600,y:330,speed:55,r:9},{x1:1180,x2:1340,y:320,speed:65,r:9}]},
  {name:'Spike Valley',length:2200,hearts:3,checkpoints:[820,1460],
   rings:[[230,370],[380,330],[540,365],[660,320],[800,365],[980,330],[1140,370],[1240,320],[1400,365],[1560,330],[1740,370],[1900,330],[2030,360]],
   spikes:[[280,2],[480,3],[700,2],[920,3],[1100,2],[1300,3],[1520,2],[1700,3],[1880,2]],
   hazards:[{x1:560,x2:720,y:330,speed:60,r:9},{x1:1390,x2:1570,y:315,speed:70,r:9},{x1:1900,x2:2050,y:345,speed:60,r:9}]},
  {name:'Bounce Master',length:2500,hearts:3,checkpoints:[880,1840],
   rings:[[240,370],[390,330],[500,300],[650,365],[820,330],[960,300],[1100,365],[1240,330],[1400,300],[1540,365],[1700,330],[1860,300],[2000,365],[2180,330],[2320,360]],
   spikes:[[300,3],[540,2],[760,3],[1000,2],[1180,3],[1360,2],[1560,3],[1760,2],[1950,3],[2140,2],[2260,3]],
   hazards:[{x1:600,x2:740,y:320,speed:70,r:9},{x1:1230,x2:1400,y:335,speed:75,r:9},{x1:1850,x2:2020,y:315,speed:80,r:9}]}
];

const THEMES=[
  {top:'#0e2b4d',bottom:'#35708f',sun:'#ffe9a8',far:'#153a56',near:'#155244',ground:'#1d5c3d',dirt:'#122b22'},
  {top:'#261438',bottom:'#8d4463',sun:'#ffcf9e',far:'#3b2050',near:'#4a2b52',ground:'#4a3346',dirt:'#241a2e'},
  {top:'#0b2036',bottom:'#2f5d7c',sun:'#d8f3ff',far:'#173a52',near:'#165a52',ground:'#1d6248',dirt:'#102a24'},
  {top:'#1c1430',bottom:'#5e3d78',sun:'#ffe0b8',far:'#2c1f46',near:'#3a2a58',ground:'#3d3558',dirt:'#1e1930'},
  {top:'#132a2f',bottom:'#4d7a5d',sun:'#f6ffcf',far:'#1c3c41',near:'#255a44',ground:'#2a6647',dirt:'#142a22'},
  {top:'#231027',bottom:'#7a2e46',sun:'#ffd6a1',far:'#351a38',near:'#4a2440',ground:'#4c2c3d',dirt:'#251520'}
];

function xpNeeded(l){return l*120;}
function defaultState(){
  return {user:user,money:0,xp:0,level:1,unlocked:1,levelsDone:[],totalRings:0,bestTimes:{}};
}
function loadState(){
  let s=null;
  try{s=JSON.parse(storeGet(KEY)||'null');}catch(e){s=null;}
  if(!s||typeof s!=='object'||!s.user)s=defaultState();
  ['money','xp','level','unlocked','totalRings'].forEach(function(k){
    if(typeof s[k]!=='number'||!isFinite(s[k])||s[k]<0)s[k]=k==='unlocked'?1:(k==='level'?1:0);
  });
  if(s.level<1)s.level=1;
  s.unlocked=Math.max(1,Math.min(LEVELS.length,Math.floor(s.unlocked)));
  if(!Array.isArray(s.levelsDone))s.levelsDone=[];
  s.levelsDone=s.levelsDone.map(function(v){return Math.floor(v);}).filter(function(v,i,a){
    return v>=0&&v<LEVELS.length&&a.indexOf(v)===i;
  });
  if(typeof s.bestTimes!=='object'||!s.bestTimes)s.bestTimes={};
  return s;
}
let state=loadState();
function save(){storeSet(KEY,JSON.stringify(state));}

const $=function(id){return document.getElementById(id);};
const canvas=$('c');
const ctx=canvas.getContext('2d');
const input={left:false,right:false};
let jumpBuffer=0,airJumpUsed=false;
let lastFrame=0,menuT=0;
let touchEnabled=false;
try{touchEnabled=('ontouchstart' in window)||navigator.maxTouchPoints>0;}catch(e){}

const game={
  mode:'menu',
  levelIndex:0,
  level:LEVELS[0],
  rings:[],
  spikes:[],
  hazards:[],
  checkpoints:[],
  hearts:3,
  maxHearts:3,
  invuln:0,
  time:0,
  ringsCollected:0,
  ringsTotal:0,
  checkpoint:0,
  flash:0,
  particles:[],
  ball:{x:60,y:GROUND-BALL_R,vx:0,vy:0,rot:0}
};

let audioCtx=null,master=null,muted=storeGet(MUTE_KEY)==='1';
function unlockAudio(){
  try{
    if(!audioCtx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;
      audioCtx=new AC();
      master=audioCtx.createGain();master.gain.value=0.8;master.connect(audioCtx.destination);
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
function clickSound(){tone(480,0.06,'square',0.05);}
function jumpSound(){tone(420,0.13,'triangle',0.09,760);}
function airSound(){tone(620,0.1,'sine',0.07,920);}
function landSound(){tone(170,0.05,'sine',0.03,120);}
function ringSound(){tone(880,0.13,'triangle',0.11,1320);}
function checkpointSound(){tone(700,0.12,'square',0.07,980);}
function hitSound(){tone(180,0.3,'sawtooth',0.12,70);}
function winSound(){[523,659,784,1047,1319].forEach(function(f,i){setTimeout(function(){tone(f,0.2,'triangle',0.12);},i*110);});}
function loseSound(){tone(300,0.5,'sawtooth',0.12,90);}
function levelSound(){tone(660,0.14,'square',0.09,990);}
document.addEventListener('pointerdown',unlockAudio,{once:true});
document.addEventListener('touchstart',unlockAudio,{once:true,passive:true});
document.addEventListener('keydown',unlockAudio,{once:true});

function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function activeOverlay(){return document.querySelector('.overlay:not(.hidden)');}
function overlayVisible(){return !!activeOverlay();}
function show(id){
  const list=document.querySelectorAll('.overlay');
  for(let i=0;i<list.length;i++)list[i].classList.add('hidden');
  if(id){
    const el=$(id);
    if(el){
      el.classList.remove('hidden');
      const bs=el.querySelectorAll('button');
      for(let i=0;i<bs.length;i++){
        if(!bs[i].disabled&&!bs[i].classList.contains('hidden')){
          try{bs[i].focus();}catch(e){}
          break;
        }
      }
    }
  }
}
let toastTimer=null;
function toast(msg){
  const el=$('toast');
  if(!el)return;
  el.textContent=msg;
  el.classList.add('show');
  if(toastTimer)clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){el.classList.remove('show');toastTimer=null;},2000);
}
function syncChrome(){
  const p=$('pauseBtn'),t=$('touchcontrols');
  if(p)p.classList.toggle('hidden',game.mode!=='playing');
  if(t)t.classList.toggle('hidden',!(touchEnabled&&game.mode==='playing'));
}
function addXp(n){
  if(n<=0)return 0;
  state.xp+=n;
  let gained=0;
  while(state.xp>=xpNeeded(state.level)){
    state.xp-=xpNeeded(state.level);
    state.level++;
    state.money+=state.level*30;
    gained++;
  }
  if(gained){
    levelSound();
    toast('Level up! Lv '+state.level);
  }
  return gained;
}
function updateMenu(){
  if($('userinfo'))$('userinfo').textContent='Player: '+state.user;
  if($('mlevel'))$('mlevel').textContent=state.level;
  if($('mxp'))$('mxp').textContent=state.xp;
  if($('mneed'))$('mneed').textContent=xpNeeded(state.level);
  if($('mmoney'))$('mmoney').textContent=state.money;
  if($('mstats'))$('mstats').textContent='Levels '+state.levelsDone.length+'/'+LEVELS.length+' · Rings '+state.totalRings;
  const mb=$('mute2');
  if(mb)mb.textContent=muted?'Sound: Off':'Sound: On';
}
function allRings(){return game.ringsCollected>=game.ringsTotal;}

function loadLevel(i){
  if(!(i>=0&&i<LEVELS.length))i=0;
  const lv=LEVELS[i];
  game.levelIndex=i;
  game.level=lv;
  game.rings=lv.rings.map(function(r){return {x:r[0],y:r[1],taken:false};});
  game.ringsTotal=game.rings.length;
  game.ringsCollected=0;
  game.spikes=lv.spikes.map(function(s){return {x:s[0],count:s[1]};});
  game.hazards=(lv.hazards||[]).map(function(h){
    return {x:(h.x1+h.x2)/2,x1:h.x1,x2:h.x2,y:h.y,r:h.r||9,speed:h.speed||55,dir:1};
  });
  game.checkpoints=(lv.checkpoints||[]).map(function(x){return {x:x,reached:false};});
  game.hearts=lv.hearts||3;
  game.maxHearts=lv.hearts||3;
  game.invuln=0;
  game.time=0;
  game.checkpoint=0;
  game.flash=0;
  game.particles=[];
  game.ball={x:60,y:GROUND-BALL_R,vx:0,vy:0,rot:0};
  input.left=false;
  input.right=false;
  jumpBuffer=0;
  airJumpUsed=false;
}
function startLevel(i){
  loadLevel(i);
  game.mode='playing';
  show(null);
  syncChrome();
  unlockAudio();
  clickSound();
  toast('Level '+(i+1)+' · '+LEVELS[i].name);
}
function continueGame(){
  const idx=Math.min(state.unlocked-1,LEVELS.length-1);
  startLevel(Math.max(0,idx));
}
function pauseGame(){
  if(game.mode!=='playing')return;
  game.mode='paused';
  input.left=false;
  input.right=false;
  if($('plevel'))$('plevel').textContent=game.levelIndex+1;
  if($('pringsb'))$('pringsb').textContent=game.ringsCollected+'/'+game.ringsTotal;
  show('pausev');
  syncChrome();
}
function resumeGame(){
  if(game.mode!=='paused')return;
  game.mode='playing';
  show(null);
  syncChrome();
  clickSound();
}
function openMenu(){
  game.mode='menu';
  input.left=false;
  input.right=false;
  updateMenu();
  show('menu');
  syncChrome();
}
function levelFailed(){
  if(game.mode!=='playing')return;
  game.mode='failed';
  loseSound();
  syncChrome();
  if($('otitle'))$('otitle').textContent='Level Failed';
  if($('otext'))$('otext').textContent='You ran out of hearts.';
  if($('ostats'))$('ostats').textContent='Rings '+game.ringsCollected+'/'+game.ringsTotal+' · Try again!';
  if($('next'))$('next').classList.add('hidden');
  show('over');
}
function completeLevel(){
  if(game.mode!=='playing')return;
  game.mode='complete';
  const idx=game.levelIndex;
  const time=Math.max(1,Math.round(game.time));
  const bonus=40+game.ringsTotal*8+Math.max(0,45-time);
  state.money+=bonus;
  addXp(60+game.ringsTotal*10);
  state.totalRings+=game.ringsCollected;
  if(!state.bestTimes)state.bestTimes={};
  const key=String(idx);
  if(!state.bestTimes[key]||time<state.bestTimes[key])state.bestTimes[key]=time;
  if(state.levelsDone.indexOf(idx)<0)state.levelsDone.push(idx);
  if(state.unlocked<idx+2)state.unlocked=Math.min(LEVELS.length,idx+2);
  save();
  winSound();
  syncChrome();
  const last=idx>=LEVELS.length-1;
  if($('otitle'))$('otitle').textContent=last?'All Levels Cleared!':'Level Complete!';
  if($('otext'))$('otext').textContent=last?'Every ring collected. You are a Bounce master!':'Every ring collected. The gate is open!';
  if($('ostats'))$('ostats').textContent='Time '+time+'s · Rings '+game.ringsCollected+'/'+game.ringsTotal+' · Coins +'+bonus;
  if($('next'))$('next').classList.toggle('hidden',last);
  show('over');
}

function burst(x,y,color){
  for(let i=0;i<12;i++){
    const a=Math.random()*Math.PI*2,sp=30+Math.random()*90;
    game.particles.push({
      x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-40,
      life:0.5+Math.random()*0.35,max:0.85,
      color:color||'#ffd166',size:1.5+Math.random()*2.2
    });
  }
}
function spawnDust(){
  for(let i=0;i<3;i++){
    game.particles.push({
      x:game.ball.x+(Math.random()-0.5)*18,y:GROUND-2,
      vx:(Math.random()-0.5)*40,vy:-20-Math.random()*30,
      life:0.3,max:0.3,color:'rgba(220,235,220,.6)',size:1+Math.random()*1.5
    });
  }
}
function requestJump(){
  if(game.mode!=='playing')return;
  unlockAudio();
  const nearGround=game.ball.y+BALL_R>=GROUND-6;
  if(nearGround){
    jumpBuffer=0.16;
  }else if(game.ball.vy>80&&game.ball.y+BALL_R>=GROUND-60){
    jumpBuffer=0.16;
  }else if(!airJumpUsed&&game.ball.vy>-80){
    game.ball.vy=-AIR_V;
    airJumpUsed=true;
    airSound();
    burst(game.ball.x,game.ball.y,'rgba(190,225,255,.8)');
  }
}
function hurt(){
  if(game.mode!=='playing'||game.invuln>0)return;
  game.hearts--;
  game.flash=0.55;
  game.invuln=1.7;
  hitSound();
  burst(game.ball.x,game.ball.y,'#ff6b6b');
  if(game.hearts<=0){levelFailed();return;}
  game.ball.x=clamp(game.checkpoint+30,BALL_R,game.level.length-120);
  game.ball.y=GROUND-BALL_R-70;
  game.ball.vx=0;
  game.ball.vy=-160;
  game.ball.rot=0;
  airJumpUsed=false;
  jumpBuffer=0;
  toast('Ouch! '+game.hearts+(game.hearts===1?' heart left':' hearts left'));
}
function circleRect(cx,cy,r,rx,ry,rw,rh){
  const nx=clamp(cx,rx,rx+rw),ny=clamp(cy,ry,ry+rh);
  const dx=cx-nx,dy=cy-ny;
  return dx*dx+dy*dy<r*r;
}
function update(dt){
  game.time+=dt;
  if(game.invuln>0)game.invuln=Math.max(0,game.invuln-dt);
  if(game.flash>0)game.flash=Math.max(0,game.flash-dt*2.4);
  if(jumpBuffer>0)jumpBuffer=Math.max(0,jumpBuffer-dt);

  const ball=game.ball;
  const target=(input.right?1:0)-(input.left?1:0);
  const tv=target*MOVE_V;
  ball.vx+=(tv-ball.vx)*Math.min(1,dt*9);
  ball.vy+=GRAV*dt;
  ball.x+=ball.vx*dt;
  ball.y+=ball.vy*dt;
  ball.rot+=ball.vx*dt/BALL_R;

  if(ball.x<BALL_R){ball.x=BALL_R;if(ball.vx<0)ball.vx=0;}

  if(ball.y+BALL_R>=GROUND){
    ball.y=GROUND-BALL_R;
    const strong=jumpBuffer>0;
    ball.vy=strong?-JUMP_V:-AUTO_V;
    if(strong){jumpBuffer=0;jumpSound();}
    else landSound();
    airJumpUsed=false;
    if(strong)spawnDust();
  }

  game.checkpoints.forEach(function(cp){
    if(!cp.reached&&ball.x>=cp.x){
      cp.reached=true;
      game.checkpoint=cp.x;
      checkpointSound();
      toast('Checkpoint!');
    }
  });

  game.rings.forEach(function(r){
    if(r.taken)return;
    const dx=ball.x-r.x,dy=ball.y-r.y;
    if(dx*dx+dy*dy<26*26){
      r.taken=true;
      game.ringsCollected++;
      ringSound();
      burst(r.x,r.y,'#ffd166');
    }
  });

  for(let i=0;i<game.spikes.length;i++){
    const s=game.spikes[i];
    if(circleRect(ball.x,ball.y,BALL_R-2,s.x,GROUND-18,s.count*20,18)){
      hurt();
      if(game.mode!=='playing')return;
    }
  }

  for(let i=0;i<game.hazards.length;i++){
    const h=game.hazards[i];
    h.x+=h.dir*h.speed*dt;
    if(h.x<h.x1){h.x=h.x1;h.dir=1;}
    if(h.x>h.x2){h.x=h.x2;h.dir=-1;}
    const dx=ball.x-h.x,dy=ball.y-h.y,rr=h.r+BALL_R-2;
    if(dx*dx+dy*dy<rr*rr){
      hurt();
      if(game.mode!=='playing')return;
    }
  }

  const gateX=game.level.length-70;
  if(allRings()){
    if(ball.x>=gateX+10){
      completeLevel();
      return;
    }
  }else if(ball.x>gateX-BALL_R-6){
    ball.x=gateX-BALL_R-6;
    if(ball.vx>0)ball.vx=-80;
    if(!toastTimer)toast('Collect all rings first!');
  }
  if(ball.x>game.level.length-BALL_R){
    ball.x=game.level.length-BALL_R;
    if(ball.vx>0)ball.vx=0;
  }
}
function updateParticles(dt){
  for(let i=game.particles.length-1;i>=0;i--){
    const p=game.particles[i];
    p.life-=dt;
    if(p.life<=0){game.particles.splice(i,1);continue;}
    p.vy+=220*dt;
    p.x+=p.vx*dt;
    p.y+=p.vy*dt;
  }
}
function rrect(x,y,w,h,r){
  const rr=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.arcTo(x+w,y,x+w,y+h,rr);
  ctx.arcTo(x+w,y+h,x,y+h,rr);
  ctx.arcTo(x,y+h,x,y,rr);
  ctx.arcTo(x,y,x+w,y,rr);
  ctx.closePath();
}
function drawHills(offset,baseY,amp,period,color){
  ctx.beginPath();
  ctx.moveTo(0,H);
  for(let x=0;x<=W;x+=6){
    const wx=x+offset;
    const y=baseY-Math.sin(wx/period*Math.PI*2)*amp-Math.sin(wx/(period*0.63)*Math.PI*2)*amp*0.35;
    ctx.lineTo(x,y);
  }
  ctx.lineTo(W,H);
  ctx.closePath();
  ctx.fillStyle=color;
  ctx.fill();
}
function drawCloud(x,y,s){
  ctx.fillStyle='rgba(255,255,255,.13)';
  ctx.beginPath();
  ctx.arc(x,y,13*s,0,Math.PI*2);
  ctx.arc(x+15*s,y+3*s,10*s,0,Math.PI*2);
  ctx.arc(x-16*s,y+4*s,9*s,0,Math.PI*2);
  ctx.arc(x+2*s,y-9*s,10*s,0,Math.PI*2);
  ctx.fill();
}
function drawWorld(t,cam){
  const th=THEMES[game.levelIndex%THEMES.length];
  const sky=ctx.createLinearGradient(0,0,0,GROUND);
  sky.addColorStop(0,th.top);
  sky.addColorStop(1,th.bottom);
  ctx.fillStyle=sky;
  ctx.fillRect(0,0,W,H);

  const sg=ctx.createRadialGradient(W-72,66,4,W-72,66,60);
  sg.addColorStop(0,'rgba(255,244,200,.8)');
  sg.addColorStop(1,'rgba(255,244,200,0)');
  ctx.fillStyle=sg;
  ctx.fillRect(W-150,0,180,150);
  ctx.fillStyle=th.sun;
  ctx.beginPath();ctx.arc(W-72,66,21,0,Math.PI*2);ctx.fill();

  for(let i=0;i<4;i++){
    const cx=((i*170-cam*0.15)%620+620)%620-120;
    drawCloud(cx,54+((i*29)%54),0.7+(i%3)*0.22);
  }

  drawHills(cam*0.25,398,24,190,th.far);
  drawHills(cam*0.55,424,18,140,th.near);

  ctx.fillStyle=th.dirt;
  ctx.fillRect(0,GROUND,W,H-GROUND);
  ctx.fillStyle=th.ground;
  ctx.fillRect(0,GROUND,W,10);
  ctx.fillStyle='rgba(255,255,255,.08)';
  ctx.fillRect(0,GROUND,W,2);

  const start=Math.floor(cam/34)*34;
  ctx.strokeStyle='rgba(190,255,200,.15)';
  ctx.lineWidth=1.5;
  for(let wx=start;wx<cam+W+34;wx+=34){
    const x=wx-cam;
    const hh=3+((wx*7)%4);
    ctx.beginPath();ctx.moveTo(x,GROUND+3);ctx.lineTo(x-2,GROUND+3+hh);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+4,GROUND+3);ctx.lineTo(x+6,GROUND+3+hh);ctx.stroke();
  }

  game.checkpoints.forEach(function(cp){
    const x=cp.x-cam;
    if(x<-30||x>W+30)return;
    ctx.strokeStyle='#8b97b3';
    ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(x,GROUND);ctx.lineTo(x,GROUND-34);ctx.stroke();
    ctx.fillStyle=cp.reached?'#4ade80':'#94a3b8';
    ctx.beginPath();ctx.moveTo(x,GROUND-34);ctx.lineTo(x+20,GROUND-27);ctx.lineTo(x,GROUND-20);ctx.closePath();ctx.fill();
  });

  const gateX=game.level.length-70;
  const gx=gateX-cam;
  if(gx>-90&&gx<W+90){
    const open=allRings();
    const field=ctx.createLinearGradient(0,GROUND-120,0,GROUND);
    field.addColorStop(0,open?'rgba(74,222,128,.05)':'rgba(248,113,113,.18)');
    field.addColorStop(1,open?'rgba(74,222,128,.18)':'rgba(248,113,113,.05)');
    ctx.fillStyle=field;
    ctx.fillRect(gx-20,GROUND-116,40,116);
    ctx.fillStyle='#2c3550';
    ctx.fillRect(gx-30,GROUND-126,10,126);
    ctx.fillRect(gx+20,GROUND-126,10,126);
    ctx.fillStyle='#384361';
    ctx.fillRect(gx-34,GROUND-8,18,8);
    ctx.fillRect(gx+16,GROUND-8,18,8);
    ctx.fillStyle='#3f4d70';
    ctx.fillRect(gx-32,GROUND-132,64,9);
    ctx.fillStyle=open?'#4ade80':'#f87171';
    ctx.beginPath();
    ctx.arc(gx,GROUND-127.5,3.5,0,Math.PI*2);
    ctx.fill();
    if(open){
      ctx.globalAlpha=0.4+Math.sin(t*4)*0.15;
      ctx.strokeStyle='#86efac';
      ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(gx,GROUND-127.5,7,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=1;
    }
  }

  game.spikes.forEach(function(s){
    for(let i=0;i<s.count;i++){
      const x=s.x-cam+i*20;
      if(x<-24||x>W+24)continue;
      ctx.fillStyle='#b7c2d6';
      ctx.beginPath();ctx.moveTo(x,GROUND);ctx.lineTo(x+10,GROUND-19);ctx.lineTo(x+20,GROUND);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.5)';
      ctx.beginPath();ctx.moveTo(x+10,GROUND-19);ctx.lineTo(x+7,GROUND);ctx.lineTo(x+10,GROUND);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(0,0,0,.18)';
      ctx.beginPath();ctx.moveTo(x+10,GROUND-19);ctx.lineTo(x+13,GROUND);ctx.lineTo(x+20,GROUND);ctx.closePath();ctx.fill();
    }
  });

  game.rings.forEach(function(r){
    if(r.taken)return;
    const x=r.x-cam;
    if(x<-40||x>W+40)return;
    const pulse=1+Math.sin(t*3.2+r.x*0.02)*0.04;
    ctx.save();
    ctx.translate(x,r.y);
    ctx.strokeStyle='rgba(255,209,102,.22)';
    ctx.lineWidth=11;
    ctx.beginPath();ctx.arc(0,0,22*pulse,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#f6c445';
    ctx.lineWidth=5;
    ctx.beginPath();ctx.arc(0,0,22*pulse,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='rgba(255,247,204,.85)';
    ctx.lineWidth=1.6;
    ctx.beginPath();ctx.arc(0,0,18*pulse,Math.PI*1.05,Math.PI*1.7);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.9)';
    const sa=t*2+r.x*0.05;
    ctx.beginPath();ctx.arc(Math.cos(sa)*17*pulse,Math.sin(sa)*17*pulse,1.4,0,Math.PI*2);ctx.fill();
    ctx.restore();
  });

  game.hazards.forEach(function(h){
    const x=h.x-cam;
    if(x<-30||x>W+30)return;
    ctx.save();
    ctx.translate(x,h.y);
    ctx.rotate(t*1.4+h.x*0.01);
    ctx.fillStyle='#7134a6';
    for(let k=0;k<8;k++){
      const a=k*Math.PI/4;
      const px=Math.cos(a)*h.r,py=Math.sin(a)*h.r;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a-0.28)*h.r*0.7,Math.sin(a-0.28)*h.r*0.7);
      ctx.lineTo(px*1.55,py*1.55);
      ctx.lineTo(Math.cos(a+0.28)*h.r*0.7,Math.sin(a+0.28)*h.r*0.7);
      ctx.closePath();
      ctx.fill();
    }
    const hg=ctx.createRadialGradient(-3,-3,1,0,0,h.r);
    hg.addColorStop(0,'#d8b4fe');
    hg.addColorStop(0.6,'#9333ea');
    hg.addColorStop(1,'#4c1d95');
    ctx.fillStyle=hg;
    ctx.beginPath();ctx.arc(0,0,h.r,0,Math.PI*2);ctx.fill();
    ctx.restore();
  });

  const b=game.ball;
  const bx=b.x-cam;
  const sh=clamp(1-(GROUND-BALL_R-b.y)/260,0.25,1);
  ctx.save();
  ctx.globalAlpha=0.28*sh;
  ctx.fillStyle='#000';
  ctx.beginPath();
  ctx.ellipse(bx,GROUND+2,16*sh,4.5*sh,0,0,Math.PI*2);
  ctx.fill();
  ctx.restore();

  let alpha=1;
  if(game.invuln>0)alpha=Math.floor(game.invuln*14)%2===0?0.4:1;
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.translate(bx,b.y);
  const bg=ctx.createRadialGradient(-5,-6,2,0,0,BALL_R);
  bg.addColorStop(0,'#ffb0b0');
  bg.addColorStop(0.45,'#ef4444');
  bg.addColorStop(1,'#7f1d1d');
  ctx.fillStyle=bg;
  ctx.beginPath();ctx.arc(0,0,BALL_R,0,Math.PI*2);ctx.fill();
  ctx.save();
  ctx.beginPath();ctx.arc(0,0,BALL_R,0,Math.PI*2);ctx.clip();
  ctx.rotate(b.rot);
  ctx.strokeStyle='rgba(255,255,255,.35)';
  ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(0,0,BALL_R*0.62,0,Math.PI*0.9);ctx.stroke();
  ctx.restore();
  ctx.fillStyle='rgba(255,255,255,.55)';
  ctx.beginPath();ctx.arc(-5,-6,3.2,0,Math.PI*2);ctx.fill();
  ctx.restore();

  game.particles.forEach(function(p){
    ctx.globalAlpha=Math.max(0,p.life/p.max);
    ctx.fillStyle=p.color;
    ctx.beginPath();ctx.arc(p.x-cam,p.y,p.size,0,Math.PI*2);ctx.fill();
  });
  ctx.globalAlpha=1;
}
function drawHeart(cx,cy,s,on){
  ctx.save();
  ctx.translate(cx,cy);
  ctx.scale(s,s);
  ctx.beginPath();
  ctx.moveTo(0,2.4);
  ctx.bezierCurveTo(-4.2,-1.6,-3.2,-5.2,0,-2.6);
  ctx.bezierCurveTo(3.2,-5.2,4.2,-1.6,0,2.4);
  ctx.closePath();
  ctx.fillStyle=on?'#f43f5e':'rgba(255,255,255,.16)';
  ctx.fill();
  if(on){
    ctx.strokeStyle='rgba(255,255,255,.35)';
    ctx.lineWidth=0.7;
    ctx.stroke();
  }
  ctx.restore();
}
function drawHud(){
  ctx.fillStyle='rgba(5,10,20,.55)';
  ctx.fillRect(0,0,W,34);
  ctx.fillStyle='rgba(255,255,255,.07)';
  ctx.fillRect(0,33,W,1);

  ctx.strokeStyle='#ffd166';
  ctx.lineWidth=2.5;
  ctx.beginPath();ctx.arc(16,17,6,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#fff';
  ctx.font='bold 14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
  ctx.textAlign='left';
  ctx.textBaseline='middle';
  ctx.fillText(game.ringsCollected+'/'+game.ringsTotal,24,18);

  ctx.textAlign='center';
  ctx.fillStyle='#dbe4ff';
  ctx.fillText('LV '+(game.levelIndex+1),W/2,18);

  for(let i=0;i<game.maxHearts;i++){
    drawHeart(W-16-i*16,17,1.55,i<game.hearts);
  }
}
function draw(now){
  if(game.mode==='menu'){
    drawWorld(now,0);
    return;
  }
  const cam=clamp(game.ball.x-120,0,Math.max(0,game.level.length-W));
  drawWorld(now,cam);
  drawHud();
  if(game.flash>0){
    ctx.fillStyle='rgba(239,68,68,'+(game.flash*0.35)+')';
    ctx.fillRect(0,0,W,H);
  }
}
function loop(now){
  if(!lastFrame)lastFrame=now;
  let dt=(now-lastFrame)/1000;
  lastFrame=now;
  if(!isFinite(dt)||dt<0)dt=0;
  if(dt>0.033)dt=0.033;
  if(game.mode==='playing'){
    update(dt);
  }else if(game.mode==='menu'){
    menuT+=dt;
    game.ball.x=110;
    game.ball.y=GROUND-BALL_R-Math.abs(Math.sin(menuT*1.8))*115;
    game.ball.rot+=dt*2;
  }
  updateParticles(dt);
  draw(now/1000);
  requestAnimationFrame(loop);
}

function menuFocusStep(dir){
  const ov=activeOverlay();
  if(!ov)return;
  const all=ov.querySelectorAll('button');
  const out=[];
  for(let i=0;i<all.length;i++)if(!all[i].disabled&&!all[i].classList.contains('hidden'))out.push(all[i]);
  if(!out.length)return;
  let idx=-1;
  for(let i=0;i<out.length;i++)if(out[i]===document.activeElement){idx=i;break;}
  const next=idx<0?0:(idx+dir+out.length)%out.length;
  try{out[next].focus();}catch(e){}
}
function menuActivate(){
  const ov=activeOverlay();
  if(!ov)return;
  const all=ov.querySelectorAll('button');
  const out=[];
  for(let i=0;i<all.length;i++)if(!all[i].disabled&&!all[i].classList.contains('hidden'))out.push(all[i]);
  if(!out.length)return;
  let idx=-1;
  for(let i=0;i<out.length;i++)if(out[i]===document.activeElement){idx=i;break;}
  const target=idx<0?out[0]:out[idx];
  try{target.click();}catch(e){}
}
window.addEventListener('keydown',function(e){
  const k=e.key||'',c=e.keyCode||0;
  if(overlayVisible()){
    if(k==='ArrowDown'||k==='ArrowRight'||k==='8'||k==='6'||c===40||c===39||c===56||c===54){e.preventDefault();menuFocusStep(1);}
    else if(k==='ArrowUp'||k==='ArrowLeft'||k==='2'||k==='4'||c===38||c===37||c===50||c===52){e.preventDefault();menuFocusStep(-1);}
    else if(k==='Enter'||k===' '||k==='5'||k==='SoftLeft'||c===13||c===32||c===53){e.preventDefault();menuActivate();}
    return;
  }
  if(game.mode!=='playing')return;
  if(k==='ArrowLeft'||k==='4'||c===37||c===52){
    e.preventDefault();input.left=true;unlockAudio();
  }else if(k==='ArrowRight'||k==='6'||c===39||c===54){
    e.preventDefault();input.right=true;unlockAudio();
  }else if(k==='5'||k==='ArrowUp'||k===' '||c===53||c===38||c===32){
    e.preventDefault();
    if(!e.repeat)requestJump();
  }else if(k==='0'||k==='Escape'||k==='Backspace'||c===48||c===27||c===8){
    e.preventDefault();
    pauseGame();
  }
});
window.addEventListener('keyup',function(e){
  const k=e.key||'',c=e.keyCode||0;
  if(k==='ArrowLeft'||k==='4'||c===37||c===52)input.left=false;
  if(k==='ArrowRight'||k==='6'||c===39||c===54)input.right=false;
});
document.addEventListener('visibilitychange',function(){
  if(document.hidden&&game.mode==='playing')pauseGame();
});

function bindHold(el,onFn,offFn){
  if(!el)return;
  el.addEventListener('touchstart',function(e){e.preventDefault();onFn();},{passive:false});
  el.addEventListener('touchend',function(e){e.preventDefault();offFn();},{passive:false});
  el.addEventListener('touchcancel',offFn);
  el.addEventListener('mousedown',function(e){e.preventDefault();onFn();});
  el.addEventListener('mouseup',offFn);
  el.addEventListener('mouseleave',offFn);
}
function bindTap(el,fn){
  if(!el)return;
  el.addEventListener('touchstart',function(e){e.preventDefault();fn();},{passive:false});
  el.addEventListener('mousedown',function(e){e.preventDefault();fn();});
}
bindHold($('tLeft'),function(){input.left=true;unlockAudio();},function(){input.left=false;});
bindHold($('tRight'),function(){input.right=true;unlockAudio();},function(){input.right=false;});
bindTap($('tJump'),requestJump);
canvas.addEventListener('pointerdown',function(){
  if(game.mode==='playing')requestJump();
});

function renderLevels(){
  const list=$('llist');
  if(!list)return;
  list.innerHTML='';
  LEVELS.forEach(function(lv,i){
    const unlocked=i<state.unlocked;
    const done=state.levelsDone.indexOf(i)>=0;
    const best=state.bestTimes&&state.bestTimes[String(i)];
    const b=document.createElement('button');
    b.type='button';
    b.className='lvl'+(unlocked?'':' locked')+(done?' done':'');
    b.disabled=!unlocked;
    const num=document.createElement('span');
    num.className='num';
    num.textContent=String(i+1);
    const nm=document.createElement('span');
    nm.className='nm';
    nm.textContent=lv.name;
    const bt=document.createElement('span');
    bt.className='bt';
    bt.textContent=unlocked?(best?best+'s':''):'Locked';
    b.appendChild(num);
    b.appendChild(nm);
    b.appendChild(bt);
    b.addEventListener('click',function(){
      if(!unlocked)return;
      clickSound();
      startLevel(i);
    });
    list.appendChild(b);
  });
  show('levels');
}

$('start').addEventListener('click',function(){continueGame();});
$('levelsBtn').addEventListener('click',function(){clickSound();renderLevels();});
$('back1').addEventListener('click',function(){clickSound();updateMenu();show('menu');});
$('home').addEventListener('click',function(){clickSound();location.href='../../index.html';});
$('mute2').addEventListener('click',function(){
  muted=!muted;
  storeSet(MUTE_KEY,muted?'1':'0');
  updateMenu();
  if(!muted){unlockAudio();clickSound();}
});
$('pauseBtn').addEventListener('click',function(){unlockAudio();pauseGame();});
$('resume').addEventListener('click',resumeGame);
$('restart').addEventListener('click',function(){clickSound();startLevel(game.levelIndex);});
$('menuP').addEventListener('click',function(){clickSound();openMenu();});
$('next').addEventListener('click',function(){
  const nextIdx=game.levelIndex+1;
  if(nextIdx<LEVELS.length&&nextIdx<state.unlocked)startLevel(nextIdx);
});
$('replay').addEventListener('click',function(){clickSound();startLevel(game.levelIndex);});
$('menuO').addEventListener('click',function(){clickSound();openMenu();});

loadLevel(0);
game.mode='menu';
updateMenu();
show('menu');
syncChrome();
save();
requestAnimationFrame(loop);
