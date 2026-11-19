/* ===== कौन बनेगा ज्ञानी — game.js =====
   KBC-style quiz with creature→sage progression ladder.
   Saves under localStorage 'gyani_'+user (wg_user JSON name, fallback 'guest').
   Mute persisted under 'gyani_muted'. ===== */
'use strict';

var params;
try{params=new URLSearchParams(location.search);}catch(e){params={get:function(){return null;}};}
function storeGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function storeSet(k,v){try{return localStorage.setItem(k,v);}catch(e){return false;}}
function storeDel(k){try{localStorage.removeItem(k);}catch(e){}}
function readJSON(key){try{return JSON.parse(storeGet(key)||'null');}catch(e){return null;}}

var user=params.get('user');
if(!user){var u=readJSON('wg_user');if(u&&u.name)user=u.name;}
if(!user)user='guest';
var KEY='gyani_'+user;
var MUTE_KEY='gyani_muted';

var LOW_GFX=/KAIOS/i.test(navigator.userAgent||'')||((window.innerWidth||999)<=320)||((window.innerHeight||999)<=380);
if(LOW_GFX&&document.body)document.body.classList.add('low-gfx');

var QUESTIONS=(typeof GYANI_QUESTIONS!=='undefined')?GYANI_QUESTIONS:[];
var Q_BY_TIER={1:[],2:[],3:[],4:[],5:[]};
QUESTIONS.forEach(function(q){if(Q_BY_TIER[q.d])Q_BY_TIER[q.d].push(q);});

/* ---------- Progression ladder (40 stages) ----------
   Creature ladder uses verified "world's smallest" records, then famous
   animals in symbolic ascending order, then मानव, then Hindu wisdom titles.
   Never shown to player; player only sees current index + title. */
