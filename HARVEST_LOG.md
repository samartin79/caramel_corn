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
| 1 | Mate-score TT ply shift | correctness | ~225 | SHIPPED b6581ec | src/tt.js:55-59,107-111 |
| 6 | Staged good/even/bad captures | ordering | ~200 | SHIPPED dc83eab | src/iterate.js:205-263 |
| 7 | Check extensions | strength | bundled | SHIPPED 34bc5f4 | src/search.js:70-72,372-374 |
| 8 | Reverse futility | pruning | bundled | SHIPPED 34bc5f4 | src/search.js:252-253 |
| 9 | Futility (frontier) | pruning | bundled | SHIPPED 34bc5f4 | src/search.js:342-343 |
| 10 | Late-move pruning | pruning | bundled | SHIPPED 34bc5f4 | src/search.js:339-340 |
| 3 | History heuristic | strength | ~200 | SHIPPED 4faa70c | src/history.js |
| 4 | Null-move pruning | strength | ~835 | SHIPPED 16506b9 | src/search.js:270-304 |
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

### 16506b9 — feat: add null-move pruning

Harvest item #4. First search-shape change since the predictive-stop retune in `c40c724`.

- **Date**: 2026-04-13
- **Bytes**: agent.js +835 (27,971 → 28,806). Headroom 1,914 bytes. Bigger than the ~200 byte estimate — the nullPos object literal and the `hasNonPawnMaterial` helper account for most of it.
- **Tests**: npm test green
- **Tactical sanity**: mate-in-1 Qg7# (967ms) and free-queen Nxb7 (1241ms) both correctly found.

#### What landed

**Helper**: `hasNonPawnMaterial(pos, side)` scans the board for any of the side's non-king non-pawn pieces. Used to guard against zugzwang in pawn endgames where passing turn would actually be losing.

**NMP block** in `negamax`, between RFP and the move loop:
```
if (ev !== null && depth > 2 && beta < MINMATE && ev > beta && hasNonPawnMaterial(pos, pos.side)) {
  // null-move position: same board, opposite side, ep cleared
  // search at depth - 4 (R = 3) with null window (-beta, -beta+1)
  // if score >= beta, return it (clamped to beta if > MINMATE)
}
```

#### Gates (matches the agreed sketch)

- `!inCheck` — implicit via `ev !== null` (ev is computed only when not in check)
- `depth > 2` — NMP at depth 1-2 is rarely useful
- `ev !== null` — needs static eval to gate on "already winning"
- `beta < MINMATE` — don't NMP in mate-bound regions (paired with the b6581ec mate-shift fix)
- `ev > beta` — only NMP when static eval says we're already at/above the cutoff threshold
- `hasNonPawnMaterial(pos, pos.side)` — zugzwang guard

#### Key design choices

