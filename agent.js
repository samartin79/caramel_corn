const FILES = 'abcdefgh';

function squareToIndex(square) {
  const file = FILES.indexOf(square[0]);
  const rank = 8 - Number(square[1]);
  return rank * 8 + file;
}

function indexToSquare(index) {
  const rank = Math.floor(index / 8);
  const file = index % 8;
  return `${FILES[file]}${8 - rank}`;
}

function colorOf(piece) {
  if (!piece || piece === '.') return null;
  return piece === piece.toUpperCase() ? 'w' : 'b';
}

function opposite(side) {
  return side === 'w' ? 'b' : 'w';
}

function cloneBoard(board) {
  return board.slice();
}

function parseFen(fen) {
  const [placement, side, castling, ep, halfmove, fullmove] = fen.trim().split(/\s+/);
  const board = [];
  for (const row of placement.split('/')) {
    for (const ch of row) {
      if (/\d/.test(ch)) board.push(...'.'.repeat(Number(ch)));
      else board.push(ch);
    }
  }
  return {
    board,
    side: side || 'w',
    castling: castling && castling !== '-' ? castling : '-',
    enPassant: ep || '-',
    halfmove: Number(halfmove || 0),
    fullmove: Number(fullmove || 1),
  };
}

function stripCastling(castling) {
  return castling.replace(/-/g, '');
}

function normalizeCastling(castling) {
  const out = stripCastling(castling);
  return out || '-';
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function isSquareAttacked(pos, sqIdx, by) {
  const tr = Math.floor(sqIdx / 8);
  const tc = sqIdx % 8;

  const pawnRow = by === 'w' ? tr + 1 : tr - 1;
  for (const dc of [-1, 1]) {
    const c = tc + dc;
    if (!inBounds(pawnRow, c)) continue;
    const p = pos.board[pawnRow * 8 + c];
    if (p !== '.' && colorOf(p) === by && p.toLowerCase() === 'p') return true;
  }

  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const r = tr + dr, c = tc + dc;
    if (!inBounds(r, c)) continue;
    const p = pos.board[r * 8 + c];
    if (p !== '.' && colorOf(p) === by && p.toLowerCase() === 'n') return true;
  }

  for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    let r = tr + dr, c = tc + dc;
    while (inBounds(r, c)) {
      const p = pos.board[r * 8 + c];
      if (p !== '.') {
        if (colorOf(p) === by && ['b', 'q'].includes(p.toLowerCase())) return true;
        break;
      }
      r += dr; c += dc;
    }
  }

  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    let r = tr + dr, c = tc + dc;
    while (inBounds(r, c)) {
      const p = pos.board[r * 8 + c];
      if (p !== '.') {
        if (colorOf(p) === by && ['r', 'q'].includes(p.toLowerCase())) return true;
        break;
      }
      r += dr; c += dc;
    }
  }

  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue;
    const r = tr + dr, c = tc + dc;
    if (!inBounds(r, c)) continue;
    const p = pos.board[r * 8 + c];
    if (p !== '.' && colorOf(p) === by && p.toLowerCase() === 'k') return true;
  }
  return false;
}

function isKingInCheck(pos, side) {
  const kingIdx = pos.board.findIndex((p) => p !== '.' && colorOf(p) === side && p.toLowerCase() === 'k');
  if (kingIdx < 0) return true;
  return isSquareAttacked(pos, kingIdx, opposite(side));
}

function hasNonPawnMaterial(pos, side) {
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (p === '.' || colorOf(p) !== side) continue;
    const lower = p.toLowerCase();
    if (lower !== 'p' && lower !== 'k') return true;
  }
  return false;
}

function hasPiece(pos, sq, piece) {
  return pos.board[squareToIndex(sq)] === piece;
}