var STAGES=[
  {t:'फेरीफ्लाई ततैया',en:'Fairyfly Wasp · Dicopomorpha echmepterygis',baby:'🥚',adult:'🪰',size:'~0.139 मिमी',tier:1,need:440},
  {t:'फेदरविंग भृंग',en:'Featherwing Beetle · Scydosella musawasensis',baby:'🐛',adult:'🪲',size:'~0.325 मिमी',tier:1,need:440},
  {t:'पतू डिगुआ',en:'Patu digua — विश्व की सबसे छोटी मकड़ी',baby:'🕷️',adult:'🕷️',size:'~0.37 मिमी',tier:1,need:440},
  {t:'केयरबारा चींटी',en:'Carebara bruni — विश्व की सबसे छोटी चींटी',baby:'🐜',adult:'🐜',size:'~1 मिमी',tier:1,need:440},
  {t:'स्टिगमेला मॉथ',en:'Stigmella maya — विश्व का सबसे छोटा पतंगा',baby:'🐛',adult:'🦋',size:'~2.8 मिमी (पंख-फैलाव)',tier:1,need:440},
  {t:'शिंडलेरिया मछली',en:'Schindleria brevipinguis — \'stout infantfish\'',baby:'🥚',adult:'🐟',size:'~6.5 मिमी',tier:1,need:440},
  {t:'पैडोफाइनी मेंढक',en:'Paedophryne amauensis — विश्व का सबसे छोटा मेंढक',baby:'🥚',adult:'🐸',size:'~7.7 मिमी',tier:1,need:440},
  {t:'पेडोसिप्रिस मछली',en:'Paedocypris progenetica — मीठे पानी की सबसे छोटी मछली',baby:'🐟',adult:'🐠',size:'~7.9 मिमी',tier:1,need:440},
  {t:'नैनो कैमेलियन',en:'Brookesia nana — विश्व का सबसे छोटा सरीसृप',baby:'🦎',adult:'🦎',size:'~13.5 मिमी',tier:2,need:600},
  {t:'बम्बलबी चमगादड़',en:'Bumblebee Bat · Craseonycteris thonglongyai',baby:'🦇',adult:'🦇',size:'~3.1 सेमी',tier:2,need:600},
  {t:'एट्रुस्कन शेरू',en:'Etruscan Shrew · Suncus etruscus — सबसे छोटा स्तनधारी (भार से)',baby:'🐭',adult:'🐭',size:'~4.4 सेमी',tier:2,need:600},
  {t:'बी हमिंगबर्ड',en:'Bee Hummingbird · Mellisuga helenae — विश्व का सबसे छोटा पक्षी',baby:'🥚',adult:'🐦',size:'~5.5 सेमी',tier:2,need:600},
  {t:'स्पेक्ल्ड पैडलोपर',en:'Speckled Padloper · Homopus signatus — विश्व का सबसे छोटा कछुआ',baby:'🥚',adult:'🐢',size:'~8 सेमी',tier:2,need:600},
  {t:'बार्बेडोस थ्रेडस्नेक',en:'Tetracheilostoma carlae — विश्व का सबसे छोटा साँप',baby:'🐍',adult:'🐍',size:'~10 सेमी',tier:2,need:600},
  {t:'प्रवासी टिड्डा',en:'Migratory Locust · Locusta migratoria',baby:'🦗',adult:'🦗',size:'~8–11 सेमी',tier:2,need:600},
  {t:'बंदर',en:'Rhesus Macaque · Macaca mulatta',baby:'🐵',adult:'🐒',size:'~53 सेमी',tier:2,need:600},
  {t:'कुत्ता',en:'Canis lupus familiaris',baby:'🐶',adult:'🐕',size:'~70 सेमी',tier:3,need:900},
  {t:'भेड़िया',en:'Canis lupus',baby:'🐺',adult:'🐺',size:'~1.1 मी',tier:3,need:900},
  {t:'शेर',en:'Panthera leo — जंगल का राजा',baby:'🦁',adult:'🦁',size:'~1.8 मी',tier:3,need:900},
  {t:'बाघ',en:'Panthera tigris',baby:'🐯',adult:'🐅',size:'~2.3 मी',tier:3,need:900},
  {t:'घोड़ा',en:'Equus ferus caballus',baby:'🐴',adult:'🐎',size:'~2.4 मी',tier:3,need:900},
  {t:'हाथी',en:'Elephas maximus / Loxodonta africana',baby:'🐘',adult:'🐘',size:'~3.3 मी',tier:3,need:900},
  {t:'ब्लू व्हेल',en:'Blue Whale · Balaenoptera musculus',baby:'🐳',adult:'🐋',size:'~27 मी',tier:3,need:900},
  {t:'मानव',en:'Homo sapiens — ज्ञान का शिखर',baby:'👶',adult:'🧑',size:'~1.7 मी',tier:4,need:1300},
  {t:'विद्यार्थी',en:'विद्या की राह का प्रथम दीपक',baby:'🧒',adult:'🧑',size:'चरण 1',tier:4,need:1300},
  {t:'शिष्य',en:'जो सीखने की लौ जलाता है',baby:'🙇',adult:'🧑',size:'चरण 2',tier:4,need:1300},
  {t:'ज्ञानार्थी',en:'जो ज्ञान का अन्वेषक है',baby:'🧑',adult:'🧓',size:'चरण 3',tier:4,need:1300},
  {t:'विद्वान',en:'जो शास्त्रों का ज्ञाता है',baby:'🧓',adult:'🧓',size:'चरण 4',tier:4,need:1300},
  {t:'पंडित',en:'जो पाण्डित्य की प्रतिमा है',baby:'🙏',adult:'🙏',size:'चरण 5',tier:4,need:1300},
  {t:'आचार्य',en:'जो सिखाता है, खुद सीखकर',baby:'🧎',adult:'🧘',size:'चरण 6',tier:4,need:1300},
  {t:'उपाध्याय',en:'जो अर्ध-वेदों का आधिकारिक भाष्यकार है',baby:'🙏',adult:'🧘',size:'चरण 7',tier:4,need:1300},
  {t:'साधु',en:'जो सत्य को ही अपनाता है',baby:'🙏',adult:'🧘',size:'चरण 8',tier:4,need:1300},
  {t:'सन्त',en:'जो सर्वहित की साधना करता है',baby:'🧘',adult:'🧘',size:'चरण 9',tier:5,need:1800},
  {t:'महात्मा',en:'जिसकी आत्मा महान है',baby:'🙏',adult:'🧘',size:'चरण 10',tier:5,need:1800},
  {t:'तपस्वी',en:'जो तप द्वारा शुद्ध होता है',baby:'🧘',adult:'🧘',size:'चरण 11',tier:5,need:1800},
  {t:'ऋषि',en:'दृष्टा — जिसने ऋचाएँ देखीं',baby:'🧘',adult:'🕉️',size:'चरण 12',tier:5,need:1800},
  {t:'महर्षि',en:'महान दृष्टा — वेद के द्रष्टा',baby:'🧘',adult:'🕉️',size:'चरण 13',tier:5,need:1800},
  {t:'ब्रह्मर्षि',en:'जो ब्रह्म में ही स्थित है',baby:'🕉️',adult:'🕉️',size:'चरण 14',tier:5,need:1800},
  {t:'देवर्षि',en:'देवताओं के भी ऋषि — नारद की परम्परा',baby:'🙏',adult:'🕉️',size:'चरण 15',tier:5,need:1800},
  {t:'पूर्ण ज्ञानस्वरूप',en:'ज्ञान ही स्वरूप — शिव के समान',baby:'🧘',adult:'🕉️',size:'चरम',tier:5,need:1800}
];
var NUM_STAGES=STAGES.length;

