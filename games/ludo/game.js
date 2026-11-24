'use strict';

var $ = function (id) { return document.getElementById(id); };
var params = null;
try { params = new URLSearchParams(location.search); } catch (e) { params = { get: function () { return null; } }; }

function storeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function storeSet(key, value) { try { localStorage.setItem(key, value); return true; } catch (e) { return false; } }
function readJSON(key) { try { return JSON.parse(storeGet(key) || 'null'); } catch (e) { return null; } }

var user = params.get('user');
if (!user) {
  try {
    var savedUser = JSON.parse(storeGet('wg_user') || 'null');
    if (savedUser && savedUser.name) user = savedUser.name;
  } catch (e) {}
}
if (!user) user = 'guest';

var KEY = 'ludo_' + user;
var DIFF_KEY = 'ludo_difficulty';
var engine = window.LudoEngine;
var OVERLAYS = ['menu', 'pause', 'result', 'help', 'pair'];
var FIT = 450;
var GRID = 15;
var CELL = FIT / GRID;

var INFO = [
  { name: 'Red', fill: '#ef5350', dark: '#7f1d24', light: '#ffd9d9' },
  { name: 'Green', fill: '#3cc46a', dark: '#145c2f', light: '#d1f7dd' },
  { name: 'Yellow', fill: '#f5c542', dark: '#7a5608', light: '#fff2bf' },
  { name: 'Blue', fill: '#4187ef', dark: '#173f7f', light: '#d7e7ff' }
];

var stats = loadStats();
var difficulty = storeGet(DIFF_KEY) || 'normal';
if (difficulty !== 'easy' && difficulty !== 'normal' && difficulty !== 'hard') difficulty = 'normal';

var mode = 'menu';
var game = engine.createGame({ seats: [0, 2] });
var names = ['You', 'Bot'];
var localSeat = 0;
var remote = null;
var remoteWaiting = false;
var pairUI = null;
var selectedToken = null;
var paused = false;
var botTimer = null;
var winCounted = false;
var roundNo = 0;
var toastTimer = null;
var canvas = null;
var ctx = null;
var hitAreas = [];
var tokenButtons = [];
var laneMap = {};
var startMap = {};
var resizeTimer = null;

function loadStats() {
  var s = readJSON(KEY);
  if (!s || typeof s !== 'object') s = {};
  ['botWins', 'botLosses', 'botGames', 'localGames', 'remoteGames', 'remoteWins', 'remoteLosses', 'games'].forEach(function (k) {
    if (typeof s[k] !== 'number' || !isFinite(s[k]) || s[k] < 0) s[k] = 0;
  });
  return s;
}

function saveStats() {
  storeSet(KEY, JSON.stringify(stats));
  updateMenu();
}

function toast(msg) {
  var el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.className = 'toast'; }, 2400);
}

function show(id) {
  for (var i = 0; i < OVERLAYS.length; i++) {
    var el = $(OVERLAYS[i]);
    if (el) el.classList.add('hidden');
  }
  if (!id) return;
  var target = $(id);
  if (!target) return;
  target.classList.remove('hidden');
  if (id !== 'pair') {
    setTimeout(function () {
      var btn = target.querySelector('button:not(:disabled)');
      if (btn) { try { btn.focus(); } catch (e) {} }
    }, 30);
  }
}

function overlayVisible() {
  return !!document.querySelector('.overlay:not(.hidden)');
}

function isPairOpen() {
  var el = $('pair');
  return !!(el && !el.classList.contains('hidden'));
}

function layoutBoard() {
  var wrap = $('boardWrap');
  if (!wrap || !canvas) return;
  var w = wrap.clientWidth - 2;
  var h = wrap.clientHeight - 2;
  if (w < 60 || h < 60) return;
  var size = Math.max(110, Math.min(w, h, 450));
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
}

function updateMenu() {
  if ($('userinfo')) $('userinfo').textContent = 'Player: ' + user;
  if ($('botStats')) $('botStats').textContent = stats.botWins + '-' + stats.botLosses;
  if ($('menuGames')) $('menuGames').textContent = stats.games;
  if ($('statsLine')) {
    $('statsLine').textContent = '2 Players: ' + stats.localGames +
      '  ·  2 Phones: ' + stats.remoteGames + ' (' + stats.remoteWins + '-' + stats.remoteLosses + ')';
  }
  var diffButtons = document.querySelectorAll('[data-diff]');
  for (var i = 0; i < diffButtons.length; i++) {
    diffButtons[i].className = diffButtons[i].getAttribute('data-diff') === difficulty ? 'on' : '';
  }
}

function setDifficulty(d) {
  difficulty = d;
  storeSet(DIFF_KEY, d);
  updateMenu();
  toast('Bot difficulty: ' + (d.charAt(0).toUpperCase() + d.slice(1)));
}

