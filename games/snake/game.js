'use strict';
let params;
try{params=new URLSearchParams(location.search);}catch(e){params={get:function(){return null;}};}
function storeGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function storeSet(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}}

let user=params.get('user');
if(!user){try{const u=JSON.parse(storeGet('wg_user')||'null');if(u&&u.name)user=u.name;}catch(e){}}
if(!user)user='guest';
const KEY='snake_'+user;
const MUTE_KEY='snake_muted';

const MISSIONS=[
  {id:'score100',title:'Score 100 in one game',type:'bestScore',target:100,reward:100},
  {id:'score300',title:'Score 300 in one game',type:'bestScore',target:300,reward:250},
  {id:'score800',title:'Score 800 in one game',type:'bestScore',target:800,reward:600},
  {id:'apples25',title:'Eat 25 apples in total',type:'apples',target:25,reward:150},
  {id:'apples100',title:'Eat 100 apples in total',type:'apples',target:100,reward:450},
  {id:'games10',title:'Play 10 games',type:'games',target:10,reward:200},
  {id:'length20',title:'Grow to length 20',type:'bestLength',target:20,reward:300}
];

function xpNeeded(l){return l*100;}
function defaultState(){
  return {user:user,money:0,xp:0,level:1,best:0,bestLength:3,games:0,apples:0,totalScore:0,
    missions:MISSIONS.map(m=>({id:m.id,progress:0,done:false}))};
}
function loadState(){
  let s=null;
  try{s=JSON.parse(storeGet(KEY)||'null');}catch(e){s=null;}
  if(!s||typeof s!=='object'||!s.user)s=defaultState();
  ['money','xp','level','best','bestLength','games','apples','totalScore'].forEach(function(k){
    if(typeof s[k]!=='number'||!isFinite(s[k])||s[k]<0)s[k]=k==='level'?1:(k==='bestLength'?3:0);
  });
  if(s.level<1)s.level=1;
  if(!Array.isArray(s.missions))s.missions=[];
  MISSIONS.forEach(function(def){
    if(!s.missions.some(function(m){return m&&m.id===def.id;}))s.missions.push({id:def.id,progress:0,done:false});
  });
  return s;
}
let state=loadState();
function save(){storeSet(KEY,JSON.stringify(state));}

const $=function(id){return document.getElementById(id);};
const canvas=$('c');
const ctx=canvas.getContext('2d');
const COLS=16,ROWS=16,CELL=canvas.width/COLS;
const DIRS={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};

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
function eatSound(){tone(760,0.09,'triangle',0.1,980);}
function turnSound(){tone(300,0.03,'triangle',0.025,340);}
function levelSound(){tone(660,0.14,'square',0.09,990);}
function loseSound(){tone(300,0.5,'sawtooth',0.12,90);}
function winSound(){[523,659,784,1047,1319].forEach(function(f,i){setTimeout(function(){tone(f,0.2,'triangle',0.12);},i*110);});}
function missionSound(){tone(900,0.18,'triangle',0.1,1250);}
document.addEventListener('pointerdown',unlockAudio,{once:true});
document.addEventListener('touchstart',unlockAudio,{once:true,passive:true});
document.addEventListener('keydown',unlockAudio,{once:true});

const game={
  mode:'menu',
  snake:[],
  dir:{x:1,y:0},
  queue:[],
  food:{x:12,y:8},
  score:0,
  apples:0,
  speedLevel:1,
  perfect:false,
  claimed:false,
  acc:0,
  particles:[],
  shake:0
};
let lastFrame=0;
let lastRun={coins:0};

