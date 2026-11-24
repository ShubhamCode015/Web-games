/* Tic Tac Toe rules and computer opponent. */
(function (root, factory) {
  var engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  root.TicTacToeEngine = engine;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  function other(player) { return player === 'X' ? 'O' : 'X'; }

  function available(board) {
    var out = [];
    for (var i = 0; i < 9; i++) if (!board[i]) out.push(i);
    return out;
  }

  function winner(board) {
    for (var i = 0; i < LINES.length; i++) {
      var a = LINES[i][0], b = LINES[i][1], c = LINES[i][2];
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return available(board).length ? null : 'draw';
  }

  function emptyBoard() {
    return ['', '', '', '', '', '', '', '', ''];
  }

  function pick(list, rng) {
    return list[Math.floor(rng() * list.length)];
  }

  function findWinningMove(board, player) {
    var moves = available(board);
    for (var m = 0; m < moves.length; m++) {
      board[moves[m]] = player;
      var win = winner(board) === player;
      board[moves[m]] = '';
      if (win) return moves[m];
    }
    return -1;
  }

  function minimax(board, turn, me) {
    var result = winner(board);
    if (result === 'draw') return 0;
    if (result) return result === me ? 10 : -10;
    var moves = available(board);
    var score = turn === me ? -Infinity : Infinity;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      board[m] = turn;
      var value = minimax(board, other(turn), me);
      board[m] = '';
      if (turn === me) {
        if (value > score) score = value;
      } else if (value < score) {
        score = value;
      }
    }
    return score;
  }

  function hardMove(board, player, rng) {
    var moves = available(board);
    if (!moves.length) return -1;
    var best = [];
    var bestScore = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      board[m] = player;
      var score = minimax(board, other(player), player);
      board[m] = '';
      if (score > bestScore) {
        bestScore = score;
        best = [m];
      } else if (score === bestScore) {
        best.push(m);
      }
    }
    return pick(best, rng);
  }

  function normalMove(board, player, rng) {
    var moves = available(board);
    if (!moves.length) return -1;
    var win = findWinningMove(board, player);
    if (win >= 0) return win;
    var block = findWinningMove(board, other(player));
    if (block >= 0) return block;
    if (board[4] === '') return 4;
    var corners = [0, 2, 6, 8].filter(function (i) { return board[i] === ''; });
    if (corners.length) return pick(corners, rng);
    return pick(moves, rng);
  }

  function easyMove(board, player, rng) {
    var moves = available(board);
    if (!moves.length) return -1;
    if (rng() < 0.7) return pick(moves, rng);
    return normalMove(board, player, rng);
  }

  function bestMove(board, player, difficulty, rng) {
    rng = rng || Math.random;
    if (difficulty === 'easy') return easyMove(board, player, rng);
    if (difficulty === 'hard') return hardMove(board, player, rng);
    return normalMove(board, player, rng);
  }

  return {
    LINES: LINES,
    emptyBoard: emptyBoard,
    winner: winner,
    available: available,
    bestMove: bestMove,
    other: other
  };
});