var MISSIONS=[
  {id:'correct10',title:'10 सही जवाब दें',target:10,type:'correct',reward:1000},
  {id:'correct25',title:'25 सही जवाब दें',target:25,type:'correct',reward:2500},
  {id:'streak5',title:'लगातार 5 सही जवाब दें',target:5,type:'bestStreak',reward:1500},
  {id:'stage5',title:'स्तर 5 तक पहुँचें',target:5,type:'stageCount',reward:2000},
  {id:'stage10',title:'स्तर 10 तक पहुँचें',target:10,type:'stageCount',reward:5000},
  {id:'money10k',title:'कुल ₹10,000 जमा करें',target:10000,type:'money',reward:3000}
];
var BASE_GYAN={1:40,2:60,3:90,4:130,5:180};
var TIMER_BY_TIER={1:45,2:45,3:30,4:20,5:20};

function num(v,def){return (typeof v==='number'&&isFinite(v))?v:def;}
function clampInt(v,min,max,def){return Math.min(max,Math.max(min,Math.floor(num(v,def))));}
function activeTier(){return STAGES[state.stage]?STAGES[state.stage].tier:1;}

function defaultState(){
  return {user:user,stage:0,stageGyan:0,totalGyan:0,money:0,correct:0,wrong:0,streak:0,bestStreak:0,
    bestTitle:0,titlesUnlocked:[0],gamesPlayed:0,questionsAnswered:0,
    missions:MISSIONS.map(function(m){return {id:m.id,progress:0,done:false};})};
}
function loadState(){
  var s=null;
  try{s=JSON.parse(storeGet(KEY)||'null');}catch(e){s=null;}
  if(!s||!s.user)s=defaultState();
  s.stage=clampInt(s.stage,0,NUM_STAGES-1,0);
  var need=STAGES[s.stage].need;
  s.stageGyan=clampInt(s.stageGyan,0,need,0);
  s.totalGyan=Math.max(0,num(s.totalGyan,0));
  s.money=Math.max(0,Math.floor(num(s.money,0)));
  s.correct=Math.max(0,Math.floor(num(s.correct,0)));
  s.wrong=Math.max(0,Math.floor(num(s.wrong,0)));
  s.streak=Math.max(0,Math.floor(num(s.streak,0)));
  s.bestStreak=Math.max(0,Math.floor(num(s.bestStreak,0)));
  s.bestTitle=clampInt(s.bestTitle,0,NUM_STAGES-1,0);
  if(!Array.isArray(s.titlesUnlocked))s.titlesUnlocked=[0];
  var tu=[];s.titlesUnlocked.forEach(function(i){i=clampInt(i,0,NUM_STAGES-1,-1);if(i>=0&&tu.indexOf(i)<0)tu.push(i);});
  if(tu.indexOf(0)<0)tu.push(0);
  s.titlesUnlocked=tu;
  s.gamesPlayed=Math.max(0,Math.floor(num(s.gamesPlayed,0)));
  s.questionsAnswered=Math.max(0,Math.floor(num(s.questionsAnswered,0)));
  if(!Array.isArray(s.missions))s.missions=[];
  MISSIONS.forEach(function(def){
    if(!s.missions.some(function(m){return m&&m.id===def.id;}))s.missions.push({id:def.id,progress:0,done:false});
    var m=s.missions.filter(function(m){return m&&m.id===def.id;})[0];
    if(m){m.progress=Math.max(0,num(m.progress,0));m.done=!!m.done;}
  });
  return s;
}
var state=loadState();
function save(){storeSet(KEY,JSON.stringify(state));}

