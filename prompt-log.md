# Prompt Log

Chronological record of all prompts/instructions given during development.

## 1. Fork and baseline setup

> Fork/setup first: ensure samartin79/vibe-code-cup-challenge1 exists, clone it locally, set origin to your fork and upstream to aj47/vibe-code-cup-challenge1, checkout main, pull latest, and run npm test. If tests fail, fix baseline/test environment only, rerun until green, then commit chore: baseline fork setup and green tests.

## 2. Material evaluation

> Edit only root agent.js. Keep parser and legal move generator intact. Add deterministic material evaluation with P=100,N=320,B=330,R=500,Q=900,K=20000. Integrate into move choice with lexicographic UCI tie-break. Run npm test; if failing, stop and fix before continuing. Commit: feat: material evaluation.

## 3. Clean-up: stdin-only input rule and logging

> Work in /mnt/llmstore/comp/vibe-code-cup-challenge1 only.
>
> Clean-up + back-on-track task (no questions, execute directly):
>
> 1. Keep existing FEN parser and legal move generator logic unchanged.
> 2. Fix rules compliance drift in agent.js input handling:
>    - Remove node:fs stdin read.
>    - Use only process.stdin (or readline) to read one FEN from stdin.
>    - Still print exactly one UCI move or 0000.
> 3. Preserve current deterministic material-eval behavior exactly (no randomness, stable tie-break).
> 4. Logging requirement:
>    - Use prompt-log.md as the canonical prompt file.
>    - Append this user instruction and this execution prompt text to prompt-log.md.
>    - Mirror those prompt entries in submission-report.md under chronological prompt log.
>    - Append tools used in this turn to the tool log section in submission-report.md (and tool-log.md if present).
> 5. Run npm test. If failing, stop feature work and fix until green.
> 6. Run a quick banned-API scan in agent.js for: Math.random, child_process, worker_threads, eval, Function, fs.writeFile.
> 7. Commit if green with: chore: enforce stdin-only input rule and update prompt/tool logs
> 8. Return only: test result, banned-API scan result, changed files, commit SHA, next milestone to execute (PST integration).

## 4. Piece-square tables

> PROMPT 3 — Piece-Square Tables (sequential)
>
> Work in /mnt/llmstore/comp/vibe-code-cup-challenge1 only.
>
> 1. Edit only agent.js.
> 2. Keep existing FEN parser + legal move generator unchanged.
> 3. Add static piece-square tables for p,n,b,r,q,k and integrate into evaluation:
>    - score = material + PST
>    - white uses direct index
>    - black must mirror by rank flip (mirrored = index ^ 56), not file flip
> 4. Preserve deterministic tie-break behavior (lexicographic UCI on equal score).
> 5. Run npm test. If failing, stop and fix before continuing.
> 6. Append this user prompt + this execution prompt to prompt-log.md.
> 7. Mirror prompt entries into submission-report.md chronological prompt log.
> 8. Append tools used in this turn to tool log section (and tool-log.md if present).
> 9. Commit: feat: add piece-square evaluation with mirrored black indexing.
>
> Return only: test result, changed files, commit SHA.

## 5. Alpha-beta search core

> Work in /mnt/llmstore/comp/vibe-code-cup-challenge1 only.
>
> Milestone: deterministic alpha-beta core
>
> 1. Edit only agent.js.
> 2. Keep parser + legal move generator logic unchanged.
> 3. Implement negamax with alpha-beta pruning:
>    - depth-limited search
>    - terminal handling for no legal moves:
>      - in check => mate score (-MATE + ply)
>      - not in check => stalemate score (0)
>    - deterministic tie-break at root: lexicographically smallest UCI on equal score
> 4. Use current eval (material + PST) at leaf nodes.
> 5. Add safe legal fallback move if time/logic exits unexpectedly.
> 6. No randomness, no banned APIs.
> 7. Run npm test; if failing, stop and fix before further work.
> 8. Determinism check: run same FEN 5 times and confirm identical output.
> 9. Append this user prompt + this execution prompt to prompt-log.md.
> 10. Mirror those prompt entries and tool usage in submission-report.md.
> 11. Commit: feat: add deterministic alpha-beta search core.
>
> Return only: test result, determinism check result, changed files, commit SHA.

## 6. Patch alpha-beta correctness

> Patch alpha-beta correctness before iterative deepening.
>
> Work only in /mnt/llmstore/comp/vibe-code-cup-challenge1/agent.js.
>
> 1. Keep parser + legal move generator unchanged.
> 2. Fix root search correctness:
>    - Remove narrow-window call negamax(..., -Infinity, -bestScore) at root.
>    - Use full-window search per root move (-Infinity, Infinity) so returned scores are exact for tie-break decisions.
> 3. Fix mate-distance scoring for future iterative deepening:
>    - Add ply parameter to negamax.
>    - Terminal mate score must be -(MATE - ply).
>    - Increment ply + 1 on recursion.
> 4. Keep deterministic root tie-break by lexicographic UCI.
> 5. Run npm test; if failing, stop and fix.
> 6. Run determinism check on same FEN 5x.
> 7. Update prompt/tool logs in prompt-log.md and submission-report.md.
> 8. Commit message: fix: correct alpha-beta root scoring and mate ply handling.
>
> Return only: test result, determinism result, changed files, commit SHA.

## 7. Iterative deepening + time management

