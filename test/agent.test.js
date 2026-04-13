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

function createBoard(fen, legal) {
  const verboseMoves = legal.map(uciToMove);
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

for (const testCase of cases) {
  const move = runAgent(testCase.fen);
  if (testCase.legal.length === 0) {
    assert.equal(move, '0000', `${testCase.name}: expected 0000 when no legal moves exist`);
  } else {
    assert.ok(testCase.legal.includes(move), `${testCase.name}: illegal move ${move}`);
  }
}

assert.equal(runAgent(cases[0].fen), runAgent(cases[0].fen), 'Agent must be deterministic for the same FEN');

const makeMove = loadMakeMove();

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

console.log('agent smoke tests ok');
