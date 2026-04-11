# Submission Report

## Submission summary

- **Participant / team name:** samartin79
- **Final source file:** `agent.js`
- **Model(s) / system(s) used:** Claude Code (Claude Opus 4.6)
- **Short strategy summary:** Iterative-deepening negamax alpha-beta with capture-only quiescence, material + PST evaluation, MVV-LVA move ordering, soft/hard time control (60ms/400ms), deterministic opening book (14 entries), and lexicographic UCI tie-break. No randomness, no external dependencies.

## Prompt log

Chronological record of all prompts given during development. See `prompt-log.md` for full verbatim text.

1. **Fork and baseline setup** — Fork repo, clone, configure remotes, pull latest, run tests, commit baseline.
2. **Material evaluation** — Add deterministic material eval (P=100, N=320, B=330, R=500, Q=900, K=20000) with lexicographic UCI tie-break. Keep parser/movegen intact.
3. **Clean-up: stdin-only input rule and logging** — Remove `node:fs` import, switch to `process.stdin` for FEN input. Create prompt and tool logs. Run banned-API scan.
4. **Piece-square tables** — Add static PST for all 6 piece types. Integrate as `score = material + PST`. Black mirrors via `index ^ 56` rank flip.
5. **Alpha-beta search core** — Negamax with alpha-beta pruning, depth-limited. Terminal: mate score `-(MATE - ply)`, stalemate `0`. Deterministic tie-break preserved.
6. **Patch alpha-beta correctness** — Full-window root search for exact tie-break scores. Added `ply` param for mate-distance scoring. Reduced to depth 3 (full-window cost; iterative deepening reclaims).
7. **Iterative deepening + time management** — Deepens from 1 while time allows. Soft 200ms / hard 800ms via `Date.now()`. ABORT sentinel propagates cleanly. Lexicographic root move order for determinism. Legal fallback if no depth completes.
8. **Patch iterative deepening completion semantics** — ABORT at any root move discards entire depth (no partial results). Hard-deadline guard before starting each new depth. Only fully completed depths update bestMove.
9. **Deterministic move ordering** — MVV-LVA captures first, then checks, then quiet moves. Stable UCI lex tie-break within each bucket. Applied at both root and recursive levels.
10. **Hardening freeze** — 5x test pass, 10x determinism check, legality sweep on 8 diverse FENs, compliance audit, final submission report.
11. **Quiescence search** — Capture-only quiescence at leaf nodes. Stand-pat eval, alpha/beta pruning, en passant captures included. MVV-LVA ordering with stable UCI tie-break. ABORT propagation preserved.
12. **Performance fix** — Removed expensive check detection from move ordering (was calling applyMove+isKingInCheck per quiet move). Tightened time controls to 80ms soft / 400ms hard. Opening position now ~200ms, midgame positions ~120ms.
13. **Submission guardrail timing adjustment** — Committed and pushed immediately to avoid unsubmitted local drift. Set soft/hard controls to 150ms / 600ms for safer headroom under the 1000ms hard cap.
14. **Deterministic opening book** — 14-entry hardcoded book keyed by FEN core (placement/side/castling/ep). Covers d4/e4/c4/Nf3 openings through ~3 moves. Validated against legal moves before use; falls back to search if missing/illegal.
15. **Timing headroom fix** — Tightened to 60ms soft / 400ms hard after audit showed 269-338ms peaks on non-book positions. Improved timing headroom; typical tested positions well below hard cap, though some complex positions may still exceed 250ms target. File size metadata updated.
16. **PV-first and killer move ordering** — PV move from previous depth searched first at root. 2-slot killer heuristic per ply recorded on quiet beta cutoffs. Killers prioritized below captures/promotions, above other quiets. No timing regression (Italian avg 179ms, Sicilian avg 156ms, Castling avg 101ms).
17. **Transposition table** — Bounded 50k-entry TT with FNV-1a position hash. Stores depth/score/bound/bestMoveUci. Depth-preferred replace, FIFO eviction at cap. TT best move gets highest ordering priority. No timing regression (Italian avg 180ms, Sicilian avg 156ms, Castling avg 102ms).

## Tools used

| Tool | How it was used |
| --- | --- |
| Claude Code (Opus 4.6) | All code generation, editing, testing, and compliance checks |
| gh CLI | Fork verification, repo clone with auto-configured remotes |
| npm test | Smoke test suite after each change (run 5x in hardening) |
| ripgrep (via Grep) | Banned-API scans (Math.random, child_process, worker_threads, eval, Function, fs.writeFile, external imports) |
| git | Version control, commits and pushes at each milestone |
| node (direct) | Determinism checks (5x and 10x same-FEN), legality sweep on 8 diverse FENs |
| wc | File size verification (27,277 bytes) |
| ls | Verify single executable source file at repo root |

## Rules compliance checklist

| Item | Yes / No |
| --- | --- |
| The submission has exactly one source file: `agent.js` or `agent.ts` | Yes |
| The agent uses only the Node.js standard library | Yes |
| The agent does not use network access | Yes |
| The agent does not read files outside the submission root | Yes |
| The agent does not start background daemons, subprocesses, worker pools, or child processes | Yes |
| The agent does not use runtime downloads or self-modifying code | Yes |
| The same FEN input always produces the same stdout output | Yes |
| `npm test` passes locally for the included smoke tests | Yes |
| The source file is under `1 MB` | Yes (27,277 bytes) |

## Cut decisions

- **Quiescence search** — implemented (capture-only).
- **Opening book** — implemented (14-entry hardcoded map, d4/e4/c4/Nf3 lines through ~3 moves).
- **Transposition table** — implemented (50k entries, FNV-1a hash, depth-preferred replace).
- **Killer heuristic** — implemented (2-slot per ply, quiet beta cutoffs). History heuristic skipped.
- **Endgame-specific PST** — skipped; single PST set used for all phases.

## Additional notes

- Input reads via `process.stdin` (top-level `for await` in ESM) — no `node:fs` dependency.
- All move ordering is deterministic: MVV-LVA priority with stable UCI lexicographic tie-break within each bucket.
- Full prompt history maintained in `prompt-log.md`.