function canCastle(pos, side, kind) {
  const rights = stripCastling(pos.castling);
  const kingSq = side === 'w' ? 'e1' : 'e8';
  const rookSq = side === 'w' ? (kind === 'king' ? 'h1' : 'a1') : (kind === 'king' ? 'h8' : 'a8');
  const between = side === 'w'
    ? (kind === 'king' ? ['f1', 'g1'] : ['d1', 'c1', 'b1'])
    : (kind === 'king' ? ['f8', 'g8'] : ['d8', 'c8', 'b8']);
  const pass = side === 'w'
    ? (kind === 'king' ? ['f1', 'g1'] : ['d1', 'c1'])
    : (kind === 'king' ? ['f8', 'g8'] : ['d8', 'c8']);
  const right = side === 'w' ? (kind === 'king' ? 'K' : 'Q') : (kind === 'king' ? 'k' : 'q');
  const kingPiece = side === 'w' ? 'K' : 'k';
  const rookPiece = side === 'w' ? 'R' : 'r';
  if (!rights.includes(right)) return false;
  if (!hasPiece(pos, kingSq, kingPiece) || !hasPiece(pos, rookSq, rookPiece)) return false;
  if (isKingInCheck(pos, side)) return false;
  for (const sq of between) {
    if (pos.board[squareToIndex(sq)] !== '.') return false;
  }
  for (const sq of pass) {
    if (isSquareAttacked(pos, squareToIndex(sq), opposite(side))) return false;
  }
  return true;
}

// Castling move/right tables. Index mapping: a8=0, h8=7, a1=56, h1=63.
const CASTLE_ROOK = { g1: [61, 63], c1: [59, 56], g8: [5, 7], c8: [3, 0] };
const CASTLE_RIGHT = { 56: 'Q', 63: 'K', 0: 'q', 7: 'k' };

function applyMove(pos, move) {
  const next = {
    board: cloneBoard(pos.board),
    side: opposite(pos.side),
    castling: stripCastling(pos.castling),
    enPassant: '-',
    halfmove: pos.halfmove + 1,
    fullmove: pos.fullmove + (pos.side === 'b' ? 1 : 0),
  };

  const from = squareToIndex(move.from);
  const to = squareToIndex(move.to);
  const piece = next.board[from];
  const target = next.board[to];
  const lower = piece.toLowerCase();

  next.board[from] = '.';

  if (lower === 'p' && move.to === pos.enPassant && target === '.') {
    const captureIdx = to + (pos.side === 'w' ? 8 : -8);
    next.board[captureIdx] = '.';
  }

  if (lower === 'k' && Math.abs(to - from) === 2) {
    const rk = CASTLE_ROOK[move.to];
    if (rk) {
      next.board[rk[0]] = next.board[rk[1]];
      next.board[rk[1]] = '.';
    }
  }

  next.board[to] = move.promotion
    ? (pos.side === 'w' ? move.promotion.toUpperCase() : move.promotion.toLowerCase())
    : piece;

  if (lower === 'p' || target !== '.' || (lower === 'p' && move.to === pos.enPassant)) next.halfmove = 0;
  if (lower === 'p' && Math.abs(to - from) === 16) {
    next.enPassant = indexToSquare((from + to) / 2);
  }

  if (lower === 'k') {
    next.castling = next.castling.replace(pos.side === 'w' ? /[KQ]/g : /[kq]/g, '');
  }
  if (lower === 'r') {
    const r = CASTLE_RIGHT[from];
    if (r) next.castling = next.castling.replace(r, '');
  }
  if (target.toLowerCase() === 'r') {
    const r = CASTLE_RIGHT[to];
    if (r) next.castling = next.castling.replace(r, '');
  }

  next.castling = normalizeCastling(next.castling);
  return next;
}