function rgba(hex, alpha) {
  var h = hex.replace('#', '');
  var r = parseInt(h.substring(0, 2), 16);
  var g = parseInt(h.substring(2, 4), 16);
  var b = parseInt(h.substring(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function roundRect(x, y, w, h, r) {
  if (r > w / 2) r = w / 2;
  if (r > h / 2) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function initMaps() {
  laneMap = {};
  startMap = {};
  for (var color = 0; color < 4; color++) {
    for (var pos = 51; pos < engine.FINISH; pos++) {
      var lane = engine.tokenCellForColor(color, pos, 0);
      if (lane) laneMap[lane[0] + ',' + lane[1]] = color;
    }
    var start = engine.TRACK[engine.START[color]];
    startMap[start[0] + ',' + start[1]] = color;
  }
}

function isBaseCell(r, c) {
  return (r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c > 8) || (r > 8 && c < 6);
}

function isCenterCell(r, c) {
  return r >= 6 && r <= 8 && c >= 6 && c <= 8;
}

function playersHaveColor(color) {
  for (var i = 0; i < game.players.length; i++) if (game.players[i].color === color) return true;
  return false;
}

function drawBase(color) {
  var col = color === 0 || color === 3 ? 0 : 9;
  var row = color === 0 || color === 1 ? 0 : 9;
  var x = col * CELL;
  var y = row * CELL;
  var size = 6 * CELL;
  var info = INFO[color];
  var active = playersHaveColor(color);

  ctx.fillStyle = active ? rgba(info.fill, 0.18) : 'rgba(255,255,255,0.025)';
  ctx.strokeStyle = active ? rgba(info.fill, 0.72) : 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 2;
  roundRect(x + 2, y + 2, size - 4, size - 4, CELL * 0.5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = active ? 'rgba(4,10,16,0.35)' : 'rgba(255,255,255,0.02)';
  roundRect(x + CELL * 0.75, y + CELL * 0.75, size - CELL * 1.5, size - CELL * 1.5, CELL * 0.42);
  ctx.fill();

  for (var i = 0; i < 4; i++) {
    var cell = engine.tokenCellForColor(color, -1, i);
    var cx = (cell[1] + 0.5) * CELL;
    var cy = (cell[0] + 0.5) * CELL;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.33, 0, Math.PI * 2);
    ctx.fillStyle = active ? rgba(info.fill, 0.14) : 'rgba(255,255,255,0.025)';
    ctx.fill();
    ctx.strokeStyle = active ? rgba(info.fill, 0.5) : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawCell(r, c, fill, stroke) {
  var x = c * CELL + 1;
  var y = r * CELL + 1;
  var w = CELL - 2;
  var h = CELL - 2;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawPath() {
  for (var r = 0; r < GRID; r++) {
    for (var c = 0; c < GRID; c++) {
      if (isBaseCell(r, c) || isCenterCell(r, c)) continue;
      var key = r + ',' + c;
      var lane = laneMap[key];
      var start = startMap[key];
      var fill = '#e9e1cd';
      var stroke = 'rgba(53,43,31,0.25)';
      if (lane !== undefined) {
        var la = playersHaveColor(lane);
        fill = la ? rgba(INFO[lane].fill, 0.48) : 'rgba(233,225,205,0.28)';
        stroke = la ? rgba(INFO[lane].dark, 0.55) : 'rgba(255,255,255,0.09)';
      }
      if (start !== undefined) {
        var sa = playersHaveColor(start);
        fill = sa ? INFO[start].fill : 'rgba(255,255,255,0.08)';
        stroke = sa ? INFO[start].dark : 'rgba(255,255,255,0.1)';
      }
      drawCell(r, c, fill, stroke);
    }
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold ' + Math.round(CELL * 0.62) + 'px Arial,sans-serif';
  for (var i = 0; i < engine.SAFE.length; i++) {
    var sq = engine.SAFE[i];
    var cell = engine.TRACK[sq];
    var key2 = cell[0] + ',' + cell[1];
    var onStart = startMap[key2] !== undefined;
    ctx.fillStyle = onStart ? 'rgba(255,255,255,0.9)' : '#8a7f6c';
    ctx.fillText('\u2605', (cell[1] + 0.5) * CELL, (cell[0] + 0.54) * CELL);
  }
}

function drawCenter() {
  var x0 = 6 * CELL;
  var y0 = 6 * CELL;
  var x1 = 9 * CELL;
  var y1 = 9 * CELL;
  var cx = 7.5 * CELL;
  var cy = 7.5 * CELL;
  ctx.fillStyle = '#0d1722';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  var tris = [
    { color: 0, pts: [[x0, y0], [x0, y1], [cx, cy]] },
    { color: 1, pts: [[x0, y0], [x1, y0], [cx, cy]] },
    { color: 2, pts: [[x1, y0], [x1, y1], [cx, cy]] },
    { color: 3, pts: [[x0, y1], [x1, y1], [cx, cy]] }
  ];
  for (var i = 0; i < tris.length; i++) {
    var t = tris[i];
    var active = playersHaveColor(t.color);
    ctx.beginPath();
    ctx.moveTo(t.pts[0][0], t.pts[0][1]);
    ctx.lineTo(t.pts[1][0], t.pts[1][1]);
    ctx.lineTo(t.pts[2][0], t.pts[2][1]);
    ctx.closePath();
    ctx.fillStyle = active ? rgba(INFO[t.color].fill, 0.82) : 'rgba(255,255,255,0.035)';
    ctx.fill();
    ctx.strokeStyle = active ? rgba(INFO[t.color].dark, 0.8) : 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  var anchors = [
    [x0 + CELL * 0.55, cy],
    [cx, y0 + CELL * 0.55],
    [x1 - CELL * 0.55, cy],
    [cx, y1 - CELL * 0.55]
  ];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (var s = 0; s < game.players.length; s++) {
    var color = game.players[s].color;
    var count = engine.finishedCount(game, s);
    if (!count) continue;
    var ax = anchors[color][0];
    var ay = anchors[color][1];
    ctx.beginPath();
    ctx.arc(ax, ay, CELL * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = INFO[color].fill;
    ctx.fill();
    ctx.strokeStyle = '#fff7df';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = color === 2 ? '#3d2b05' : '#fff';
    ctx.font = 'bold ' + Math.round(CELL * 0.38) + 'px Arial,sans-serif';
    ctx.fillText(String(count), ax, ay + 0.5);
  }
}

function getLocalActingSeat() {
  if (!game || mode === 'menu' || game.winner !== null) return -1;
  if (mode === 'local') return game.turn;
  if (mode === 'bot') return game.turn === 0 ? 0 : -1;
  if (mode === 'remote') {
    if (!remote || remote.dead || remoteWaiting) return -1;
    return game.turn === localSeat ? localSeat : -1;
  }
  return -1;
}

function getLocalLegalMoves() {
  var seat = getLocalActingSeat();
  if (seat < 0 || !game.rolled) return [];
  return engine.getLegalMoves(game, seat);
}

function tokenOffsets(n) {
  if (n <= 1) return [[0, 0]];
  if (n === 2) return [[-CELL * 0.18, 0], [CELL * 0.18, 0]];
  if (n === 3) return [[-CELL * 0.18, -CELL * 0.17], [CELL * 0.18, -CELL * 0.17], [0, CELL * 0.2]];
  if (n === 4) return [[-CELL * 0.18, -CELL * 0.18], [CELL * 0.18, -CELL * 0.18], [-CELL * 0.18, CELL * 0.18], [CELL * 0.18, CELL * 0.18]];
  var out = [];
  for (var r = -1; r <= 1; r++) for (var c = -1; c <= 1; c++) out.push([c * CELL * 0.19, r * CELL * 0.19]);
  return out;
}

function drawToken(x, y, r, color, legal, selected) {
  var info = INFO[color];
  if (legal || selected) {
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = selected ? '#ffffff' : '#ffd166';
    ctx.lineWidth = selected ? 2.5 : 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r + 6.5, 0, Math.PI * 2);
    ctx.strokeStyle = rgba('#ffd166', 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x + 1.2, y + 1.8, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = info.fill;
  ctx.fill();
  ctx.strokeStyle = '#fff8e9';
  ctx.lineWidth = Math.max(1.3, r * 0.13);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 0.28, y - r * 0.3, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
}

function drawTokens() {
  hitAreas = [];
  var acting = getLocalActingSeat();
  var legal = [];
  if (acting >= 0 && game.rolled) legal = engine.getLegalMoves(game, acting);
  var groups = {};
  for (var p = 0; p < game.players.length; p++) {
    var player = game.players[p];
    for (var t = 0; t < player.tokens.length; t++) {
      var pos = player.tokens[t];
      if (pos === engine.FINISH) continue;
      var cell = engine.tokenCell(game, p, t);
      if (!cell) continue;
      var key = cell[0] + ',' + cell[1];
      if (!groups[key]) groups[key] = { cell: cell, items: [] };
      groups[key].items.push({ seat: p, token: t, color: player.color });
    }
  }
  for (var k in groups) {
    if (!groups.hasOwnProperty(k)) continue;
    var g = groups[k];
    var n = g.items.length;
    var offsets = tokenOffsets(n);
    var baseX = (g.cell[1] + 0.5) * CELL;
    var baseY = (g.cell[0] + 0.5) * CELL;
    var radius = n === 1 ? CELL * 0.32 : n <= 4 ? CELL * 0.19 : CELL * 0.14;
    for (var i = 0; i < n; i++) {
      var item = g.items[i];
      var off = offsets[i] || [0, 0];
      var x = baseX + off[0];
      var y = baseY + off[1];
      var isLegal = acting >= 0 && item.seat === acting && legal.indexOf(item.token) >= 0;
      var isSel = selectedToken === item.token && item.seat === acting;
      drawToken(x, y, radius, item.color, isLegal, isSel);
      hitAreas.push({
        x: baseX,
        y: baseY,
        tx: x,
        ty: y,
        r: Math.max(CELL * 0.45, radius * 1.8),
        seat: item.seat,
        token: item.token
      });
    }
  }
}

function drawBoard() {
  if (!ctx) return;
  ctx.clearRect(0, 0, FIT, FIT);
  var bg = ctx.createLinearGradient(0, 0, FIT, FIT);
  bg.addColorStop(0, '#101d2b');
  bg.addColorStop(1, '#070d15');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, FIT, FIT);
  drawBase(0);
  drawBase(1);
  drawBase(2);
  drawBase(3);
  drawPath();
  drawCenter();
  drawTokens();
}

function canRoll() {
  if (!game || mode === 'menu' || game.winner !== null || paused || overlayVisible()) return false;
  if (game.rolled) return false;
  if (mode === 'local') return true;
  if (mode === 'bot') return game.turn === 0;
  if (mode === 'remote') {
    return !!remote && !remote.dead && !remoteWaiting && game.turn === localSeat;
  }
  return false;
}

function canChooseToken(i) {
  if (game.winner !== null || paused || overlayVisible()) return false;
  var moves = getLocalLegalMoves();
  return moves.indexOf(i) >= 0;
}

function tokenLabel(pos) {
  if (pos === -1) return 'Base';
  if (pos === engine.FINISH) return 'Home';
  if (pos >= 51) return 'Lane';
  return pos + '/56';
}

function renderAction() {
  var rollBtn = $('rollBtn');
  var tokenBox = $('tokenBtns');
  if (!rollBtn || !tokenBox) return;
  var moves = getLocalLegalMoves();
  var mustChoose = moves.length > 0 && !overlayVisible() && !paused && game.winner === null && !(remote && remote.dead);
  tokenButtons = [];

  if (mustChoose) {
    rollBtn.classList.add('hidden');
    tokenBox.classList.remove('hidden');
    tokenBox.innerHTML = '';
    var actingSeat = getLocalActingSeat();
    for (var i = 0; i < 4; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-token', String(i));
      var legal = moves.indexOf(i) >= 0;
      b.className = (legal ? 'can' : '') + (selectedToken === i && legal ? ' sel' : '');
      b.disabled = !legal;
      var pos = actingSeat >= 0 && game.players[actingSeat] ? game.players[actingSeat].tokens[i] : -1;
      var num = document.createElement('b');
      num.textContent = String(i + 1);
      var label = document.createElement('span');
      label.textContent = tokenLabel(pos);
      b.appendChild(num);
      b.appendChild(label);
      b.onclick = (function (idx) {
        return function () { chooseToken(idx); };
      })(i);
      tokenBox.appendChild(b);
      tokenButtons.push(b);
    }
    return;
  }

  tokenBox.classList.add('hidden');
  tokenBox.innerHTML = '';
  rollBtn.classList.remove('hidden');
  var disabled = true;
  var text = 'ROLL DICE';
  if (game.winner !== null) { text = 'GAME OVER'; }
  else if (remote && remote.dead) { text = 'DISCONNECTED'; }
  else if (paused || overlayVisible()) { text = 'PAUSED'; }
  else if (mode === 'bot' && game.turn === 1) { text = 'BOT IS THINKING...'; }
  else if (mode === 'remote' && remoteWaiting) { text = 'WAITING...'; }
  else if (mode === 'remote' && game.turn !== localSeat) { text = 'WAITING FOR OPPONENT'; }
  else if (game.rolled) { text = 'CHOOSE A TOKEN'; }
  else if (canRoll()) {
    disabled = false;
    text = game.lastEvent && game.lastEvent.type === 'move' && game.lastEvent.bonus ? 'ROLL AGAIN' : 'ROLL DICE';
  }
  rollBtn.textContent = text;
  rollBtn.disabled = disabled;
}

function renderTurn() {
  var dot = $('turnDot');
  var text = $('turnText');
  var dice = $('diceVal');
  if (!dot || !text || !dice) return;
  if (!game) { text.textContent = 'Load game'; return; }
  var seat = game.turn;
  var color = game.players[seat] ? game.players[seat].color : 0;
  dot.className = 'turnDot ' + (color === 2 ? 'yellow' : 'red');
  dice.textContent = game.dice ? String(game.dice) : '-';

  if (game.winner !== null) { text.textContent = names[game.winner] + ' wins!'; return; }
  if (remote && remote.dead) { text.textContent = 'Opponent disconnected'; return; }
  if (mode === 'menu') { text.textContent = 'Choose a game mode'; return; }
  if (remoteWaiting) { text.textContent = 'Waiting for host...'; return; }

  var local = getLocalActingSeat();
  var isLocalTurn = local >= 0 && game.turn === local;
  if (game.rolled) {
    if (isLocalTurn) {
      var moves = engine.getLegalMoves(game, local);
      if (mode === 'local') {
        text.textContent = names[game.turn] + ' rolled ' + game.dice + (moves.length ? ' — choose a token' : ' — no move');
      } else {
        text.textContent = moves.length ? 'You rolled ' + game.dice + ' — choose a token' : 'No move';
      }
    } else if (mode === 'bot' && game.turn === 1) {
      text.textContent = 'Bot rolled ' + game.dice + '...';
    } else {
      text.textContent = 'Waiting — opponent rolled ' + game.dice;
    }
    return;
  }
  if (isLocalTurn) {
    text.textContent = (mode === 'local' ? names[game.turn] + ' — roll' : 'Your turn — roll');
  } else if (mode === 'bot') {
    text.textContent = 'Bot is thinking...';
  } else if (mode === 'remote') {
    text.textContent = 'Waiting for ' + names[game.turn] + '...';
  } else {
    text.textContent = names[game.turn] + "'s turn";
  }
}

function renderHome() {
  var counts = [0, 0];
  for (var s = 0; s < game.players.length; s++) {
    var color = game.players[s].color;
    var n = engine.finishedCount(game, s);
    if (color === 0) counts[0] = n;
    if (color === 2) counts[1] = n;
  }
  if ($('redHome')) $('redHome').textContent = counts[0] + '/4';
  if ($('yellowHome')) $('yellowHome').textContent = counts[1] + '/4';
}

function render() {
  if (!game) return;
  renderTurn();
  renderHome();
  renderAction();
  drawBoard();
}

function focusActionSoon() {
  setTimeout(function () {
    if (overlayVisible() || paused || !game || game.winner !== null) return;
    if (remote && remote.dead) return;
    var moves = getLocalLegalMoves();
    if (moves.length) {
      var b = document.querySelector('#tokenBtns button.can:not(:disabled)');
      if (b) { try { b.focus(); } catch (e) {} }
      return;
    }
    if (canRoll()) {
      var r = $('rollBtn');
      if (r && !r.disabled) { try { r.focus(); } catch (e) {} }
    }
  }, 50);
}

function eventToast(ev) {
  if (!ev) return;
  var who = names[ev.seat] || 'Player';
  if (ev.type === 'tripleSix') toast(who + ' rolled three 6s — turn lost');
  else if (ev.type === 'noMove') toast(who + ' rolled ' + ev.dice + ' — no move');
  else if (ev.type === 'move') {
    if (ev.win) toast(who + ' wins!');
    else if (ev.captured && ev.captured.length) toast(who + ' captured ' + ev.captured.length + ' token' + (ev.captured.length > 1 ? 's' : '') + '!');
    else if (ev.finished) toast(who + ' brought a token home!');
    else if (ev.dice === 6) toast(who + ' rolled a 6 — extra roll');
  }
}

function finishGame() {
  if (!game || game.winner === null) return;
  clearBot();
  if (!winCounted) {
    winCounted = true;
    stats.games++;
    if (mode === 'bot') {
      stats.botGames++;
      if (game.winner === 0) stats.botWins++;
      else stats.botLosses++;
    } else if (mode === 'local') {
      stats.localGames++;
    } else if (mode === 'remote') {
      stats.remoteGames++;
      if (game.winner === localSeat) stats.remoteWins++;
      else stats.remoteLosses++;
    }
    saveStats();
  }
  showResult();
}

function resultTitle() {
  if (!game || game.winner === null) return 'Game over';
  if (mode === 'bot') return game.winner === 0 ? 'You win!' : 'Bot wins';
  if (mode === 'local') return names[game.winner] + ' wins!';
  if (mode === 'remote') return game.winner === localSeat ? 'You win!' : names[game.winner] + ' wins';
  return names[game.winner] + ' wins';
}

function showResult() {
  if (!game || game.winner === null) return;
  $('resultTitle').textContent = resultTitle();
  $('resultText').textContent = 'All four tokens are home.';
  $('resultScore').textContent = 'Red ' + engine.finishedCount(game, 0) + '/4  ·  Yellow ' + engine.finishedCount(game, 1) + '/4';
  var btn = $('newRoundBtn');
  if (btn) {
    btn.disabled = !!(remote && remote.dead);
    btn.textContent = mode === 'remote' && remote && remote.role === 'join' ? 'Request Rematch' : 'New Game';
  }
  show('result');
}

function showDisconnected() {
  if (!remote) return;
  $('resultTitle').textContent = 'Opponent disconnected';
  $('resultText').textContent = 'The other phone left the game.';
  $('resultScore').textContent = 'Open the menu to start again.';
  var btn = $('newRoundBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Disconnected'; }
  show('result');
}

function clearBot() {
  if (botTimer) { clearTimeout(botTimer); botTimer = null; }
}

function scheduleBot() {
  clearBot();
  if (mode !== 'bot' || !game || game.winner !== null || paused || overlayVisible()) return;
  if (game.turn !== 1) { focusActionSoon(); return; }
  botTimer = setTimeout(function () {
    botTimer = null;
    if (mode !== 'bot' || !game || game.winner !== null || paused || overlayVisible() || game.turn !== 1) return;
    if (!game.rolled) {
      var ev = engine.roll(game, Math.random);
      selectedToken = null;
      render();
      eventToast(ev);
      if (game.winner !== null) { finishGame(); return; }
      scheduleBot();
      return;
    }
    var moves = engine.getLegalMoves(game, 1);
    if (!moves.length) { scheduleBot(); return; }
    var token = engine.chooseBotMove(game, difficulty, Math.random);
    var result = engine.move(game, token);
    selectedToken = null;
    render();
    eventToast(result);
    if (game.winner !== null) { finishGame(); return; }
    scheduleBot();
  }, 620);
}

function newGameState(bots) {
  game = engine.createGame({ seats: [0, 2], bots: bots || [false, false] });
  selectedToken = null;
  winCounted = false;
  roundNo++;
}

function startBot() {
  closeRemote();
  clearBot();
  mode = 'bot';
  names = [user, 'Bot'];
  localSeat = 0;
  paused = false;
  newGameState([false, true]);
  show(null);
  layoutBoard();
  render();
  renderAction();
  focusActionSoon();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  toast('You are Red. Difficulty: ' + difficulty);
}

function startLocal() {
  closeRemote();
  clearBot();
  mode = 'local';
  names = ['Player 1', 'Player 2'];
  localSeat = 0;
  paused = false;
  newGameState([false, false]);
  show(null);
  layoutBoard();
  render();
  focusActionSoon();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  toast('Player 1 is Red · Player 2 is Yellow');
}

function newRoundAction() {
  if (remote && remote.dead) return;
  clearBot();
  if (mode === 'remote') {
    if (!remote) return;
    if (remote.role === 'host') {
      newGameState([false, false]);
      paused = false;
      show(null);
      render();
      sendState();
      focusActionSoon();
    } else {
      var sent = remote.session.send({ t: 'restart' });
      if (sent) {
        remoteWaiting = true;
        var btn = $('newRoundBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Waiting for host...'; }
      } else {
        toast('Connection lost.');
      }
    }
    return;
  }
  paused = false;
  newGameState(mode === 'bot' ? [false, true] : [false, false]);
  show(null);
  layoutBoard();
  render();
  focusActionSoon();
  if (mode === 'bot') toast('New game — you start as Red');
}

function doRoll() {
  if (!canRoll()) return;
  selectedToken = null;
  var ev = engine.roll(game, Math.random);
  render();
  eventToast(ev);
  focusActionSoon();
  return ev;
}

function rollAction() {
  if (!canRoll()) return;
  if (mode === 'remote') {
    if (remote.role === 'host') {
      var ev = doRoll();
      sendState();
      if (game.winner !== null) finishGame();
      return;
    }
    remoteWaiting = true;
    var sent = remote.session.send({ t: 'roll' });
    if (!sent) { remoteWaiting = false; toast('Connection lost.'); }
    render();
    return;
  }
  var ev2 = doRoll();
  if (game.winner !== null) finishGame();
}

function chooseToken(i) {
  if (!canChooseToken(i)) return;
  selectedToken = i;
  if (mode === 'remote') {
    if (remote.role === 'host') {
      var ev = engine.move(game, i);
      render();
      eventToast(ev);
      sendState();
      if (game.winner !== null) finishGame();
      else focusActionSoon();
      return;
    }
    remoteWaiting = true;
    renderAction();
    var sent = remote.session.send({ t: 'move', token: i });
    if (!sent) { remoteWaiting = false; toast('Connection lost.'); }
    render();
    return;
  }
  var result = engine.move(game, i);
  selectedToken = null;
  render();
  eventToast(result);
  if (game.winner !== null) finishGame();
  else {
    scheduleBot();
    focusActionSoon();
  }
}

function sendState() {
  if (!remote || mode !== 'remote' || remote.role !== 'host' || !remote.session) return;
  var ok = remote.session.send({ t: 'state', g: game, round: roundNo });
  if (!ok) toast('Could not send state. Check the connection.');
}

function validRemoteState(msg) {
  if (!msg || !msg.g || !Array.isArray(msg.g.players) || msg.g.players.length < 2) return false;
  for (var i = 0; i < msg.g.players.length; i++) {
    if (!msg.g.players[i] || !Array.isArray(msg.g.players[i].tokens) || msg.g.players[i].tokens.length !== 4) return false;
  }
  return true;
}

function applyRemoteState(msg) {
  if (!validRemoteState(msg)) return;
  var isNewRound = msg.round !== roundNo;
  roundNo = msg.round || roundNo;
  if (isNewRound) {
    winCounted = false;
    selectedToken = null;
  }
  game = msg.g;
  localSeat = 1;
  remoteWaiting = false;
  if (remote) remote.dead = false;
  if (game.winner === null) {
    var r = $('result');
    if (r && !r.classList.contains('hidden')) show(null);
  }
  render();
  setTimeout(layoutBoard, 30);
  if (game.winner !== null) finishGame();
  else focusActionSoon();
}

function handleRemote(msg) {
  if (!remote || !msg) return;
  if (remote.role === 'join') {
    if (msg.t === 'state') applyRemoteState(msg);
    return;
  }
  if (msg.t === 'roll') {
    if (game.winner !== null || game.rolled || game.turn !== 1) { sendState(); return; }
    var ev = engine.roll(game, Math.random);
    selectedToken = null;
    render();
    eventToast(ev);
    sendState();
    if (game.winner !== null) finishGame();
    else if (getLocalActingSeat() >= 0) focusActionSoon();
    return;
  }
  if (msg.t === 'move') {
    if (game.winner !== null || !game.rolled || game.turn !== 1) { sendState(); return; }
    var legal = engine.getLegalMoves(game, 1);
    if (legal.indexOf(msg.token) < 0) { sendState(); return; }
    var result = engine.move(game, msg.token);
    selectedToken = null;
    render();
    eventToast(result);
    sendState();
    if (game.winner !== null) finishGame();
    else if (getLocalActingSeat() >= 0) focusActionSoon();
    return;
  }
  if (msg.t === 'restart') {
    if (game.winner === null) { sendState(); return; }
    newGameState([false, false]);
    paused = false;
    show(null);
    render();
    sendState();
    focusActionSoon();
  }
}

function remoteLost(reason) {
  if (!remote || reason === 'local') return;
  remote.dead = true;
  remoteWaiting = false;
  clearBot();
  render();
  toast('Opponent disconnected');
  showDisconnected();
}

function destroyPairUI() {
  if (pairUI) {
    try { pairUI.destroy(); } catch (e) {}
    pairUI = null;
  }
}

function closeRemote() {
  destroyPairUI();
  if (remote && remote.session) {
    try {
      remote.session.onmessage = null;
      remote.session.onclose = null;
      remote.session.close();
    } catch (e) {}
  }
  remote = null;
  remoteWaiting = false;
}

function openPair() {
  if (!window.WGNet || !WGNet.supported()) {
    alert('This browser does not support offline phone-to-phone play. Use 2 Players on the same phone instead.');
    return;
  }
  closeRemote();
  show('pair');
  pairUI = WGNet.pair({
    root: $('pairBody'),
    onConnected: function (session, role) {
      onPeerConnected(session, role);
    },
    onClose: function () {
      destroyPairUI();
      show('menu');
    }
  });
}

function onPeerConnected(session, role) {
  destroyPairUI();
  clearBot();
  mode = 'remote';
  paused = false;
  selectedToken = null;
  remote = { role: role, session: session, dead: false };
  session.onmessage = handleRemote;
  session.onclose = remoteLost;
  if (role === 'host') {
    localSeat = 0;
    names = [user, 'Guest'];
    remoteWaiting = false;
    newGameState([false, false]);
    roundNo = 1;
    show(null);
    layoutBoard();
    render();
    sendState();
    focusActionSoon();
    toast('Connected! You are Red (host).');
  } else {
    localSeat = 1;
    names = ['Host', user];
    remoteWaiting = true;
    game = engine.createGame({ seats: [0, 2] });
    winCounted = false;
    roundNo = 0;
    show(null);
    layoutBoard();
    render();
    toast('Connected! You are Yellow (guest).');
  }
}

function toMainMenu() {
  clearBot();
  closeRemote();
  mode = 'menu';
  paused = false;
  show('menu');
  updateMenu();
}

function pauseGame() {
  if (mode === 'menu' || overlayVisible()) return;
  paused = true;
  clearBot();
  if ($('pauseInfo')) {
    $('pauseInfo').textContent = mode === 'remote'
      ? (remote && remote.role === 'host' ? 'You are Red. Guest is Yellow.' : 'You are Yellow. Host is Red.')
      : (mode === 'bot' ? 'Bot difficulty: ' + difficulty : 'Player 1 vs Player 2');
  }
  show('pause');
}

function resumeGame() {
  paused = false;
  show(null);
  layoutBoard();
  render();
  scheduleBot();
  focusActionSoon();
}

function keyboardOverlayStep(direction) {
  var panel = document.querySelector('.overlay:not(.hidden)');
  if (!panel) return;
  var list = panel.querySelectorAll('button:not(:disabled)');
  if (!list.length) return;
  var idx = -1;
  for (var i = 0; i < list.length; i++) if (list[i] === document.activeElement) { idx = i; break; }
  idx = idx < 0 ? 0 : (idx + direction + list.length) % list.length;
  try { list[idx].focus(); } catch (e) {}
}

function cycleTokenFocus(direction) {
  var list = document.querySelectorAll('#tokenBtns button:not(:disabled)');
  if (!list.length) return;
  var idx = -1;
  for (var i = 0; i < list.length; i++) if (list[i] === document.activeElement) { idx = i; break; }
  idx = idx < 0 ? 0 : (idx + direction + list.length) % list.length;
  try { list[idx].focus(); } catch (e) {}
}

function boardClick(e) {
  if (!game || game.winner !== null || paused || overlayVisible()) return;
  var acting = getLocalActingSeat();
  if (acting < 0) return;
  var legal = engine.getLegalMoves(game, acting);
  if (!legal.length) return;
  var rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  var x = (e.clientX - rect.left) * FIT / rect.width;
  var y = (e.clientY - rect.top) * FIT / rect.height;
  var best = null;
  var bestDist = Infinity;
  for (var i = 0; i < hitAreas.length; i++) {
    var h = hitAreas[i];
    if (h.seat !== acting || legal.indexOf(h.token) < 0) continue;
    var dx = x - h.tx;
    var dy = y - h.ty;
    var d = Math.sqrt(dx * dx + dy * dy);
    var dc = x - h.x;
    var dcy = y - h.y;
    var cellDist = Math.sqrt(dc * dc + dcy * dcy);
    if (d <= h.r || cellDist <= CELL * 0.55) {
      var score = Math.min(d, cellDist + 1);
      if (score < bestDist) { bestDist = score; best = h; }
    }
  }
  if (best) chooseToken(best.token);
}

window.addEventListener('keydown', function (e) {
  var tag = (e.target && e.target.nodeName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (isPairOpen()) return;
  var k = e.key || '';
  var c = e.keyCode || 0;

  if (overlayVisible()) {
    var navDown = k === 'ArrowDown' || k === 'ArrowRight' || k === '8' || k === '6' || c === 40 || c === 39 || c === 56 || c === 54;
    var navUp = k === 'ArrowUp' || k === 'ArrowLeft' || k === '2' || k === '4' || c === 38 || c === 37 || c === 50 || c === 52;
    if (navDown || navUp) { e.preventDefault(); keyboardOverlayStep(navDown ? 1 : -1); }
    return;
  }
  if (mode === 'menu' || paused) return;

  if (k === '0' || c === 48 || k === 'Escape' || c === 27) {
    e.preventDefault();
    pauseGame();
    return;
  }

  var moves = getLocalLegalMoves();
  if (c >= 49 && c <= 52) {
    e.preventDefault();
    var idx = c - 49;
    if (moves.indexOf(idx) >= 0) chooseToken(idx);
    return;
  }

  if (k === 'ArrowLeft' || c === 37) { if (moves.length) { e.preventDefault(); cycleTokenFocus(-1); } return; }
  if (k === 'ArrowRight' || c === 39) { if (moves.length) { e.preventDefault(); cycleTokenFocus(1); } return; }
  if (k === 'ArrowUp' || c === 38) { if (moves.length) { e.preventDefault(); cycleTokenFocus(-1); } return; }
  if (k === 'ArrowDown' || c === 40) { if (moves.length) { e.preventDefault(); cycleTokenFocus(1); } return; }

  if (k === '5' || c === 53) {
    e.preventDefault();
    if (canRoll()) { rollAction(); return; }
    if (moves.length === 1) { chooseToken(moves[0]); return; }
    var active = document.activeElement;
    if (active && active.getAttribute && active.getAttribute('data-token') !== null) {
      chooseToken(Number(active.getAttribute('data-token')));
    }
    return;
  }

  if (k === 'Enter' || c === 13 || k === ' ' || c === 32) {
    var tag2 = (document.activeElement && document.activeElement.nodeName || '').toUpperCase();
    if (tag2 === 'BUTTON') return;
    if (canRoll()) { e.preventDefault(); rollAction(); return; }
    if (moves.length === 1) { e.preventDefault(); chooseToken(moves[0]); }
  }
});

function bindUI() {
  canvas = $('board');
  if (canvas) {
    ctx = canvas.getContext('2d');
    initMaps();
    canvas.addEventListener('click', boardClick);
  }
  updateMenu();

  var diffButtons = document.querySelectorAll('[data-diff]');
  for (var i = 0; i < diffButtons.length; i++) {
    diffButtons[i].onclick = function () {
      setDifficulty(this.getAttribute('data-diff'));
    };
  }

  $('playBot').onclick = startBot;
  $('playLocal').onclick = startLocal;
  $('playRemote').onclick = openPair;
  $('howtoBtn').onclick = function () { show('help'); };
  $('helpBack').onclick = function () { show('menu'); };
  $('homeBtn').onclick = function () { location.href = '../../index.html'; };
  $('menuBtn').onclick = pauseGame;
  $('resumeBtn').onclick = resumeGame;
  $('pauseMenuBtn').onclick = toMainMenu;
  $('newRoundBtn').onclick = newRoundAction;
  $('resultMenuBtn').onclick = toMainMenu;
  $('rollBtn').onclick = rollAction;

  show('menu');
  render();
  setTimeout(layoutBoard, 60);
}

window.addEventListener('resize', function () {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(layoutBoard, 60);
});
window.addEventListener('orientationchange', function () {
  setTimeout(layoutBoard, 250);
});

bindUI();