/* ---------- Audio (WebAudio) ---------- */
var audioCtx=null,master=null,droneOn=false,noiseBuf=null;
var muted=storeGet(MUTE_KEY)==='1';
function unlockAudio(){
  try{
    if(!audioCtx){
      var AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;
      audioCtx=new AC();
      master=audioCtx.createGain();master.gain.value=0.8;master.connect(audioCtx.destination);
    }
    if(audioCtx.state==='suspended')audioCtx.resume();
    startDrone();
  }catch(e){}
}
function startDrone(){
  if(droneOn||!audioCtx||muted)return;
  try{
    droneOn=true;
    var g=audioCtx.createGain();g.gain.value=0.045;g.connect(master);
    var lp=audioCtx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;lp.Q.value=0.7;lp.connect(g);
    var o1=audioCtx.createOscillator();o1.type='sawtooth';o1.frequency.value=98;
    var o2=audioCtx.createOscillator();o2.type='sawtooth';o2.frequency.value=98.6;
    var o3=audioCtx.createOscillator();o3.type='sine';o3.frequency.value=49;
    var lfo=audioCtx.createOscillator();lfo.type='sine';lfo.frequency.value=0.08;
    var lfoGain=audioCtx.createGain();lfoGain.gain.value=0.02;
    lfo.connect(lfoGain);lfoGain.connect(g.gain);
    o1.connect(lp);o2.connect(lp);o3.connect(lp);
    o1.start();o2.start();o3.start();lfo.start();
  }catch(e){droneOn=false;}
}
function tone(freq,dur,type,vol,slideTo,when){
  if(!audioCtx||muted)return;
  try{
    var t=audioCtx.currentTime+(when||0);
    var o=audioCtx.createOscillator(),g=audioCtx.createGain();
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
    var len=Math.floor(audioCtx.sampleRate*0.6);
    noiseBuf=audioCtx.createBuffer(1,len,audioCtx.sampleRate);
    var d=noiseBuf.getChannelData(0);
    for(var i=0;i<len;i++)d[i]=Math.random()*2-1;
  }catch(e){noiseBuf=null;}
  return noiseBuf;
}
function noiseBurst(dur,vol,freq,type){
  if(!audioCtx||muted)return;
  try{
    var b=getNoise();if(!b)return;
    var t=audioCtx.currentTime;
    var s=audioCtx.createBufferSource();s.buffer=b;s.loop=true;
    var f=audioCtx.createBiquadFilter();f.type=type||'bandpass';f.frequency.value=freq||900;f.Q.value=0.9;
    var g=audioCtx.createGain();g.gain.setValueAtTime(vol||0.1,t);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+dur+0.02);
  }catch(e){}
}
function sfxClick(){tone(520,0.05,'square',0.05);}
function sfxCorrect(){
  // सुरमंडल-like happy chord (sa, ga, pa) + conch-ish swell
  [392,494,587,784].forEach(function(f,i){tone(f,0.42,'triangle',0.11,null,i*0.06);});
  noiseBurst(0.5,0.05,1400,'bandpass');
}
function sfxWrong(){
  tone(120,0.4,'sawtooth',0.14,70);           // dull duff
  noiseBurst(0.9,0.09,300,'lowpass');          // crowd murmur
}
function sfxHeartbeat(){tone(72,0.11,'sine',0.16,50);}
function sfxPromote(){
  // शंखनाद + ढोल + तालियाँ
  tone(196,1.3,'sawtooth',0.13,196);
  tone(196.8,1.2,'sawtooth',0.1,197.5,0.05);
  [0,0.18,0.36,0.54,0.72,0.9,1.08,1.26].forEach(function(when,i){tone(i%2?150:95,0.12,'sine',0.17,55,when);});
  noiseBurst(1.4,0.14,1200,'bandpass');
  noiseBurst(1.4,0.1,700,'bandpass');
  [784,988,1175,1568].forEach(function(f,i){tone(f,0.9,'triangle',0.1,null,0.15+i*0.12);});
}
function toggleMute(){
  unlockAudio();
  muted=!muted;
  storeSet(MUTE_KEY,muted?'1':'0');
  if(!muted)startDrone();
  updateMenu();updateHud();
}