function pseudoLegalMoves(pos) {
  const moves = [];
  const side = pos.side;
  const push = (m) => moves.push(m);

  for (let i = 0; i < 64; i++) {
    const piece = pos.board[i];
    if (piece === '.' || colorOf(piece) !== side) continue;
    const r = Math.floor(i / 8), c = i % 8;
    const lower = piece.toLowerCase();

    if (lower === 'p') {
      const dir = side === 'w' ? -1 : 1;
      const startRank = side === 'w' ? 6 : 1;
      const promoRank = side === 'w' ? 0 : 7;
      const oneR = r + dir;
      if (inBounds(oneR, c) && pos.board[oneR * 8 + c] === '.') {
        const to = oneR * 8 + c;
        if (oneR === promoRank) ['q', 'r', 'b', 'n'].forEach((p) => push({ from: indexToSquare(i), to: indexToSquare(to), promotion: p }));
        else push({ from: indexToSquare(i), to: indexToSquare(to) });
        const twoR = r + dir * 2;
        if (r === startRank && inBounds(twoR, c) && pos.board[twoR * 8 + c] === '.') push({ from: indexToSquare(i), to: indexToSquare(twoR * 8 + c) });
      }
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const to = nr * 8 + nc;
        const target = pos.board[to];
        const targetSq = indexToSquare(to);
        if (targetSq === pos.enPassant || (target !== '.' && colorOf(target) !== side)) {
          if (nr === promoRank) ['q', 'r', 'b', 'n'].forEach((p) => push({ from: indexToSquare(i), to: targetSq, promotion: p }));
          else push({ from: indexToSquare(i), to: targetSq });
        }
      }
      continue;
    }

    const addSlides = (dirs) => {
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc)) {
          const target = pos.board[nr * 8 + nc];
          if (target === '.') push({ from: indexToSquare(i), to: indexToSquare(nr * 8 + nc) });
          else {
            if (colorOf(target) !== side) push({ from: indexToSquare(i), to: indexToSquare(nr * 8 + nc) });
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
    };

    if (lower === 'n') {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const target = pos.board[nr * 8 + nc];
        if (target === '.' || colorOf(target) !== side) push({ from: indexToSquare(i), to: indexToSquare(nr * 8 + nc) });
      }
    } else if (lower === 'b') addSlides([[-1,-1],[-1,1],[1,-1],[1,1]]);
    else if (lower === 'r') addSlides([[-1,0],[1,0],[0,-1],[0,1]]);
    else if (lower === 'q') addSlides([[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
    else if (lower === 'k') {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const target = pos.board[nr * 8 + nc];
        if (target === '.' || colorOf(target) !== side) push({ from: indexToSquare(i), to: indexToSquare(nr * 8 + nc) });
      }
      if (canCastle(pos, side, 'king')) push({ from: indexToSquare(i), to: side === 'w' ? 'g1' : 'g8' });
      if (canCastle(pos, side, 'queen')) push({ from: indexToSquare(i), to: side === 'w' ? 'c1' : 'c8' });
    }
  }

  return moves;
}

function legalMoves(pos) {
  return pseudoLegalMoves(pos).filter((m) => !isKingInCheck(applyMove(pos, m), pos.side));
}

function moveToUci(move) {
  return `${move.from}${move.to}${move.promotion || ''}`;
}

function moveToReport(move) {
  const reported = { from: move.from, to: move.to };
  if (move.promotion) reported.promotion = move.promotion;
  return reported;
}

function moveMatches(a, b) {
  const ap = a.promotion || '';
  const bp = b.promotion || '';
  return a.from === b.from && a.to === b.to && ap === bp;
}

function promotionTie(move) {
  if (!move || !move.promotion) return 0;
  return move.promotion === 'q' ? 4 : move.promotion === 'r' ? 3 : move.promotion === 'b' ? 2 : 1;
}

function pstIndex(piece, idx) {
  return piece === piece.toUpperCase() ? idx : (idx ^ 56);
}

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const PST = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

function evaluate(pos) {
  let score = 0;
  let whiteBishops = 0, blackBishops = 0;
  const whitePawns = [0, 0, 0, 0, 0, 0, 0, 0];
  const blackPawns = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 64; i++) {
    const piece = pos.board[i];
    if (piece === '.') continue;
    const lower = piece.toLowerCase();
    const white = colorOf(piece) === 'w';
    const idx = pstIndex(piece, i);
    const value = PIECE_VALUES[lower] + PST[lower][idx];
    if (lower === 'p') {
      (white ? whitePawns : blackPawns)[i & 7]++;
    } else if (lower === 'b') {
      if (white) whiteBishops++;
      else blackBishops++;
    }
    score += white ? value : -value;
  }
  for (let file = 0; file < 8; file++) {
    if (whitePawns[file] > 1) score -= 12 * (whitePawns[file] - 1);
    if (blackPawns[file] > 1) score += 12 * (blackPawns[file] - 1);
    if (whitePawns[file] && !(file && whitePawns[file - 1]) && !(file < 7 && whitePawns[file + 1])) score -= 9 * whitePawns[file];
    if (blackPawns[file] && !(file && blackPawns[file - 1]) && !(file < 7 && blackPawns[file + 1])) score += 9 * blackPawns[file];
  }
  if (whiteBishops > 1) score += 28;
  if (blackBishops > 1) score -= 28;
  return score;
}

