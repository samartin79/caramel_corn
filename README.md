# Vibe Cup v1 — Base Challenge

This is the challenger-facing repository for the Vibe Cup chess competition.

## Getting started

Start by **forking this repository** into your own GitHub account. Build your agent in your fork, keep your final submission files at the repository root, and submit the forked repository when entries are collected.

## Challenge

You are building a chess agent that plays full standard chess games against other submissions in a round robin tournament.

### Input
Your program receives a single chess position in [**FEN**](https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation) on stdin.

Example FEN:

```text
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
```

FEN fields:
1. Piece placement
2. Side to move (`w` or `b`)
3. Castling availability
4. En passant target square or `-`
5. Halfmove clock
6. Fullmove number

### Output
Your program must print **one UCI move** on stdout, for example:

```text
e2e4
```

Other valid examples:
- `g1f3`
- `e7e8q` for promotion to queen
- `e1g1` for king-side castling

Only one move should be printed per turn.

## Submission structure

Your submission repo must contain **exactly one runnable source file** at the root:

```text
agent.js
```

or

```text
agent.ts
```

No extra source tree is required. A root-level `submission-report.md` is also required for transparency, but it is treated as documentation rather than source code.


## Required submission documentation

Each submission must also include a small root-level markdown file:

```text
submission-report.md
```

This file must include, at minimum:
1. **All prompts given** during development of the submission
2. **All tools used** during development of the submission

Recommended structure:
- model(s) / system(s) used
- short strategy summary
- chronological prompt log
- tool list with short description of how each tool was used
- one-line Yes/No rules compliance checklist

This file is required for review transparency, but it does **not** count as a second source file. The single-source-file rule still applies to executable code only.

## Runtime contract

Submissions are executed with one of:

```bash
node agent.js < input.fen
```

or

```bash
node agent.ts < input.fen
```

Assume a pinned Node.js runtime supplied by the organizer. Do not assume `tsx`, `ts-node`, a TypeScript build step, `npm install`, or any network/package download step is available during judging.

## Hard submission constraints

These are part of the competition rules, not just recommendations:

- **Single source file only:** exactly one of `agent.js` or `agent.ts` at repository root
- **No external runtime dependencies:** Node.js standard library only
- **Max source file size:** `1 MB`
- **No network access**
- **No reading files outside the submission root**
- **No background daemons, subprocesses, worker pools, or child processes**
- **No self-modifying code or runtime downloads**
- **Determinism required:** identical FEN input must produce identical stdout output
- **Memory cap:** target submissions must fit within a `256 MB` memory limit
- **Think time per move:** target `250 ms`
- **Hard per-move timeout:** `1000 ms`; exceeding it loses that move
- **Total compute budget per submission per game:** `30 s`; exceeding it forfeits the current game

## Game rules

Standard chess rules apply.

Edge cases:
- **Illegal move:** immediate loss
- **Timeout:** immediate loss
- **Crash / invalid output / malformed UCI:** immediate loss
- **Checkmate:** normal win/loss
- **Stalemate:** draw
- **Threefold repetition:** draw
- **50-move rule:** draw
- **Insufficient material:** draw

## Judging and tournament format

The organizer runs submissions in a deterministic head-to-head simulator.

- Each unique pair of agents plays **5 round-robin games**.
- Colors alternate between games in the pair.
- Because 5 is odd, the first agent in the organizer's sorted entrant list receives the extra white game for that pair.
- Every move is logged with the FEN before the move, FEN after the move, UCI move, side to move, runtime, and raw stdout for replay/verification.
- The top 4 agents after the round robin advance to the knockout bracket.
- Bracket games are played as normal games; if a bracket game is drawn, the higher-ranked agent by the tiebreak ladder advances.

### Scoring

- Win: `1` point
- Draw: `0.5` points
- Loss: `0` points

### Tiebreak ladder

If agents are tied in the standings, ranking is resolved in this order:

1. Total score
2. Head-to-head score between the tied agents
3. Total wins
4. Sonneborn-Berger score / strength of defeated and drawn opponents
5. Fewest losses
6. Shortest average win length, measured in plies
7. Deterministic label/order fallback if all previous metrics remain tied

This avoids endlessly replaying deterministic bots that may produce the same drawn game repeatedly.

## Fairness note

Can someone embed the whole chess decision tree?

No — not for real full chess. The full game tree is far too large, and every submission must still fit within the source file size, runtime, memory, dependency, and determinism constraints above.

## Sample agent

This repo includes a sample JavaScript agent, `agent.js`, that:
1. parses the FEN position
2. generates legal moves
3. picks one move deterministically
4. prints exactly one UCI move

That is the starting point challengers will fork and improve.

## Expected repo layout

```text
agent.js or agent.ts
submission-report.md
README.md
```

No extra source files should be required by the judge. `submission-report.md` is mandatory documentation.
