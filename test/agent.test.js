import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const entryFiles = ['agent.js', 'agent.ts'].filter((file) => existsSync(join(root, file)));

assert.equal(entryFiles.length, 1, 'Expected exactly one root entry file: agent.js or agent.ts');

const agentPath = join(root, entryFiles[0]);
const UCI_OR_NO_MOVE = /^(?:[a-h][1-8][a-h][1-8][qrbn]?|0000)$/;

const cases = [
  {
    name: 'opening move for white',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    legal: ['a2a3','a2a4','b1a3','b1c3','b2b3','b2b4','c2c3','c2c4','d2d3','d2d4','e2e3','e2e4','f2f3','f2f4','g1f3','g1h3','g2g3','g2g4','h2h3','h2h4'],
  },
  {
    name: 'opening reply for black',
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    legal: ['a7a5','a7a6','b7b5','b7b6','b8a6','b8c6','c7c5','c7c6','d7d5','d7d6','e7e5','e7e6','f7f5','f7f6','g7g5','g7g6','g8f6','g8h6','h7h5','h7h6'],
  },
  {
    name: 'forced check evasion',
    fen: '4k3/8/8/8/8/8/4q3/4K3 w - - 0 1',
    legal: ['e1e2'],
  },
  {
    name: 'pinned rook cannot expose king',
    fen: '4k3/8/8/8/8/8/4r3/4K2R w - - 0 1',
    legal: ['e1d1','e1e2','e1f1'],
  },
  {
    name: 'castling position',
    fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
    legal: ['a1a2','a1a3','a1a4','a1a5','a1a6','a1a7','a1a8','a1b1','a1c1','a1d1','e1c1','e1d1','e1d2','e1e2','e1f1','e1f2','e1g1','h1f1','h1g1','h1h2','h1h3','h1h4','h1h5','h1h6','h1h7','h1h8'],
  },
  {
    name: 'promotion must include a legal promotion piece',
    fen: '4k3/6P1/8/8/8/8/8/4K3 w - - 0 1',
    legal: ['e1d1','e1d2','e1e2','e1f1','e1f2','g7g8b','g7g8n','g7g8q','g7g8r'],
  },
  {
    name: 'en passant target is legal',
    fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
    legal: ['e1d1','e1d2','e1e2','e1f1','e1f2','e5d6','e5e6'],
  },
  {
    name: 'no legal moves prints 0000 placeholder',
    fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
    legal: [],
  },
];

const exactCases = [
  {
    name: 'prefer queen promotion in winning capture sequence',
    fen: '1rbqkbnr/pPpppppp/8/8/8/8/PPP1PPPP/RNBQKBNR w KQk - 1 5',
    expected: 'b7c8q',
  },
];

const repetitionFrames = [
  '1k1r1b1r/1pp1pppp/p1nqbn2/3p4/3P4/P1NQBN2/1PP1PPPP/1K1R1B1R w - - 0 9',
  '1k1r1b1r/1pp1pppp/p1nqbn2/3p4/3P4/P1NQBN2/1PP1PPPP/1K2RB1R b - - 1 9',
  '1k2rb1r/1pp1pppp/p1nqbn2/3p4/3P4/P1NQBN2/1PP1PPPP/1K2RB1R w - - 2 10',
  '1k2rb1r/1pp1pppp/p1nqbn2/3p4/3P4/P1NQBN2/1PP1PPPP/1K1R1B1R b - - 3 10',
  '1k1r1b1r/1pp1pppp/p1nqbn2/3p4/3P4/P1NQBN2/1PP1PPPP/1K1R1B1R w - - 4 11',
];