const MATE = 100000;
const MINMATE = MATE - 1000;
const ABORT = Symbol('abort');
const LOCAL_TIMING = { softMs: 60, hardMs: 400 };
const ARENA_BUFFER_MS = 1500;
const ARENA_FLOOR_MS = 200;

const TT_MAX = 50000;
const EXACT = 0;
const LOWER = 1;
const UPPER = 2;
const tt = new Map();
const history = Object.create(null);
let posStack = [];
let gameHistory = [];
let gameTurn = 0;

function posKey(pos) {
  let h = 2166136261;
  for (let i = 0; i < 64; i++) {
    h ^= pos.board[i].charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  h ^= pos.side.charCodeAt(0);
  h = Math.imul(h, 16777619);
  for (let i = 0; i < pos.castling.length; i++) {
    h ^= pos.castling.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = 0; i < pos.enPassant.length; i++) {
    h ^= pos.enPassant.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function ttProbe(key, depth, alpha, beta, ply) {
  const entry = tt.get(key);
  if (!entry || entry.depth < depth) return null;
  let score = entry.score;
  if (score > MINMATE) score -= ply;
  else if (score < -MINMATE) score += ply;
  if (entry.bound === EXACT) return { score, bestUci: entry.bestUci };
  if (entry.bound === LOWER && score >= beta) return { score, bestUci: entry.bestUci };
  if (entry.bound === UPPER && score <= alpha) return { score, bestUci: entry.bestUci };
  return { score: null, bestUci: entry.bestUci };
}

function ttStore(key, depth, score, bound, bestUci, ply) {
  const existing = tt.get(key);
  if (existing && existing.depth > depth) return;
  if (tt.size >= TT_MAX && !existing) {
    const first = tt.keys().next().value;
    tt.delete(first);
  }
  let stored = score;
  if (stored > MINMATE) stored += ply;
  else if (stored < -MINMATE) stored -= ply;
  tt.set(key, { depth, score: stored, bound, bestUci });
}

function historyScore(uci) {
  return history[uci] || 0;
}

function recordHistory(uci, depth) {
  history[uci] = Math.min(historyScore(uci) + depth * depth + depth, 8000);
}

function ageHistory() {
  for (const uci in history) {
    history[uci] >>= 1;
    if (!history[uci]) delete history[uci];
  }
}

function repeated(key, stack) {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i] === key) return true;
  }
  return false;
}

function orderMoves(pos, moves, killerUcis, ttBestUci) {
  const killers = killerUcis ? new Set(killerUcis) : null;
  const scored = moves.map((move) => {
    const uci = moveToUci(move);
    if (ttBestUci && uci === ttBestUci) return { move, uci, priority: 20000 };
    const toIdx = squareToIndex(move.to);
    const victim = pos.board[toIdx];
    const fromIdx = squareToIndex(move.from);
    const attacker = pos.board[fromIdx];
    const lower = attacker.toLowerCase();
    const isEP = lower === 'p' && move.to === pos.enPassant;
    const isCap = victim !== '.' || isEP;
    let priority = 0;
    if (isEP) {
      priority = 10000 + PIECE_VALUES.p;
    } else if (victim !== '.') {
      const victimVal = PIECE_VALUES[victim.toLowerCase()];
      const attackerVal = PIECE_VALUES[lower];
      const base = victimVal >= attackerVal ? 10000 : 3000;
      priority = base + victimVal - attackerVal / 100;
    }
    if (move.promotion) {
      priority += 9000 + PIECE_VALUES[move.promotion];
    }
    if (killers && killers.has(uci)) {
      priority += 5000;
    }
    if (!isCap && !move.promotion) {
      priority += historyScore(uci);
      priority += (PST[lower][pstIndex(attacker, toIdx)] - PST[lower][pstIndex(attacker, fromIdx)]) * 2;
      if (lower === 'k' && Math.abs(toIdx - fromIdx) === 2) priority += 120;
    }
    return { move, uci, priority };
  });
  scored.sort((a, b) => b.priority - a.priority || (a.uci < b.uci ? -1 : a.uci > b.uci ? 1 : 0));
  return scored;
}

function isQuiet(pos, move) {
  if (pos.board[squareToIndex(move.to)] !== '.') return false;
  if (move.promotion) return false;
  if (move.to === pos.enPassant && pos.board[squareToIndex(move.from)].toLowerCase() === 'p') return false;
  return true;
}

