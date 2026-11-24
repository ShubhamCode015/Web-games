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

var KEY = 'tictactoe_' + user;
var DIFF_KEY = 'tictactoe_difficulty';
var engine = window.TicTacToeEngine;
var OVERLAYS = ['menu', 'pause', 'result', 'help', 'pair'];

var stats = loadStats();
var difficulty = storeGet(DIFF_KEY) || 'normal';
if (difficulty !== 'easy' && difficulty !== 'normal' && difficulty !== 'hard') difficulty = 'normal';

var mode = 'menu';
var boardState = engine.emptyBoard();
var turn = 'X';
var over = false;
var result = null;
var scores = { X: 0, O: 0, D: 0 };
var names = { X: 'You', O: 'Bot' };
var sel = 4;
var paused = false;
var botTimer = null;
var remote = null;
var remoteWaiting = false;
var pairUI = null;
var roundNo = 0;
var toastTimer = null;
var cells = [];

function loadStats() {
  var s = readJSON(KEY);
  if (!s || typeof s !== 'object') s = {};
  ['wins', 'losses', 'draws', 'games', 'streak', 'bestStreak'].forEach(function (k) {
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
  toastTimer = setTimeout(function () { el.className = 'toast'; }, 2200);
}

function addCell(parent, idx) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'cell';
  b.setAttribute('aria-label', 'Cell ' + (idx + 1));
  b.onclick = function () { handleCellClick(idx); };
  cells.push(b);
  parent.appendChild(b);
}

function buildBoard() {
  var board = $('board');
  if (!board) return;
  board.innerHTML = '';
  cells = [];
  for (var r = 0; r < 3; r++) {
    var row = document.createElement('div');
    row.className = 'brow';
    addCell(row, r * 3);
    addCell(row, r * 3 + 1);
    addCell(row, r * 3 + 2);
    board.appendChild(row);
  }
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
  var board = $('board');
  if (!wrap || !board) return;
  var w = wrap.clientWidth - 2;
  var h = wrap.clientHeight - 2;
  if (w < 60 || h < 60) return;
  var size = Math.max(120, Math.min(w, h, 360));
  board.style.width = size + 'px';
  board.style.height = size + 'px';
}

function updateMenu() {
  if ($('userinfo')) $('userinfo').textContent = 'Player: ' + user;
  if ($('menuStats')) $('menuStats').textContent = stats.wins + '-' + stats.losses + '-' + stats.draws;
  if ($('menuGames')) $('menuGames').textContent = stats.games;
  if ($('streakLine')) {
    $('streakLine').textContent = stats.streak
      ? 'Win streak: ' + stats.streak + ' (best ' + stats.bestStreak + ')'
      : 'Win streak: 0 (best ' + stats.bestStreak + ')';
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

function clearBot() {
  if (botTimer) { clearTimeout(botTimer); botTimer = null; }
}

function remoteLocalMark() {
  if (!remote) return null;
  return remote.role === 'host' ? 'X' : 'O';
}

function canPlayCell(i) {
  if (mode === 'menu' || over || paused || remoteWaiting) return false;
  if (overlayVisible()) return false;
  if (boardState[i]) return false;
  if (mode === 'bot') return turn === 'X';
  if (mode === 'local') return true;
  if (mode === 'remote') return !!remote && !remote.dead && turn === remoteLocalMark();
  return false;
}

function renderCells() {
  for (var i = 0; i < cells.length; i++) {
    var b = cells[i];
    var mark = boardState[i];
    b.textContent = mark;
    b.className = 'cell' + (mark ? ' ' + mark.toLowerCase() : '') + (i === sel ? ' sel' : '');
    b.disabled = !canPlayCell(i);
  }
}

function playerName(mark) {
  return mark === 'X' ? names.X : names.O;
}

function renderStatus() {
  var dot = $('turnDot');
  var text = $('turnText');
  if (!dot || !text) return;
  dot.className = 'dot ' + (turn === 'X' ? 'x' : 'o');
  if (mode === 'menu') { text.textContent = 'Choose a game mode'; return; }
  if (remote && remote.dead) { text.textContent = 'Opponent disconnected — open Menu'; return; }
  if (over) { text.textContent = 'Round over'; return; }
  if (remoteWaiting) { text.textContent = mode === 'remote' && remote && remote.role === 'host' ? 'Waiting for guest...' : 'Waiting for host...'; return; }
  if (mode === 'bot') {
    text.textContent = turn === 'X' ? 'Your turn — place X' : 'Bot is thinking...';
    return;
  }
  if (mode === 'local') {
    text.textContent = playerName(turn) + "'s turn — place " + turn;
    return;
  }
  if (mode === 'remote') {
    if (turn === remoteLocalMark()) text.textContent = 'Your turn — place ' + turn;
    else text.textContent = 'Waiting for ' + playerName(turn) + '...';
  }
}

function render() {
  if ($('nameX')) $('nameX').textContent = names.X;
  if ($('nameO')) $('nameO').textContent = names.O;
  if ($('scoreX')) $('scoreX').textContent = scores.X;
  if ($('scoreO')) $('scoreO').textContent = scores.O;
  if ($('scoreD')) $('scoreD').textContent = scores.D;
  renderCells();
  renderStatus();
}

function resetBoardState() {
  boardState = engine.emptyBoard();
  turn = 'X';
  over = false;
  result = null;
  sel = 4;
  remoteWaiting = false;
}

function resetScores() {
  scores = { X: 0, O: 0, D: 0 };
}

function recordBotResult(res) {
  stats.games++;
  if (res === 'X') {
    stats.wins++;
    stats.streak++;
    if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
  } else if (res === 'O') {
    stats.losses++;
    stats.streak = 0;
  } else {
    stats.draws++;
    stats.streak = 0;
  }
  saveStats();
}

function makeMove(i, mark) {
  if (over || boardState[i]) return false;
  boardState[i] = mark;
  var win = engine.winner(boardState);
  if (win) {
    over = true;
    result = win;
    if (win === 'draw') scores.D++;
    else scores[win]++;
    if (mode === 'bot') recordBotResult(win);
    render();
    setTimeout(function () { if (over) showResult(); }, 260);
    return true;
  }
  turn = engine.other(mark);
  render();
  if (mode === 'bot' && turn === 'O') scheduleBot();
  return false;
}

function scheduleBot() {
  clearBot();
  if (mode !== 'bot' || turn !== 'O' || over || paused || overlayVisible()) return;
  botTimer = setTimeout(function () {
    botTimer = null;
    if (mode !== 'bot' || turn !== 'O' || over || paused || overlayVisible()) return;
    var move = engine.bestMove(boardState, 'O', difficulty, Math.random);
    if (move >= 0) makeMove(move, 'O');
  }, 480);
}

function handleCellClick(i) {
  if (!canPlayCell(i)) return;
  sel = i;
  renderCells();
  if (mode === 'remote') {
    if (!remote) return;
    if (remote.role === 'host') {
      if (turn !== 'X') return;
      makeMove(i, 'X');
      sendState();
    } else {
      if (turn !== 'O') return;
      remoteWaiting = true;
      var sent = remote.session.send({ t: 'move', cell: i });
      if (!sent) { remoteWaiting = false; toast('Connection lost.'); }
      render();
    }
    return;
  }
  makeMove(i, turn);
}

function resultTitle() {
  if (result === 'draw') return 'Draw';
  if (mode === 'bot') return result === 'X' ? 'You win!' : 'Bot wins';
  if (mode === 'local') return result === 'X' ? 'Player 1 wins!' : 'Player 2 wins!';
  if (mode === 'remote') {
    if (result === remoteLocalMark()) return 'You win!';
    return result === 'X' ? names.X + ' wins' : names.O + ' wins';
  }
  return 'Round over';
}

function showResult() {
  if (!over) return;
  $('resultTitle').textContent = resultTitle();
  $('resultText').textContent = result === 'draw' ? 'Board full — no winner.' : 'Three in a row!';
  $('resultScore').textContent = names.X + ' ' + scores.X + '  ·  Draws ' + scores.D + '  ·  ' + names.O + ' ' + scores.O;
  var btn = $('newRoundBtn');
  if (btn) {
    btn.disabled = !!(remote && remote.dead);
    btn.textContent = mode === 'remote' && remote && remote.role === 'join' ? 'Request Rematch' : 'New Round';
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

function resetRound(keepResultHidden) {
  clearBot();
  resetBoardState();
  paused = false;
  if (keepResultHidden) show(null);
  render();
  setTimeout(layoutBoard, 30);
}

function startBot() {
  closeRemote();
  mode = 'bot';
  names = { X: user, O: 'Bot' };
  resetScores();
  resetRound(true);
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  toast('You are X. Bot difficulty: ' + difficulty);
}

function startLocal() {
  closeRemote();
  mode = 'local';
  names = { X: 'Player 1', O: 'Player 2' };
  resetScores();
  resetRound(true);
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  toast('Player 1 is X · Player 2 is O');
}

function resetRoundAction() {
  if (remote && remote.dead) return;
  if (mode === 'remote') {
    if (!remote) return;
    if (remote.role === 'host') {
      resetRound(true);
      roundNo++;
      sendState();
    } else {
      var sent = remote.session.send({ t: 'restart' });
      if (sent) {
        remoteWaiting = true;
        $('newRoundBtn').disabled = true;
        $('newRoundBtn').textContent = 'Waiting for host...';
      } else {
        toast('Connection lost.');
      }
    }
    return;
  }
  resetRound(true);
  if (mode === 'bot') toast('New round — X starts');
}

function sendState() {
  if (!remote || mode !== 'remote' || remote.role !== 'host' || !remote.session) return;
  var ok = remote.session.send({
    t: 'state',
    b: boardState.slice(),
    turn: turn,
    over: over,
    result: result,
    scores: { X: scores.X, O: scores.O, D: scores.D },
    round: roundNo
  });
  if (!ok) toast('Could not send game state. Check the connection.');
}

function num(v) {
  v = Number(v);
  return isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

function applyRemoteState(msg) {
  if (!msg || !Array.isArray(msg.b) || msg.b.length < 9) return;
  var next = [];
  for (var i = 0; i < 9; i++) next.push(msg.b[i] === 'X' || msg.b[i] === 'O' ? msg.b[i] : '');
  var nextRound = num(msg.round);
  var isNewRound = nextRound !== roundNo;
  boardState = next;
  turn = msg.turn === 'O' ? 'O' : 'X';
  over = !!msg.over;
  result = msg.result === 'X' || msg.result === 'O' || msg.result === 'draw' ? msg.result : null;
  scores = { X: num(msg.scores && msg.scores.X), O: num(msg.scores && msg.scores.O), D: num(msg.scores && msg.scores.D) };
  roundNo = nextRound;
  remoteWaiting = false;
  if (isNewRound) sel = 4;
  if (remote) remote.dead = false;
  if (!over) {
    var r = $('result');
    if (r && !r.classList.contains('hidden')) show(null);
  }
  render();
  setTimeout(layoutBoard, 30);
  if (over) showResult();
}

function handleRemote(msg) {
  if (!remote || !msg) return;
  if (remote.role === 'join') {
    if (msg.t === 'state') applyRemoteState(msg);
    return;
  }
  if (msg.t === 'move') {
    if (over || turn !== 'O' || typeof msg.cell !== 'number' || msg.cell < 0 || msg.cell > 8 || boardState[msg.cell]) {
      sendState();
      return;
    }
    remoteWaiting = false;
    makeMove(msg.cell, 'O');
    sendState();
    return;
  }
  if (msg.t === 'restart') {
    if (!over) { sendState(); return; }
    resetRound(true);
    roundNo++;
    sendState();
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
  mode = 'remote';
  roundNo = 1;
  scores = { X: 0, O: 0, D: 0 };
  boardState = engine.emptyBoard();
  turn = 'X';
  over = false;
  result = null;
  paused = false;
  sel = 4;
  remoteWaiting = role === 'join';
  var hostName = role === 'host' ? user : 'Host';
  var guestName = role === 'join' ? user : 'Guest';
  names = { X: hostName, O: guestName };
  remote = { role: role, session: session, localMark: role === 'host' ? 'X' : 'O', dead: false };
  session.onmessage = handleRemote;
  session.onclose = remoteLost;
  show(null);
  layoutBoard();
  render();
  if (role === 'host') {
    sendState();
    toast('Connected! You are X (host).');
  } else {
    toast('Connected! You are O (guest).');
  }
}

function toMainMenu() {
  clearBot();
  closeRemote();
  mode = 'menu';
  paused = false;
  resetBoardState();
  render();
  show('menu');
  updateMenu();
}

function pauseGame() {
  if (mode === 'menu' || overlayVisible()) return;
  paused = true;
  clearBot();
  if ($('pauseInfo')) {
    $('pauseInfo').textContent = mode === 'remote'
      ? (remote && remote.role === 'host' ? 'You are X. Guest is O.' : 'You are O. Host is X.')
      : (mode === 'bot' ? 'Bot difficulty: ' + difficulty : 'Player 1 vs Player 2');
  }
  show('pause');
}

function resumeGame() {
  paused = false;
  show(null);
  layoutBoard();
  if (mode === 'bot' && turn === 'O') scheduleBot();
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

function moveSelection(kind) {
  if (kind === 'up') sel = sel >= 3 ? sel - 3 : sel + 6;
  else if (kind === 'down') sel = sel < 6 ? sel + 3 : sel - 6;
  else if (kind === 'left') sel = sel % 3 === 0 ? sel + 2 : sel - 1;
  else if (kind === 'right') sel = sel % 3 === 2 ? sel - 2 : sel + 1;
  renderCells();
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

  var up = k === 'ArrowUp' || k === '2' || c === 38 || c === 50;
  var down = k === 'ArrowDown' || k === '8' || c === 40 || c === 56;
  var left = k === 'ArrowLeft' || k === '4' || c === 37 || c === 52;
  var right = k === 'ArrowRight' || k === '6' || c === 39 || c === 54;
  if (up || down || left || right) {
    e.preventDefault();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    moveSelection(up ? 'up' : down ? 'down' : left ? 'left' : 'right');
    return;
  }
  if (k === '5' || c === 53 || k === 'Enter' || c === 13 || k === ' ' || c === 32) {
    e.preventDefault();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (canPlayCell(sel)) handleCellClick(sel);
    return;
  }
  if (k === '0' || c === 48 || k === 'Escape' || c === 27) {
    e.preventDefault();
    pauseGame();
    return;
  }
});

function bindUI() {
  buildBoard();
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
  $('newRoundBtn').onclick = resetRoundAction;
  $('resultMenuBtn').onclick = toMainMenu;

  show('menu');
  render();
  setTimeout(layoutBoard, 60);
}

window.addEventListener('resize', function () {
  clearTimeout(window._tttResize);
  window._tttResize = setTimeout(layoutBoard, 60);
});
window.addEventListener('orientationchange', function () {
  setTimeout(layoutBoard, 250);
});

bindUI();