- **R = 3** as agreed.
- **enPassant cleared** in null pos — the side that "passes" can't be subject to en passant from the previous move.
- **board reference shared, not cloned** — negamax never mutates `pos.board`; all mutations happen in `applyMove`'s constructed `next` object. Sharing is safe and saves 64-element copy.
- **Mate clamp on fail-high**: if the null-move search returns a score above MINMATE, we treat it as exactly `beta` instead of returning the inflated mate score. Standard precaution — null moves can produce fake mate threats if the opponent's "next" move is mate-in-1 from a position the opponent shouldn't have reached.
- **No mate clamp on fail-low**: if the null-move search returns a very negative score (we're getting mated after passing), we just don't NMP-cutoff. Normal search resumes. Standard.
- **Effective depth range**: NMP currently fires at depth 3-6 because `ev` is gated by `depth <= 6`. Lifting that gate would extend NMP coverage to deeper depths but adds eval cost. Deferred — tracked as a follow-up.

#### Risk notes

- **Successive null moves**: this implementation doesn't track "previous move was null" to prevent re-NMP at the child. Lozza doesn't either. Depth reduction (R=3) prevents infinite recursion. Compounded NMP can occasionally miss tactics; standard implementations vary on whether to guard.
- **Endgame zugzwang beyond K+P**: the material guard catches K+pawns. K+B+P vs K+P or K+N+P vs K+P endgames where a piece move is forced by zugzwang are still at risk. Rare in practice; standard practice accepts the risk.
- **Object-literal cost**: the nullPos `{ board, side, castling, enPassant, halfmove, fullmove }` allocates a new object per NMP firing. Could be reduced via spread (`{ ...pos, side: ..., enPassant: '-' }`) — fewer bytes, same allocation count. Deferred.

#### Timing baseline (3-run median, all stable)

| Position | Pre-NMP | Post-NMP | Soft cap | Hard cap |
|----------|--------:|---------:|---------:|---------:|
| 45-Kiwipete | 5.6s | 5.6s | 5.58s | 9.0s |
| 41 Italian middlegame | 2.24s | 2.24s | 6.16s | 11.0s |
| 21 K+R vs K endgame | 4.4s | 4.4s | 6.16s | 11.0s |

Wall times unchanged. This is **not** "NMP did nothing" — when search is soft-cap saturated (45-Kiwipete) or predictive-stop-bounded (41-Italian, after the retune), NMP doesn't reduce wall time, it lets the engine reach more depth in the same wall time. Without node-count or depth-completed instrumentation, we don't have direct evidence NMP is firing and pruning. We're trusting the implementation here. The agreed acceptance bar (wall time + tactics + tests) is met.

If we wanted real evidence in a future commit: add a `statsNmpFired` counter and a one-shot probe that prints it for a known test position.

### c40c724 — tune: tighten predictive-stop multiplier from 2.5 to 3.0

Isolated tuning commit, no search-shape changes. Addresses the 41-case soft-budget overshoot introduced by the pruning bundle in `34bc5f4`.

- **Date**: 2026-04-13
- **Bytes**: agent.js −16 (27,987 → 27,971). Headroom 2,749 bytes.
- **Tests**: npm test green
- **Tactical sanity**: mate-in-1 Qg7# (980ms) and free-queen Nxb7 (1359ms) — both correctly found.
- **What**: changed the predictive-stop expression in `pickMove`'s iterative-deepening loop from `Math.floor(lastIterMs * 5 / 2)` to `lastIterMs * 3`. Multiplier 2.5 → 3.0. The check is "if I expect the next iteration to land past the soft target, don't start it."
- **Why**: with the pruning bundle live, per-iteration searches are faster, so the previous 2.5× heuristic was too lenient — it allowed iterations to start that then ran past the soft cap. Tightening to 3.0× makes the predictive stop more conservative about starting new iterations near the soft boundary.
- **Why this and not arenaTiming changes**: the 41-case spike was a search-shape artifact (faster iters → more iters allowed → overshoot), not a budget-policy problem. Touching the soft ratios in `arenaTiming` would have changed the targets for all positions across all branching buckets, including positions that were behaving correctly. The predictive-stop term is the localized lever.

#### Acceptance against the stated targets

| Position | Pre-retune | Post-retune | Target | Result |
|----------|-----------:|------------:|--------|--------|
| 45-Kiwipete | 5.6s | 5.6s | ≤ ~5.6s | ✓ |
| 41 Italian middlegame | 6.97s | 2.24s | materially below 6.97s | ✓ |
| 21 K+R vs K endgame | 4.4s | 4.4s | not worse | ✓ |

The 41-case dropped from "overshooting soft by ~800ms" to "using 36% of soft budget." This is intentional headroom — NMP and LMR are next, and they'll make per-iteration searches even faster, allowing more iterations to fit into that recovered budget without compounding the overshoot we just fixed.

### 34bc5f4 — feat: bundle check ext + reverse futility + futility + LMP

Single bundled search-shape pass, shipping items #7, #8, #9, #10 from the harvest plan.

- **Date**: 2026-04-13
- **Bytes**: agent.js +458 (27,529 → 27,987). Headroom 2,733 bytes.
- **Tests**: npm test green
- **Tactical sanity**: mate-in-1 Qg7# (984ms via makeMove path) and free-queen Nxb7 (1351ms) both correctly found.

#### Subitems landed

**#7 Check extensions**
- `const inCheck = isKingInCheck(pos, pos.side)` is now computed once and reused for terminal mate detection AND extension
- `if (inCheck) depth += 1;` extends one ply when side-to-move is in check, before the horizon check fires
- Avoids quiescing out of check, which is unsound (qsearch only considers captures, can miss check-evasion quiets)

**#8 Reverse futility pruning (RFP)**
- Gated on `!inCheck && depth <= 6 && beta < MINMATE`
- If `ev - 100 * depth >= beta`, return `ev` early
- The `beta < MINMATE` guard prevents pruning in mate-bound regions (the point of the mate-shift fix in `b6581ec`)

**#9 Futility pruning (frontier)**
- Inside the move loop, skip quiet moves at depth ≤ 4 when `ev + 120 * depth < alpha`
- Gated on `i > 0` so the first move is always searched (we need at least one value)
- Gated on `alpha > -MINMATE` to avoid pruning escape-from-mate moves

**#10 Late-move pruning (LMP)**
- Inside the move loop, skip quiet moves at depth ≤ 2 past index `4 + depth * 4`
- Same `i > 0` and `alpha > -MINMATE` gates as FP

#### Shared scaffolding for the bundle

- New `ev` variable: `(!inCheck && depth <= 6) ? evaluate(pos) * (pos.side === 'w' ? 1 : -1) : null`. Computed once per node, reused by RFP/FP/LMP. Returns null in branches where pruning won't fire (in check, or depth too deep) so we don't pay for evaluate when we wouldn't use the result.
- Loop refactor: `for (const { move, uci } of ordered)` → `for (let i = 0; i < ordered.length; i++)` to expose move index for FP/LMP gates.

#### Risk notes

- FP/LMP can theoretically prune a quiet sacrifice that leads to mate-in-3+. The `alpha > -MINMATE` guard plus `quiet`-only filter limit this to non-mate-bound centipawn regions. Standard engine trade-off.
- We do NOT detect "move gives check" before pruning. Lozza approximates by skipping pruning on `MOVE_NOISY_MASK` (captures + promotions). We use `isQuiet(pos, move)` which has the same effect for our move representation. A quiet check that isn't a capture/promotion can still be pruned at shallow depth — slight tactical risk, accepted for speed.
- TT interaction with check extensions: extending depth means we probe at the higher depth. Previous entries stored at non-extended depth may not satisfy the `entry.depth >= depth` check and we'll re-search. Slightly wasteful but correct.

#### Timing baseline (3-run median, all stable)

| Position | Pre-bundle | Post-bundle | Soft cap | Hard cap | Notes |
|----------|-----------:|------------:|---------:|---------:|-------|
| 45-Kiwipete | 5.6s | 5.6s | 5.58s | 9.0s | unchanged — was already at soft |
| 41 Italian middlegame | 3.8s | **6.97s** | 6.16s | 11.0s | now overshoots soft by ~800ms |
| 21 K+R vs K endgame | 3.7s | 4.4s | 6.16s | 11.0s | small per-node `evaluate()` overhead |

The 45-case, which was the user's stated stop condition, is **stable**.

The 41-case spike (3.8s → 6.97s) is consistent with successful pruning: faster per-iteration search → predictive-stop allows one more iteration to start → that iteration lands past soft. The bot is now using budget that was previously left on the table. All within hard cap. Tactical probes pass.

**Follow-up worth tracking**: the predictive stop and soft ratio were tuned in `77d20e2` against the pre-pruning behavior. With pruning live, soft is now a target we hit/overshoot rather than a ceiling we rarely approach. May want to either tighten predictive-stop multiplier (currently `lastIterMs * 2.5`) or reduce soft ratios in `arenaTiming`. Not blocking for the bundle; tracking as a tuning task.

### b6581ec — fix: ply-shift mate scores in transposition table
- **Date**: 2026-04-12
- **Bytes**: agent.js +224 (27,305 → 27,529). Headroom 3,191 bytes.
- **Tests**: npm test green; mate-in-1 probe (Qg7# from `6k1/8/6KQ/8/8/8/8/8 w - - 0 1`) found correctly via both stdin and makeMove paths.
- **Why**: previously TT stored and returned raw mate scores. A mate found at ply P was cached as `MATE - P - k` (mate-in-k from this position). Probed at a different ply P', the same value was returned, so the bot believed mate was further or closer than it actually was. Symptom: "mate-in-N" announcements that drift, occasional preference for slower mates over faster ones when both transpose to the same TT entry.
- **What**:
  - New constant `MINMATE = MATE - 1000` separates centipawn scores from mate scores. Search depths never exceed 1000 plies, so this is a safe boundary.
  - `ttStore(key, depth, score, bound, bestUci, ply)`:
    - if `score > MINMATE`: stored = `score + ply` (positive mate condensed to "from-this-node" frame)
    - else if `score < -MINMATE`: stored = `score - ply` (negative mate condensed)
    - else: stored = `score` unchanged
  - `ttProbe(key, depth, alpha, beta, ply)`:
    - reads `entry.score`
    - if `entry.score > MINMATE`: returned = `entry.score - ply` (positive mate re-expanded to "from-root-at-current-ply" frame)
    - else if `entry.score < -MINMATE`: returned = `entry.score + ply`
    - else: returned = `entry.score` unchanged
    - **Critical**: bound checks (`>= beta`, `<= alpha`) use the unwrapped score, not `entry.score` directly. This was a subtle bug-magnet — using `entry.score` for the bound check would compare a "from-this-node" mate value against a "from-root" beta/alpha and either accept wrong cutoffs or miss valid ones.
- **Mate-score normalization happens on both sides**: yes, store and probe both adjust. Adjustments are inverse (store +/-, probe -/+) so a round-trip with the same ply yields the original value, and a round-trip with different store/probe plies yields the correctly-rebased value.
- **Call sites updated**: 3 in `negamax` (probe, LOWER store on cutoff, UPPER/EXACT store on return). All have `ply` in scope. Quiescence does not touch TT and needed no change.
- **Risk**: medium. The bound-check ordering (unwrap before comparing) is the place this can silently break — verified by reading the function body. Existing tests verify legality and overall move selection but don't directly probe TT semantics; mate-in-1 sanity test confirms basic mate recognition still works.
- **Timing effect**: negligible. 3-run median across the three probe positions:
  - 45-Kiwipete: ~5.6s (was ~5.6s post-staged-captures) — unchanged
  - 41 mid-game: ~3.8s (was ~3.8s) — unchanged
  - 21 rook eg: ~3.7s (was ~3.7s) — unchanged
  - Two extra integer comparisons per TT op are below measurement noise.
- **Lozza reference**: src/tt.js:45-71 (ttPut), 75-124 (ttGet). Same algorithm, adapted to caramel_corn's Map-based TT instead of typed-array TT.

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
