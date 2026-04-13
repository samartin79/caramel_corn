# ChessArena Competition Plan

Fetched and locked on 2026-04-12 from the live ChessArena site and worker code.

## Research

### Verified sources

- AI guide: https://chessarena.dev/ai-instructions-v2.html
- Docs: https://chessarena.dev/docs
- Register page: https://chessarena.dev/register
- Bot specs: https://chessarena.dev/bot-specs.json
- Home page: https://chessarena.dev/
- Validation worker runtime: https://chessarena.dev/js/browser-bot-worker.js

### Competition format

- Platform is JavaScript-only and runs bots in a sandboxed server environment.
- Matchmaking is ELO-based "soft meritocracy" rather than a fixed round robin.
- Automated matchmaking is documented as running every 10 minutes.
- Results, leaderboard stats, and match replays are public.
- Draws have a platform tiebreaker where shorter code wins.

### Submission mechanics

- Registration requires `botName`, `authorName`, and raw JavaScript bot code.
- Code size must stay between 50 and 30,720 bytes.
- Registration page requires local validation before submit.
- Update flow requires saving the returned update token. Losing it means re-registering a new bot.
- Validation currently accepts a draw or win against a site-provided percentile bot.

### Runtime and repo constraints

- Bot entrypoint must define a global `makeMove(...)` in plain JavaScript.
- Human docs and specs say `makeMove(board, timeRemaining, reportMove)`.
- The live validation worker actually calls `makeMove(board, timeRemaining, reportMove, getMemory, stockfishMove)` via `new Function(..., "use strict"; ...)`.
- Main board is read-only. `board.moves()` is backed by verbose move objects in the validation worker.
- `reportMove()` accepts SAN strings or move objects. Verbose move objects are normalized to `.san` before execution. Plain UCI strings are not a safe assumption.
- The last reported move before timeout is used.
- Timeout in the validation worker is 20,000 ms.
- No imports, exports, module syntax, or dependency installs should be relied on.
- Forbidden APIs are listed in `bot-specs.json` and include network, eval-family APIs, workers, storage APIs, and prototype modification.

### Judging and failure conditions

- Illegal move loses.
- No move reported before timeout loses.
- Crashes and strict-mode syntax errors fail validation and likely lose live matches.
- Draws count as draws, but shorter code is favored on the platform tiebreak.

### Day-of failure risks

- Spec drift:
  - Home page says validation is against a 50th-percentile bot.
  - Register page and worker logs say 80th percentile.
  - Docs/specs say 3-arg `makeMove`.
  - AI guide and worker invocation pass extra args.
  - AI guide says `timeRemaining` starts at 25,000 ms, while docs and worker timeout are 20,000 ms.
- Old local repo baseline is stdin/FEN driven and ends in top-level async I/O, which is not upload-safe for browser `new Function`.
- Old agent outputs UCI. ChessArena validation uses SAN or move objects with `game.move(...)`, so direct UCI reporting is risky.
- Current `agent.js` is already near the 30 KB cap. Growth must be tightly controlled.
- Validation worker runs in strict mode, so reserved-word and syntax slips fail hard.
- The AI guide exposes `stockfishMove` and `getMemory`, but those are not promised by the public specs. Treat them as non-contract features.

## Prompt Lock

### Requirements

- Keep the bot as one plain JavaScript file.
- Define a global `makeMove(board, timeRemaining, reportMove)` that still tolerates extra args.
- Call `reportMove()` immediately with a legal fallback before deeper search.
- Report a legal SAN or move object, not raw UCI.
- Reuse the current deterministic single-file engine core where it helps, but remove browser-unsafe stdin-only assumptions.
- Preserve a guarded Node stdin wrapper only for local smoke tests.
- Stay under 30,720 bytes with margin.

### Prompt nouns

- board
- verbose move object
- reportMove
- SAN
- FEN
- custom position
- opening book
- alpha-beta
- size budget
- validation worker

### Prompt verbs

- parse
- search
- order
- map
- report
- validate
- harden
- trim

### Negative brief

- No imports or exports.
- No external packages.
- No dependency on `stockfishMove`, `getMemory`, or undocumented helper APIs.
- No raw UCI-only reporting path.
- No top-level await.
- No console logging.
- No broad rewrite of the search core unless the adapter path fails.

### One differentiator

- Use a custom FEN-based deterministic engine core behind a thin ChessArena adapter so search does not depend on repeated board cloning or undocumented board internals.

### One cut order

1. Cut extra opening-book breadth before touching legality or adapter code.
2. Cut quiescence depth before cutting immediate fallback reporting.
3. Cut TT size or tuning before cutting move mapping correctness.
4. Cut optional draw-avoidance heuristics before cutting test coverage.

### Chosen lane

- Thin adapter lane: keep the current single-file chess engine, adapt only the runtime boundary and timing policy for ChessArena.

### Reskin pass

- Replace old Vibe Cup phrasing with ChessArena naming.
- Keep docs and reporting files arena-specific.
- Keep the repo ready for browser upload plus local Node smoke tests.

## Sequenced Runbook

1. Lock the live contract in code comments and docs.
2. Replace the stdin-only entrypoint with a browser-safe global `makeMove`.
3. Immediately report a legal fallback move object from `board.moves()`.
4. Parse `board.fen()` into the existing internal position model.
5. Search with the current engine core and map the chosen internal move back onto a live verbose move object.
6. Keep a guarded Node stdin wrapper for fast local legality smoke tests.
7. Update tests so they verify both the stdin path and the ChessArena-style `makeMove` path.
8. Re-budget timing for a 20-second platform limit with a hard safety buffer.
9. Check file size after edits and trim if needed.
10. Run local smoke tests.
11. Before live submission, run the site validation flow manually and save the update token.

## Build notes

- Prefer move objects over SAN when reporting the searched move because move-object mapping avoids SAN disambiguation bugs.
- Use SAN only as a last-resort fallback if object mapping fails.
- Do not depend on nested clone chains; the site worker comments that clones cannot be cloned.
- Do not assume `board.in_draw()` or repetition helpers are authoritative on the main board in validation mode.