function recordKiller(killerTable, ply, uci) {
  if (!killerTable[ply]) killerTable[ply] = [null, null];
  if (killerTable[ply][0] !== uci) {
    killerTable[ply][1] = killerTable[ply][0];
    killerTable[ply][0] = uci;
  }
}

function quiescence(pos, alpha, beta, ply, deadline) {
  if (Date.now() >= deadline) return ABORT;
  const key = posKey(pos);
  if (repeated(key, posStack)) return -1;
  const standPat = evaluate(pos) * (pos.side === 'w' ? 1 : -1);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  const legal = legalMoves(pos);
  if (!legal.length) {
    return isKingInCheck(pos, pos.side) ? -(MATE - ply) : 0;
  }

  const captures = legal.filter((m) => {
    if (pos.board[squareToIndex(m.to)] !== '.') return true;
    if (m.to === pos.enPassant && pos.board[squareToIndex(m.from)].toLowerCase() === 'p') return true;
    return false;
  });

  posStack.push(key);
  const ordered = orderMoves(pos, captures, null, null);
  for (const { move } of ordered) {
    const raw = quiescence(applyMove(pos, move), -beta, -alpha, ply + 1, deadline);
    if (raw === ABORT) {
      posStack.pop();
      return ABORT;
    }
    const score = -raw;
    if (score >= beta) {
      posStack.pop();
      return beta;
    }
    if (score > alpha) alpha = score;
  }
  posStack.pop();
  return alpha;
}

function negamax(pos, depth, alpha, beta, ply, deadline, killerTable) {
  if (Date.now() >= deadline) return ABORT;
  const legal = legalMoves(pos);
  const inCheck = isKingInCheck(pos, pos.side);
  if (!legal.length) {
    return inCheck ? -(MATE - ply) : 0;
  }
  if (inCheck) depth += 1;
  if (depth <= 0) {
    return quiescence(pos, alpha, beta, ply, deadline);
  }

  const key = posKey(pos);

  if (ply > 0 && repeated(key, posStack)) return -1;

  let ttBestUci = null;
  const probe = ttProbe(key, depth, alpha, beta, ply);
  if (probe) {
    if (probe.score !== null) return probe.score;
    ttBestUci = probe.bestUci;
  }

  const ev = (!inCheck && depth <= 6) ? evaluate(pos) * (pos.side === 'w' ? 1 : -1) : null;
  if (ev !== null && beta < MINMATE && ev - 100 * depth >= beta) return ev;

  posStack.push(key);
  if (ev !== null && depth > 2 && beta < MINMATE && ev > beta && hasNonPawnMaterial(pos, pos.side)) {
    const nullPos = {
      board: pos.board,
      side: opposite(pos.side),
      castling: pos.castling,
      enPassant: '-',
      halfmove: pos.halfmove,
      fullmove: pos.fullmove,
    };
    const raw = negamax(nullPos, depth - 4, -beta, -beta + 1, ply + 1, deadline, killerTable);
    if (raw === ABORT) {
      posStack.pop();
      return ABORT;
    }
    let nullScore = -raw;
    if (nullScore >= beta) {
      if (nullScore > MINMATE) nullScore = beta;
      posStack.pop();
      return nullScore;
    }
  }

  const origAlpha = alpha;
  const killerUcis = killerTable[ply] || null;
  const ordered = orderMoves(pos, legal, killerUcis, ttBestUci);
  let bestUci = ordered[0].uci;
  for (let i = 0; i < ordered.length; i++) {
    const { move, uci } = ordered[i];
    const quiet = isQuiet(pos, move);
    if (i > 0 && ev !== null && alpha > -MINMATE && quiet) {
      if (depth <= 2 && i > 4 + depth * 4) continue;
      if (depth <= 4 && ev + 120 * depth < alpha) continue;
    }
    const child = applyMove(pos, move);
    const r = (quiet && i >= 4 && depth >= 3 && !inCheck) ? (depth >= 6 && i >= 8 ? 2 : 1) : 0;
    let raw = negamax(child, depth - 1 - r, -beta, -alpha, ply + 1, deadline, killerTable);
    if (raw === ABORT) {
      posStack.pop();
      return ABORT;
    }
    let score = -raw;
    if (r && score > alpha) {
      raw = negamax(child, depth - 1, -beta, -alpha, ply + 1, deadline, killerTable);
      if (raw === ABORT) {
        posStack.pop();
        return ABORT;
      }
      score = -raw;
    }
    if (score >= beta) {
      if (quiet) {
        recordKiller(killerTable, ply, uci);
        recordHistory(uci, depth);
      }
      ttStore(key, depth, beta, LOWER, uci, ply);
      posStack.pop();
      return beta;
    }
    if (score > alpha) {
      alpha = score;
      bestUci = uci;
    }
  }
  ttStore(key, depth, alpha, alpha > origAlpha ? EXACT : UPPER, bestUci, ply);
  posStack.pop();
  return alpha;
}