function missionValue(def){
  if(def.type==='bestScore')return state.best;
  if(def.type==='apples')return state.apples;
  if(def.type==='games')return state.games;
  if(def.type==='bestLength')return state.bestLength;
  return 0;
}
function renderMissions(){
  const el=$('mlist');
  if(!el)return;
  el.innerHTML='';
  state.missions.forEach(function(m){
    const def=MISSIONS.find(function(x){return x.id===m.id;});
    if(!def)return;
    const val=Math.min(missionValue(def),def.target);
    const pct=Math.round(val/def.target*100);
    const d=document.createElement('div');
    d.className='mitem';
    const bar=document.createElement('div');
    bar.className='bar mini';
    const fill=document.createElement('i');
    fill.style.width=pct+'%';
    fill.style.background=m.done?'#22c55e':'#3fbf62';
    bar.appendChild(fill);
    const title=document.createElement('b');
    title.textContent=def.title;
    const info=document.createElement('span');
    info.textContent=val+'/'+def.target+' · Reward '+def.reward+' coins'+(m.done?' · DONE':'');
    d.appendChild(title);
    d.appendChild(info);
    d.appendChild(bar);
    el.appendChild(d);
  });
}
function checkMissions(){
  state.missions.forEach(function(m){
    if(m.done)return;
    const def=MISSIONS.find(function(x){return x.id===m.id;});
    if(!def)return;
    m.progress=missionValue(def);
    if(m.progress>=def.target){
      m.done=true;
      state.money+=def.reward;
      missionSound();
      toast('Mission: '+def.title+' +'+def.reward);
    }
  });
}
function addXp(n){
  if(n<=0)return 0;
  state.xp+=n;
  let gained=0;
  while(state.xp>=xpNeeded(state.level)){
    state.xp-=xpNeeded(state.level);
    state.level++;
    state.money+=state.level*20;
    gained++;
  }
  if(gained){
    levelSound();
    toast('Level up! Lv '+state.level);
  }
  return gained;
}