/* ---------- DOM ---------- */
function $(id){return document.getElementById(id);}
var OPT_BUTTONS=null;
function optionButtons(){
  if(!OPT_BUTTONS)OPT_BUTTONS=Array.prototype.slice.call(document.querySelectorAll('#options .opt'));
  return OPT_BUTTONS;
}
function show(id){
  var list=document.querySelectorAll('.overlay');
  for(var i=0;i<list.length;i++)list[i].classList.add('hidden');
  if(id){var el=$(id);if(el){el.classList.remove('hidden');focusFirstButton(el);}}
}
var toastTimer=null;
function toast(msg){
  var t=$('toast');if(!t)return;
  t.textContent=msg;t.classList.remove('hidden');
  if(toastTimer)clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){t.classList.add('hidden');},2400);
}
function visibleOverlay(){
  var list=document.querySelectorAll('.overlay');
  for(var i=0;i<list.length;i++){if(!list[i].classList.contains('hidden'))return list[i];}
  return null;
}
function overlayButtons(ov){
  var out=[];if(!ov)return out;
  var all=ov.querySelectorAll('button');
  for(var i=0;i<all.length;i++){if(!all[i].disabled)out.push(all[i]);}
  return out;
}
function focusFirstButton(ov){
  var btns=overlayButtons(ov);
  if(btns.length){try{btns[0].focus();}catch(e){}}
}
function focusStep(dir){
  var btns=overlayButtons(visibleOverlay()||gameButtonsContainer());
  if(!btns.length)return;
  var idx=-1;
  for(var i=0;i<btns.length;i++){if(btns[i]===document.activeElement){idx=i;break;}}
  var next=idx<0?0:(idx+dir+btns.length)%btns.length;
  try{btns[next].focus();}catch(e){}
}
function gameButtonsContainer(){return $('game');}
function activateFocused(){
  var ov=visibleOverlay();
  var btns=overlayButtons(ov||gameButtonsContainer());
  if(!btns.length)return false;
  var idx=-1;
  for(var i=0;i<btns.length;i++){if(btns[i]===document.activeElement){idx=i;break;}}
  if(idx<0){try{btns[0].focus();}catch(e){}return true;}
  try{btns[idx].click();}catch(e){}
  return true;
}
function bindPress(el,fn){
  if(!el)return;
  el.addEventListener('touchend',function(e){
    if(e&&e.preventDefault)e.preventDefault();
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
function bindClick(id,fn){bindPress($(id),fn);}

/* ---------- Game flow ---------- */
var currentQ=null,askedIds=[],askedSet={},answered=false,questionStart=0;
var timerTotal=45,timerLeft=45,timerInt=null,lastBeat=99;

function askedRemember(id){
  askedIds.push(id);
  askedSet[id]=true;
  // when almost the whole bank has been asked this session, reset so high tiers never starve
  var uniqueCount=0;
  for(var k in askedSet){if(askedSet[k])uniqueCount++;}
  if(uniqueCount>=QUESTIONS.length-50){askedSet={};}
  if(askedIds.length>4000)askedIds.shift();
}
function questionsOfTier(tier){
  return Q_BY_TIER[tier]||[];
}
function pickQuestion(tier){
  if(!QUESTIONS.length)return null;
  // prefer exact difficulty of the current tier; then neighbouring tiers (harder first, then easier)
  var order=[tier,tier+1,tier-1,tier+2,tier-2,tier+3,tier-3,tier+4,tier-4];
  for(var i=0;i<order.length;i++){
    var t=order[i];
    if(t<1||t>5)continue;
    var pool=questionsOfTier(t).filter(function(q){return !askedSet[q.id];});
    if(pool.length)return pool[Math.floor(Math.random()*pool.length)];
  }
  // everything in reach seen already: exact tier ignoring memory
  var fallback=questionsOfTier(tier);
  if(fallback.length)return fallback[Math.floor(Math.random()*fallback.length)];
  return QUESTIONS[Math.floor(Math.random()*QUESTIONS.length)];
}
function updateHud(){
  $('hmny').textContent=state.money;
  $('hstreak').textContent=state.streak;
  $('hlvl').textContent='स्तर '+(state.stage+1);
  $('htitle').textContent=STAGES[state.stage].t;
  $('hmute').textContent=muted?'🔇':'🔊';
}
function stageEmoji(){
  var st=STAGES[state.stage];
  var t=st.need>0?(state.stageGyan/st.need):0;
  return t<0.34?st.baby:st.adult;
}
function stageScale(){
  var st=STAGES[state.stage];
  var t=st.need>0?Math.min(1,state.stageGyan/st.need):0;
  return 0.55+0.5*t;
}
function updateStageView(){
  var st=STAGES[state.stage];
  var t=st.need>0?Math.min(1,state.stageGyan/st.need):0;
  var em=$('bigEmoji');
  em.textContent=stageEmoji();
  em.style.transform='scale('+stageScale().toFixed(3)+')';
  $('sizeLabel').textContent=st.size;
  $('stageTitle').textContent=st.t;
  $('stageEn').textContent=st.en;
  $('gyanFill').style.width=Math.round(t*100)+'%';
  $('gyanText').textContent=Math.floor(state.stageGyan)+' / '+st.need;
  updateHud();
}
function updateMenu(){
  var st=STAGES[state.stage];
  var t=st.need>0?Math.min(1,state.stageGyan/st.need):0;
  var next=state.stage<NUM_STAGES-1?STAGES[state.stage+1].t:'—';
  $('menuEmoji').textContent=stageEmoji();
  $('menuEmoji').style.transform='scale('+(0.7+0.5*t).toFixed(3)+')';
  $('menuStage').textContent='स्तर '+(state.stage+1)+' — '+st.t;
  $('menuEn').textContent=st.en;
  $('menuFill').style.width=Math.round(t*100)+'%';
  $('menuNext').textContent=(state.stageGyan|0)+' / '+st.need+(state.stage<NUM_STAGES-1?' → अगला: '+next:' → शिखर!');
  $('mmoney').textContent=state.money;
  $('mtotal').textContent=Math.floor(state.totalGyan);
  $('mbest').textContent=state.bestStreak;
  $('muteMenu').textContent='ध्वनि: '+(muted?'बंद':'चालू');
}
function resetOptionButtons(){
  optionButtons().forEach(function(b){b.disabled=false;b.classList.remove('correct','wrong');});
}
function renderQuestion(){
  var st=STAGES[state.stage];
  currentQ=pickQuestion(st.tier);
  answered=false;questionStart=Date.now();
  resetOptionButtons();
  $('qcard').classList.remove('flash-bad');
  if(!currentQ){$('question').textContent='प्रश्न बैंक खाली है!';return;}
  askedRemember(currentQ.id);
  $('question').textContent=currentQ.q;
  var opts=optionButtons();
  opts.forEach(function(b,i){
    b.querySelector('.otext').textContent=currentQ.o[i];
    b.setAttribute('aria-label','विकल्प '+(i+1)+': '+currentQ.o[i]);
  });
  startTimer(TIMER_BY_TIER[st.tier]||30);
  updateStageView();
}
function startTimer(sec){
  stopTimer();
  timerTotal=sec;timerLeft=sec;lastBeat=Math.ceil(sec*0.34)+1;
  var fill=$('timerFill');
  fill.style.width='100%';fill.className='';
  $('timerText').textContent=sec;
  timerInt=setInterval(function(){
    timerLeft-=0.1;
    if(timerLeft<0)timerLeft=0;
    var pct=Math.round(timerLeft/timerTotal*100);
    fill.style.width=pct+'%';
    $('timerText').textContent=Math.ceil(timerLeft);
    if(pct<=30)fill.classList.add('low');else if(pct<=60)fill.classList.add('mid');
    if(timerLeft<=6&&Math.ceil(timerLeft)<lastBeat){lastBeat=Math.ceil(timerLeft);sfxHeartbeat();}
    if(timerLeft<=0){stopTimer();answer(-1);}
  },100);
}
function stopTimer(){if(timerInt){clearInterval(timerInt);timerInt=null;}}

function missionValue(def){
  if(def.type==='correct')return state.correct;
  if(def.type==='bestStreak')return state.bestStreak;
  if(def.type==='stageCount')return state.bestTitle+1;
  if(def.type==='money')return state.money;
  return 0;
}
function claimMissions(){
  state.missions.forEach(function(m){
    if(m.done)return;
    var def=MISSIONS.filter(function(x){return x.id===m.id;})[0];if(!def)return;
    m.progress=Math.min(def.target,missionValue(def));
    if(m.progress>=def.target){
      m.done=true;
      state.money+=def.reward;
      sfxPromote();
      toast('मिशन पूरा: '+def.title+' (+₹'+def.reward+')');
    }
  });
}
function markOption(i,cls){
  var opts=optionButtons();
  if(opts[i])opts[i].classList.add(cls);
}
function answer(i){
  if(answered||!currentQ)return;
  answered=true;
  stopTimer();
  var st=STAGES[state.stage];
  var diff=st.tier;
  var opts=optionButtons();
  opts.forEach(function(b){b.disabled=true;});
  state.questionsAnswered++;
  if(i===currentQ.a){
    markOption(i,'correct');
    state.streak++;
    if(state.streak>state.bestStreak)state.bestStreak=state.streak;
    var gain=BASE_GYAN[diff]||40;
    if(state.streak>=3)gain=Math.round(gain*1.25);
    state.stageGyan+=gain;
    state.totalGyan+=gain;
    state.money+=100*diff;
    state.correct++;
    sfxCorrect();
    var promoted=false;
    while(state.stageGyan>=STAGES[state.stage].need){
      state.stageGyan=0;
      if(state.stage<NUM_STAGES-1){state.stage++;}
      else{state.stageGyan=0;}
      promoted=true;
      if(state.titlesUnlocked.indexOf(state.stage)<0)state.titlesUnlocked.push(state.stage);
      if(state.stage>state.bestTitle)state.bestTitle=state.stage;
    }
    claimMissions();
    save();
    if(promoted){
      updateStageView();updateMenu();
      showPromotion();
    }else{
      toast('सही! +'+gain+' ज्ञान · +₹'+(100*diff));
      save();
      updateStageView();
      setTimeout(renderQuestion,850);
    }
  }else{
    markOption(currentQ.a,'correct');
    if(i>=0)markOption(i,'wrong');
    state.streak=0;
    state.wrong++;
    state.stageGyan-=50;
    $('qcard').classList.add('flash-bad');
    sfxWrong();
    var msg='गलत! सही उत्तर: '+currentQ.o[currentQ.a]+' · −50 ज्ञान';
    if(state.stageGyan<0){
      if(state.stage>0){
        state.stage--;
        state.stageGyan=Math.floor(STAGES[state.stage].need*0.5);
        msg='अवनति! अब आप हैं: '+STAGES[state.stage].t;
        toast(msg);
      }else{
        state.stageGyan=0;
        toast('गलत! ज्ञान 0 पर — पर शुरू से फिर…');
      }
    }else{
      toast(msg);
    }
    claimMissions();
    save();
    updateStageView();
    setTimeout(renderQuestion,1400);
  }
}
function showPromotion(){
  var st=STAGES[state.stage];
  var bonus=500*st.tier;
  state.money+=bonus;
  claimMissions();
  save();
  $('promoEmoji').textContent=st.adult;
  $('promoTitle').textContent=st.t;
  $('promoSub').textContent=st.en;
  $('promoBonus').textContent='+₹'+bonus+' बोनस';
  sfxPromote();
  updateMenu();
  show('promote');
}
function quitToSummary(){
  stopTimer();
  state.gamesPlayed++;
  save();
  $('sCorrect').textContent=state.correct;
  $('sWrong').textContent=state.wrong;
  $('sStreak').textContent=state.bestStreak;
  $('sMoney').textContent=state.money;
  $('sTotal').textContent=Math.floor(state.totalGyan);
  show('summary');
}
function startGame(){
  $('menu').classList.add('hidden');
  $('game').classList.remove('hidden');
  $('hud').classList.remove('hidden');
  sfxClick();
  renderQuestion();
}
function backToMenu(){
  stopTimer();
  updateMenu();
  $('game').classList.add('hidden');
  $('hud').classList.add('hidden');
  show('menu');
}

/* ---------- Achievements & Missions ---------- */
function renderAchievements(){
  var grid=$('agrid');if(!grid)return;
  grid.innerHTML='';
  STAGES.forEach(function(st,i){
    var unlocked=state.titlesUnlocked.indexOf(i)>=0;
    var d=document.createElement('div');
    d.className='acell'+(unlocked?'':' locked');
    d.innerHTML='<div class="aemoji">'+(unlocked?st.adult:'❓')+'</div><div class="anum">स्तर '+(i+1)+'</div><div class="aname">'+(unlocked?st.t:'???')+'</div>';
    grid.appendChild(d);
  });
}
function renderMissions(){
  var el=$('mlist');if(!el)return;
  el.innerHTML='';
  state.missions.forEach(function(m){
    var def=MISSIONS.filter(function(x){return x.id===m.id;})[0];if(!def)return;
    var prog=Math.min(def.target,Math.max(m.progress||0,missionValue(def)));
    var pct=Math.round(prog/def.target*100);
    var d=document.createElement('div');d.className='mitem'+(m.done?' done':'');
    d.innerHTML='<b>'+def.title+'</b><span>'+Math.floor(prog)+' / '+def.target+' · इनाम ₹'+def.reward+(m.done?' · पूरा ✓':'')+'</span><div class="bar mini"><i style="width:'+pct+'%"></i></div>';
    el.appendChild(d);
  });
}

/* ---------- Buttons ---------- */
bindClick('play',startGame);
bindClick('achv',function(){unlockAudio();sfxClick();renderAchievements();show('achvV');});
bindClick('missions',function(){unlockAudio();sfxClick();renderMissions();show('missV');});
bindClick('back1',function(){sfxClick();show('menu');updateMenu();});
bindClick('back2',function(){sfxClick();show('menu');updateMenu();});
bindClick('home',function(){location.href='../../index.html';});
bindClick('muteMenu',toggleMute);
bindClick('hmute',toggleMute);
bindClick('hquit',function(){sfxClick();quitToSummary();});
bindClick('promoOk',function(){sfxClick();show(null);renderQuestion();});
bindClick('again',function(){sfxClick();show(null);renderQuestion();});
bindClick('sumMenu',function(){sfxClick();backToMenu();});
optionButtons().forEach(function(b){
  bindPress(b,function(){unlockAudio();answer(parseInt(b.getAttribute('data-i'),10));});
});

/* ---------- Keypad (KaiOS first-class) ---------- */
window.addEventListener('keydown',function(e){
  var k=e.key||'',c=e.keyCode||0;
  var inGame=!$('game').classList.contains('hidden')&&!visibleOverlay();
  if(k==='#'||c===163){e.preventDefault();troubleMute();return;}
  if(k==='*'||k==='Escape'||c===27){
    e.preventDefault();
    var ov=visibleOverlay();
    if(ov){
      if(ov.id==='menu'){/* already home */}
      else if(ov.id==='promote'){$('promoOk').click();}
      else if(ov.id==='summary'){backToMenu();}
      else{sfxClick();show('menu');updateMenu();}
    }else if(inGame){sfxClick();quitToSummary();}
    return;
  }
  if(k==='ArrowDown'||c===40||k==='8'||c===56){e.preventDefault();focusStep(1);return;}
  if(k==='ArrowUp'||c===38||k==='2'||c===50){e.preventDefault();focusStep(-1);return;}
  if(k==='Enter'||c===13||k===' '||c===32||k==='5'||c===53||k==='SoftLeft'){e.preventDefault();activateFocused();return;}
  if(inGame){
    var map={'1':0,'2':1,'3':2,'4':3};
    if(map[k]!==undefined){e.preventDefault();unlockAudio();answer(map[k]);return;}
  }
});
function troubleMute(){toggleMute();}

/* ---------- Init ---------- */
updateHud();
updateMenu();
show('menu');
save();