function searchDepth(pos, rootMoves, depth, deadline, killerTable, historyKeys) {
  let bestScore = -Infinity;
  let bestUci = '';
  let bestMove = null;
  let bestRepeat = true;
  posStack = historyKeys && historyKeys.length ? historyKeys.slice() : [posKey(pos)];
  for (const { move, uci } of rootMoves) {
    const next = applyMove(pos, move);
    const repeats = historyKeys ? repeated(posKey(next), historyKeys) : false;
    const raw = negamax(next, depth - 1, -Infinity, Infinity, 1, deadline, killerTable);
    if (raw === ABORT) {
      posStack = [];
      return null;
    }
    const score = -raw - (repeats ? 12 : 0);
    if (
      score > bestScore ||
      (score === bestScore && (
        (bestRepeat && !repeats) ||
        (bestRepeat === repeats && (
          promotionTie(move) > promotionTie(bestMove) ||
          (promotionTie(move) === promotionTie(bestMove) && uci < bestUci)
        ))
      ))
    ) {
      bestScore = score;
      bestUci = uci;
      bestMove = move;
      bestRepeat = repeats;
    }
  }
  posStack = [];
  return { move: bestMove, score: bestScore, uci: bestUci };
}

function bookKey(pos) {
  const placement = [];
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = pos.board[r * 8 + c];
      if (p === '.') { empty++; } else {
        if (empty) { placement.push(empty); empty = 0; }
        placement.push(p);
      }
    }
    if (empty) placement.push(empty);
    if (r < 7) placement.push('/');
  }
  return `${placement.join('')} ${pos.side} ${pos.castling} ${pos.enPassant}`;
}

const BOOK = new Map([
  ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -', 'd2d4'],
  ['rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq -', 'd7d5'],
  ['rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -', 'c2c4'],
  ['rnbqkb1r/pppp1ppp/4pn2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -', 'b1c3'],
  ['rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -', 'e7e5'],
  ['rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6', 'g1f3'],
  ['rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -', 'd2d4'],
  ['rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -', 'd2d4'],
  ['rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6', 'e4d5'],
  ['rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -', 'g1f3'],
  ['rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -', 'b8c6'],
  ['r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -', 'f1b5'],
  ['rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -', 'c2c4'],
  ['rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq -', 'e7e6'],
  ['rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -', 'b1c3'],
  ['rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -', 'b1c3'],
  ['rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq -', 'g8f6'],
  ['rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq -', 'e7e5'],
  ['rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq -', 'd7d5'],
  ['rnbqkbnr/ppp1pppp/8/3p4/2P5/5N2/PP1PPPPP/RNBQKB1R b KQkq c3', 'e7e6'],
  ['r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -', 'f8c5'],
  ['r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -', 'c2c3'],
  ['r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq -', 'g8f6'],
  ['r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -', 'a7a6'],
  ['r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq -', 'b5a4'],
  ['r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R b KQkq -', 'g8f6'],
]);

