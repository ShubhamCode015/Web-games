/* Ludo rules engine: 52-square track, home columns, 1v1 or 4-player ready. */
(function (root, factory) {
  var engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  root.LudoEngine = engine;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var COLORS = ['red', 'green', 'yellow', 'blue'];
  var START = [0, 13, 26, 39];
  var SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
  var FINISH = 56;
  var HOME_COL = [
    [[7, 1], 0, 1],
    [[1, 7], 1, 0],
    [[7, 13], 0, -1],
    [[13, 7], -1, 0]
  ];
  var BASE = [[2, 2], [2, 11], [11, 11], [11, 2]];
  var TRACK = [];

  function run(r, c, dr, dc, n) {
    for (var i = 0; i < n; i++) TRACK.push([r + dr * i, c + dc * i]);
  }
  run(6, 1, 0, 1, 5);
  run(5, 6, -1, 0, 6);
  TRACK.push([0, 7]);
  run(0, 8, 1, 0, 6);
  run(6, 9, 0, 1, 6);
  TRACK.push([7, 14]);
  run(8, 14, 0, -1, 6);
  run(9, 8, 1, 0, 6);
  TRACK.push([14, 7]);
  run(14, 6, -1, 0, 6);
  run(8, 5, 0, -1, 6);
  TRACK.push([7, 0]);
  TRACK.push([6, 0]);

  function otherSeats(state, seat) {
    var out = [];
    for (var i = 0; i < state.players.length; i++) if (i !== seat) out.push(state.players[i]);
    return out;
  }

  function absoluteSquare(color, progress) {
    return (START[color] + progress) % 52;
  }

  function isSafeSquare(square) {
    return SAFE.indexOf(square) >= 0;
  }

  function createGame(options) {
    options = options || {};
    var seats = options.seats || [0, 2];
    var bots = options.bots || [];
    var players = [];
    for (var i = 0; i < seats.length; i++) {
      players.push({
        color: seats[i],
        tokens: [-1, -1, -1, -1],
        bot: !!bots[i]
      });
    }
    return {
      players: players,
      turn: 0,
      dice: 0,
      rolled: false,
      sixes: 0,
      winner: null,
      moveCount: 0,
      lastEvent: { type: 'start', seat: 0, dice: 0, text: 'Game started' }
    };
  }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function getLegalMoves(state, seat) {
    if (!state || state.winner !== null || !state.rolled) return [];
    if (seat == null) seat = state.turn;
    var player = state.players[seat];
    if (!player) return [];
    var moves = [];
    for (var i = 0; i < player.tokens.length; i++) {
      var pos = player.tokens[i];
      if (pos === -1 && state.dice === 6) moves.push(i);
      else if (pos >= 0 && pos < FINISH && pos + state.dice <= FINISH) moves.push(i);
    }
    return moves;
  }

  function finishTurn(state) {
    state.turn = (state.turn + 1) % state.players.length;
    state.rolled = false;
    state.sixes = 0;
    state.moveCount++;
  }

  function roll(state, rng) {
    if (!state || state.winner !== null || state.rolled) return null;
    rng = rng || Math.random;
    var seat = state.turn;
    var dice = 1 + Math.floor(rng() * 6);
    if (dice < 1) dice = 1;
    if (dice > 6) dice = 6;
    state.dice = dice;
    state.rolled = true;
    var event = { type: 'roll', seat: seat, dice: dice, moves: [], captured: [] };

    if (dice === 6) {
      state.sixes++;
      if (state.sixes >= 3) {
        event.type = 'tripleSix';
        event.text = 'Three 6s in a row - turn lost';
        state.lastEvent = event;
        finishTurn(state);
        return event;
      }
    } else {
      state.sixes = 0;
    }

    var moves = getLegalMoves(state, seat);
    event.moves = moves;
    if (!moves.length) {
      event.type = 'noMove';
      event.text = 'No legal move';
      state.lastEvent = event;
      finishTurn(state);
      return event;
    }
    event.text = 'Dice rolled';
    state.lastEvent = event;
    return event;
  }

  function move(state, tokenIndex) {
    if (!state || state.winner !== null || !state.rolled) return null;
    var seat = state.turn;
    var player = state.players[seat];
    if (!player || tokenIndex < 0 || tokenIndex >= player.tokens.length) return null;
    var legal = getLegalMoves(state, seat);
    if (legal.indexOf(tokenIndex) < 0) return null;

    var from = player.tokens[tokenIndex];
    var to = from === -1 ? 0 : from + state.dice;
    var color = player.color;
    var event = {
      type: 'move',
      seat: seat,
      token: tokenIndex,
      from: from,
      to: to,
      dice: state.dice,
      captured: [],
      bonus: false,
      finished: false,
      win: false,
      text: ''
    };

    player.tokens[tokenIndex] = to;

    if (to <= 50) {
      var square = absoluteSquare(color, to);
      if (!isSafeSquare(square)) {
        for (var p = 0; p < state.players.length; p++) {
          if (p === seat) continue;
          var other = state.players[p];
          for (var t = 0; t < other.tokens.length; t++) {
            var op = other.tokens[t];
            if (op >= 0 && op <= 50 && absoluteSquare(other.color, op) === square) {
              other.tokens[t] = -1;
              event.captured.push({ seat: p, token: t });
              event.bonus = true;
            }
          }
        }
      }
    }

    if (state.dice === 6) event.bonus = true;
    if (to === FINISH) {
      event.finished = true;
      event.bonus = true;
    }

    var allHome = true;
    for (var k = 0; k < player.tokens.length; k++) {
      if (player.tokens[k] !== FINISH) { allHome = false; break; }
    }
    if (allHome) {
      state.winner = seat;
      state.rolled = false;
      event.win = true;
      event.bonus = false;
      event.text = 'All four tokens reached home';
      state.lastEvent = event;
      state.moveCount++;
      return event;
    }

    if (event.bonus) {
      if (state.dice !== 6) state.sixes = 0;
      state.rolled = false;
      state.moveCount++;
      event.text = event.finished ? 'Token reached home - roll again'
        : event.captured.length ? 'Captured - roll again' : 'Rolled a 6 - roll again';
    } else {
      finishTurn(state);
      event.text = 'Next player';
    }
    state.lastEvent = event;
    return event;
  }

  function tokenCellForColor(color, progress, tokenIndex) {
    if (progress === -1) {
      var base = BASE[color];
      return [base[0] + (tokenIndex >> 1), base[1] + (tokenIndex & 1)];
    }
    if (progress >= 0 && progress <= 50) return TRACK[absoluteSquare(color, progress)].slice();
    if (progress >= 51 && progress < FINISH) {
      var lane = HOME_COL[color];
      var step = progress - 51;
      return [lane[0][0] + lane[1] * step, lane[0][1] + lane[2] * step];
    }
    return null;
  }

  function tokenCell(state, seat, tokenIndex) {
    var player = state.players[seat];
    if (!player) return null;
    return tokenCellForColor(player.color, player.tokens[tokenIndex], tokenIndex);
  }

  function finishedCount(state, seat) {
    var player = state.players[seat];
    if (!player) return 0;
    var n = 0;
    for (var i = 0; i < player.tokens.length; i++) if (player.tokens[i] === FINISH) n++;
    return n;
  }

  function threatScore(state, seat, targetSquare) {
    var score = 0;
    for (var p = 0; p < state.players.length; p++) {
      if (p === seat) continue;
      var other = state.players[p];
      for (var t = 0; t < other.tokens.length; t++) {
        var pos = other.tokens[t];
        if (pos < 0 || pos > 50) continue;
        var from = absoluteSquare(other.color, pos);
        var delta = (targetSquare - from + 52) % 52;
        if (delta >= 1 && delta <= 6) score += 70 + (6 - delta) * 12;
      }
    }
    return score;
  }

  function evaluateMove(state, seat, tokenIndex, difficulty, rng) {
    var player = state.players[seat];
    var from = player.tokens[tokenIndex];
    var dice = state.dice;
    var to = from === -1 ? 0 : from + dice;
    var color = player.color;
    var score = to * 2 + (rng ? rng() * 3 : 0);

    if (from === -1) score += 45;
    if (to >= 51) score += 80;
    if (to === FINISH) score += 520;

    if (to <= 50) {
      var square = absoluteSquare(color, to);
      var safe = isSafeSquare(square);
      if (safe) {
        score += 35;
      } else {
        for (var p = 0; p < state.players.length; p++) {
          if (p === seat) continue;
          var other = state.players[p];
          for (var t = 0; t < other.tokens.length; t++) {
            var op = other.tokens[t];
            if (op >= 0 && op <= 50 && absoluteSquare(other.color, op) === square) {
              score += 380;
            }
          }
        }
        var risk = threatScore(state, seat, square);
        score -= difficulty === 'hard' ? risk : risk * 0.45;
      }
    }

    if (difficulty === 'hard' && to <= 50) {
      var ownBehind = 0;
      for (var i = 0; i < player.tokens.length; i++) {
        if (i === tokenIndex) continue;
        var pos = player.tokens[i];
        if (pos >= 0 && pos <= 50) {
          var d = (absoluteSquare(color, to) - absoluteSquare(color, pos) + 52) % 52;
          if (d >= 1 && d <= 6) ownBehind++;
        }
      }
      score += ownBehind * 4;
    }
    return score;
  }

  function chooseBotMove(state, difficulty, rng) {
    rng = rng || Math.random;
    var moves = getLegalMoves(state, state.turn);
    if (!moves.length) return -1;
    if (difficulty === 'easy') {
      if (rng() < 0.8) return moves[Math.floor(rng() * moves.length)];
      difficulty = 'normal';
    }
    var best = moves[0];
    var bestScore = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var score = evaluateMove(state, state.turn, moves[i], difficulty, rng);
      if (score > bestScore) { bestScore = score; best = moves[i]; }
    }
    return best;
  }

  return {
    COLORS: COLORS,
    START: START,
    SAFE: SAFE,
    TRACK: TRACK,
    BASE: BASE,
    HOME_COL: HOME_COL,
    FINISH: FINISH,
    createGame: createGame,
    cloneState: cloneState,
    getLegalMoves: getLegalMoves,
    roll: roll,
    move: move,
    tokenCell: tokenCell,
    tokenCellForColor: tokenCellForColor,
    finishedCount: finishedCount,
    absoluteSquare: absoluteSquare,
    isSafeSquare: isSafeSquare,
    chooseBotMove: chooseBotMove
  };
});