> Work in /mnt/llmstore/comp/vibe-code-cup-challenge1 only.
>
> Milestone: iterative deepening + time management
>
> 1. Edit only agent.js.
> 2. Keep parser + legal move generator unchanged.
> 3. Add iterative deepening at root:
>    - start depth at 1 and increase while time allows.
>    - soft target: 200ms, hard cutoff: 800ms using Date.now().
>    - always keep the best fully-completed depth result.
> 4. Add timeout safety in search:
>    - pass a context with hardDeadlineMs.
>    - if hard deadline is exceeded during search, abort current depth and return last completed depth move.
> 5. Preserve deterministic behavior:
>    - deterministic root move iteration order (lexicographic UCI).
>    - deterministic tie-break unchanged.
> 6. Guarantee legal fallback:
>    - if interrupted/timeout before any completed depth, return a deterministic legal fallback move.
> 7. Run npm test; if failing, stop and fix first.
> 8. Run determinism check on same FEN 5x.
> 9. Update prompt-log.md and submission-report.md with this prompt + tool usage.
> 10. Commit: feat: add iterative deepening with soft/hard time control.
>
> Return only: test result, determinism result, changed files, commit SHA.

## 8. Patch iterative deepening completion semantics

> Work in /mnt/llmstore/comp/vibe-code-cup-challenge1 only.
>
> Patch iterative deepening completion semantics:
>
> 1. Edit only agent.js.
> 2. Keep parser + legal move generator unchanged.
> 3. In searchDepth, if ABORT occurs at any root move, return null (do not return partial depth result).
> 4. In pickMove, update bestMove only when a depth fully completes (non-null result).
> 5. Add hard-deadline guard before starting each new depth iteration.
> 6. Preserve deterministic root ordering and tie-breaks.
> 7. Run npm test; if failing, stop and fix.
> 8. Run same-FEN determinism check x5.
> 9. Update prompt/tool logs in prompt-log.md and submission-report.md.
> 10. Commit: fix: keep only fully completed iterative depths on timeout.
>
> Return only: test result, determinism result, changed files, commit SHA.

## 9. Deterministic move ordering

> Work in /mnt/llmstore/comp/vibe-code-cup-challenge1 only.
>
> Milestone: deterministic move ordering
>
> 1. Edit only agent.js.
> 2. Keep parser + legal move generator unchanged.
> 3. Add deterministic move ordering for search:
>    - captures first (MVV-LVA)
>    - then checking moves
>    - then quiet moves
>    - stable UCI lexicographic tie-break inside each bucket
> 4. Apply ordering in both root move iteration and recursive negamax.
> 5. Preserve timeout behavior and full-depth-only iterative deepening semantics.
> 6. Run npm test; if failing, stop and fix.
> 7. Run same-FEN determinism check x5.
> 8. Update prompt-log.md and submission-report.md with prompt + tool usage.
> 9. Commit: feat: add deterministic move ordering for alpha-beta.
> 10. Push: git push origin main.
>
> Return only: test result, determinism result, changed files, commit SHA.

## 10. Hardening freeze

> Work in /mnt/llmstore/comp/vibe-code-cup-challenge1 only.
>
> Hardening freeze (no new features):
>
> 1. Do not change search behavior except bug fixes.
> 2. Run npm test 5 times in a row; all must pass.
> 3. Determinism check: run same FEN 10 times and confirm identical output.
> 4. Quick legality sanity sweep: run agent on diverse FENs (opening, castling, promotion, en passant, check, no-legal-move) and confirm valid UCI/0000 outputs.
> 5. Compliance checks: only agent.js at root, size < 1MB, no banned APIs, no external imports.
> 6. Update submission-report.md with complete logs and compliance checklist.
> 7. Ensure prompt-log.md and submission-report.md are synchronized.
> 8. Commit: chore: final hardening and submission report.
> 9. Push: git push origin main.
>
> Return only: 5x test results summary, determinism 10x result, compliance check summary, changed files, commit SHA.

## 11. Quiescence search (captures only)

> Work in /mnt/llmstore/comp/vibe-code-cup-challenge1 only.
>
> Milestone: add quiescence search (captures only)
>
> 1. Edit only agent.js.
> 2. Keep parser + legal move generator unchanged.
> 3. Add capture-only quiescence at leaf nodes:
>    - In negamax, when depth <= 0, call quiescence(pos, alpha, beta, ply, deadline) instead of static eval.
>    - quiescence must: return ABORT on hard deadline hit, compute stand-pat score, apply alpha/beta, search only legal capture moves (include en passant), be deterministic.
> 4. Preserve existing iterative deepening timeout semantics.
> 5. No randomness, no banned APIs/imports.
> 6. Run npm test 5 times; all must pass.
> 7. Run same-FEN determinism check 10x.
> 8. Update prompt-log.md and submission-report.md.
> 9. Commit: feat: add capture-only quiescence search.
> 10. Push: git push origin main.
>
> Return only: 5x test summary, determinism 10x result, changed files, commit SHA.

## 12. Performance fix (audit response)

> Audit findings: timing ~825ms on opening (above 250ms target, near 1000ms hard cap), stale file size in report.
>
> Fixes applied:
> 1. Removed check detection from move ordering (was calling applyMove+isKingInCheck per quiet move — main bottleneck).
> 2. Tightened time controls: SOFT_MS 200→80, HARD_MS 800→400.
> 3. Updated file size in submission-report.md (20,894→21,769 bytes).
> 4. Verified: opening ~200ms, midgame ~120ms, all positions under 250ms target.

## 13. Submission guardrail timing adjustment

> Two issues. Fix in this order:
> 1. Commit and push NOW. Uncomitted code doesn't exist on GitHub.
> 2. Timing — 825ms average on opening positions is dangerous.
>    Reduce soft target from 200ms to 150ms and hard cutoff from 800ms to 600ms.
>    Trade one ply of depth for never timing out.
>    Fix timing FIRST, then commit, then push, then update report metadata.