function runAgent(fen) {
  const raw = execFileSync('node', [agentPath], {
    input: `${fen}\n`,
    encoding: 'utf8',
    timeout: 1000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const output = String(raw).trim();
  assert.match(output, UCI_OR_NO_MOVE, `Agent printed malformed output: ${JSON.stringify(raw)}`);
  return output;
}

function loadMakeMove() {
  const source = readFileSync(agentPath, 'utf8');
  const sandbox = {
    console: { log() {}, error() {}, warn() {} },
    Date,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: agentPath });
  assert.equal(typeof sandbox.makeMove, 'function', 'Expected global makeMove function');
  return sandbox.makeMove;
}

function loadWorkerMakeMove() {
  const source = readFileSync(agentPath, 'utf8');
  const sandbox = {
    console: { log() {}, error() {}, warn() {} },
    Date,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const body = `"use strict";\n${source}\nif (typeof makeMove !== 'function') throw new Error('makeMove function not found');\nreturn makeMove(board, timeRemaining, reportMove, getMemory, stockfishMove);`;
  sandbox.workerRunner = vm.runInContext(
    `new Function('board', 'timeRemaining', 'reportMove', 'getMemory', 'stockfishMove', ${JSON.stringify(body)})`,
    sandbox,
    { filename: agentPath },
  );
  return (board, timeRemaining, reportMove) => sandbox.workerRunner(
    board,
    timeRemaining,
    reportMove,
    () => ({ heapUsed: 0, heapTotal: 0 }),
    undefined,
  );
}

function loadLegalMoveHelper() {
  const source = readFileSync(agentPath, 'utf8');
  const sandbox = {
    console: { log() {}, error() {}, warn() {} },
    Date,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: agentPath });
  return (fen) => sandbox.legalMoves(sandbox.parseFen(fen)).map(sandbox.moveToUci);
}

function uciToMove(uci) {
  const move = {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
  };
  if (uci.length > 4) move.promotion = uci[4];
  return move;
}

function moveToUci(move) {
  if (typeof move === 'string') return move;
  return `${move.from}${move.to}${move.promotion || ''}`;
}

const legalMovesForFen = loadLegalMoveHelper();

function createBoard(fen, legal) {
  const verboseMoves = (legal || legalMovesForFen(fen)).map(uciToMove);
  return {
    moves() {
      return verboseMoves;
    },
    fen() {
      return fen;
    },
    turn() {
      return fen.trim().split(/\s+/)[1] || 'w';
    },
    in_check() {
      return false;
    },
    pgn() {
      return '';
    },
  };
}

function runArenaAgent(makeMove, testCase) {
  const reported = [];
  makeMove(createBoard(testCase.fen, testCase.legal), 500, (move) => {
    reported.push(move);
  });
  return reported.map(moveToUci);
}

function runArenaSequence(makeMove, fens) {
  return fens.map((fen) => {
    const reported = [];
    makeMove(createBoard(fen), 500, (move) => {
      reported.push(move);
    });
    return reported.at(-1) ? moveToUci(reported.at(-1)) : null;
  });
}

for (const testCase of cases) {
  const move = runAgent(testCase.fen);
  if (testCase.legal.length === 0) {
    assert.equal(move, '0000', `${testCase.name}: expected 0000 when no legal moves exist`);
  } else {
    assert.ok(testCase.legal.includes(move), `${testCase.name}: illegal move ${move}`);
  }
}

assert.equal(runAgent(cases[0].fen), runAgent(cases[0].fen), 'Agent must be deterministic for the same FEN');

for (const testCase of exactCases) {
  assert.equal(runAgent(testCase.fen), testCase.expected, `${testCase.name}: expected exact move ${testCase.expected}`);
}

const makeMove = loadMakeMove();
const workerMakeMove = loadWorkerMakeMove();

for (const testCase of cases) {
  const reported = runArenaAgent(makeMove, testCase);
  if (testCase.legal.length === 0) {
    assert.equal(reported.length, 0, `${testCase.name}: expected no reported moves when no legal moves exist`);
  } else {
    assert.ok(reported.length >= 1, `${testCase.name}: expected makeMove to report a fallback move`);
    assert.ok(testCase.legal.includes(reported[0]), `${testCase.name}: illegal fallback move ${reported[0]}`);
    assert.ok(testCase.legal.includes(reported.at(-1)), `${testCase.name}: illegal final move ${reported.at(-1)}`);
  }
}

assert.deepEqual(
  runArenaAgent(makeMove, cases[0]),
  runArenaAgent(makeMove, cases[0]),
  'makeMove path must be deterministic for the same FEN',
);

for (const testCase of exactCases) {
  const reported = runArenaAgent(makeMove, testCase);
  assert.equal(reported.at(-1), testCase.expected, `${testCase.name}: expected exact makeMove result ${testCase.expected}`);
}

for (const testCase of cases) {
  const reported = runArenaAgent(workerMakeMove, testCase);
  if (testCase.legal.length === 0) {
    assert.equal(reported.length, 0, `${testCase.name}: expected no worker-reported moves when no legal moves exist`);
  } else {
    assert.ok(reported.length >= 1, `${testCase.name}: expected strict worker path to report a fallback move`);
    assert.ok(testCase.legal.includes(reported[0]), `${testCase.name}: illegal worker fallback move ${reported[0]}`);
    assert.ok(testCase.legal.includes(reported.at(-1)), `${testCase.name}: illegal worker final move ${reported.at(-1)}`);
  }
}

assert.deepEqual(
  runArenaAgent(workerMakeMove, cases[0]),
  runArenaAgent(workerMakeMove, cases[0]),
  'strict worker path must be deterministic for the same FEN',
);

for (const testCase of exactCases) {
  const reported = runArenaAgent(workerMakeMove, testCase);
  assert.equal(reported.at(-1), testCase.expected, `${testCase.name}: expected exact worker result ${testCase.expected}`);
}

const repetitionMakeMove = loadMakeMove();
const repetitionWorkerMakeMove = loadWorkerMakeMove();

assert.notEqual(
  runArenaSequence(repetitionMakeMove, repetitionFrames).at(-1),
  'd1e1',
  'makeMove path should avoid walking back into a recorded repetition loop',
);

assert.notEqual(
  runArenaSequence(repetitionWorkerMakeMove, repetitionFrames).at(-1),
  'd1e1',
  'strict worker path should avoid walking back into a recorded repetition loop',
);

console.log('agent smoke tests ok');