function activeOverlay(){return document.querySelector('.overlay:not(.hidden)');}
function overlayVisible(){return !!activeOverlay();}
function show(id){
  const list=document.querySelectorAll('.overlay');
  for(let i=0;i<list.length;i++)list[i].classList.add('hidden');
  if(id){
    const el=$(id);
    if(el){
      el.classList.remove('hidden');
      const b=el.querySelector('button');
      if(b){try{b.focus();}catch(e){}}
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
  toastTimer=setTimeout(function(){el.classList.remove('show');},2200);
}

function runCoins(){return Math.floor(game.score/20)+(game.perfect?50:0);}
function refreshHud(){
  const s=$('gscore'),b=$('gbest'),c=$('gcoins');
  if(s)s.textContent=game.score;
  if(b)b.textContent=Math.max(state.best,game.score);
  if(c)c.textContent=runCoins();
}
function updateMenu(){
  if($('userinfo'))$('userinfo').textContent='Player: '+state.user;
  if($('mlevel'))$('mlevel').textContent=state.level;
  if($('mxp'))$('mxp').textContent=state.xp;
  if($('mneed'))$('mneed').textContent=xpNeeded(state.level);
  if($('mmoney'))$('mmoney').textContent=state.money;
  if($('mbest'))$('mbest').textContent=state.best;
  if($('mlength'))$('mlength').textContent=state.bestLength;
  if($('mstats'))$('mstats').textContent='Games '+state.games+' · Apples '+state.apples+' · Total score '+state.totalScore;
  const mb=$('mute'),mm=$('muteMenu');
  if(mb)mb.textContent=muted?'Sound: Off':'Sound: On';
  if(mm)mm.textContent=muted?'Sound: Off':'Sound: On';
}

function freeCells(){
  const used={};
  game.snake.forEach(function(s){used[s.x+','+s.y]=true;});
  const out=[];
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    if(!used[x+','+y])out.push({x:x,y:y});
  }
  return out;
}
function spawnFood(){
  const cells=freeCells();
  if(!cells.length)return false;
  game.food=cells[(Math.random()*cells.length)|0];
  return true;
}
function resetBoard(){
  game.snake=[{x:8,y:8},{x:7,y:8},{x:6,y:8}];
  game.dir={x:1,y:0};
  game.queue=[];
  game.score=0;
  game.apples=0;
  game.speedLevel=1;
  game.perfect=false;
  game.claimed=false;
  game.acc=0;
  game.particles=[];
  game.shake=0;
  spawnFood();
  refreshHud();
}
function startGame(){
  resetBoard();
  game.mode='playing';
  show(null);
  unlockAudio();
  clickSound();
  if($('hint'))$('hint').textContent='2/4/6/8 move · 5 pause';
}
function turn(dx,dy){
  if(game.mode!=='playing')return;
  let ref=game.dir;
  if(game.queue.length)ref=game.queue[game.queue.length-1];
  if(ref.x===-dx&&ref.y===-dy)return;
  if(ref.x===dx&&ref.y===dy)return;
  if(game.queue.length<2)game.queue.push({x:dx,y:dy});
}
function speedInterval(){return Math.max(68,175-(game.speedLevel-1)*13);}
function burst(x,y,color){
  for(let i=0;i<10;i++){
    const a=Math.random()*Math.PI*2,sp=30+Math.random()*80;
    game.particles.push({
      x:(x+0.5)*CELL,y:(y+0.5)*CELL,
      vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-30,
      life:0.5+Math.random()*0.3,max:0.8,
      color:color||'#ff6b6b',size:1.5+Math.random()*2
    });
  }
}
function claimRun(){
  if(game.claimed)return;
  game.claimed=true;
  lastRun={coins:runCoins()};
  state.money+=lastRun.coins;
  state.best=Math.max(state.best,game.score);
  state.bestLength=Math.max(state.bestLength,game.snake.length);
  state.games++;
  state.apples+=game.apples;
  state.totalScore+=game.score;
  addXp(game.score);
  checkMissions();
  save();
}
function showOver(title,text){
  if($('otitle'))$('otitle').textContent=title;
  if($('otext'))$('otext').textContent=text;
  if($('oscore'))$('oscore').textContent=game.score;
  if($('obest'))$('obest').textContent=state.best;
  if($('oapples'))$('oapples').textContent=game.apples;
  if($('ocoins'))$('ocoins').textContent=lastRun.coins;
  refreshHud();
  show('over');
}
function die(){
  if(game.mode!=='playing')return;
  game.mode='over';
  game.shake=0.45;
  claimRun();
  loseSound();
  showOver('Game Over','The snake crashed.');
}
function perfectGame(){
  if(game.mode!=='playing')return;
  game.perfect=true;
  game.mode='over';
  claimRun();
  winSound();
  showOver('Perfect Game!','The whole board is full. Legendary!');
}
function step(){
  if(game.queue.length)game.dir=game.queue.shift();
  const head=game.snake[0];
  const nx=head.x+game.dir.x,ny=head.y+game.dir.y;
  if(nx<0||nx>=COLS||ny<0||ny>=ROWS){die();return;}
  const eating=(nx===game.food.x&&ny===game.food.y);
  const limit=eating?game.snake.length:game.snake.length-1;
  for(let i=0;i<limit;i++){
    if(game.snake[i].x===nx&&game.snake[i].y===ny){die();return;}
  }
  game.snake.unshift({x:nx,y:ny});
  if(eating){
    game.apples++;
    game.score+=10;
    game.speedLevel=1+Math.floor(game.apples/4);
    burst(nx,ny,'#ff6b6b');
    eatSound();
    if(!spawnFood()){perfectGame();return;}
    refreshHud();
  }else{
    game.snake.pop();
  }
}
function togglePause(){
  if(game.mode==='playing'){
    game.mode='paused';
    if($('pscore'))$('pscore').textContent=game.score;
    if($('papples'))$('papples').textContent=game.apples;
    show('pausev');
  }else if(game.mode==='paused'){
    game.mode='playing';
    game.acc=0;
    show(null);
    clickSound();
  }
}
function resumeGame(){
  if(game.mode!=='paused')return;
  game.mode='playing';
  game.acc=0;
  show(null);
  clickSound();
}
function openMenu(){
  if(game.mode==='playing'||game.mode==='paused')claimRun();
  game.mode='menu';
  updateMenu();
  show('menu');
}

function mixColor(c1,c2,t){
  const a=parseInt(c1.slice(1),16),b=parseInt(c2.slice(1),16);
  const r=Math.round((a>>16&255)+((b>>16&255)-(a>>16&255))*t);
  const g=Math.round((a>>8&255)+((b>>8&255)-(a>>8&255))*t);
  const bl=Math.round((a&255)+((b&255)-(a&255))*t);
  return 'rgb('+r+','+g+','+bl+')';
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
function drawBackground(t){
  const g=ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,'#0d1f15');
  g.addColorStop(1,'#071009');
  ctx.fillStyle=g;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<ROWS;y++){
    for(let x=0;x<COLS;x++){
      if((x+y)%2===0){
        ctx.fillStyle='rgba(255,255,255,0.016)';
        ctx.fillRect(x*CELL,y*CELL,CELL,CELL);
      }
    }
  }
  ctx.strokeStyle='rgba(140,220,160,0.035)';
  ctx.lineWidth=1;
  for(let i=1;i<COLS;i++){
    ctx.beginPath();ctx.moveTo(i*CELL,0);ctx.lineTo(i*CELL,canvas.height);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,i*CELL);ctx.lineTo(canvas.width,i*CELL);ctx.stroke();
  }
}
function drawFood(t){
  const cx=(game.food.x+0.5)*CELL,cy=(game.food.y+0.5)*CELL;
  const pulse=1+Math.sin(t*4)*0.06;
  ctx.save();
  ctx.globalAlpha=0.18+Math.sin(t*4)*0.05;
  ctx.fillStyle='#ff5a5a';
  ctx.beginPath();ctx.arc(cx,cy,CELL*0.55*pulse,0,Math.PI*2);ctx.fill();
  ctx.restore();
  const rad=CELL*0.32;
  const g=ctx.createRadialGradient(cx-rad*0.35,cy-rad*0.4,rad*0.15,cx,cy,rad);
  g.addColorStop(0,'#ff9d9d');
  g.addColorStop(0.55,'#ef4444');
  g.addColorStop(1,'#a51616');
  ctx.fillStyle=g;
  ctx.beginPath();ctx.arc(cx,cy,rad,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#5f2b0b';ctx.lineWidth=1.6;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(cx+1,cy-rad+1);ctx.lineTo(cx+3,cy-rad-4);ctx.stroke();
  ctx.fillStyle='#3fbf62';
  ctx.beginPath();
  ctx.ellipse?ctx.ellipse(cx+6,cy-rad-3,4,2.4,-0.5,0,Math.PI*2):ctx.arc(cx+6,cy-rad-3,3,0,Math.PI*2);
  ctx.fill();
}
function drawSnake(){
  for(let i=game.snake.length-1;i>=1;i--){
    const s=game.snake[i];
    const t=i/Math.max(1,game.snake.length-1);
    const pad=2.2;
    rrect(s.x*CELL+pad,s.y*CELL+pad,CELL-pad*2,CELL-pad*2,4);
    ctx.fillStyle=mixColor('#3fbf62','#14532d',t*0.85);
    ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.06)';
    rrect(s.x*CELL+pad,s.y*CELL+pad,CELL-pad*2,3,2);
    ctx.fill();
  }
  if(!game.snake.length)return;
  const h=game.snake[0];
  const pad=1.5;
  rrect(h.x*CELL+pad,h.y*CELL+pad,CELL-pad*2,CELL-pad*2,5);
  const hg=ctx.createLinearGradient(h.x*CELL,h.y*CELL,h.x*CELL,h.y*CELL+CELL);
  hg.addColorStop(0,'#c7ffb8');
  hg.addColorStop(1,'#6ee77c');
  ctx.fillStyle=hg;
  ctx.fill();
  const cx=(h.x+0.5)*CELL,cy=(h.y+0.5)*CELL;
  const dx=game.dir.x,dy=game.dir.y;
  const eyes=[
    {x:cx+dx*3.6-dy*3.4,y:cy+dy*3.6-dx*3.4},
    {x:cx+dx*3.6+dy*3.4,y:cy+dy*3.6+dx*3.4}
  ];
  eyes.forEach(function(e){
    ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(e.x,e.y,2.6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#0c2317';
    ctx.beginPath();ctx.arc(e.x+dx*1.1,e.y+dy*1.1,1.25,0,Math.PI*2);ctx.fill();
  });
}
function updateParticles(dt){
  for(let i=game.particles.length-1;i>=0;i--){
    const p=game.particles[i];
    p.life-=dt;
    if(p.life<=0){game.particles.splice(i,1);continue;}
    p.vy+=160*dt;
    p.x+=p.vx*dt;
    p.y+=p.vy*dt;
  }
}
function drawParticles(){
  game.particles.forEach(function(p){
    ctx.globalAlpha=Math.max(0,p.life/p.max);
    ctx.fillStyle=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
  });
  ctx.globalAlpha=1;
}
function draw(t){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  if(game.shake>0){
    const s=game.shake*10;
    ctx.translate((Math.random()-0.5)*s,(Math.random()-0.5)*s);
  }
  drawBackground(t);
  drawFood(t);
  drawSnake();
  drawParticles();
  if(game.shake>0.2){
    ctx.fillStyle='rgba(239,68,68,'+(game.shake*0.3)+')';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  ctx.restore();
}
function loop(now){
  if(!lastFrame)lastFrame=now;
  let dt=(now-lastFrame)/1000;
  lastFrame=now;
  if(dt>0.1)dt=0.1;
  if(game.mode==='playing'){
    game.acc+=Math.min(dt,0.08);
    const interval=speedInterval()/1000;
    let guard=0;
    while(game.acc>=interval&&game.mode==='playing'&&guard<4){
      game.acc-=interval;
      step();
      guard++;
    }
  }
  if(game.shake>0)game.shake=Math.max(0,game.shake-dt);
  updateParticles(dt);
  draw(now/1000);
  requestAnimationFrame(loop);
}

function sizeBoard(){
  const wrap=$('wrap'),board=$('board');
  if(!wrap||!board)return;
  const maxW=Math.min(wrap.clientWidth-20,376);
  const avail=(window.innerHeight||320)-148;
  const size=Math.max(140,Math.min(maxW,avail));
  board.style.width=Math.round(size)+'px';
  board.style.height=Math.round(size)+'px';
}

const board=$('board');
let touchStart=null;
board.addEventListener('touchstart',function(e){
  if(overlayVisible())return;
  unlockAudio();
  if(e.changedTouches.length){
    const t=e.changedTouches[0];
    touchStart={x:t.clientX,y:t.clientY};
  }
},{passive:true});
board.addEventListener('touchend',function(e){
  if(!touchStart||overlayVisible())return;
  const t=e.changedTouches[0];
  const dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;
  touchStart=null;
  const adx=Math.abs(dx),ady=Math.abs(dy);
  if(Math.max(adx,ady)<20)return;
  if(adx>ady)turn(dx>0?1:-1,0);
  else turn(0,dy>0?1:-1);
},{passive:true});
board.addEventListener('touchcancel',function(){touchStart=null;});

function keyDir(k,c){
  if(k==='ArrowUp'||k==='2'||c===38||c===50)return DIRS.up;
  if(k==='ArrowDown'||k==='8'||c===40||c===56)return DIRS.down;
  if(k==='ArrowLeft'||k==='4'||c===37||c===52)return DIRS.left;
  if(k==='ArrowRight'||k==='6'||c===39||c===54)return DIRS.right;
  return null;
}
function menuFocusStep(dir){
  const ov=activeOverlay();
  if(!ov)return;
  const all=ov.querySelectorAll('button');
  const out=[];
  for(let i=0;i<all.length;i++)if(!all[i].disabled)out.push(all[i]);
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
  for(let i=0;i<all.length;i++)if(!all[i].disabled)out.push(all[i]);
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
  const dir=keyDir(k,c);
  if(dir){
    e.preventDefault();
    unlockAudio();
    turn(dir.x,dir.y);
    turnSound();
    return;
  }
  if(k==='5'||k==='Enter'||k==='Escape'||k==='0'||c===53||c===13||c===27||c===48){
    e.preventDefault();
    togglePause();
  }
});
window.addEventListener('resize',sizeBoard);
document.addEventListener('visibilitychange',function(){
  if(document.hidden&&game.mode==='playing')togglePause();
});

function toggleMute(){
  muted=!muted;
  storeSet(MUTE_KEY,muted?'1':'0');
  updateMenu();
  if(!muted){unlockAudio();clickSound();}
}
$('mute').addEventListener('click',toggleMute);
$('muteMenu').addEventListener('click',toggleMute);
$('start').addEventListener('click',startGame);
$('missions').addEventListener('click',function(){clickSound();renderMissions();show('missv');});
$('back2').addEventListener('click',function(){clickSound();updateMenu();show('menu');});
$('home').addEventListener('click',function(){clickSound();location.href='../../index.html';});
$('pauseBtn').addEventListener('click',function(){unlockAudio();togglePause();});
$('menuBtn').addEventListener('click',function(){unlockAudio();clickSound();openMenu();});
$('resume').addEventListener('click',resumeGame);
$('restart').addEventListener('click',function(){
  if(game.mode==='paused')claimRun();
  startGame();
});
$('menuP').addEventListener('click',function(){clickSound();openMenu();});
$('retry').addEventListener('click',startGame);
$('menu2').addEventListener('click',function(){clickSound();openMenu();});

resetBoard();
sizeBoard();
updateMenu();
refreshHud();
show('menu');
save();
requestAnimationFrame(loop);
