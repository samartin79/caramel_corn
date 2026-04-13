# Caramel Corn Harvest Log

Live tracking doc for porting Lozza ideas into caramel_corn. Updated as work lands.

## Sources

- **Lozza reference fork**: `/mnt/llmstore/comp/the_carpenter` (read-only, no adaptation work happens there)
- **Baseline**: chess-challenge1 commit `638019c` — the build that passed live ChessArena validation against Amok on 2026-04-12
- **Live cap**: 30,720 bytes per ChessArena bot-specs.json

## Open question (not blocking caramel_corn work)

`chess-challenge1/main` has drifted past the validated build with the promotion fix `0761757` on top. To preserve the validated artifact, recommend tagging `638019c` as `validated-2026-04-12`. Awaiting decision.

## Harvest plan (ranked)

Ranking by ELO-per-byte at our current strength level. Order in this list is the recommended ship order.

| # | Item | Type | Bytes | Status | Lozza source |
|---|------|------|-------|--------|--------------|
| 1 | Mate-score TT ply shift | correctness | ~50 | pending | src/tt.js:55-59,107-111 |
| 6 | Staged good/even/bad captures | ordering | ~200 | SHIPPED dc83eab | src/iterate.js:205-263 |
| 7 | Check extensions | strength | ~30 | pending | src/search.js:70-72,372-374 |
| 8 | Reverse futility | pruning | ~50 | pending | src/search.js:252-253 |
| 9 | Futility (frontier) | pruning | ~40 | pending | src/search.js:342-343 |
| 10 | Late-move pruning | pruning | ~40 | pending | src/search.js:339-340 |
| 3 | History heuristic | strength | ~200 | SHIPPED 4faa70c | src/history.js |
| 4 | Null-move pruning | strength | ~200 | pending | src/search.js:270-304 |
| 5 | LMR | strength | ~150 | pending | src/search.js:74-77,376-378 |
| 11 | Mate-distance pruning | pruning | ~80 | pending | src/search.js:183-197 |
| 12 | IIR | pruning | ~30 | pending | src/search.js:311,324-328 |
| 13 | Delta pruning (qsearch) | pruning | ~40 | pending | src/qsearch.js:45 |
| 14 | quickSee (qsearch) | pruning | ~150 | pending | src/see.js |
| 2 | Repetition detection | correctness | ~200 | pending | src/search.js:201-202 |

## Skipped / deferred

- **Aspiration windows** — not in Lozza, fiddly re-search logic, low ROI at our time controls
- **Bitboards / 0x88 representation** — would be a rewrite, not a harvest
- **NNUE / weights.js** — 526 KB of weights, no path to fit
- **Counter-move history / continuation history** — high bytes for modest extra gain over plain history
- **Grandparent killers** — modest gain, defer until plain history matures
- **"Improving" heuristic** — adds complexity proportional to gain; defer until NMP/LMR are in

## Shipped commits (newest first)

### dc83eab — feat: stage capture priority by victim-attacker value
- **Date**: 2026-04-12
- **Bytes**: agent.js +208 (27,097 → 27,305). Headroom 3,415 bytes.
- **Tests**: npm test green
- **What**:
  - Captures with `victim < attacker` now score in the 3000 band instead of 10000+. They land below killers (5000+) and history-strong quiets in ordering.
  - Quiet-move bonus block (history + PST + castling) now uses an explicit `!isCap && !move.promotion` guard instead of the `priority < 10000` proxy. Keeps bad captures from picking up quiet-move bonuses.
  - En passant kept as a "good capture" (10100, pawn-takes-pawn equivalent).
- **Why**: previously a queen-takes-defended-pawn (~10091) outranked a killer quiet (~5500). Wrong: known-bad captures should be searched after confirmed-good quiets.
- **Risk**: pure ordering change. No effect on which moves get searched, only the order. Determinism preserved.
- **Timing**: 45-Kiwipete now consumes ~5.6s of soft budget (up from 3.8s) — likely searching deeper or exploring more nodes per ply, but well inside the 9s hard cap.

### 4faa70c — feat: add quiet-move history heuristic
- **Date**: 2026-04-12
- **Bytes**: agent.js +449 (26,648 → 27,097)
- **Tests**: npm test green
- **What**: `Object.create(null)` table keyed by UCI string. `recordHistory(uci, depth)` adds `depth²+depth` capped at 8000 on quiet beta cutoffs. `ageHistory()` halves all entries once per `pickMove`. Used in ordering only when move is quiet (`priority < 10000`).
- **Notes**: No negative update on failed quiets — Lozza does, we rely on aging. Hot-path string lookup cost is non-zero but acceptable for first iteration.

### 0761757 — fix: prefer queen promotions on tied scores
- **Date**: 2026-04-12
- **Bytes**: agent.js +316
- **Tests**: npm test green; new `exactCases` array asserts `b7c8q` through stdin/makeMove/strict-worker paths
- **What**: New `promotionTie(move)` returns 4/3/2/1 for q/r/b/n. Used as second-key tie-break in `searchDepth`'s root selection. Internal nodes still use UCI lex (correct — they return values, not move choices).
- **Why**: The bxc8=B underpromotion observed in the live validation game (Move 5 vs Amok) — same-eval promotion candidates were being broken by alphabetical UCI lex ordering, picking 'b' over 'q'.

### Inherited from chess-challenge1 baseline
- Alpha-beta negamax, iterative deepening with soft/hard budget + predictive stop
- 2-slot killers per ply, MVV-LVA captures
- TT (50K Map, depth-preferred, EXACT/LOWER/UPPER bounds, TT-move threaded through ordering)
- PST delta on quiets, castling bonus
- PV-first root reorder
- Capture-only quiescence with stand-pat
- ~25-entry opening book
- Bishop pair, doubled/isolated pawn eval terms

## In progress

(none)

## Recent timing baseline (caramel_corn HEAD on local box)

Probe positions, three-run median, `timeRemaining=20000`:

| Position | History only (4faa70c) | + Staged captures |
|----------|------------------------|-------------------|
| 45-move Kiwipete | ~3.8s | ~5.6s |
| 41-move Italian middlegame | ~3.9s | ~3.8s |
| 21-move K+R vs K endgame | ~3.0s | ~3.7s |

All inside hard caps (9s for ≥28 legal, 11s for ≥20 legal, 12s otherwise). Kiwipete now consumes nearly the full soft budget (5.58s). Without node-count instrumentation, can't distinguish "deeper search" from "same depth, more nodes per ply" — but no budget violation and no regression in legality or determinism.