function pickMove(pos, timing = LOCAL_TIMING, historyKeys = null) {
  const legal = legalMoves(pos);
  if (!legal.length) return null;
  ageHistory();
  posStack = [posKey(pos)];

  const bk = bookKey(pos);
  const bookUci = BOOK.get(bk);
  if (bookUci) {
    const bookMove = legal.find((m) => moveToUci(m) === bookUci);
    if (bookMove) return bookMove;
  }

  const rootMoves = orderMoves(pos, legal, null, null);

  let bestMove = rootMoves[0].move;
  let pvUci = null;
  const killerTable = [];

  const start = Date.now();
  const hardMs = timing.hardMs;
  const softMs = timing.softMs;
  const deadline = start + hardMs;
  let lastIterMs = 0;

  for (let depth = 1; ; depth++) {
    const elapsed = Date.now() - start;
    if (elapsed >= deadline - start || elapsed >= softMs || (lastIterMs && elapsed + lastIterMs * 3 >= softMs)) break;
    if (pvUci) {
      const pvIdx = rootMoves.findIndex((m) => m.uci === pvUci);
      if (pvIdx > 0) {
        const pv = rootMoves.splice(pvIdx, 1)[0];
        rootMoves.unshift(pv);
      }
    }
    const iterStart = Date.now();
    const result = searchDepth(pos, rootMoves, depth, deadline, killerTable, historyKeys);
    if (!result) break;
    bestMove = result.move;
    pvUci = result.uci;
    lastIterMs = Date.now() - iterStart;
  }
  return bestMove;
}

function arenaTiming(timeRemaining, legalCount) {
  const raw = Number.isFinite(timeRemaining) ? timeRemaining : 20000;
  const available = raw > ARENA_BUFFER_MS ? raw - ARENA_BUFFER_MS : Math.floor(raw * 0.6);
  const hardCap = legalCount >= 28 ? 9000 : legalCount >= 20 ? 11000 : 12000;
  const hardMs = Math.max(ARENA_FLOOR_MS, Math.min(hardCap, available));
  let softRatio = 0.48;
  if (legalCount <= 4) softRatio = 0.32;
  else if (legalCount <= 10) softRatio = 0.4;
  else if (legalCount >= 28) softRatio = 0.62;
  else if (legalCount >= 20) softRatio = 0.56;
  const softMs = Math.max(ARENA_FLOOR_MS, Math.min(hardMs - 75, Math.floor(hardMs * softRatio)));
  return { softMs, hardMs };
}

function liveMoves(board) {
  if (!board || typeof board.moves !== 'function') return [];
  try {
    const verbose = board.moves({ verbose: true });
    if (Array.isArray(verbose) && verbose.length) return verbose;
  } catch {}
  try {
    const moves = board.moves();
    return Array.isArray(moves) ? moves : [];
  } catch {
    return [];
  }
}

function toFallbackReport(move) {
  if (!move) return null;
  if (typeof move === 'string') return move;
  if (move && typeof move === 'object' && move.from && move.to) return moveToReport(move);
  return null;
}

function findLiveMove(moves, move) {
  return moves.find((candidate) => candidate && typeof candidate === 'object' && candidate.from && candidate.to && moveMatches(candidate, move)) || null;
}

function rememberPosition(pos) {
  const turn = pos.fullmove * 2 + (pos.side === 'b');
  if (turn <= gameTurn || (pos.fullmove === 1 && pos.side === 'w')) gameHistory = [];
  gameTurn = turn;
  const key = posKey(pos);
  if (gameHistory[gameHistory.length - 1] !== key) gameHistory.push(key);
  return gameHistory;
}

function playFen(fen, timing = LOCAL_TIMING) {
  const pos = parseFen(fen);
  const move = pickMove(pos, timing);
  return move ? moveToUci(move) : '0000';
}

function makeMove(board, timeRemaining, reportMove) {
  const moves = liveMoves(board);
  if (!moves.length || typeof reportMove !== 'function') return;

  const fallback = toFallbackReport(moves[0]);
  if (fallback) reportMove(fallback);

  const fen = board && typeof board.fen === 'function' ? board.fen() : '';
  if (!fen) return;

  const pos = parseFen(fen);
  const best = pickMove(pos, arenaTiming(timeRemaining, moves.length), rememberPosition(pos));
  if (!best) return;

  const matched = findLiveMove(moves, best);
  if (matched && !moveMatches(matched, moves[0])) {
    reportMove(moveToReport(matched));
  }
}

// Local Node-only harness for fast smoke tests. The uploaded platform code uses
// makeMove(board, timeRemaining, reportMove) instead of stdin/stdout.
if (typeof process !== 'undefined' && process.stdin && process.stdout) {
  let fen = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    fen += chunk;
  });
  process.stdin.on('end', () => {
    process.stdout.write(`${playFen(fen.trim())}\n`);
  });
  process.stdin.resume();
}
